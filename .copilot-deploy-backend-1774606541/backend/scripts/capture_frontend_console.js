const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    page.on('console', (msg) => {
      try {
        const args = msg.args();
        if (args && args.length) {
          Promise.all(args.map(a => a.jsonValue().catch(() => a.toString()))).then(vals => {
            console.log('PAGE_CONSOLE', msg.type(), ...vals);
          }).catch(() => console.log('PAGE_CONSOLE', msg.type(), msg.text()));
        } else {
          console.log('PAGE_CONSOLE', msg.type(), msg.text());
        }
      } catch (e) {
        console.log('PAGE_CONSOLE', msg.type(), msg.text());
      }
    });

    page.on('pageerror', (err) => {
      console.error('PAGE_ERROR', err && err.stack ? err.stack : String(err));
    });

    page.on('requestfailed', req => {
      console.warn('REQUEST_FAILED', req.url(), req.failure()?.errorText || req.failure());
    });

    const url = process.argv[2] || 'http://127.0.0.1:3000';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // wait some time to capture runtime logs
    await new Promise(res => setTimeout(res, 10000));

    // also capture a screenshot for debugging
    const out = process.argv[3] || 'frontend_console_screenshot.png';
    await page.screenshot({ path: out, fullPage: true });
    console.log('Saved screenshot to', out);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('CAPTURE_ERROR', err && err.stack ? err.stack : String(err));
    process.exit(2);
  }
})();
