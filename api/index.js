// Root Vercel function: wrap backend app with serverless-http and
// provide a fallback handler that logs require/startup errors so
// production invocation failures surface useful diagnostics.
// TEMPORARY SMOKE TEST HANDLER
// Replace with the real server wrapper after diagnosis.
module.exports = async (req, res) => {
	res.statusCode = 200;
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify({ ok: true, note: 'smoke-test handler', now: new Date().toISOString() }));
};


