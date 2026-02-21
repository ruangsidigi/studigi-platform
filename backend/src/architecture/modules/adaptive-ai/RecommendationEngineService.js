const supabase = require('../../../config/supabase');
const IRecommendationEngine = require('../../interfaces/IRecommendationEngine');

class RecommendationEngineService extends IRecommendationEngine {
  async generateForTopic({ userId, topic, skillScore, accuracy }) {
    const recommendationType = skillScore < 55 ? 'practice' : skillScore < 75 ? 'review' : 'challenge';
    const reason = recommendationType === 'practice'
      ? `Topik ${topic} masih lemah. Fokus latihan dasar untuk meningkatkan akurasi.`
      : recommendationType === 'review'
        ? `Topik ${topic} cukup baik. Review pola kesalahan untuk stabilitas.`
        : `Topik ${topic} sudah kuat. Naikkan tingkat kesulitan.`;

    const { data, error } = await supabase
      .from('recommendations')
      .insert([
        {
          user_id: userId,
          topic,
          recommendation_type: recommendationType,
          reason,
          priority: recommendationType === 'practice' ? 3 : recommendationType === 'review' ? 2 : 1,
          status: 'active',
          metadata: { skillScore, accuracy },
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getUserRecommendations(userId) {
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
