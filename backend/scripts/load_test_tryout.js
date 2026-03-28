require('dotenv').config();
const axios = require('axios');

const BASE_URL = (process.env.LOAD_TEST_BASE_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const TOTAL_USERS = Math.max(1, Number(process.env.LOAD_TEST_USERS || 100));
const QUESTIONS_LIMIT = Math.max(0, Number(process.env.LOAD_TEST_QUESTIONS_LIMIT || 10));
const PACKAGE_ID = process.env.LOAD_TEST_PACKAGE_ID ? Number(process.env.LOAD_TEST_PACKAGE_ID) : null;
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'LoadTest123!';
const PARTICIPANT_PROVINCE = process.env.LOAD_TEST_PROVINCE || 'Lampung';
const PARTICIPANT_NAME_PREFIX = process.env.LOAD_TEST_NAME_PREFIX || 'Load Test User';
const RUN_ID = String(process.env.LOAD_TEST_RUN_ID || 'prod100').trim();
const EMAIL_DOMAIN = process.env.LOAD_TEST_EMAIL_DOMAIN || 'example.com';
const SKIP_REGISTER = String(process.env.LOAD_TEST_SKIP_REGISTER || 'false').toLowerCase() === 'true';
const PURCHASE_BEFORE_START = String(process.env.LOAD_TEST_CREATE_PURCHASE || 'true').toLowerCase() !== 'false';
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.LOAD_TEST_REQUEST_DELAY_MS || 5));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const metrics = {
  startedAt: Date.now(),
  completedUsers: 0,
  failedUsers: 0,
  stepFailures: {
    register: 0,
    login: 0,
    packageLookup: 0,
    purchase: 0,
    startTryout: 0,
    submitAnswer: 0,
    finishTryout: 0,
  },
  samples: [],
};

let chosenPackagePromise = null;

const log = (...args) => console.log('[load-test]', ...args);

const createUserIdentity = (index) => {
  const stamp = `${RUN_ID}.${String(index + 1).padStart(3, '0')}`;
  return {
    email: `loadtest.${stamp}@${EMAIL_DOMAIN}`,
    password: PASSWORD,
    name: `${PARTICIPANT_NAME_PREFIX} ${index + 1}`,
  };
};

const getAxiosError = (error) => {
  if (error.response) {
    return `HTTP ${error.response.status}: ${JSON.stringify(error.response.data || {})}`;
  }
  return error.message || String(error);
};

const choosePackage = async (authHeaders) => {
  if (PACKAGE_ID) return { id: PACKAGE_ID };

  const packageRes = await axios.get(`${BASE_URL}/packages`, authHeaders);
  const packages = Array.isArray(packageRes.data) ? packageRes.data : [];
  for (const pkg of packages) {
    try {
      const questionsRes = await axios.get(`${BASE_URL}/questions/package/${pkg.id}`, authHeaders);
      if (Array.isArray(questionsRes.data) && questionsRes.data.length > 0) {
        return pkg;
      }
    } catch (_) {}
  }

  throw new Error('Tidak ditemukan paket dengan soal. Set LOAD_TEST_PACKAGE_ID.');
};

const getChosenPackage = async (authHeaders) => {
  if (!chosenPackagePromise) {
    chosenPackagePromise = choosePackage(authHeaders);
  }
  return chosenPackagePromise;
};

const submitAnswers = async (sessionId, packageId, authHeaders) => {
  const questionsRes = await axios.get(`${BASE_URL}/questions/package/${packageId}`, authHeaders);
  const questions = Array.isArray(questionsRes.data) ? questionsRes.data : [];
  const selectedQuestions = QUESTIONS_LIMIT > 0 ? questions.slice(0, QUESTIONS_LIMIT) : questions;

  for (const question of selectedQuestions) {
    const category = String(question.category || '').toUpperCase();
    let selectedAnswer = String(question.correct_answer || 'A').toUpperCase();

    if (category === 'TKP') {
      const candidates = ['A', 'B', 'C', 'D', 'E'];
      selectedAnswer = candidates.find((option) => question[`option_${option.toLowerCase()}`]) || 'A';
    }

    await axios.post(
      `${BASE_URL}/tryouts/submit-answer`,
      {
        sessionId,
        questionId: question.id,
        selectedAnswer,
      },
      authHeaders
    );

    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  }

  return selectedQuestions.length;
};

const runUserFlow = async (index) => {
  const identity = createUserIdentity(index);
  const startedAt = Date.now();

  try {
    if (!SKIP_REGISTER) {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: identity.email,
        password: identity.password,
        name: identity.name,
      }).catch(() => {});
    }

    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: identity.email,
      password: identity.password,
    });

    const token = loginRes.data?.token;
    if (!token) throw new Error('Token login tidak tersedia');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const pkg = await getChosenPackage(authHeaders);
    if (!pkg?.id) throw new Error('Package id tidak tersedia');

    if (PURCHASE_BEFORE_START) {
      const packagePrice = Number(pkg.price || 0);
      await axios.post(
        `${BASE_URL}/purchases`,
        { packageIds: [pkg.id], totalPrice: packagePrice },
        authHeaders
      );
    }

    const startRes = await axios.post(
      `${BASE_URL}/tryouts/start`,
      {
        packageId: pkg.id,
        participantName: identity.name,
        participantProvince: PARTICIPANT_PROVINCE,
      },
      authHeaders
    );

    const sessionId = startRes.data?.session?.id;
    if (!sessionId) throw new Error('Session id tidak tersedia');

    const answeredCount = await submitAnswers(sessionId, pkg.id, authHeaders);

    await axios.post(`${BASE_URL}/tryouts/finish`, { sessionId }, authHeaders);

    metrics.completedUsers += 1;
    metrics.samples.push({
      email: identity.email,
      packageId: pkg.id,
      answeredCount,
      durationMs: Date.now() - startedAt,
      status: 'success',
    });
  } catch (error) {
    const message = getAxiosError(error);
    metrics.failedUsers += 1;
    metrics.samples.push({
      email: identity.email,
      durationMs: Date.now() - startedAt,
      status: 'failed',
      error: message,
    });

    if (/register/i.test(message)) metrics.stepFailures.register += 1;
    else if (/token login|login|401|403/i.test(message)) metrics.stepFailures.login += 1;
    else if (/paket|package/i.test(message)) metrics.stepFailures.packageLookup += 1;
    else if (/purchase|akses/i.test(message)) metrics.stepFailures.purchase += 1;
    else if (/Nama peserta|Provinsi|tryout session started|start/i.test(message)) metrics.stepFailures.startTryout += 1;
    else if (/submit-answer|question|Answer submitted/i.test(message)) metrics.stepFailures.submitAnswer += 1;
    else metrics.stepFailures.finishTryout += 1;
  }
};

const summarize = () => {
  const elapsedMs = Date.now() - metrics.startedAt;
  const durations = metrics.samples.filter((item) => item.status === 'success').map((item) => item.durationMs);
  const averageDurationMs = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;
  const maxDurationMs = durations.length ? Math.max(...durations) : 0;

  return {
    baseUrl: BASE_URL,
    totalUsers: TOTAL_USERS,
    questionsLimit: QUESTIONS_LIMIT,
    purchaseBeforeStart: PURCHASE_BEFORE_START,
    elapsedMs,
    completedUsers: metrics.completedUsers,
    failedUsers: metrics.failedUsers,
    averageSuccessDurationMs: averageDurationMs,
    maxSuccessDurationMs: maxDurationMs,
    stepFailures: metrics.stepFailures,
    failedSamples: metrics.samples.filter((item) => item.status === 'failed').slice(0, 10),
  };
};

const run = async () => {
  log(`Starting load test: ${TOTAL_USERS} user(s), base URL ${BASE_URL}`);
  const workers = Array.from({ length: TOTAL_USERS }, (_, index) => runUserFlow(index));
  await Promise.allSettled(workers);
  const summary = summarize();
  log('Summary:');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedUsers > 0) process.exitCode = 1;
};

run().catch((error) => {
  console.error('[load-test] fatal:', error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});