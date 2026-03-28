const supabase = require('../../config/supabase');
const { safePercent, toNumber, trendSlope } = require('./helpers');

const getUserCompletedSessions = async (userId) => {
  const { data, error } = await supabase
    .from('tryout_sessions')
    .select('id, package_id, total_score, is_passed, twk_score, tiu_score, tkp_score, finished_at, created_at, status')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
};

const getTopicMasteryFromAnswers = async (userId, sessionIds) => {
  if (!sessionIds || sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('tryout_answers')
    .select('session_id, user_answer, questions(category, correct_answer)')
    .in('session_id', sessionIds);

  if (error) throw new Error(error.message);

  const map = new Map();

  (data || []).forEach((row) => {
    const topic = (row.questions?.category || 'LAINNYA').toUpperCase();
    const current = map.get(topic) || { topic, attempts: 0, correct: 0, wrong: 0 };

    // Objective sections only for correctness calc
    if (topic === 'TWK' || topic === 'TIU') {
      current.attempts += 1;
      const ok = row.user_answer && row.user_answer === row.questions?.correct_answer;
      if (ok) current.correct += 1;
      else current.wrong += 1;
    } else {
      // Keep visibility for TKP as attempt without objective correctness
      current.attempts += 1;
    }

    map.set(topic, current);
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    accuracy: row.topic === 'TKP' ? 0 : safePercent(row.correct, Math.max(1, row.correct + row.wrong)),
  }));
};

const computeAnalytics = (sessions, masteryRows) => {
  const totalAttempts = sessions.length;
  const avgScore = totalAttempts > 0
    ? Number((sessions.reduce((sum, item) => sum + toNumber(item.total_score), 0) / totalAttempts).toFixed(2))
    : 0;
  const passRate = safePercent(sessions.filter((item) => item.is_passed).length, totalAttempts);
  const trend = trendSlope(sessions.map((item) => toNumber(item.total_score)));

  const sortedByAccuracy = [...masteryRows].sort((a, b) => b.accuracy - a.accuracy);
  const strongestTopic = sortedByAccuracy[0]?.topic || null;
  const weakestTopic = sortedByAccuracy[sortedByAccuracy.length - 1]?.topic || null;

  return {
    averageScore: avgScore,
    trendScore: trend,
    passRate,
    strongestTopic,
    weakestTopic,
  };
};

const saveAnalyticsSummary = async (userId, attemptId, analytics, predictionProbability, snapshot) => {
  const { error } = await supabase.from('analytics_summary').insert([
    {
      user_id: userId,
      attempt_id: attemptId,
      average_score: analytics.averageScore,
      trend_score: analytics.trendScore,
      pass_rate: analytics.passRate,
      strongest_topic: analytics.strongestTopic,
      weakest_topic: analytics.weakestTopic,
      prediction_pass_probability: predictionProbability,
      snapshot,
      created_at: new Date(),
    },
  ]);

  if (error) throw new Error(error.message);
};

module.exports = {
  getUserCompletedSessions,
  getTopicMasteryFromAnswers,
  computeAnalytics,
  saveAnalyticsSummary,
};
