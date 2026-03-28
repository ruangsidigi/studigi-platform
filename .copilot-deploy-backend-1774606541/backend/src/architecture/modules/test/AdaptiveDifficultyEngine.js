class AdaptiveDifficultyEngine {
  selectQuestions({ userProfile, questionBank, count = 100 }) {
    // Difficulty strategy:
    // - weak topics -> easier+medium first
    // - strong topics -> medium+hard
    // - keep blueprint balance per section
    const weakTopics = userProfile?.weakTopics || [];

    const prioritized = [...questionBank].sort((a, b) => {
      const aWeakBoost = weakTopics.includes(a.topic) ? -1 : 0;
      const bWeakBoost = weakTopics.includes(b.topic) ? -1 : 0;
      return aWeakBoost - bWeakBoost;
    });

    return prioritized.slice(0, count);
  }
}

module.exports = new AdaptiveDifficultyEngine();
