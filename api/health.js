module.exports = async (req, res) => {
  try {
    console.log('api/health.js invoked');
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, source: 'api/health.js', time: new Date().toISOString() }));
  } catch (e) {
    try { console.error('api/health error', e && e.stack ? e.stack : e); } catch (_) {}
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'health handler error' }));
  }
};
