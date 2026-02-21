// Root Vercel function: wrap backend app with serverless-http and
// provide a fallback handler that logs require/startup errors so
// production invocation failures surface useful diagnostics.
const serverless = require('serverless-http');
const pino = require('pino');
const logger = pino();

let startupError = null;

try {
	const app = require('../backend/src/server');
	module.exports = serverless(app);
} catch (err) {
	startupError = err;
	// Log the startup error prominently so Vercel runtime logs capture it
	try { logger.fatal({ err }, 'server startup error in api/index.js'); } catch (_) {}
	// Also emit raw stack to stderr/console to make sure it appears in logs
	try { console.error('server startup error in api/index.js', err && err.stack ? err.stack : err); } catch (_) {}

	// Export a fallback handler that returns 500 with the error message
	// and stacktrace to aid debugging of production invocation failures.
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
			try { logger.error({ e }, 'fallback handler error'); } catch (_) {}
		}
	};
}

