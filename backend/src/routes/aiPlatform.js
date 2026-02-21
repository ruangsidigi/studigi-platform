const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const skillModelService = require('../architecture/modules/adaptive-ai/SkillModelService');
const recommendationEngine = require('../architecture/modules/adaptive-ai/RecommendationEngineService');
const analyticsTrackingService = require('../architecture/modules/adaptive-ai/AnalyticsTrackingService');
const studyPlannerService = require('../architecture/modules/adaptive-ai/StudyPlannerService');

const router = express.Router();
router.use(authenticateToken);

router.get('/skills', async (req, res) => {
  try {
    const data = await skillModelService.getSkillSnapshot(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const data = await recommendationEngine.getUserRecommendations(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const data = await analyticsTrackingService.summarizeUserAnalytics(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/study-plan', async (req, res) => {
  try {
    const data = await studyPlannerService.generateStudyPlan(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
