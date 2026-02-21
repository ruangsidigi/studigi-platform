const supabase = require('../../config/supabase');

class AnalyticsService {
  mapEventType(eventType) {
    const normalized = String(eventType || '').toLowerCase();
    if (normalized === 'content_viewed') return 'view';
    if (normalized === 'skill_updated') return 'progress';
    return 'completion';
  }

  async track({ userId, attemptId, eventType, metricName, metricValue, payload }) {
    const mappedEventType = this.mapEventType(eventType);
    const { data, error } = await supabase
      .from('analytics')
      .insert([
        {
          user_id: userId,
          event_type: mappedEventType,
          progress_percent: metricName === 'progress_percent' ? Number(metricValue || 0) : null,
          session_id: attemptId ? String(attemptId) : null,
          metadata: {
            platform_event_type: eventType,
            metric_name: metricName || null,
            metric_value: typeof metricValue === 'number' ? metricValue : null,
            payload: payload || null,
          },
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getOverview(userId) {
    const { data, error } = await supabase
      .from('analytics')
      .select('event_type, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const rows = data || [];
    const platformEventTypeOf = (row) => row?.metadata?.platform_event_type || row?.event_type || null;

    return {
      totalEvents: rows.length,
      attemptsSubmitted: rows.filter((row) => platformEventTypeOf(row) === 'attempt_submitted').length,
      contentsViewed: rows.filter((row) => platformEventTypeOf(row) === 'content_viewed').length,
      skillsUpdated: rows.filter((row) => platformEventTypeOf(row) === 'skill_updated').length,
      latest: rows[0] || null,
    };
  }
}

module.exports = new AnalyticsService();
