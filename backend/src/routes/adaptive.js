const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const adaptiveService = require('../services/adaptiveService');

const router = express.Router();

router.use(authenticateToken);

// Submit answer + adaptive update
router.post('/submit-answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, topic, isCorrect, timeSpentMs, difficulty, source, metadata } = req.body;

    const result = await adaptiveService.updateSkillFromAnswer({
      userId,
      questionId,
      topic,
      isCorrect,
      timeSpentMs,
      difficulty,
      source,
      metadata,
    });

    res.json({
      message: 'Answer processed and skill updated',
      result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Manual update skill endpoint (same engine, explicit endpoint for external trigger)
router.post('/update-skill', async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, topic, isCorrect, timeSpentMs, difficulty, source, metadata } = req.body;

    const result = await adaptiveService.updateSkillFromAnswer({
      userId,
      questionId,
      topic,
      isCorrect,
      timeSpentMs,
      difficulty,
      source: source || 'manual_update',
      metadata,
    });

    res.json({
      message: 'Skill updated',
      result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/recommendation', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number(req.query.limit || 5);
    const data = await adaptiveService.getRecommendations(userId, limit);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/study-plan', async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await adaptiveService.getStudyPlan(userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await adaptiveService.getAdaptiveDashboard(userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backfill', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await adaptiveService.backfillAdaptiveFromCompletedTryouts(userId);
    res.json({
      message: result.skipped ? 'Backfill skipped' : 'Backfill completed',
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
