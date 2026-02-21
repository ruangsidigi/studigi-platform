class RecommendationService {
  generate({ mastery = [] }) {
    return mastery
      .filter((topic) => topic.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((topic, index) => ({
        topic: topic.topic,
        priority: index + 1,
        recommendation: `Fokus latihan ${topic.topic}. Akurasi saat ini ${topic.accuracy}%.`,
      }));
  }
}

module.exports = new RecommendationService();
