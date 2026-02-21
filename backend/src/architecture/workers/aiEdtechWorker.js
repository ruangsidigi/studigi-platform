const eventPublisher = require('../core/events/eventPublisher');
const EVENTS = require('../core/events/eventTypes');
const eventProcessingFlow = require('../modules/adaptive-ai/EventProcessingFlow');

const registerAiEdtechWorker = () => {
  eventPublisher.subscribe(EVENTS.QUESTION_ATTEMPTED, async (event) => {
    await eventProcessingFlow.processQuestionAttempt(event);
  });

  eventPublisher.subscribe(EVENTS.ATTEMPT_COMPLETED, async (event) => {
    await eventProcessingFlow.processAttemptCompleted(event);
  });
};

module.exports = { registerAiEdtechWorker };
