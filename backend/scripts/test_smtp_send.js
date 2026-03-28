require('dotenv').config();
const nodemailer = require('nodemailer');

const readEnv = (name, fallback = '') => {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  return String(raw).trim();
};

const readEnvBool = (name, fallback = false) => {
  const raw = readEnv(name, String(fallback));
  const lowered = raw.toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(lowered)) return false;
  return fallback;
};

const readEnvNum = (name, fallback) => {
  const value = Number(readEnv(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
};

const createTransporter = () => {
  const smtpUrl = readEnv('SMTP_URL');
  if (smtpUrl) {
    return nodemailer.createTransport(smtpUrl, {
      connectionTimeout: readEnvNum('SMTP_CONNECTION_TIMEOUT_MS', 10000),
      greetingTimeout: readEnvNum('SMTP_GREETING_TIMEOUT_MS', 10000),
      socketTimeout: readEnvNum('SMTP_SOCKET_TIMEOUT_MS', 15000),
      dnsTimeout: readEnvNum('SMTP_DNS_TIMEOUT_MS', 10000),
    });
  }

  const host = readEnv('SMTP_HOST');
  const port = readEnvNum('SMTP_PORT', 587);
  const secure = readEnvBool('SMTP_SECURE', false);
  const user = readEnv('SMTP_USER');
  const pass = readEnv('SMTP_PASS');

  if (!host) throw new Error('SMTP_HOST belum diisi');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: readEnvNum('SMTP_CONNECTION_TIMEOUT_MS', 10000),
    greetingTimeout: readEnvNum('SMTP_GREETING_TIMEOUT_MS', 10000),
    socketTimeout: readEnvNum('SMTP_SOCKET_TIMEOUT_MS', 15000),
    dnsTimeout: readEnvNum('SMTP_DNS_TIMEOUT_MS', 10000),
    tls: {
      minVersion: 'TLSv1.2',
      servername: host,
    },
    auth: user || pass ? { user, pass } : undefined,
  });
};

const main = async () => {
  const to = readEnv('SMTP_TEST_TO') || readEnv('ADMIN_EMAIL') || readEnv('SMTP_USER');
  const from = readEnv('MAIL_FROM') || readEnv('SMTP_FROM') || readEnv('SMTP_USER');

  if (!to) throw new Error('Isi SMTP_TEST_TO (atau ADMIN_EMAIL/SMTP_USER)');
  if (!from) throw new Error('Isi MAIL_FROM (atau SMTP_FROM/SMTP_USER)');

  const transporter = createTransporter();
  await transporter.verify();

  const result = await transporter.sendMail({
    from,
    to,
    subject: `[Studigi] SMTP send test ${new Date().toISOString()}`,
    text: 'Ini email test SMTP dari backend Studigi.',
    html: '<p>Ini email <strong>test SMTP</strong> dari backend Studigi.</p>',
  });

  console.log('[SMTP_SEND_TEST] OK', {
    messageId: result?.messageId || null,
    accepted: result?.accepted || [],
    rejected: result?.rejected || [],
    response: result?.response || null,
  });
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SMTP_SEND_TEST] FAILED', {
      code: err?.code || 'UNKNOWN_CODE',
      message: err?.message || 'Unknown error',
      response: err?.response || null,
      command: err?.command || null,
    });
    process.exit(1);
  });
