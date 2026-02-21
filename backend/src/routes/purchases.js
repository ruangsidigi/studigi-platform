const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Get user purchases
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*, packages(*)')
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create purchase
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { packageIds, totalPrice, paymentMethod = 'transfer' } = req.body;

    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
      return res.status(400).json({ error: 'Package IDs array is required' });
    }

    // Create purchase records
    const purchaseData = packageIds.map((packageId) => ({
      user_id: userId,
      package_id: packageId,
      payment_method: paymentMethod,
      payment_status: 'completed',
      total_price: totalPrice / packageIds.length, // Simple division, can be improved
      created_at: new Date(),
    }));

    const { data: purchases, error } = await supabase
      .from('purchases')
      .insert(purchaseData)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Purchase successful',
      purchases: purchases,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all purchases (Admin only)
router.get('/admin/all', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { data: allPurchases, error } = await supabase
      .from('purchases')
      .select('*, users(id, name, email), packages(id, name, type)')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(allPurchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
