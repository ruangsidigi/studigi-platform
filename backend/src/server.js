// backend/src/server.js
const express = require('express');
const helmet = require('helmet');
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

// Basic middleware
app.use(helmet());
// capture raw body for better parse-error logging
app.use(express.json({
  verify: (req, _res, buf) => {
    try {
      req.rawBody = buf && buf.toString();
    } catch (e) {
      req.rawBody = undefined;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

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
      app.locals.db = { query: async () => { throw new Error('DB not configured'); } };
      return;
    }

    try {
      if (global.__pgPool && global.__pgPool.connectionString === config.dbUrl) {
        pool = global.__pgPool;
      } else {
        pool = new Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 3000 });
        global.__pgPool = pool;
        global.__pgPool.connectionString = config.dbUrl;
      }
      const connectPromise = pool.connect();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 4000));
      const client = await Promise.race([connectPromise, timeout]);
      client.release();
      app.locals.db = { query: (...args) => pool.query(...args) };
      console.info('Connected to database');
    } catch (err) {
      console.warn('Database connection failed; using mock DB. Error:', err && err.message ? err.message : err);
      app.locals.db = { query: async () => { throw new Error('DB unavailable'); } };
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
  return res.json({ ok: true, time: new Date().toISOString() });
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

// Attach middleware and routes
const authMiddleware = require('../shared/middleware/auth');
app.use(authMiddleware);

const uploadRoutes = require('../services/materials/upload');
const brandingRoutes = require('../services/branding');
const authRoutes = require('../services/auth');
const paymentsRoutes = require('../services/payments');

// Mount all service routers under the common `/api` prefix. Service routers
// define relative paths (e.g. `/auth/login`, `/materials`) so final routes
// become `/api/auth/login`, `/api/materials`, etc. This is more robust
// when running behind Vercel function path rewrites.
app.use('/api', uploadRoutes);
app.use('/api', brandingRoutes);
app.use('/api', authRoutes);
app.use('/api', paymentsRoutes);

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
