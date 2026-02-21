const eventPublisher = require('../core/events/eventPublisher');
const EVENTS = require('../core/events/eventTypes');
const platformEventProcessor = require('../../platform/events/PlatformEventProcessor');

const registerPlatformEventWorker = () => {
  eventPublisher.subscribe(EVENTS.ATTEMPT_SUBMITTED, async (event) => {
    await platformEventProcessor.onAttemptSubmitted(event);
  });

  eventPublisher.subscribe(EVENTS.CONTENT_VIEWED, async (event) => {
    await platformEventProcessor.onContentViewed(event);
  });

  eventPublisher.subscribe(EVENTS.SKILL_UPDATED, async (event) => {
    await platformEventProcessor.onSkillUpdated(event);
  });
};

module.exports = { registerPlatformEventWorker };
