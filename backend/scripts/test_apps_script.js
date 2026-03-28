require('dotenv').config();

const readEnv = (name, fallback = '') => {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  return String(raw).trim();
};

const maskUrl = (value) => {
  if (!value) return '';
  return value.length <= 14 ? '***' : `${value.slice(0, 10)}...${value.slice(-4)}`;
};

const main = async () => {
  const webhookUrl = readEnv('APPS_SCRIPT_WEBHOOK_URL');
  const secret = readEnv('APPS_SCRIPT_WEBHOOK_SECRET');

  if (!webhookUrl) {
    throw new Error('APPS_SCRIPT_WEBHOOK_URL belum diisi');
  }

  if (!secret) {
    throw new Error('APPS_SCRIPT_WEBHOOK_SECRET belum diisi');
  }

  const testTo = readEnv('APPS_SCRIPT_TEST_TO') || readEnv('SMTP_USER') || readEnv('ADMIN_EMAIL');
  if (!testTo) {
    throw new Error('Isi APPS_SCRIPT_TEST_TO (atau SMTP_USER/ADMIN_EMAIL) untuk alamat email uji');
  }

  const payload = {
    to: [testTo],
    subject: `[Studigi] Apps Script Test ${new Date().toISOString()}`,
    text: 'Ini email test jalur Apps Script dari backend Studigi.',
    html: '<p>Ini email <strong>test</strong> jalur Apps Script dari backend Studigi.</p>',
    from: readEnv('MAIL_FROM') || 'Studigi <no-reply@studigi.local>',
    secret,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mail-secret': secret,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch (_) {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} | body: ${bodyText}`);
  }

  if (parsed && parsed.ok === false) {
    throw new Error(`Apps Script returned ok=false | ${parsed.error || parsed.message || bodyText}`);
  }

  console.log('[APPS_SCRIPT_TEST] OK', {
    webhook: maskUrl(webhookUrl),
    to: testTo,
    responseStatus: response.status,
    payloadOk: parsed ? parsed.ok !== false : true,
  });
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[APPS_SCRIPT_TEST] FAILED', {
      message: err?.message || 'Unknown error',
    });
    process.exit(1);
  });
