class IRecommendationEngine {
  async generateForTopic(_payload) {
    throw new Error('generateForTopic() must be implemented');
  }

  async getUserRecommendations(_userId) {
    throw new Error('getUserRecommendations() must be implemented');
  }
}

module.exports = IRecommendationEngine;
