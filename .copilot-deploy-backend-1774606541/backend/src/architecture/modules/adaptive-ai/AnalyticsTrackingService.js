const supabase = require('../../../config/supabase');
const IAnalyticsTrackingService = require('../../interfaces/IAnalyticsTrackingService');

class AnalyticsTrackingService extends IAnalyticsTrackingService {
  async trackEvent({ userId, attemptId, eventType, metricName, metricValue, payload }) {
    const { data, error } = await supabase
      .from('analytics')
      .insert([
        {
          user_id: userId,
          attempt_id: attemptId || null,
          event_type: eventType || 'learning_event',
          entity_type: 'user',
          entity_id: String(userId),
          metric_name: metricName || null,
          metric_value: typeof metricValue === 'number' ? metricValue : null,
          payload: payload || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async summarizeUserAnalytics(userId) {
    const { data, error } = await supabase
      .from('analytics')
      .select('event_type, metric_name, metric_value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const events = data || [];
    return {
      totalEvents: events.length,
      latestEvent: events[0] || null,
      scoreEvents: events.filter((event) => event.metric_name === 'score').length,
      progressEvents: events.filter((event) => event.metric_name === 'progress').length,
    };
  }
}

module.exports = new AnalyticsTrackingService();
