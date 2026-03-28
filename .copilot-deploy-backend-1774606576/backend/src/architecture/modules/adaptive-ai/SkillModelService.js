const supabase = require('../../../config/supabase');
const ISkillModel = require('../../interfaces/ISkillModel');

class SkillModelService extends ISkillModel {
  async updateSkill({ userId, topic, isCorrect, timeSpentMs }) {
    const normalizedTopic = String(topic || 'GENERAL').toUpperCase();

    const { data: current, error: currentError } = await supabase
      .from('user_skills')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', normalizedTopic)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);

    const totalAnswered = Number(current?.total_answered || 0) + 1;
    const previousAccuracy = Number(current?.accuracy || 0);
    const previousAvgTime = Number(current?.avg_time_ms || 0);
    const accuracy = ((previousAccuracy * Number(current?.total_answered || 0)) + (isCorrect ? 1 : 0)) / totalAnswered;
    const avgTimeMs = Math.round(((previousAvgTime * Number(current?.total_answered || 0)) + Number(timeSpentMs || 60000)) / totalAnswered);

    const accuracyScore = accuracy * 100;
    const speedScore = Math.max(0, Math.min(100, (60000 / Math.max(1000, avgTimeMs)) * 100));
    const skillScore = Number(((accuracyScore * 0.7) + (speedScore * 0.3)).toFixed(2));

    const { data, error } = await supabase
      .from('user_skills')
      .upsert([
        {
          user_id: userId,
          topic: normalizedTopic,
          skill_score: skillScore,
          accuracy: Number(accuracy.toFixed(4)),
          avg_time_ms: avgTimeMs,
          total_answered: totalAnswered,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,topic' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getSkillSnapshot(userId) {
    const { data, error } = await supabase
      .from('user_skills')
      .select('topic, skill_score, accuracy, avg_time_ms, total_answered, updated_at')
      .eq('user_id', userId)
      .order('skill_score', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }
}

module.exports = new SkillModelService();
