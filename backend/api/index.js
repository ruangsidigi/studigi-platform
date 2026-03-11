// backend/api/index.js - Vercel Node Function entry
// Use native Express handler directly on Vercel to preserve request path.
const app = require('../src/server');

module.exports = (req, res) => app(req, res);
