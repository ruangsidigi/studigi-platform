// backend/services/payments/index.js
const express = require('express');
const router = express.Router();
const config = require('../../shared/config');

// Creates a checkout session with external payment provider (adapter placeholder)
router.post('/api/payments/checkout', async (req, res) => {
  // In production, create session via provider SDK using config.paymentApiKey
  const { bundle_id, success_url, cancel_url } = req.body || {};
  if (!bundle_id) return res.status(400).json({ error: 'bundle_id required' });
  // placeholder: return mock session id
  return res.json({ sessionId: `mock_${bundle_id}_${Date.now()}` });
});

// Webhook endpoint to receive provider events
router.post('/api/payments/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  // Validate signature and process event. This is a skeleton.
  console.log('payment webhook received');
  res.status(200).send('ok');
});

module.exports = router;
