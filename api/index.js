// Root Vercel function: wrap backend app with serverless-http and
// provide a fallback handler that logs require/startup errors so
// production invocation failures surface useful diagnostics.
let serverless;
let pino;
let logger;
let startupError = null;

try {
	serverless = require('serverless-http');
	pino = require('pino');
	logger = pino();

	const app = require('../backend/src/server');
	module.exports = serverless(app);
} catch (err) {
	startupError = err;
	// Try to log using pino if available, otherwise fallback to console
	try {
		if (!logger && pino) logger = pino();
		if (logger && logger.fatal) logger.fatal({ err }, 'server startup error in api/index.js');
	} catch (_) {}

	try { console.error('server startup error in api/index.js', err && err.stack ? err.stack : err); } catch (_) {}

	module.exports = async (req, res) => {
		try {
			res.statusCode = 500;
			res.setHeader('content-type', 'application/json');
			const payload = {
				error: 'server startup failed',
				message: startupError && startupError.message ? startupError.message : String(startupError),
				stack: startupError && startupError.stack ? startupError.stack : undefined,
			};
			res.end(JSON.stringify(payload));
		} catch (e) {
			try { if (logger && logger.error) logger.error({ e }, 'fallback handler error'); } catch (_) {}
			try { console.error('fallback handler error', e && e.stack ? e.stack : e); } catch (_) {}
		}
	};
}

