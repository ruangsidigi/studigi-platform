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

const main = async () => {
  const smtpUrl = readEnv('SMTP_URL');
  const from = readEnv('MAIL_FROM') || readEnv('SMTP_FROM') || readEnv('SMTP_USER');

  let transporter;
  if (smtpUrl) {
    transporter = nodemailer.createTransport(smtpUrl, {
      connectionTimeout: readEnvNum('SMTP_CONNECTION_TIMEOUT_MS', 10000),
      greetingTimeout: readEnvNum('SMTP_GREETING_TIMEOUT_MS', 10000),
      socketTimeout: readEnvNum('SMTP_SOCKET_TIMEOUT_MS', 15000),
      dnsTimeout: readEnvNum('SMTP_DNS_TIMEOUT_MS', 10000),
    });
  } else {
    const host = readEnv('SMTP_HOST');
    const port = readEnvNum('SMTP_PORT', 587);
    const secure = readEnvBool('SMTP_SECURE', false);
    const user = readEnv('SMTP_USER');
    const pass = readEnv('SMTP_PASS');

    if (!host) {
      throw new Error('SMTP_HOST belum diisi');
    }

    transporter = nodemailer.createTransport({
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
  }

  await transporter.verify();
  console.log('[SMTP_TEST] verify OK', {
    host: readEnv('SMTP_HOST') || '(from SMTP_URL)',
    port: readEnv('SMTP_PORT') || '(from SMTP_URL)',
    secure: readEnv('SMTP_SECURE') || '(from SMTP_URL)',
    smtpUserSet: Boolean(readEnv('SMTP_USER')),
    smtpPassSet: Boolean(readEnv('SMTP_PASS')),
    fromSet: Boolean(from),
  });
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SMTP_TEST] verify FAILED', {
      code: err?.code || 'UNKNOWN_CODE',
      message: err?.message || 'Unknown error',
      response: err?.response || null,
    });
    process.exit(1);
  });
