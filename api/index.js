// Root Vercel function: wrap backend app with serverless-http and
// provide a fallback handler that logs require/startup errors so
// production invocation failures surface useful diagnostics.
const serverless = require('serverless-http');
const pino = require('pino');
const logger = pino();

try {
	const app = require('../backend/src/server');
	module.exports = serverless(app);
} catch (err) {
	// Log the startup error prominently so Vercel runtime logs capture it
	logger.error({ err }, 'server startup error in api/index.js');
	// Export a simple fallback handler that returns 500 so invocations
	// don't fail with opaque FUNCTION_INVOCATION_FAILED without logs.
	module.exports = async (req, res) => {
		try {
			res.statusCode = 500;
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ error: 'server startup failed' }));
		} catch (e) {
			// best-effort log
			try { logger.error({ e }, 'fallback handler error'); } catch (_) {}
			// nothing else we can do
		}
	};
}

