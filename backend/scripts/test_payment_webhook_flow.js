const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');

const apiBase = String(process.argv[2] || process.env.TEST_API_URL || '').replace(/\/$/, '');
const envFilePath = process.argv[3] || process.env.TEST_ENV_FILE || '';
const paymentMethod = String(process.argv[4] || process.env.TEST_PAYMENT_METHOD || 'midtrans').trim() || 'midtrans';

if (!apiBase) {
  console.error('Usage: node scripts/test_payment_webhook_flow.js <api-base-url> [env-file]');
  process.exit(1);
}

dotenv.config();
if (envFilePath && fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath, override: false });
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;

if (!adminEmail || !adminPassword) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  process.exit(1);
}

if (!midtransServerKey) {
  console.error('MIDTRANS_SERVER_KEY must be set');
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

async function main() {
  console.log(`API: ${apiBase}`);

  const loginResponse = await client.post('/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });

  const token = loginResponse.data?.token;
  const user = loginResponse.data?.user;
  if (!token || !user) {
    throw new Error('Login did not return token and user');
  }
  console.log(`Login: OK (${user.email || 'unknown'})`);

  const [packageResponse, purchaseResponse] = await Promise.all([
    client.get('/packages'),
    client.get('/purchases', authHeaders(token)),
  ]);

  const targetPackage = pickTargetPackage(packageResponse.data, purchaseResponse.data);
  if (!targetPackage?.id) {
    throw new Error('No package available for webhook test');
  }
  console.log(`Package: ${targetPackage.id} - ${targetPackage.name || 'Unnamed'}`);

  const checkoutResponse = await client.post(
    '/payments/checkout',
    {
      packageIds: [targetPackage.id],
      paymentMethod,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: 'automated-webhook-test',
    },
    authHeaders(token)
  );

  const payment = checkoutResponse.data?.payment;
  if (!payment?.id || !payment?.reference) {
    throw new Error('Checkout did not return payment id/reference');
  }

  const grossAmount = String(Math.max(1, Math.round(Number(payment.total_amount || 0))));
  const statusCode = '200';
  const signatureKey = buildSignature(payment.reference, statusCode, grossAmount);

  const webhookPayload = {
    order_id: payment.reference,
    transaction_status: 'settlement',
    fraud_status: 'accept',
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
  };

  const webhookResponse = await client.post('/payments/webhook', webhookPayload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  console.log(`Webhook: ${webhookResponse.data?.message || 'OK'}`);

  const paymentStatusResponse = await client.get(`/payments/${payment.id}`, authHeaders(token));
  const verifiedPayment = paymentStatusResponse.data?.payment || {};
  const purchases = paymentStatusResponse.data?.purchases || [];

  console.log(
    JSON.stringify(
      {
        ok: true,
        userEmail: user.email || null,
        packageId: targetPackage.id,
        packageName: targetPackage.name || null,
        paymentMethod,
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