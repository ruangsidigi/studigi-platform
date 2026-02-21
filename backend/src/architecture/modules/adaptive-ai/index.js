const assessmentService = require('./AssessmentService');
const recommendationEngine = require('./RecommendationEngineService');
const skillModelService = require('./SkillModelService');
const analyticsTrackingService = require('./AnalyticsTrackingService');
const studyPlannerService = require('./StudyPlannerService');
const eventProcessingFlow = require('./EventProcessingFlow');

module.exports = {
  assessmentService,
  recommendationEngine,
  skillModelService,
  analyticsTrackingService,
  studyPlannerService,
  eventProcessingFlow,
};
