class GamificationService {
  updateXpAndLevel({ score, passed }) {
    const baseXp = 50;
    const gain = baseXp + Math.round((score || 0) / 10) + (passed ? 30 : 0);
    return { gainedXp: gain };
  }

  updateStreak({ lastStudyDate, today }) {
    // streak update algorithm placeholder
    return { currentStreak: 1, longestStreak: 1 };
  }
}

module.exports = new GamificationService();
