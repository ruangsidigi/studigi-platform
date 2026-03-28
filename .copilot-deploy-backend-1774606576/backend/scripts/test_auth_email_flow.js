require('dotenv').config();

const axios = require('axios');

const readEnv = (name, fallback = '') => {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return fallback;
  return String(raw).trim();
};

const baseUrl = (readEnv('AUTH_TEST_BASE_URL') || readEnv('API_BASE_URL') || 'http://localhost:5000/api').replace(/\/$/, '');
const password = readEnv('AUTH_TEST_PASSWORD', 'password123');
const name = readEnv('AUTH_TEST_NAME', 'Flow Test User');
const emailDomain = readEnv('AUTH_TEST_EMAIL_DOMAIN', 'example.com');

const makeEmail = () => {
  const stamp = Date.now();
  return `flowtest+${stamp}@${emailDomain}`;
};

const requestJson = async (method, path, payload) => {
  const url = `${baseUrl}${path}`;
  try {
    const response = await axios({
      method,
      url,
      data: payload,
      timeout: 30000,
      validateStatus: () => true,
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {
        error: err?.message || 'Request failed',
      },
    };
  }
};

const main = async () => {
  const email = makeEmail();
  const summary = {
    baseUrl,
    email,
    steps: [],
    success: true,
  };

  const registerResult = await requestJson('post', '/auth/register', { email, password, name });
  summary.steps.push({ step: 'register', ...registerResult });
  if (!registerResult.ok) summary.success = false;

  const loginResult = await requestJson('post', '/auth/login', { email, password });
  summary.steps.push({ step: 'login_before_verify', ...loginResult });
  const loginBlockedAsExpected = loginResult.status === 403;
  if (!loginBlockedAsExpected) summary.success = false;

  const resendResult = await requestJson('post', '/auth/resend-verification', { email });
  summary.steps.push({ step: 'resend_verification', ...resendResult });
  if (!resendResult.ok) summary.success = false;

  const forgotResult = await requestJson('post', '/auth/forgot-password', { email });
  summary.steps.push({ step: 'forgot_password', ...forgotResult });
  if (!forgotResult.ok) summary.success = false;

  console.log('[AUTH_FLOW_TEST] RESULT');
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.success) {
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error('[AUTH_FLOW_TEST] FAILED', err?.message || err);
  process.exit(1);
});
