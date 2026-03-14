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
const CHECKOUT_COMPAT_VERSION = 'checkout-compat-v2';

// Strip any sslmode= parameter from the URL so the `ssl` Pool option takes full control.
// Mixing ?sslmode=require in the URL with ssl:{rejectUnauthorized:false} causes pg to
// use the URL's stricter mode and ignore the object option, keeping cert errors.
const stripSslMode = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) return value;
  try {
    const parsed = new URL(value);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch (_) {
    return value;
  }
};

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label || 'operation'} timeout after ${ms}ms`)), ms)
    ),
  ]);

const getPgSslConfig = (rawUrl) => {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if ((parsed.hostname || '').includes('supabase.com')) {
      // Disable strict cert validation for Supabase pooler in serverless environments.
      // The pooler's certificate chain is not always trusted by Node's default CA store.
      return { rejectUnauthorized: false };
    }
  } catch (_) {}
  // For non-Supabase, still use SSL if the URL has sslmode=require
  return { rejectUnauthorized: false };
};

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

// Vercel may invoke serverless handlers with rewritten '/' URLs.
// Recover the intended API path from forwarded headers before routing.
app.use((req, _res, next) => {
  try {
    if (req.url === '/' || req.url === '') {
      const candidates = [
        req.headers['x-vercel-original-url'],
        req.headers['x-now-route'],
        req.headers['x-matched-path'],
        req.headers['x-forwarded-uri'],
        req.originalUrl,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      const chosen = candidates.find((value) => value.startsWith('/api/')) || candidates.find((value) => value.startsWith('/'));
      if (chosen) {
        req.url = chosen;
        req.originalUrl = chosen;
      }
    }
  } catch (_) {}
  next();
});

// Compatibility shim for mixed frontend/backend versions in production.
// Some legacy handlers require `bundle_id` while newer clients send `packageIds`.
app.use((req, _res, next) => {
  try {
    const requestPath = String(req.path || req.originalUrl || '').split('?')[0].replace(/\/+$/, '');
    const isCheckoutPath =
      requestPath === '/api/payments/checkout' ||
      requestPath === '/payments/checkout' ||
      requestPath.startsWith('/api/payments/checkout/') ||
      requestPath.startsWith('/payments/checkout/');
    const isPurchasePath =
      requestPath === '/api/purchases' ||
      requestPath === '/purchases' ||
      requestPath.startsWith('/api/purchases/') ||
      requestPath.startsWith('/purchases/');
    const isTarget = req.method === 'POST' && (isCheckoutPath || isPurchasePath);
    if (!isTarget || !req.body || typeof req.body !== 'object') return next();

    const body = req.body;
    const packageIds = Array.isArray(body.packageIds)
      ? body.packageIds
      : Array.isArray(body.package_ids)
        ? body.package_ids
        : [];

    const primaryId =
      body.bundle_id ||
      body.bundleId ||
      body.package_id ||
      body.packageId ||
      (packageIds.length > 0 ? packageIds[0] : null);

    if (primaryId !== null && primaryId !== undefined && String(primaryId).trim() !== '') {
      if (!body.bundle_id) body.bundle_id = primaryId;
      if (!body.bundleId) body.bundleId = primaryId;
      if (!body.package_id) body.package_id = primaryId;
      if (!body.packageId) body.packageId = primaryId;
    }

    if ((!Array.isArray(body.packageIds) || body.packageIds.length === 0) && packageIds.length > 0) {
      body.packageIds = packageIds;
    }

    if ((!Array.isArray(body.package_ids) || body.package_ids.length === 0) && Array.isArray(body.packageIds)) {
      body.package_ids = body.packageIds;
    }
  } catch (_) {}
  return next();
});

// simple request logger (only logs method/url and body size to avoid noise)
app.use((req, res, next) => {
  try {
    const size = req.rawBody ? req.rawBody.length : (req.body ? JSON.stringify(req.body).length : 0);
    logger.info({ method: req.method, url: req.url, originalUrl: req.originalUrl, bodySize: size }, 'incoming request');
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
      const normalizedDbUrl = stripSslMode(config.dbUrl);
      console.log('ensureDb: creating new pg Pool (will use connectionTimeoutMillis=3000)');
      pool = new Pool({
        connectionString: normalizedDbUrl,
        connectionTimeoutMillis: 3000,
        query_timeout: 10000,
        statement_timeout: 10000,
        ssl: getPgSslConfig(normalizedDbUrl),
      });
      console.log('ensureDb: starting pool.connect()');
      const connectStart = Date.now();
      const connectPromise = pool.connect();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 4000));
      const client = await Promise.race([connectPromise, timeout]);
      const connectElapsed = Date.now() - connectStart;
      console.log('ensureDb: pool.connect() succeeded', { connectElapsed });
      client.release();
      app.locals.db = {
        query: (...args) => withTimeout(pool.query(...args), 12000, 'db query'),
      };
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
  return res.json({ ok: true, time: new Date().toISOString(), checkoutCompat: CHECKOUT_COMPAT_VERSION });
});

// Accept root path health probes since platform rewrites may change req.url
app.get('/', (req, res) => {
  console.log('health handler / invoked (platform rewrite)', { url: req.url, originalUrl: req.originalUrl, headers: Object.keys(req.headers) });
  return res.json({ ok: true, time: new Date().toISOString(), checkoutCompat: CHECKOUT_COMPAT_VERSION });
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

const resolveFavicon = async (db) => {
  const result = await db.query(
    `SELECT favicon_url
     FROM branding_settings
     WHERE favicon_url IS NOT NULL AND favicon_url <> ''
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`
  );
  return result?.rows?.[0]?.favicon_url || null;
};

const sendFaviconResponse = (res, faviconUrl) => {
  const value = String(faviconUrl || '').trim();
  if (!value) return res.status(404).end();

  res.setHeader('Cache-Control', 'no-store');

  if (/^data:image\//i.test(value)) {
    const match = value.match(/^data:([^;]+);base64,(.+)$/i);
    if (!match) return res.status(404).end();
    const mimeType = match[1] || 'image/x-icon';
    const payload = match[2] || '';
    const body = Buffer.from(payload, 'base64');
    res.setHeader('Content-Type', mimeType);
    return res.status(200).send(body);
  }

  return res.redirect(value);
};

app.get('/favicon.ico', async (req, res) => {
  try {
    const faviconUrl = await resolveFavicon(req.app.locals.db);
    return sendFaviconResponse(res, faviconUrl);
  } catch (error) {
    return res.status(404).end();
  }
});

app.get('/api/favicon.ico', async (req, res) => {
  try {
    const faviconUrl = await resolveFavicon(req.app.locals.db);
    return sendFaviconResponse(res, faviconUrl);
  } catch (error) {
    return res.status(404).end();
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
const tryoutsRoutes = require('../services/tryouts');
const questionsRoutes = require('../services/questions');
const reviewsRoutes = require('../services/reviews');
const categoriesRoutes = require('../services/categories');
const usersRoutes = require('../services/users');
const vouchersRoutes = require('../services/vouchers');
const bundlesLegacyRoutes = require('./routes/bundles');

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
app.use('/api', tryoutsRoutes);
app.use('/api', questionsRoutes);
app.use('/api', reviewsRoutes);
app.use('/api', categoriesRoutes);
app.use('/api', usersRoutes);
app.use('/api', vouchersRoutes);
// Keep bundles route mounted statically so it is always included in Vercel bundle.
app.use('/api/bundles', bundlesLegacyRoutes);

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
