const puppeteer = require('puppeteer');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
  const result = {
    homeLoaded: false,
    navbarHasMainMenu: false,
    addedToCart: false,
    checkoutRedirectsToLogin: false,
    dashboardRedirectsToLogin: false,
    errors: [],
  };

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    page.on('pageerror', (err) => result.errors.push(`PAGE_ERROR: ${String(err)}`));
    page.on('requestfailed', (req) => result.errors.push(`REQUEST_FAILED: ${req.url()} - ${req.failure()?.errorText || 'unknown'}`));

    await page.goto(`${baseUrl}/home`, { waitUntil: 'networkidle2' });
    const homeText = await page.$eval('body', (el) => el.innerText || '');
    result.homeLoaded = /Home\s*-\s*Katalog Paket|Daftar Paket|Semua Paket/i.test(homeText);

    result.navbarHasMainMenu = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')).map((el) => (el.textContent || '').trim());
      return links.includes('Home') && links.includes('Dashboard') && links.includes('Login');
    });

    const addToCartClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find((btn) => /Tambah ke Keranjang/i.test((btn.textContent || '').trim()) && !btn.disabled);
      if (!addBtn) return false;
      addBtn.click();
      return true;
    });
    result.addedToCart = addToCartClicked;

    if (addToCartClicked) {
      await delay(600);
      const checkoutClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const checkoutBtn = buttons.find((btn) => /Login untuk Checkout|Checkout/i.test((btn.textContent || '').trim()) && !btn.disabled);
        if (!checkoutBtn) return false;
        checkoutBtn.click();
        return true;
      });

      if (checkoutClicked) {
        await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 10000 });
        result.checkoutRedirectsToLogin = true;
      }
    }

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle2' });
    try {
      await page.waitForFunction(() => window.location.pathname.includes('/login'), { timeout: 10000 });
      result.dashboardRedirectsToLogin = true;
    } catch (error) {
      result.dashboardRedirectsToLogin = false;
    }

    const pass = result.homeLoaded && result.navbarHasMainMenu && result.addedToCart && result.checkoutRedirectsToLogin && result.dashboardRedirectsToLogin;
    console.log('SMOKE_RESULT', JSON.stringify({ pass, ...result }, null, 2));

    if (!pass) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('SMOKE_FATAL', error && error.stack ? error.stack : String(error));
    process.exitCode = 2;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
