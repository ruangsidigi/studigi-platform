const eventPublisher = require('../core/events/eventPublisher');
const EVENTS = require('../core/events/eventTypes');
const gamificationService = require('../modules/gamification/GamificationService');

const registerGamificationWorker = () => {
  eventPublisher.subscribe(EVENTS.SCORE_UPDATED, async (event) => {
    const gamification = gamificationService.updateXpAndLevel({
      score: event.score,
      passed: event.analytics?.prediction?.probability >= 60,
    });

    await eventPublisher.publish(EVENTS.XP_UPDATED, {
      userId: event.userId,
      attemptId: event.attemptId,
      ...gamification,
    });

    const streak = gamificationService.updateStreak({
      lastStudyDate: null,
      today: new Date(),
    });

    await eventPublisher.publish(EVENTS.STREAK_UPDATED, {
      userId: event.userId,
      attemptId: event.attemptId,
      ...streak,
    });
  });
};

module.exports = { registerGamificationWorker };
