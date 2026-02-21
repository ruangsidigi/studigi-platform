// backend/src/start.js
const app = require('./server');
const config = require('../shared/config');
const pino = require('pino');
const logger = pino();

const port = config.port || 5000;
app.listen(port, () => logger.info({ port }, 'Server running (local)'));
