class ReportService {
  async getOverview(userId) {
    // aggregate attempts -> KPI
    return {
      userId,
      totalTests: 0,
      averageScore: 0,
      highestScore: 0,
    };
  }

  async getAttemptDetail(userId, attemptId) {
    return {
      userId,
      attemptId,
      sections: [],
      review: [],
    };
  }
}

module.exports = new ReportService();
