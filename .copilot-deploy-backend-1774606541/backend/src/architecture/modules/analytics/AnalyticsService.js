const masteryEngine = require('./SkillMasteryEngine');
const predictor = require('./PassingProbabilityPredictor');

class AnalyticsService {
  async updateAnalytics({ userId, attemptData }) {
    const mastery = masteryEngine.computeTopicMastery({ answers: attemptData.answers });

    const prediction = predictor.predict({
      averageScore: attemptData.averageScore,
      trend: attemptData.trend,
      consistency: attemptData.consistency,
    });

    return {
      userId,
      mastery,
      prediction,
    };
  }
}

module.exports = new AnalyticsService();
