#!/usr/bin/env node
/**
 * Regression test runner — runs all critical payment flow tests in sequence.
 *
 * Usage:
 *   node scripts/regression_test.js <api-url> <frontend-url> [env-file]
 *
 * Example (production):
 *   node scripts/regression_test.js \
 *     https://backend-rosy-tau-87.vercel.app/api \
 *     https://studigi.vercel.app \
 *     /path/to/.env.production.local
 *
 * All three tests use paymentMethod=midtrans (real Midtrans sandbox webhook simulation).
 * To use manual confirm instead: set TEST_PAYMENT_METHOD=manual in env.
 */

const { execSync } = require('child_process');
const path = require('path');

const apiUrl = process.argv[2] || process.env.TEST_API_URL;
const frontendUrl = process.argv[3] || process.env.TEST_FRONTEND_URL;
const envFile = process.argv[4] || process.env.TEST_ENV_FILE || '';
const paymentMethod = process.env.TEST_PAYMENT_METHOD || 'midtrans';

if (!apiUrl || !frontendUrl) {
  console.error('Usage: node scripts/regression_test.js <api-url> <frontend-url> [env-file]');
  process.exit(1);
}

const scriptsDir = path.join(__dirname);

const tests = [
  {
    name: '1. Webhook auto-sync (payment → status=paid)',
    cmd: `node "${path.join(scriptsDir, 'test_payment_webhook_flow.js')}" "${apiUrl}" "${envFile}" "${paymentMethod}"`,
  },
  {
    name: '2. Frontend activation (Dashboard + Library show active package)',
    cmd: `node "${path.join(scriptsDir, 'test_frontend_payment_activation.js')}" "${frontendUrl}" "${apiUrl}" "${envFile}" "${paymentMethod}"`,
  },
];

let passed = 0;
let failed = 0;
const results = [];

console.log(`\n=== Regression Test Suite ===`);
console.log(`API:      ${apiUrl}`);
console.log(`Frontend: ${frontendUrl}`);
console.log(`Method:   ${paymentMethod}`);
console.log(`=============================\n`);

for (const test of tests) {
  process.stdout.write(`Running: ${test.name} ... `);
  try {
    const output = execSync(test.cmd, { encoding: 'utf8', timeout: 90000 });
    // Find the last JSON block in output (scripts output multi-line JSON at end)
    const jsonMatch = output.match(/(\{[\s\S]*\})\s*$/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
    if (parsed && parsed.ok) {
      console.log('PASS');
      results.push({ name: test.name, status: 'PASS', detail: parsed });
      passed++;
    } else {
      console.log('FAIL (ok=false)');
      results.push({ name: test.name, status: 'FAIL', detail: parsed || output });
      failed++;
    }
  } catch (err) {
    console.log('FAIL (error)');
    const errDetail = err.stdout || err.message || String(err);
    results.push({ name: test.name, status: 'FAIL', detail: errDetail });
    failed++;
  }
}

console.log('\n=== Results ===');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${r.name}`);
  if (r.status === 'FAIL') {
    console.log('  Detail:', typeof r.detail === 'string' ? r.detail.slice(0, 300) : JSON.stringify(r.detail));
  }
}

console.log(`\n${passed}/${tests.length} passed`);
if (failed > 0) {
  process.exit(1);
}
