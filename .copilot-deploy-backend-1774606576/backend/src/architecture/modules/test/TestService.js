const eventPublisher = require('../../core/events/eventPublisher');
const EVENTS = require('../../core/events/eventTypes');

class TestService {
  async startTest({ userId, packageId }) {
    const session = { id: Date.now(), userId, packageId, status: 'in_progress' };

    await eventPublisher.publish(EVENTS.TEST_STARTED, {
      userId,
      packageId,
      attemptId: session.id,
    });

    return session;
  }

  async submitTest({ userId, attemptId, answers }) {
    // score calculation placeholder
    const score = 420;

    await eventPublisher.publish(EVENTS.TEST_SUBMITTED, {
      userId,
      attemptId,
      answers,
      score,
    });

    return { attemptId, score };
  }
}

module.exports = new TestService();
