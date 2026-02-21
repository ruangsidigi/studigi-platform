const supabase = require('../../config/supabase');
const {
  getUserCompletedSessions,
  getTopicMasteryFromAnswers,
  computeAnalytics,
  saveAnalyticsSummary,
} = require('./analyticsEngine');
const {
  calculateXpGain,
  upsertXp,
  upsertStreak,
  awardBadges,
} = require('./gamificationService');
const {
  upsertTopicMastery,
  generateRecommendations,
} = require('./recommendationService');
const { computePassingProbability } = require('./predictionService');

const upsertUserProgress = async (userId, sessions, analytics) => {
  const latestScore = sessions.length > 0 ? Number(sessions[sessions.length - 1].total_score || 0) : 0;
  const passedAttempts = sessions.filter((session) => session.is_passed).length;
  const completionPercent = Math.max(0, Math.min(100, Math.round((latestScore / 500) * 100)));

  const payload = {
    user_id: userId,
    current_score: latestScore,
    completion_percent: completionPercent,
    total_attempts: sessions.length,
    passed_attempts: passedAttempts,
    last_attempt_at: sessions[sessions.length - 1]?.finished_at || null,
    updated_at: new Date(),
  };

  const { error } = await supabase.from('user_progress').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);

  return payload;
};

const runRetentionUpdate = async ({ userId, attemptId }) => {
  const sessions = await getUserCompletedSessions(userId);
  const sessionIds = sessions.map((session) => session.id);
  const masteryRows = await getTopicMasteryFromAnswers(userId, sessionIds);
  const analytics = computeAnalytics(sessions, masteryRows);
  const prediction = computePassingProbability(analytics);

  await upsertUserProgress(userId, sessions, analytics);
  await upsertTopicMastery(userId, masteryRows);
  const recommendations = await generateRecommendations(userId, masteryRows);

  const latestAttempt = sessions[sessions.length - 1] || { total_score: 0, is_passed: false, finished_at: new Date() };
  const gainedXp = calculateXpGain(latestAttempt);
  const xp = await upsertXp(userId, gainedXp);
  const streak = await upsertStreak(userId, latestAttempt.finished_at);
  await awardBadges(userId, {
    totalAttempts: sessions.length,
    currentStreak: streak.current_streak,
    level: xp.level,
    latestPassed: !!latestAttempt.is_passed,
  });

  await saveAnalyticsSummary(
    userId,
    attemptId,
    analytics,
    prediction.probability,
    {
      recommendations: recommendations.map((rec) => ({ topic: rec.topic_name, priority: rec.priority })),
      mastery: masteryRows,
      latestScore: Number(latestAttempt.total_score || 0),
      gainedXp,
      level: xp.level,
      streak: streak.current_streak,
    }
  );

  return {
    analytics,
    prediction,
    gamification: {
      gainedXp,
      level: xp.level,
      totalXp: xp.total_xp,
      streak: streak.current_streak,
    },
  };
};

module.exports = {
  runRetentionUpdate,
};
