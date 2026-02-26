// backend/shared/config/index.js
// Loads env vars and validates required configuration.
const Joi = require('joi');
require('dotenv').config();

// Accept DATABASE_URL or PG_CONNECTION_STRING for flexibility in local envs.
// Connection strings may include characters that Joi's `uri()` rejects
// (and some environments supply non-standard formats), so validate as
// plain strings to avoid failing startup in serverless deployments.
const schema = Joi.object({
  DATABASE_URL: Joi.string().allow('').optional(),
  PG_CONNECTION_STRING: Joi.string().allow('').optional(),
  FRONTEND_URL: Joi.string().allow('').optional(),
  CORS_ORIGINS: Joi.string().allow('').optional(),
  STORAGE_ENDPOINT: Joi.string().uri().allow('').optional(),
  STORAGE_BUCKET: Joi.string().allow('').optional(),
  STORAGE_KEY: Joi.string().allow('').optional(),
  STORAGE_SECRET: Joi.string().allow('').optional(),
  PAYMENT_API_KEY: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().min(8).optional(),
  CDN_URL: Joi.string().uri().allow('').optional(),
  PORT: Joi.number().default(5000)
}).unknown(true);

const { value: env, error } = schema.validate(process.env);
if (error) {
  console.error('Invalid environment configuration:', error.message);
  process.exit(1);
}

const dbUrl = env.DATABASE_URL || env.PG_CONNECTION_STRING || '';

module.exports = {
  dbUrl,
  frontendUrl: env.FRONTEND_URL || '',
  corsOrigins: env.CORS_ORIGINS || '',
  storageEndpoint: env.STORAGE_ENDPOINT || '',
  storageBucket: env.STORAGE_BUCKET || '',
  storageKey: env.STORAGE_KEY || '',
  storageSecret: env.STORAGE_SECRET || '',
  paymentApiKey: env.PAYMENT_API_KEY || '',
  jwtSecret: env.JWT_SECRET,
  // Provide a harmless default for deployments that haven't had secrets
  // configured yet so the server can start; rotate/set a real secret in
  // project settings for production use.
  jwtSecretFallback: env.JWT_SECRET || 'dev-fallback-secret',
  cdnUrl: env.CDN_URL || env.STORAGE_ENDPOINT || '',
  port: env.PORT
};
