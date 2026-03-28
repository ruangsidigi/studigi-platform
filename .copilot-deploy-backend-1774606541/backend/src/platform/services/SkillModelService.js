const supabase = require('../../config/supabase');

class SkillModelService {
  computeSkillScore({ accuracy, avgTimeMs, totalAnswered }) {
    const accuracyScore = Math.max(0, Math.min(100, Number(accuracy) * 100));
    const speedScore = Math.max(0, Math.min(100, (60000 / Math.max(1000, Number(avgTimeMs || 60000))) * 100));
    const confidence = Math.max(0, Math.min(100, (1 - Math.exp(-Number(totalAnswered || 0) / 20)) * 100));

    const skillScore = Number(((accuracyScore * 0.6) + (speedScore * 0.25) + (confidence * 0.15)).toFixed(2));
    return { skillScore, confidence: Number(confidence.toFixed(2)) };
  }

  async upsertUserSkill({ userId, topic, isCorrect, timeSpentMs }) {
    const normalizedTopic = String(topic || 'GENERAL').toUpperCase();

    const { data: current, error: currentError } = await supabase
      .from('user_skills')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', normalizedTopic)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);

    const previousTotal = Number(current?.total_answered || 0);
    const totalAnswered = previousTotal + 1;
    const previousAccuracy = Number(current?.accuracy || 0);
    const previousAvgTime = Number(current?.avg_time_ms || 0);

    const accuracy = ((previousAccuracy * previousTotal) + (isCorrect ? 1 : 0)) / totalAnswered;
    const avgTimeMs = Math.round(((previousAvgTime * previousTotal) + Number(timeSpentMs || 60000)) / totalAnswered);
    const { skillScore, confidence } = this.computeSkillScore({ accuracy, avgTimeMs, totalAnswered });

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
          confidence,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,topic' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from('feature_store')
      .upsert([
        {
          entity_type: 'user_topic',
          entity_id: `${userId}:${normalizedTopic}`,
          feature_name: 'skill_score',
          feature_value: Number(skillScore),
          feature_vector: {
            accuracy: Number(accuracy.toFixed(4)),
            avgTimeMs,
            totalAnswered,
            confidence,
          },
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'entity_type,entity_id,feature_name' });

    return data;
  }

  async getSkillSnapshot(userId) {
    const { data, error } = await supabase
      .from('user_skills')
      .select('topic, skill_score, accuracy, avg_time_ms, total_answered, confidence, updated_at')
      .eq('user_id', userId)
      .order('skill_score', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }
}

module.exports = new SkillModelService();
