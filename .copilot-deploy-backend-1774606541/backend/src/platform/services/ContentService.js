const supabase = require('../../config/supabase');

class ContentService {
  async markViewed({ userId, contentId, topic, timeSpentMs = 0 }) {
    const { data, error } = await supabase
      .from('learning_events')
      .insert([
        {
          event_type: 'content_viewed',
          user_id: userId,
          content_id: String(contentId),
          topic: topic || null,
          time_spent_ms: Number(timeSpentMs || 0),
          payload: { source: 'content_service' },
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new ContentService();
