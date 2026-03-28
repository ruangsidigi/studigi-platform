// backend/server.js
// Minimal entry wrapper for container runtimes (Railway). Keeps existing
// start logic in `src/start.js` and provides a single `npm start` entry.

// Ensure env is loaded for local runs
require('dotenv').config();

// Delegate to existing start script which calls `app.listen(...)`
require('./src/start');
