// backend/api/index.js - Vercel serverless entry
const serverless = require('serverless-http');
const app = require('../src/server');

const handler = serverless(app);

module.exports = async (req, res) => {
	try {
		const originalFromHeader =
			req.headers['x-vercel-original-url'] ||
			req.headers['x-now-route'] ||
			req.headers['x-forwarded-uri'] ||
			'';

		if (originalFromHeader) {
			const normalized = String(originalFromHeader).trim();
			// Ensure Express sees the original path (e.g. /api/health), not '/'.
			req.url = normalized.startsWith('/') ? normalized : `/${normalized}`;
			req.originalUrl = req.url;
		}
	} catch (_) {}

	return handler(req, res);
};
