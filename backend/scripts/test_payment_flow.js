require('dotenv').config();

const axios = require('axios');

const apiBase = String(process.argv[2] || process.env.TEST_API_URL || '').replace(/\/$/, '');
const paymentMethod = String(process.argv[3] || process.env.TEST_PAYMENT_METHOD || 'midtrans').trim() || 'midtrans';

if (!apiBase) {
  console.error('Usage: node scripts/test_payment_flow.js <api-base-url>');
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  process.exit(1);
}

const client = axios.create({
  baseURL: apiBase,
  timeout: 30000,
});

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const pickPackage = (packages) => {
  if (!Array.isArray(packages) || packages.length === 0) return null;
  const pricedPackage = packages.find((pkg) => Number(pkg?.price || 0) >= 0);
  return pricedPackage || packages[0];
};

async function main() {
  console.log(`API: ${apiBase}`);

  const loginResponse = await client.post('/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  const token = loginResponse.data?.token;
  if (!token) {
    throw new Error('Login succeeded but no token returned');
  }
  console.log('Login: OK');

  const packageResponse = await client.get('/packages');
  const selectedPackage = pickPackage(packageResponse.data);
  if (!selectedPackage?.id) {
    throw new Error('No package available for checkout');
  }
  console.log(`Package: ${selectedPackage.id} - ${selectedPackage.name || 'Unnamed'}`);

  const checkoutResponse = await client.post(
    '/payments/checkout',
    {
      packageIds: [selectedPackage.id],
      paymentMethod,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: 'automated-test',
    },
    { headers: getAuthHeaders(token) }
  );

  const payment = checkoutResponse.data?.payment;
  if (!payment?.id) {
    throw new Error('Checkout did not return a payment id');
  }
  console.log(`Checkout: paymentId=${payment.id}, status=${payment.status}, reference=${payment.reference}, method=${paymentMethod}`);

  const confirmResponse = await client.post(
    `/payments/${payment.id}/confirm`,
    { status: 'paid' },
    { headers: getAuthHeaders(token) }
  );
  console.log(`Confirm: ${confirmResponse.data?.message || 'OK'}`);

  const paymentStatusResponse = await client.get(`/payments/${payment.id}`, {
    headers: getAuthHeaders(token),
  });

  const verifiedPayment = paymentStatusResponse.data?.payment || {};
  const purchases = paymentStatusResponse.data?.purchases || [];

  console.log('Verified payment status:', verifiedPayment.status || 'unknown');
  console.log(
    'Verified purchase statuses:',
    purchases.map((item) => `${item.id}:${item.payment_status}`).join(', ') || 'none'
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        paymentId: payment.id,
        reference: payment.reference,
        paymentStatus: verifiedPayment.status || null,
        purchaseStatuses: purchases.map((item) => item.payment_status),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  if (error.response) {
    console.error('Request failed:', error.response.status, JSON.stringify(error.response.data));
  } else {
    console.error('Request failed:', error.message);
  }
  process.exit(1);
});