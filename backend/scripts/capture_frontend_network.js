const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const failures = [];

    page.on('response', async (res) => {
      try {
        const status = res.status();
        if (status >= 400) {
          const url = res.url();
          const text = await (res.request().resourceType ? Promise.resolve(res.request().resourceType()) : Promise.resolve(''));
          failures.push({ url, status });
          console.warn('RESPONSE_ERROR', status, url);
        }
      } catch (e) {
        // ignore
      }
    });

    const url = process.argv[2] || 'http://127.0.0.1:3000';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(res => setTimeout(res, 5000));
    if (failures.length === 0) console.log('No HTTP >=400 responses detected');
    else console.log('Failures:', failures);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('CAPTURE_NETWORK_ERROR', err && err.stack ? err.stack : String(err));
    process.exit(2);
  }
})();
