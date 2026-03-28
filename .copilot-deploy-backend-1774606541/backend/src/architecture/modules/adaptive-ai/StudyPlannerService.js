const IStudyPlannerService = require('../../interfaces/IStudyPlannerService');
const skillModelService = require('./SkillModelService');
const recommendationEngine = require('./RecommendationEngineService');

class StudyPlannerService extends IStudyPlannerService {
  async generateStudyPlan(userId) {
    const skills = await skillModelService.getSkillSnapshot(userId);
    const recommendations = await recommendationEngine.getUserRecommendations(userId);

    const prioritizedTopics = [...skills]
      .sort((a, b) => Number(a.skill_score || 0) - Number(b.skill_score || 0))
      .slice(0, 5)
      .map((item, index) => ({
        priority: index + 1,
        topic: item.topic,
        action: Number(item.skill_score || 0) < 60
          ? 'Latihan dasar 15 soal + review konsep'
          : Number(item.skill_score || 0) < 80
            ? 'Latihan campuran 10 soal + evaluasi kesalahan'
            : 'Challenge set 10 soal difficulty tinggi',
      }));

    return {
      generatedAt: new Date().toISOString(),
      priorities: prioritizedTopics,
      recommendations,
    };
  }
}

module.exports = new StudyPlannerService();
