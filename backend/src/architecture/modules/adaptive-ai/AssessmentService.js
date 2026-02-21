const supabase = require('../../../config/supabase');
const IAssessmentService = require('../../interfaces/IAssessmentService');

class AssessmentService extends IAssessmentService {
  async recordQuestionAttempt({ userId, attemptId, questionId, topic, isCorrect, score, timeSpentMs, progressPercent, metadata }) {
    const { data, error } = await supabase
      .from('learning_events')
      .insert([
        {
          user_id: userId,
          attempt_id: attemptId || null,
          question_id: questionId || null,
          topic: topic || 'GENERAL',
          event_name: 'question_attempt',
          is_correct: typeof isCorrect === 'boolean' ? isCorrect : null,
          score: score ?? null,
          time_spent_ms: timeSpentMs ?? null,
          progress_percent: progressPercent ?? null,
          metadata: metadata || null,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async finalizeAttempt({ userId, sourceAttemptId, totalScore, progressPercent, metadata }) {
    const { data, error } = await supabase
      .from('attempts')
      .insert([
        {
          user_id: userId,
          source_attempt_id: sourceAttemptId || null,
          source_type: 'tryout',
          total_score: Number(totalScore || 0),
          progress_percent: Number(progressPercent || 100),
          completed_at: new Date().toISOString(),
          metadata: metadata || null,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new AssessmentService();
