const express = require('express');
const bundleService = require('../services/bundleService');

const router = express.Router();

// Get bundle detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detail = await bundleService.getBundleDetail(id);
    res.json(detail);
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('not found')) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
