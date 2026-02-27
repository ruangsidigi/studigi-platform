// backend/src/server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const config = require('../shared/config');
const { Pool } = require('pg');

const logger = pino();
const app = express();

// Trust proxy headers so `req.ip` is populated behind Vercel's proxy
app.set('trust proxy', true);

// Diagnostic: indicate module load in logs to help trace cold-starts
console.log('backend/src/server loaded', { nodeEnv: process.env.NODE_ENV, pid: process.pid });

// Masked startup config (do not print secrets) to aid deploy verification
try {
  console.log('startup config', {
    nodeEnv: process.env.NODE_ENV,
    dbUrlSet: !!config.dbUrl,
    supabaseUrlSet: !!config.supabaseUrl,
    storageBucketSet: !!config.storageBucket,
    jwtSecretSet: !!config.jwtSecret
  });
} catch (e) {
  console.warn('failed to log startup config', e && e.message ? e.message : e);
}

// Basic middleware
app.use(helmet());
const allowedOrigins = (() => {
  const fromEnvList = (config.corsOrigins || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const origins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(config.frontendUrl ? [config.frontendUrl] : []),
    ...fromEnvList,
  ]);
  return [...origins];
})();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.vercel.app')) return callback(null, true);
    } catch (_) {}
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// capture raw body for better parse-error logging and increase JSON limit
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    try {
      req.rawBody = buf && buf.toString();
    } catch (e) {
      req.rawBody = undefined;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// simple request logger (only logs method/url and body size to avoid noise)
app.use((req, res, next) => {
  try {
    const size = req.rawBody ? req.rawBody.length : (req.body ? JSON.stringify(req.body).length : 0);
    logger.info({ method: req.method, url: req.url, bodySize: size }, 'incoming request');
  } catch (e) {
    logger.warn({ err: e }, 'failed to log request');
  }
  next();
});
// Use a safe keyGenerator to avoid errors when `req.ip` is undefined
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req /*, res */) => {
    try {
      if (req.ip) return req.ip;
      const xf = req.headers['x-forwarded-for'] || req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'];
      if (xf) return String(xf).split(',')[0].trim();
      if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
    } catch (_) {}
    return 'unknown';
  }
}));

// DB: attempt to connect, but provide graceful fallback so server can start when
// DB: lazy initialization. Do not block `require()` on DB connect to avoid
// cold-start hangs in serverless environments. The first call to
// `app.locals.db.query(...)` will trigger `ensureDb()` which attempts to
// connect with a short timeout and falls back to a mock implementation.
let pool;
async function ensureDb() {
  if (app.locals._dbInitPromise) {
    await app.locals._dbInitPromise;
    return app.locals.db;
  }

  app.locals._dbInitPromise = (async () => {
    if (!config.dbUrl) {
      console.warn('No DATABASE_URL configured; using mock db');
      app.locals._dbErrorMessage = 'DATABASE_URL not configured';
      app.locals.db = { query: async () => { throw new Error(`DB unavailable: ${app.locals._dbErrorMessage}`); } };
      return;
    }

    try {
      const attemptStart = Date.now();
      console.log('ensureDb: attempting DB init', { dbUrl: Boolean(config.dbUrl), time: new Date().toISOString() });
      if (global.__pgPool && global.__pgPool.connectionString === config.dbUrl) {
        pool = global.__pgPool;
      } else {
        console.log('ensureDb: creating new pg Pool (will use connectionTimeoutMillis=3000)');
        pool = new Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 3000 });
        global.__pgPool = pool;
        global.__pgPool.connectionString = config.dbUrl;
      }
      console.log('ensureDb: starting pool.connect()');
      const connectStart = Date.now();
      const connectPromise = pool.connect();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 4000));
      const client = await Promise.race([connectPromise, timeout]);
      const connectElapsed = Date.now() - connectStart;
      console.log('ensureDb: pool.connect() succeeded', { connectElapsed });
      client.release();
      app.locals.db = { query: (...args) => pool.query(...args) };
      const elapsed = Date.now() - attemptStart;
      console.info('Connected to database', { elapsed });
      app.locals._dbErrorMessage = null;
    } catch (err) {
      console.warn('Database connection failed; using mock DB. Error:', err && err.message ? err.message : err);
      try { console.error('ensureDb error stack', err && err.stack ? err.stack : err); } catch (_) {}
      app.locals._dbErrorMessage = err && err.message ? err.message : String(err);
      app.locals.db = { query: async () => { throw new Error(`DB unavailable: ${app.locals._dbErrorMessage}`); } };
    }
  })();

  await app.locals._dbInitPromise;
  return app.locals.db;
}

// initial lazy db proxy: triggers `ensureDb()` on first use
app.locals.db = {
  query: async (...args) => {
    const db = await ensureDb();
    return db.query(...args);
  }
};

// health
app.get('/health', (req, res) => {
  console.log('health handler /health invoked', { url: req.url, originalUrl: req.originalUrl, headers: Object.keys(req.headers) });
  return res.json({ status: 'ok' });
});
// also expose API-scoped health for platforms that route under /api
app.get('/api/health', (req, res) => {
  console.log('health handler /api/health invoked', { url: req.url, originalUrl: req.originalUrl, headers: Object.keys(req.headers) });
  return res.json({ ok: true, time: new Date().toISOString() });
});

// Accept root path health probes since platform rewrites may change req.url
app.get('/', (req, res) => {
  console.log('health handler / invoked (platform rewrite)', { url: req.url, originalUrl: req.originalUrl, headers: Object.keys(req.headers) });
  return res.json({ ok: true, time: new Date().toISOString() });
});

// DB-check endpoint: run a lightweight query to validate DB connectivity
app.get('/api/db-check', async (req, res) => {
  try {
    const start = Date.now();
    const result = await app.locals.db.query('SELECT now() AS now');
    const elapsed = Date.now() - start;
    return res.json({ ok: true, time: result && result.rows && result.rows[0] && result.rows[0].now, elapsedMs: elapsed });
  } catch (err) {
    console.error('db-check failed', err && err.message ? err.message : err);
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : String(err),
      detail: app.locals._dbErrorMessage || null,
    });
  }
});

// Attach middleware and routes
const authMiddleware = require('../shared/middleware/auth');
app.use(authMiddleware);

const uploadRoutes = require('../services/materials/upload');
const brandingRoutes = require('../services/branding');
const authRoutes = require('../services/auth');
const adminRoutes = require('../services/admin');
const packagesRoutes = require('../services/packages');
const paymentsRoutes = require('../services/payments');
const purchasesRoutes = require('../services/purchases');
const reportsRoutes = require('../services/reports');
const campaignRoutes = require('../services/campaigns');
const adaptiveRoutes = require('../services/adaptive');
const categoriesRoutes = require('../services/categories');

// Mount all service routers under the common `/api` prefix. Service routers
// define relative paths (e.g. `/auth/login`, `/materials`) so final routes
// become `/api/auth/login`, `/api/materials`, etc. This is more robust
// when running behind Vercel function path rewrites.
app.use('/api', uploadRoutes);
app.use('/api', brandingRoutes);
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.use('/api', packagesRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', purchasesRoutes);
app.use('/api', reportsRoutes);
app.use('/api', campaignRoutes);
app.use('/api', adaptiveRoutes);
app.use('/api', categoriesRoutes);

const mountLegacyRoute = (basePath, modulePath) => {
  try {
    const router = require(modulePath);
    app.use(basePath, router);
    console.log('mounted legacy route', { basePath, modulePath });
  } catch (error) {
    console.warn('skip legacy route mount', {
      basePath,
      modulePath,
      error: error && error.message ? error.message : String(error),
    });
  }
};

mountLegacyRoute('/api/admin', './routes/admin');
mountLegacyRoute('/api/packages', './routes/packages');
mountLegacyRoute('/api/bundles', './routes/bundles');
mountLegacyRoute('/api/questions', './routes/questions');
mountLegacyRoute('/api/tryouts', './routes/tryouts');
mountLegacyRoute('/api/purchases', './routes/purchases');
mountLegacyRoute('/api/users', './routes/users');
mountLegacyRoute('/api/reports', './routes/reports');
mountLegacyRoute('/api/reviews', './routes/reviews');
mountLegacyRoute('/api/dashboard', './routes/dashboard');
mountLegacyRoute('/api/content', './routes/content');
mountLegacyRoute('/api/cms', './routes/cms');
mountLegacyRoute('/api/campaigns', './routes/campaigns');

// JSON parse error handler (body-parser / express.json)
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    logger.warn({ err: err.message, rawBody: req.rawBody }, 'invalid JSON received');
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

// basic error handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
