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
			// Deep debug: capture method, headers, raw body and parsed body preview.
			// Use console.error so logs are more visible in production. Keep this
			// robust: timebox stream reads and never throw.
			try {
				console.error('DEBUG REQUEST START');
				const MAX = 2000;
				const safeHeaders = (() => {
					try { return Object.keys(req.headers || {}).reduce((acc, k) => { acc[k] = req.headers[k]; return acc; }, {}); } catch (_) { return {}; }
				})();
				const peekRawBody = () => new Promise((resolve) => {
					try {
						if (req.rawBody) return resolve(String(req.rawBody).slice(0, MAX));
						if (req.body && typeof req.body === 'string') return resolve(String(req.body).slice(0, MAX));
						if (req.body && typeof req.body === 'object') return resolve(JSON.stringify(req.body).slice(0, MAX));
						// If the request is a stream, read a small amount then put it back.
						const chunks = [];
						let finished = false;
						function finish() {
							if (finished) return;
							finished = true;
							req.removeListener('data', onData);
							req.removeListener('end', onEnd);
							try {
								const buf = Buffer.concat(chunks);
								if (buf.length) req.unshift(buf);
								return resolve(String(buf).slice(0, MAX));
							} catch (e) { return resolve(undefined); }
						}
						function onData(c) { chunks.push(Buffer.from(c)); if (Buffer.concat(chunks).length > 1024*100) finish(); }
						function onEnd() { finish(); }
						req.on('data', onData);
						req.on('end', onEnd);
						setTimeout(finish, 50);
					} catch (e) { resolve(undefined); }
				});
				let rawPreview;
				try { rawPreview = await peekRawBody(); } catch (_) { rawPreview = undefined; }
				let parsedPreview;
				if (rawPreview) {
					try {
						parsedPreview = JSON.parse(rawPreview);
						if (typeof parsedPreview === 'object') parsedPreview = JSON.stringify(parsedPreview).slice(0, MAX);
					} catch (parseErr) {
						console.error('DEBUG PARSE ERROR', { message: parseErr && parseErr.message ? parseErr.message : String(parseErr) });
						console.error('DEBUG RAW BODY', String(rawPreview).slice(0, MAX));
						parsedPreview = undefined;
					}
				}
				try {
					console.error('DEBUG REQUEST', JSON.stringify({ method: req.method, headers: safeHeaders, rawBodyPreview: rawPreview, parsedBodyPreview: parsedPreview }, null, 2).slice(0, 10000));
				} catch (_) { console.error('DEBUG REQUEST: failed to stringify snapshot'); }
			} catch (e) {
				try { console.error('DEBUG REQUEST LOGGING ERROR', e && e.stack ? e.stack : e); } catch (_) {}
			}

			// Full event/request dump for deep debugging (safe, truncated).
			try {
				const util = require('util');
				let dump = '';
				try {
					// Prefer dumping the entire `req` (lambda event shape) where available
					dump = util.inspect(req, { depth: 6, maxArrayLength: 50, breakLength: 120 });
				} catch (e) {
					try { dump = String(req); } catch (_) { dump = '[unserializable req]'; }
				}
				// Truncate to avoid log flooding
				if (dump && dump.length > 20000) dump = dump.slice(0, 20000) + '\n...[truncated]';
				console.error('DEBUG FULL EVENT DUMP', dump);
			} catch (e) { try { console.error('DEBUG FULL EVENT DUMP FAILED', e && e.stack ? e.stack : e); } catch (_) {} }
			try { console.log('api/index handler invoked', { url: req.url, originalUrl: req.headers['x-now-route'] || req.headers['x-vercel-original-url'] || req.url }); } catch (_) {}

			// If the platform invoked this function with a lambda-style `event`,
			// log the raw event body as we received it (helps debug serverless-http
			// cleanup errors where the platform's event->req conversion fails).
			try {
				if (req && typeof req === 'object' && (req.httpMethod || req.requestContext || req.body)) {
					const evPreview = (() => {
						try {
							const b = req.body; if (b) return typeof b === 'string' ? b.slice(0, 2000) : JSON.stringify(b).slice(0,2000);
							if (req.rawBody) return String(req.rawBody).slice(0,2000);
							return undefined;
						} catch (_) { return undefined; }
					})();
					console.log('api/index raw event snapshot', { keys: Object.keys(req).slice(0,50), evPreview });
				} else {
					// Node `req` path: peek a small amount of the request body without
					// permanently consuming the stream. We buffer up to 100KB or wait
					// 50ms, then unshift the buffer back onto the stream so downstream
					// body-parsers still receive it.
					const peekRaw = () => new Promise((resolve) => {
						try {
							const chunks = [];
							let finished = false;
							function onData(c) { chunks.push(Buffer.from(c)); if (Buffer.concat(chunks).length > 1024*100) finish(); }
							function onEnd() { finish(); }
							function finish() {
								if (finished) return; finished = true;
								req.removeListener('data', onData);
								req.removeListener('end', onEnd);
								try { const buf = Buffer.concat(chunks); if (buf.length) req.unshift(buf); resolve(String(buf).slice(0,2000)); } catch (e) { resolve(undefined); }
							}
							req.on('data', onData);
							req.on('end', onEnd);
							setTimeout(finish, 50);
						} catch (e) { resolve(undefined); }
					});
					const preview = await peekRaw();
					console.log('api/index node req snapshot', { headers: Object.keys(req.headers || {}).slice(0,50), bodyPreview: preview });
				}
			} catch (_) {}

			// Log headers and any parseable body we can see at this layer. Avoid
			// reading the request stream so we don't interfere with `serverless-http`.
			try {
				const headersSnapshot = Object.keys(req.headers || {}).slice(0,50);
				const bodyPreview = (() => {
					if (req.rawBody) return String(req.rawBody).slice(0,2000);
					try {
						if (req.body && typeof req.body === 'object') return JSON.stringify(req.body).slice(0,2000);
						if (req.body) return String(req.body).slice(0,2000);
					} catch (_) {}
					return undefined;
				})();
				console.log('api/index pre-invoke snapshot', { headers: headersSnapshot, bodyPreview });
			} catch (_) {}

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

