class SkillMasteryEngine {
  computeTopicMastery({ answers = [] }) {
    const map = new Map();

    answers.forEach((item) => {
      const topic = item.topic || 'UNKNOWN';
      const current = map.get(topic) || { topic, attempts: 0, correct: 0 };
      current.attempts += 1;
      if (item.isCorrect) current.correct += 1;
      map.set(topic, current);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      accuracy: row.attempts ? Math.round((row.correct / row.attempts) * 100) : 0,
    }));
  }
}

module.exports = new SkillMasteryEngine();
