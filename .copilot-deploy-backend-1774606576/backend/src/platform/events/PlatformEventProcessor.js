const assessmentEngine = require('../services/AssessmentEngineService');
const contentService = require('../services/ContentService');
const skillModel = require('../services/SkillModelService');
const recommendationEngine = require('../services/RecommendationEngineService');
const analyticsService = require('../services/AnalyticsService');
const eventPublisher = require('../../architecture/core/events/eventPublisher');
const EVENTS = require('../../architecture/core/events/eventTypes');

class PlatformEventProcessor {
  async onAttemptSubmitted(event) {
    await assessmentEngine.recordAttempt({
      userId: event.userId,
      attemptId: event.attemptId,
      questionId: event.questionId,
      topic: event.topic,
      isCorrect: event.isCorrect,
      score: event.score,
      timeSpentMs: event.timeSpentMs,
      progressPercent: event.progressPercent,
    });

    const skill = await skillModel.upsertUserSkill({
      userId: event.userId,
      topic: event.topic,
      isCorrect: event.isCorrect,
      timeSpentMs: event.timeSpentMs,
    });

    await eventPublisher.publish(EVENTS.SKILL_UPDATED, {
      userId: event.userId,
      attemptId: event.attemptId,
      topic: event.topic,
      skillScore: Number(skill.skill_score || 0),
      accuracy: Number(skill.accuracy || 0),
      confidence: Number(skill.confidence || 0),
    });

    await analyticsService.track({
      userId: event.userId,
      attemptId: event.attemptId,
      eventType: 'attempt_submitted',
      metricName: 'score',
      metricValue: Number(event.score || 0),
      payload: event,
    });
  }

  async onContentViewed(event) {
    await contentService.markViewed({
      userId: event.userId,
      contentId: event.contentId,
      topic: event.topic,
      timeSpentMs: event.timeSpentMs,
    });

    await analyticsService.track({
      userId: event.userId,
      attemptId: event.attemptId,
      eventType: 'content_viewed',
      metricName: 'time_spent_ms',
      metricValue: Number(event.timeSpentMs || 0),
      payload: event,
    });
  }

  async onSkillUpdated(event) {
    await recommendationEngine.generateForSkill({
      userId: event.userId,
      topic: event.topic,
      skillScore: Number(event.skillScore || 0),
      accuracy: Number(event.accuracy || 0),
      confidence: Number(event.confidence || 0),
    });

    await analyticsService.track({
      userId: event.userId,
      attemptId: event.attemptId,
      eventType: 'skill_updated',
      metricName: 'skill_score',
      metricValue: Number(event.skillScore || 0),
      payload: event,
    });
  }
}

module.exports = new PlatformEventProcessor();
