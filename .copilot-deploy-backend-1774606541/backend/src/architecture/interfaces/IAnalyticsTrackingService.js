class IAnalyticsTrackingService {
  async trackEvent(_payload) {
    throw new Error('trackEvent() must be implemented');
  }

  async summarizeUserAnalytics(_userId) {
    throw new Error('summarizeUserAnalytics() must be implemented');
  }
}

module.exports = IAnalyticsTrackingService;
