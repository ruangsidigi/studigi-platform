class IStudyPlannerService {
  async generateStudyPlan(_userId) {
    throw new Error('generateStudyPlan() must be implemented');
  }
}

module.exports = IStudyPlannerService;
