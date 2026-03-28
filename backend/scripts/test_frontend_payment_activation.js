const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const puppeteer = require('puppeteer');

const frontendBaseUrl = String(process.argv[2] || process.env.TEST_FRONTEND_URL || 'https://studigi.vercel.app').replace(/\/$/, '');
const apiBase = String(process.argv[3] || process.env.TEST_API_URL || '').replace(/\/$/, '');
const envFilePath = process.argv[4] || process.env.TEST_ENV_FILE || '';
const paymentMethod = String(process.argv[5] || process.env.TEST_PAYMENT_METHOD || 'midtrans').trim() || 'midtrans';

if (!apiBase) {
  console.error('Usage: node scripts/test_frontend_payment_activation.js <frontend-base-url> <api-base-url> [env-file]');
  process.exit(1);
}

dotenv.config();
if (envFilePath && fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath, override: false });
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;

if (!adminEmail || !adminPassword || !midtransServerKey) {
  console.error('ADMIN_EMAIL, ADMIN_PASSWORD, and MIDTRANS_SERVER_KEY must be set');
  process.exit(1);
}

const client = axios.create({
  baseURL: apiBase,
  timeout: 30000,
});

const authHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const completedStatuses = new Set(['paid', 'completed', 'success', 'settlement']);

const pickTargetPackage = (packages, purchases) => {
  const ownedIds = new Set(
    (Array.isArray(purchases) ? purchases : [])
      .filter((purchase) => completedStatuses.has(String(purchase?.payment_status || purchase?.status || '').toLowerCase()))
      .map((purchase) => Number(purchase?.package_id || purchase?.packageId))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const normalizedPackages = Array.isArray(packages) ? packages : [];
  return normalizedPackages.find((pkg) => !ownedIds.has(Number(pkg?.id))) || normalizedPackages[0] || null;
};

const buildSignature = (orderId, statusCode, grossAmount) =>
  crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${midtransServerKey}`).digest('hex');

async function createSuccessfulPayment(token) {
  const [packageResponse, purchaseResponse] = await Promise.all([
    client.get('/packages'),
    client.get('/purchases', authHeaders(token)),
  ]);

  const targetPackage = pickTargetPackage(packageResponse.data, purchaseResponse.data);
  if (!targetPackage?.id) {
    throw new Error('No package available for frontend activation test');
  }

  const checkoutResponse = await client.post(
    '/payments/checkout',
    {
      packageIds: [targetPackage.id],
      paymentMethod,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: 'frontend-activation-test',
    },
    authHeaders(token)
  );

  const payment = checkoutResponse.data?.payment;
  if (!payment?.id || !payment?.reference) {
    throw new Error('Checkout did not return payment id/reference');
  }

  const grossAmount = String(Math.max(1, Math.round(Number(payment.total_amount || 0))));
  const statusCode = '200';

  await client.post(
    '/payments/webhook',
    {
      order_id: payment.reference,
      transaction_status: 'settlement',
      fraud_status: 'accept',
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: buildSignature(payment.reference, statusCode, grossAmount),
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    packageId: Number(targetPackage.id),
    packageName: targetPackage.name || 'Unnamed',
    paymentId: payment.id,
  };
}

async function main() {
  const loginResponse = await client.post('/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  const token = loginResponse.data?.token;
  const user = loginResponse.data?.user;
  if (!token || !user) {
    throw new Error('Login did not return token and user');
  }

  const activation = await createSuccessfulPayment(token);
  let browser;

  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(`${frontendBaseUrl}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate(
      ({ storedUser, storedToken }) => {
        localStorage.setItem('user', JSON.stringify(storedUser));
        localStorage.setItem('token', storedToken);
      },
      { storedUser: user, storedToken: token }
    );

    await page.goto(`${frontendBaseUrl}/dashboard`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.includes('Paket Aktif'));

    const dashboardResult = await page.evaluate((expectedPackageName) => {
      const bodyText = document.body.innerText || '';
      return {
        hasActiveSection: /Paket Aktif/i.test(bodyText),
        hasExpectedPackage: bodyText.includes(expectedPackageName),
      };
    }, activation.packageName);

    await page.goto(`${frontendBaseUrl}/library`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.length > 0);
    const libraryResult = await page.evaluate((expectedPackageName) => {
      const bodyText = document.body.innerText || '';
      const buttons = Array.from(document.querySelectorAll('button')).map((button) => (button.textContent || '').trim());
      return {
        hasExpectedPackage: bodyText.includes(expectedPackageName),
        hasActionButton: buttons.includes('Mulai') || buttons.includes('Buka'),
      };
    }, activation.packageName);

    console.log(
      JSON.stringify(
        {
          ok: dashboardResult.hasActiveSection && dashboardResult.hasExpectedPackage && libraryResult.hasExpectedPackage && libraryResult.hasActionButton,
          packageId: activation.packageId,
          packageName: activation.packageName,
          paymentMethod,
          paymentId: activation.paymentId,
          dashboardResult,
          libraryResult,
        },
        null,
        2
      )
    );
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  if (error.response) {
    console.error('Request failed:', error.response.status, JSON.stringify(error.response.data));
  } else {
    console.error('Request failed:', error.message);
  }
  process.exit(1);
});