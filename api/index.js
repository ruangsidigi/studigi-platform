// Wrapper that ensures a minimal set of env defaults for startup and
// then loads the backend app. Any startup or invocation errors are
// logged synchronously and returned as JSON to aid production debugging.
const serverless = require('serverless-http');
const pino = require('pino');
const logger = pino();

// Provide minimal env fallbacks so the app doesn't exit immediately
// when a secret isn't configured in the deployment (temporary measure).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret';

let startupError = null;

try {
	const app = require('../backend/src/server');
	const baseHandler = serverless(app);

	module.exports = async (req, res) => {
		try {
			try { console.log('api/index handler invoked', { url: req.url, originalUrl: req.headers['x-now-route'] || req.headers['x-vercel-original-url'] || req.url }); } catch (_) {}
			return await baseHandler(req, res);
		} catch (invokeErr) {
			try { logger.fatal({ err: invokeErr }, 'invocation error in api/index.js'); } catch (_) {}
			try { console.error('invocation error in api/index.js', invokeErr && invokeErr.stack ? invokeErr.stack : invokeErr); } catch (_) {}
			try {
				res.statusCode = 500;
				res.setHeader('content-type', 'application/json');
				res.end(JSON.stringify({ error: 'invocation error', message: invokeErr && invokeErr.message ? invokeErr.message : String(invokeErr), stack: invokeErr && invokeErr.stack ? invokeErr.stack : undefined }));
			} catch (_) {}
		}
	};
} catch (err) {
	startupError = err;
	try { logger.fatal({ err }, 'server startup error in api/index.js'); } catch (_) {}
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
			try { logger.error({ e }, 'fallback handler error'); } catch (_) {}
		}
	};
}

