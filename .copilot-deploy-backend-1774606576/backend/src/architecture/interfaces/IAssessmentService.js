class IAssessmentService {
  async recordQuestionAttempt(_payload) {
    throw new Error('recordQuestionAttempt() must be implemented');
  }

  async finalizeAttempt(_payload) {
    throw new Error('finalizeAttempt() must be implemented');
  }
}

module.exports = IAssessmentService;
