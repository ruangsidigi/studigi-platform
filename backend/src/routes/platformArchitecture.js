const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const eventPublisher = require('../architecture/core/events/eventPublisher');
const EVENTS = require('../architecture/core/events/eventTypes');
const { listEventLogs, summarizeEventLogs } = require('../architecture/core/events/eventLogRepository');
const recommendationEngine = require('../platform/services/RecommendationEngineService');
const skillModel = require('../platform/services/SkillModelService');
const analyticsService = require('../platform/services/AnalyticsService');
const aiTutorService = require('../platform/services/AITutorService');

const router = express.Router();
router.use(authenticateToken);

const API_CONTRACTS = {
  publishAttemptSubmitted: {
    method: 'POST',
    path: '/api/platform-architecture/events/attempt-submitted',
    body: {
      attemptId: 'number',
      questionId: 'number',
      topic: 'string',
      isCorrect: 'boolean',
      score: 'number',
      timeSpentMs: 'number',
      progressPercent: 'number',
    },
  },
  publishContentViewed: {
    method: 'POST',
    path: '/api/platform-architecture/events/content-viewed',
    body: {
      contentId: 'string|number',
      topic: 'string',
      timeSpentMs: 'number',
    },
  },
  getSkills: {
    method: 'GET',
    path: '/api/platform-architecture/skills',
  },
  getRecommendations: {
    method: 'GET',
    path: '/api/platform-architecture/recommendations',
  },
  getAnalytics: {
    method: 'GET',
    path: '/api/platform-architecture/analytics',
  },
  getEventLogs: {
    method: 'GET',
    path: '/api/platform-architecture/event-logs?limit=20&status=processed&eventType=ATTEMPT_SUBMITTED',
    auth: 'admin only',
  },
  getEventLogSummary: {
    method: 'GET',
    path: '/api/platform-architecture/event-logs/summary?limit=200',
    auth: 'admin only',
  },
  aiTutorHint: {
    method: 'POST',
    path: '/api/platform-architecture/ai-tutor/hint',
    body: {
      topic: 'string',
      skillScore: 'number',
    },
  },
};

router.get('/contracts', (req, res) => {
  res.json(API_CONTRACTS);
});

router.post('/events/attempt-submitted', async (req, res) => {
  try {
    const payload = req.body || {};
    const event = await eventPublisher.publish(EVENTS.ATTEMPT_SUBMITTED, {
      userId: req.user.id,
      attemptId: payload.attemptId,
      questionId: payload.questionId,
      topic: payload.topic,
      isCorrect: payload.isCorrect,
      score: payload.score,
      timeSpentMs: payload.timeSpentMs,
      progressPercent: payload.progressPercent,
    });

    res.status(202).json({ accepted: true, event });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/events/content-viewed', async (req, res) => {
  try {
    const payload = req.body || {};
    const event = await eventPublisher.publish(EVENTS.CONTENT_VIEWED, {
      userId: req.user.id,
      contentId: payload.contentId,
      topic: payload.topic,
      timeSpentMs: payload.timeSpentMs,
      attemptId: payload.attemptId,
    });

    res.status(202).json({ accepted: true, event });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/skills', async (req, res) => {
  try {
    const data = await skillModel.getSkillSnapshot(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const data = await recommendationEngine.listByUser(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const data = await analyticsService.getOverview(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/event-logs', authorizeRole(['admin']), async (req, res) => {
  try {
    const data = await listEventLogs({
      limit: req.query.limit,
      status: req.query.status,
      eventType: req.query.eventType,
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/event-logs/summary', authorizeRole(['admin']), async (req, res) => {
  try {
    const data = await summarizeEventLogs({
      limit: req.query.limit,
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai-tutor/hint', async (req, res) => {
  try {
    const hint = await aiTutorService.generateHint({
      topic: req.body?.topic,
      skillScore: req.body?.skillScore,
    });

    res.json({ hint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
