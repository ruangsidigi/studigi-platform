const express = require('express');

const router = express.Router();

router.get('/questions/package/:packageId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

    const result = await db.query(
      'SELECT * FROM questions WHERE package_id = $1 ORDER BY number ASC, id ASC',
      [packageId]
    );

    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/questions/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'Invalid question id' });

    const result = await db.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [questionId]);
    const question = result.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });
    return res.json(question);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
