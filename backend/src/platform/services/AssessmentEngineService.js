const supabase = require('../../config/supabase');

class AssessmentEngineService {
  async recordAttempt({ userId, attemptId, questionId, topic, isCorrect, score, timeSpentMs, progressPercent }) {
    const { data, error } = await supabase
      .from('learning_events')
      .insert([
        {
          event_type: 'attempt_submitted',
          user_id: userId,
          attempt_id: attemptId || null,
          question_id: questionId || null,
          topic: String(topic || 'GENERAL').toUpperCase(),
          is_correct: Boolean(isCorrect),
          score: Number(score || 0),
          time_spent_ms: Number(timeSpentMs || 60000),
          payload: {
            source: 'assessment_engine',
            progressPercent: Number(progressPercent || 0),
          },
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new AssessmentEngineService();
