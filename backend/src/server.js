// backend/src/server.js
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const config = require('../shared/config');
const { Pool } = require('pg');

const logger = pino();
const app = express();

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
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// DB: attempt to connect, but provide graceful fallback so server can start when
// the database is temporarily unavailable (useful for local dev without DB).
let pool;
async function initDb() {
  if (!config.dbUrl) {
    console.warn('No DATABASE_URL configured; using mock db');
    app.locals.db = { query: async () => { throw new Error('DB not configured'); } };
    return;
  }
  try {
    pool = new Pool({ connectionString: config.dbUrl });
    // quick test connection
    const client = await pool.connect();
    client.release();
    app.locals.db = { query: (...args) => pool.query(...args) };
    console.info('Connected to database');
  } catch (err) {
    console.warn('Database connection failed; starting with mock DB. Error:', err.message);
    app.locals.db = { query: async () => { throw new Error('DB unavailable'); } };
  }
}
// initialize DB connection (don't block server startup entirely)
initDb();

// health
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Attach middleware and routes
const authMiddleware = require('../shared/middleware/auth');
app.use(authMiddleware);

const uploadRoutes = require('../services/materials/upload');
const brandingRoutes = require('../services/branding');
const authRoutes = require('../services/auth');
const paymentsRoutes = require('../services/payments');

app.use(uploadRoutes);
app.use(brandingRoutes);
app.use(authRoutes);
app.use(paymentsRoutes);

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

const port = config.port || 5000;
app.listen(port, () => logger.info({ port }, 'Server running'));
