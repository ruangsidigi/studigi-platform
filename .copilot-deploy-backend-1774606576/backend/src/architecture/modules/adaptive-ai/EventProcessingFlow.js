const assessmentService = require('./AssessmentService');
const skillModelService = require('./SkillModelService');
const recommendationEngine = require('./RecommendationEngineService');
const analyticsTracking = require('./AnalyticsTrackingService');
const studyPlannerService = require('./StudyPlannerService');

class EventProcessingFlow {
  async processQuestionAttempt(event) {
    const attemptRecord = await assessmentService.recordQuestionAttempt({
      userId: event.userId,
      attemptId: event.attemptId,
      questionId: event.questionId,
      topic: event.topic,
      isCorrect: event.isCorrect,
      score: event.score,
      timeSpentMs: event.timeSpentMs,
      progressPercent: event.progressPercent,
      metadata: event,
    });

    const updatedSkill = await skillModelService.updateSkill({
      userId: event.userId,
      topic: event.topic,
      isCorrect: event.isCorrect,
      timeSpentMs: event.timeSpentMs,
    });

    const recommendation = await recommendationEngine.generateForTopic({
      userId: event.userId,
      topic: event.topic,
      skillScore: Number(updatedSkill.skill_score || 0),
      accuracy: Number(updatedSkill.accuracy || 0),
    });

    await analyticsTracking.trackEvent({
      userId: event.userId,
      attemptId: event.attemptId,
      eventType: 'QUESTION_ATTEMPTED',
      metricName: 'progress',
      metricValue: Number(event.progressPercent || 0),
      payload: {
        topic: event.topic,
        isCorrect: event.isCorrect,
        timeSpentMs: event.timeSpentMs,
      },
    });

    return { attemptRecord, updatedSkill, recommendation };
  }

  async processAttemptCompleted(event) {
    const attempt = await assessmentService.finalizeAttempt({
      userId: event.userId,
      sourceAttemptId: event.attemptId,
      totalScore: event.score,
      progressPercent: 100,
      metadata: event,
    });

    await analyticsTracking.trackEvent({
      userId: event.userId,
      attemptId: event.attemptId,
      eventType: 'ATTEMPT_COMPLETED',
      metricName: 'score',
      metricValue: Number(event.score || 0),
      payload: event,
    });

    const studyPlan = await studyPlannerService.generateStudyPlan(event.userId);

    return { attempt, studyPlan };
  }
}

module.exports = new EventProcessingFlow();
