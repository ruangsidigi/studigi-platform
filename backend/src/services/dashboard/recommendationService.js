const supabase = require('../../config/supabase');
const { masteryLevel } = require('./helpers');

const upsertTopicMastery = async (userId, masteryRows) => {
  if (!masteryRows || masteryRows.length === 0) return [];

  const payload = masteryRows.map((row) => ({
    user_id: userId,
    topic_name: row.topic,
    attempts_count: row.attempts,
    correct_count: row.correct,
    wrong_count: row.wrong,
    accuracy_percent: row.accuracy,
    mastery_level: masteryLevel(row.accuracy),
    updated_at: new Date(),
  }));

  const { error } = await supabase.from('topic_mastery').upsert(payload, { onConflict: 'user_id,topic_name' });
  if (error) throw new Error(error.message);

  return payload;
};

const generateRecommendations = async (userId, masteryRows) => {
  const weakTopics = (masteryRows || [])
    .filter((row) => row.topic !== 'TKP' && row.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const recs = weakTopics.map((topic, index) => ({
    user_id: userId,
    topic_name: topic.topic,
    priority: index + 1,
    recommendation_text: `Fokus latihan ${topic.topic}. Akurasi saat ini ${topic.accuracy}%. Prioritaskan 20-30 soal bertahap + review pembahasan.`,
    source: 'engine',
    is_active: true,
    updated_at: new Date(),
  }));

  // deactivate old recommendations from engine
  await supabase
    .from('study_recommendations')
    .update({ is_active: false, updated_at: new Date() })
    .eq('user_id', userId)
    .eq('source', 'engine');

  if (recs.length > 0) {
    const { error } = await supabase.from('study_recommendations').insert(recs);
    if (error) throw new Error(error.message);
  }

  return recs;
};

module.exports = {
  upsertTopicMastery,
  generateRecommendations,
};
