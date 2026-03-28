const supabase = require('../../config/supabase');

class RecommendationEngineService {
  async generateForSkill({ userId, topic, skillScore, accuracy, confidence }) {
    const type = skillScore < 55 ? 'practice' : skillScore < 75 ? 'review' : 'challenge';
    const reason = type === 'practice'
      ? `Topik ${topic} lemah. Fokus latihan fundamental untuk memperbaiki akurasi.`
      : type === 'review'
        ? `Topik ${topic} menengah. Review kesalahan berulang dan timing.`
        : `Topik ${topic} kuat. Naikkan tingkat kesulitan dan variasi soal.`;

    const priority = type === 'practice' ? 3 : type === 'review' ? 2 : 1;
    const score = Number(((100 - Number(skillScore || 0)) * 0.7 + (100 - Number(confidence || 0)) * 0.3).toFixed(2));

    const { data, error } = await supabase
      .from('recommendations')
      .insert([
        {
          user_id: userId,
          topic,
          recommendation_type: type,
          reason,
          priority,
          score,
          status: 'active',
          metadata: { skillScore, accuracy, confidence },
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async listByUser(userId) {
    const { data, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    return data || [];
  }
}

module.exports = new RecommendationEngineService();
