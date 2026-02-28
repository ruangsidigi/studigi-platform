// backend/services/auth/index.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../../shared/config');

const router = express.Router();

let authSchemaInitPromise = null;

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const readEnv = (name, fallback = '') => {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  return String(raw).trim();
};

const readEnvBool = (name, fallback = false) => {
  const raw = readEnv(name, String(fallback));
  if (!raw) return fallback;
  const lowered = raw.toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(lowered)) return false;
  return fallback;
};

const readEnvNum = (name, fallback) => {
  const raw = readEnv(name, String(fallback));
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const getFrontendBaseUrl = () => {
  const url =
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  return String(url).replace(/\/$/, '');
};

const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const createRawToken = () => crypto.randomBytes(32).toString('hex');

const ensureAuthSchema = async (db) => {
  if (!authSchemaInitPromise) {
    authSchemaInitPromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NULL,
          email VARCHAR(255) NOT NULL,
          purpose VARCHAR(50) NOT NULL,
          token_hash VARCHAR(128) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query('CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_purpose ON auth_tokens(email, purpose)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash)');

      try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL');
      } catch (_) {
        // schema drift fallback handled in runtime checks
      }
    })();
  }

  try {
    await authSchemaInitPromise;
  } catch (_) {
    authSchemaInitPromise = null;
  }
};

const hasColumn = async (db, tableName, columnName) => {
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(result.rows?.[0]);
};

const buildEmailTransporter = (overrides = {}) => {
  const smtpUrl = readEnv('SMTP_URL');
  const timeoutOptions = {
    connectionTimeout: readEnvNum('SMTP_CONNECTION_TIMEOUT_MS', 10000),
    greetingTimeout: readEnvNum('SMTP_GREETING_TIMEOUT_MS', 10000),
    socketTimeout: readEnvNum('SMTP_SOCKET_TIMEOUT_MS', 15000),
    dnsTimeout: readEnvNum('SMTP_DNS_TIMEOUT_MS', 10000),
  };

  if (smtpUrl && !overrides.forceHostMode) return nodemailer.createTransport(smtpUrl, timeoutOptions);

  const smtpHost = (overrides.host || readEnv('SMTP_HOST')).trim();
  if (!smtpHost) return null;

  const smtpPort = Number(overrides.port || readEnvNum('SMTP_PORT', 587));
  const smtpSecure =
    typeof overrides.secure === 'boolean'
      ? overrides.secure
      : readEnvBool('SMTP_SECURE', false);

  const smtpUser = readEnv('SMTP_USER');
  const smtpPass = readEnv('SMTP_PASS');

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    ...timeoutOptions,
    requireTLS: !smtpSecure,
    tls: {
      minVersion: 'TLSv1.2',
      servername: smtpHost,
    },
    auth:
      smtpUser || smtpPass
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
  });
};

const sendAuthEmail = async ({ to, subject, html, text }) => {
  const transporter = buildEmailTransporter();
  const resendApiKey = readEnv('RESEND_API_KEY');
  const from = readEnv('MAIL_FROM') || readEnv('SMTP_FROM') || readEnv('RESEND_FROM') || 'no-reply@studigi.local';

  const sendViaResend = async () => {
    if (!resendApiKey) return { delivered: false, error: 'Resend API key not configured' };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          delivered: false,
          error: payload?.message || payload?.error || `Resend HTTP ${response.status}`,
        };
      }

      return { delivered: true };
    } catch (err) {
      return { delivered: false, error: err?.message || 'Resend request failed' };
    }
  };

  if (!transporter) {
    return sendViaResend();
  }
  try {
    await transporter.sendMail({ from, to, subject, html, text });
    return { delivered: true };
  } catch (error) {
    const primaryError = error?.message || 'Failed to send email';
    const primaryCode = error?.code;
    const primaryResponse = error?.response;

    const smtpHost = readEnv('SMTP_HOST').toLowerCase();
    const isGmailHost = smtpHost === 'smtp.gmail.com';
    const usingSmtpUrl = Boolean(readEnv('SMTP_URL'));

    if (isGmailHost && !usingSmtpUrl) {
      const currentPort = readEnvNum('SMTP_PORT', 587);
      const currentSecure = readEnvBool('SMTP_SECURE', false);
      const retryPlans = [
        { port: 587, secure: false },
        { port: 465, secure: true },
      ].filter((plan) => !(plan.port === currentPort && plan.secure === currentSecure));

      for (const plan of retryPlans) {
        try {
          const retryTransporter = buildEmailTransporter({
            forceHostMode: true,
            host: readEnv('SMTP_HOST'),
            port: plan.port,
            secure: plan.secure,
          });
          await retryTransporter.sendMail({ from, to, subject, html, text });
          console.log(`[AUTH][MAIL_RETRY_OK] ${to} via ${readEnv('SMTP_HOST')}:${plan.port} secure=${plan.secure}`);
          return { delivered: true };
        } catch (retryError) {
          console.error(
            `[AUTH][MAIL_RETRY_FAIL] ${to} via ${readEnv('SMTP_HOST')}:${plan.port} secure=${plan.secure}: ${retryError?.code || 'UNKNOWN_CODE'} ${retryError?.message || 'unknown error'}`
          );
        }
      }
    }

    const resendResult = await sendViaResend();
    if (resendResult.delivered) {
      console.log(`[AUTH][MAIL_FALLBACK] ${to} delivered via Resend API after SMTP failure`);
      return resendResult;
    }

    const hints = [];
    if (isGmailHost) {
      hints.push('Pastikan SMTP_PASS adalah Gmail App Password 16 karakter tanpa spasi.');
      hints.push('Gunakan salah satu pasangan: SMTP_PORT=587 + SMTP_SECURE=false, atau SMTP_PORT=465 + SMTP_SECURE=true.');
    }
    if (String(process.env.VERCEL || '').toLowerCase() === '1') {
      hints.push('Jika backend berjalan di Vercel serverless dan SMTP gagal, pertimbangkan RESEND_API_KEY sebagai jalur kirim utama.');
    }

    const joinedHint = hints.length ? ` Hint: ${hints.join(' ')}` : '';
    const detailedError = [primaryCode, primaryError, primaryResponse].filter(Boolean).join(' | ');

    return { delivered: false, error: `${detailedError || primaryError}${joinedHint}` };
  }
};

const sendVerificationEmailForUser = async ({ db, user, displayName }) => {
  const verificationToken = createRawToken();
  const verificationLink = `${getFrontendBaseUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  await saveAuthToken({
    db,
    userId: user.id,
    email: user.email,
    purpose: 'verify_email',
    tokenHash: hashToken(verificationToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const mailResult = await sendAuthEmail({
    to: user.email,
    subject: 'Konfirmasi email akun Studigi',
    text: `Halo ${displayName},\n\nKlik link berikut untuk verifikasi email akun kamu:\n${verificationLink}\n\nLink berlaku 24 jam.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>Konfirmasi Email Akun Studigi</h2>
        <p>Halo <strong>${String(displayName || 'Peserta')}</strong>,</p>
        <p>Silakan klik tombol berikut untuk mengaktifkan akun kamu:</p>
        <p>
          <a href="${verificationLink}" style="display:inline-block;padding:10px 16px;background:#103c21;color:#fff;text-decoration:none;border-radius:6px;">
            Verifikasi Email
          </a>
        </p>
        <p>Jika tombol tidak berfungsi, salin link ini:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>Link berlaku selama 24 jam.</p>
      </div>
    `,
  });

  if (!mailResult.delivered) {
    console.error(`[AUTH][VERIFY][MAIL_ERROR] ${user.email}: ${mailResult.error || 'unknown error'}`);
    if (!isProduction) {
      console.log(`[AUTH][VERIFY] ${user.email} -> ${verificationLink}`);
    }
  }

  return {
    ...mailResult,
    verificationLink,
  };
};

const getUserByEmail = async (db, email) => {
  const result = await db.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
  return result.rows?.[0] || null;
};

const saveAuthToken = async ({ db, userId, email, purpose, tokenHash, expiresAt }) => {
  await db.query(
    `INSERT INTO auth_tokens (user_id, email, purpose, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId || null, email, purpose, tokenHash, expiresAt]
  );
};

const readValidToken = async ({ db, token, purpose }) => {
  const tokenHash = hashToken(token);
  const result = await db.query(
    `SELECT *
     FROM auth_tokens
     WHERE token_hash = $1
       AND purpose = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [tokenHash, purpose]
  );
  return result.rows?.[0] || null;
};

const markTokenUsed = async (db, tokenId) => {
  await db.query('UPDATE auth_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
};

const updateUserPassword = async ({ db, userId, hashedPassword }) => {
  const attempts = [
    {
      text: 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      values: [hashedPassword, userId],
    },
    {
      text: 'UPDATE users SET password_hash = $1 WHERE id = $2',
      values: [hashedPassword, userId],
    },
    {
      text: 'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      values: [hashedPassword, userId],
    },
    {
      text: 'UPDATE users SET password = $1 WHERE id = $2',
      values: [hashedPassword, userId],
    },
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      await db.query(attempt.text, attempt.values);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to update password');
};

const setUserEmailVerified = async ({ db, userId }) => {
  const attempts = [
    {
      text: 'UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1',
      values: [userId],
    },
    {
      text: 'UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = $1',
      values: [userId],
    },
    {
      text: 'UPDATE users SET email_verified = TRUE WHERE id = $1',
      values: [userId],
    },
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      await db.query(attempt.text, attempt.values);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to verify email');
};

// POST /auth/register (mounted under /api)
router.post('/auth/register', async (req, res, next) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  const db = req.app.locals.db;

  try {
    await ensureAuthSchema(db);

    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (existing.rows?.[0]) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let inserted;

    const insertAttempts = [
      {
         text: `INSERT INTO users (email, password_hash, display_name, email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, FALSE, NOW(), NOW())
               RETURNING id, email, display_name, created_at`,
        values: [email, hashedPassword, name],
      },
      {
         text: `INSERT INTO users (email, password_hash, display_name, email_verified, created_at)
           VALUES ($1, $2, $3, FALSE, NOW())
               RETURNING id, email, display_name, created_at`,
        values: [email, hashedPassword, name],
      },
      {
         text: `INSERT INTO users (email, password, name, role, email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, 'user', FALSE, NOW(), NOW())
               RETURNING id, email, name, role, created_at`,
        values: [email, hashedPassword, name],
      },
      {
         text: `INSERT INTO users (email, password, name, role, email_verified, created_at)
           VALUES ($1, $2, $3, 'user', FALSE, NOW())
               RETURNING id, email, name, role, created_at`,
        values: [email, hashedPassword, name],
      },
      {
        text: `INSERT INTO users (email, password, name, created_at)
               VALUES ($1, $2, $3, NOW())
               RETURNING id, email, name, created_at`,
        values: [email, hashedPassword, name],
      },
    ];

    let lastInsertError;
    for (const attempt of insertAttempts) {
      try {
        inserted = await db.query(attempt.text, attempt.values);
        if (inserted?.rows?.[0]) break;
      } catch (insertErr) {
        lastInsertError = insertErr;
      }
    }

    if (!inserted?.rows?.[0]) {
      throw lastInsertError || new Error('Failed to create user');
    }

    const user = inserted.rows?.[0];
    if (!user) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    try {
      const userRole = await db.query(`SELECT id FROM roles WHERE name = 'user' LIMIT 1`);
      if (userRole.rows?.[0]?.id) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [user.id, userRole.rows[0].id]
        );
      }
    } catch (_) {
      // optional role mapping for schema that has roles table
    }

    const mailResult = await sendVerificationEmailForUser({
      db,
      user,
      displayName: user.display_name || user.name || name,
    });

    return res.status(201).json({
      message: mailResult.delivered
        ? 'Registrasi berhasil. Silakan cek email untuk verifikasi akun sebelum login.'
        : 'Registrasi berhasil, tetapi email verifikasi gagal dikirim. Coba Kirim Ulang Verifikasi dari halaman login.',
      ...(mailResult.delivered || isProduction ? {} : { debugVerificationLink: mailResult.verificationLink }),
    });
  } catch (err) {
    if (err && err.message && err.message.toLowerCase().includes('db unavailable')) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

  const db = req.app.locals.db;
  try {
    await ensureAuthSchema(db);

    const user = await getUserByEmail(db, email);
    if (!user) {
      return res.json({ message: 'Jika akun terdaftar, email verifikasi akan dikirim ulang.' });
    }

    const hasEmailVerifiedColumn = await hasColumn(db, 'users', 'email_verified');
    if (hasEmailVerifiedColumn && Boolean(user.email_verified)) {
      return res.json({ message: 'Email sudah terverifikasi. Silakan login.' });
    }

    const mailResult = await sendVerificationEmailForUser({
      db,
      user,
      displayName: user.display_name || user.name || user.email,
    });

    return res.json({
      message: mailResult.delivered
        ? 'Email verifikasi berhasil dikirim ulang.'
        : 'Permintaan diterima, tetapi email verifikasi gagal dikirim. Coba beberapa saat lagi.',
      ...(mailResult.delivered || isProduction ? {} : { debugVerificationLink: mailResult.verificationLink }),
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.post('/auth/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token verifikasi tidak valid' });

  const db = req.app.locals.db;
  try {
    await ensureAuthSchema(db);
    const tokenRow = await readValidToken({ db, token, purpose: 'verify_email' });
    if (!tokenRow) return res.status(400).json({ error: 'Link verifikasi tidak valid atau kedaluwarsa' });

    await setUserEmailVerified({ db, userId: tokenRow.user_id });
    await markTokenUsed(db, tokenRow.id);

    return res.json({ message: 'Email berhasil diverifikasi. Silakan login.' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

  const db = req.app.locals.db;
  try {
    await ensureAuthSchema(db);

    const user = await getUserByEmail(db, email);
    if (!user) {
      return res.json({ message: 'Jika email terdaftar, link reset password akan dikirim.' });
    }

    const resetToken = createRawToken();
    const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
    await saveAuthToken({
      db,
      userId: user.id,
      email: user.email,
      purpose: 'reset_password',
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const mailResult = await sendAuthEmail({
      to: user.email,
      subject: 'Reset password akun Studigi',
      text: `Kami menerima permintaan reset password. Klik link berikut:\n${resetLink}\n\nLink berlaku 1 jam.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>Reset Password Studigi</h2>
          <p>Kami menerima permintaan reset password untuk akun kamu.</p>
          <p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#103c21;color:#fff;text-decoration:none;border-radius:6px;">
              Reset Password
            </a>
          </p>
          <p>Jika tombol tidak berfungsi, salin link ini:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Link berlaku selama 1 jam.</p>
        </div>
      `,
    });

    if (!mailResult.delivered) {
      console.error(`[AUTH][RESET][MAIL_ERROR] ${user.email}: ${mailResult.error || 'unknown error'}`);
      if (!isProduction) {
        console.log(`[AUTH][RESET] ${user.email} -> ${resetLink}`);
      }
    }

    return res.json({
      message: mailResult.delivered
        ? 'Jika email terdaftar, link reset password akan dikirim.'
        : 'Permintaan diterima, tetapi pengiriman email reset sedang bermasalah. Coba lagi beberapa saat.',
      ...(mailResult.delivered || isProduction ? {} : { debugResetLink: resetLink }),
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token reset tidak valid' });
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  const db = req.app.locals.db;
  try {
    await ensureAuthSchema(db);

    const tokenRow = await readValidToken({ db, token, purpose: 'reset_password' });
    if (!tokenRow) return res.status(400).json({ error: 'Link reset tidak valid atau kedaluwarsa' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateUserPassword({ db, userId: tokenRow.user_id, hashedPassword });
    await markTokenUsed(db, tokenRow.id);
    await db.query(
      `UPDATE auth_tokens SET used_at = NOW()
       WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL`,
      [tokenRow.user_id]
    );

    return res.json({ message: 'Password berhasil direset. Silakan login.' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

// POST /auth/login (mounted under /api)
router.post('/auth/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const db = req.app.locals.db;
  const jwtSecret = config.jwtSecret || config.jwtSecretFallback;
  try {
    await ensureAuthSchema(db);

    const user = await getUserByEmail(db, email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const storedHash = user.password_hash || user.password || '';
    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    let role = user.role || 'user';
    try {
      const roleResult = await db.query(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1
         ORDER BY r.name = 'admin' DESC, r.name ASC
         LIMIT 1`,
        [user.id]
      );
      if (roleResult.rows[0]?.name) role = roleResult.rows[0].name;
    } catch (_) {
      role = user.role || 'user';
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
    const isAdminByEmail = String(user.email || '').toLowerCase() === adminEmail;
    if (isAdminByEmail) {
      role = 'admin';
    }

    let emailVerified = true;
    try {
      const hasEmailVerifiedColumn = await hasColumn(db, 'users', 'email_verified');
      if (hasEmailVerifiedColumn) {
        emailVerified = Boolean(user.email_verified);
      }
    } catch (_) {
      emailVerified = true;
    }

    if (!isAdminByEmail && role !== 'admin' && !emailVerified) {
      return res.status(403).json({ error: 'Email belum diverifikasi. Cek email konfirmasi terlebih dahulu.' });
    }

    const token = jwt.sign({ sub: user.id, id: user.id, email: user.email, role }, jwtSecret, { expiresIn: '7d' });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.name || user.email,
        role,
      },
    });
  } catch (err) {
    // handle DB unavailable or other errors gracefully
    if (err && err.message && err.message.toLowerCase().includes('db unavailable')) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    return next(err);
  }
});

module.exports = router;
