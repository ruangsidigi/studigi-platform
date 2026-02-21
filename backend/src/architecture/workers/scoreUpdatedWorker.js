const eventPublisher = require('../core/events/eventPublisher');
const EVENTS = require('../core/events/eventTypes');
const { runRetentionUpdate } = require('../../services/dashboard/retentionPipeline');

const registerScoreUpdatedWorker = () => {
  eventPublisher.subscribe(EVENTS.TEST_SUBMITTED, async (event) => {
    const retentionResult = await runRetentionUpdate({
      userId: event.userId,
      attemptId: event.attemptId,
    });

    await eventPublisher.publish(EVENTS.SCORE_UPDATED, {
      userId: event.userId,
      attemptId: event.attemptId,
      score: event.score,
      analytics: retentionResult.analytics,
      prediction: retentionResult.prediction,
      gamification: retentionResult.gamification,
    });
  });
};

module.exports = { registerScoreUpdatedWorker };
