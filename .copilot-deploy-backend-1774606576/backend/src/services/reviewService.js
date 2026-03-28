/**
 * Review Service
 * Handles comprehensive review functionality with bookmarks, status tracking
 */

const supabase = require('../config/supabase');

const reviewService = {
  /**
   * Get all questions for an attempt with review data
   * Returns array with status, answers, bookmarks
   */
  getAttemptReview: async (attemptId, userId) => {
    try {
      // Verify ownership
      const { data: attempt, error: attemptError } = await supabase
        .from('tryout_sessions')
        .select('id, user_id, package_id, twk_score, tiu_score, tkp_score, total_score, is_passed')
        .eq('id', attemptId)
        .eq('user_id', userId)
        .single();

      if (attemptError || !attempt) {
        throw new Error('Attempt not found or unauthorized');
      }

      // Get all answers for this attempt (without embedded questions first)
      const { data: answers, error: answersError } = await supabase
        .from('tryout_answers')
        .select('id, session_id, question_id, user_answer, is_correct')
        .eq('session_id', attemptId);

      if (answersError) throw new Error(answersError.message);

      // Get question details separately
      const questionIds = (answers || []).map((a) => a.question_id).filter(Boolean);
      let questionMap = new Map();

      if (questionIds.length > 0) {
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('id, number, category, correct_answer')
          .in('id', questionIds);

        if (questionsError) throw new Error(questionsError.message);

        questionMap = new Map((questions || []).map((q) => [q.id, q]));
      }

      // Get bookmarks for this session (if table exists)
      let bookmarkMap = new Map();
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('question_bookmarks')
        .select('question_id, notes')
        .eq('session_id', attemptId)
        .eq('user_id', userId);

      if (!bookmarksError && bookmarks) {
        bookmarkMap = new Map(
          bookmarks.map((b) => [b.question_id, b.notes])
        );
      }

      // Build review array with status
      const review = (answers || [])
        .sort((a, b) => {
          const qA = questionMap.get(a.question_id);
          const qB = questionMap.get(b.question_id);
          return (qA?.number || 0) - (qB?.number || 0);
        })
        .map((answer) => {
          const q = questionMap.get(answer.question_id);
          if (!q) {
            return null;
          }

          const userAnswer = answer.user_answer;
          const correctAnswer = q.correct_answer;
          const category = (q.category || '').toUpperCase();

          let status = 'unanswered'; // unanswered, correct, incorrect, partial
          if (!userAnswer) {
            status = 'unanswered';
          } else if (category === 'TWK' || category === 'TIU') {
            status = userAnswer === correctAnswer ? 'correct' : 'incorrect';
          } else if (category === 'TKP') {
            status = 'partial'; // TKP doesn't have definitive answers
          }

          return {
            questionId: q.id,
            questionNumber: q.number,
            category,
            status,
            userAnswer: userAnswer || null,
            correctAnswer: correctAnswer || null,
            isBookmarked: bookmarkMap.has(q.id),
            bookmarkNotes: bookmarkMap.get(q.id) || null,
          };
        })
        .filter(Boolean); // Remove null entries

      // Calculate statistics
      const stats = {
        total: review.length,
        correct: review.filter((q) => q.status === 'correct').length,
        incorrect: review.filter((q) => q.status === 'incorrect').length,
        unanswered: review.filter((q) => q.status === 'unanswered').length,
        bookmarked: review.filter((q) => q.isBookmarked).length,
      };

      return {
        attempt: {
          id: attempt.id,
          twkScore: Math.round(Number(attempt.twk_score || 0)),
          tiuScore: Math.round(Number(attempt.tiu_score || 0)),
          tkpScore: Number(attempt.tkp_score || 0),
          totalScore: attempt.total_score,
          isPassed: attempt.is_passed,
          status: attempt.is_passed ? 'LULUS' : 'TIDAK LULUS',
        },
        review,
        stats,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get detailed question with options
   */
  getQuestionDetail: async (attemptId, questionNumber, userId) => {
    try {
      // Get attempt and verify ownership
      const { data: attempt, error: attemptError } = await supabase
        .from('tryout_sessions')
        .select('id, user_id')
        .eq('id', attemptId)
        .eq('user_id', userId)
        .single();

      if (attemptError || !attempt) {
        throw new Error('Attempt not found or unauthorized');
      }

      // Get answers with question details directly
      const { data: answers, error: answersError } = await supabase
        .from('tryout_answers')
        .select('id, user_answer, is_correct, question_id, questions(id, number, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, category, image_url)')
        .eq('session_id', attemptId);

      if (answersError) {
        // If embed fails, try separate queries
        const { data: answersNoEmbed, error: e2 } = await supabase
          .from('tryout_answers')
          .select('id, user_answer, is_correct, question_id')
          .eq('session_id', attemptId);

        if (e2) throw new Error(e2.message);

        // Find questions by ID
        const questionIds = answersNoEmbed?.map(a => a.question_id).filter(Boolean) || [];
        if (questionIds.length === 0) throw new Error('No answers found');

        const { data: questions, error: qe } = await supabase
          .from('questions')
          .select('id, number, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, category, image_url')
          .in('id', questionIds);

        if (qe) throw new Error(qe.message);

        const questionMap = new Map(questions.map(q => [q.id, q]));
        const answerMap = new Map(answersNoEmbed.map(a => [a.question_id, a]));

        // Find by number
        const question = Array.from(questionMap.values()).find(q => String(q.number) === String(questionNumber));
        if (!question) throw new Error('Question not found');

        const answer = answerMap.get(question.id);
        if (!answer) throw new Error('Answer not found');

        const userAnswer = answer.user_answer;
        const correctAnswer = question.correct_answer;
        const category = (question.category || '').toUpperCase();

        let isCorrect = null;
        if (category === 'TWK' || category === 'TIU') {
          isCorrect = userAnswer && correctAnswer ? userAnswer === correctAnswer : false;
        }

        let isBookmarked = false;
        let bookmarkNotes = null;

        try {
          const { data: bookmark } = await supabase
            .from('question_bookmarks')
            .select('notes')
            .eq('session_id', attemptId)
            .eq('question_id', question.id)
            .single();

          if (bookmark) {
            isBookmarked = true;
            bookmarkNotes = bookmark.notes;
          }
        } catch (e) {
          // Table might not exist, continue without bookmarks
        }

        return {
          questionNumber: question.number,
          questionText: question.question_text,
          imageUrl: question.image_url,
          category,
          options: [
            { label: 'A', text: question.option_a },
            { label: 'B', text: question.option_b },
            { label: 'C', text: question.option_c },
            { label: 'D', text: question.option_d },
            { label: 'E', text: question.option_e },
          ].filter((opt) => opt.text),
          userAnswer,
          correctAnswer,
          isCorrect,
          explanation: question.explanation || 'Penjelasan tidak tersedia',
          isBookmarked,
          bookmarkNotes,
        };
      }

      // Find answer with matching question number
      const answer = answers?.find((a) => {
        const qNum = a.questions?.number;
        return String(qNum) === String(questionNumber);
      });

      if (!answer || !answer.questions) {
        throw new Error('Question not found in this attempt');
      }

      const q = answer.questions;
      const userAnswer = answer.user_answer;
      const correctAnswer = q.correct_answer;
      const category = (q.category || '').toUpperCase();

      let isCorrect = null;
      if (category === 'TWK' || category === 'TIU') {
        isCorrect = userAnswer && correctAnswer ? userAnswer === correctAnswer : false;
      }

      let isBookmarked = false;
      let bookmarkNotes = null;

      try {
        const { data: bookmark } = await supabase
          .from('question_bookmarks')
          .select('notes')
          .eq('session_id', attemptId)
          .eq('question_id', q.id)
          .single();

        if (bookmark) {
          isBookmarked = true;
          bookmarkNotes = bookmark.notes;
        }
      } catch (e) {
        // Table might not exist or bookmark not found, continue without bookmarks
      }

      return {
        questionNumber: q.number,
        questionText: q.question_text,
        imageUrl: q.image_url,
        category,
        options: [
          { label: 'A', text: q.option_a },
          { label: 'B', text: q.option_b },
          { label: 'C', text: q.option_c },
          { label: 'D', text: q.option_d },
          { label: 'E', text: q.option_e },
        ].filter((opt) => opt.text),
        userAnswer,
        correctAnswer,
        isCorrect,
        explanation: q.explanation || 'Penjelasan tidak tersedia',
        isBookmarked,
        bookmarkNotes,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Toggle bookmark for a question
   */
  toggleBookmark: async (sessionId, questionId, userId, notes = null) => {
    try {
      // Check if already bookmarked
      const { data: existing } = await supabase
        .from('question_bookmarks')
        .select('id')
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Remove bookmark
        const { error } = await supabase
          .from('question_bookmarks')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { bookmarked: false };
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('question_bookmarks')
          .insert([
            {
              user_id: userId,
              session_id: sessionId,
              question_id: questionId,
              notes,
            },
          ]);
        if (error) throw error;
        return { bookmarked: true };
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get bookmarked questions for a session
   */
  getBookmarkedQuestions: async (sessionId, userId) => {
    try {
      const { data, error } = await supabase
        .from('question_bookmarks')
        .select(
          `id, question_id, notes, bookmarked_at,
           questions(number, category, question_text)`
        )
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('bookmarked_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw error;
    }
  },
};

module.exports = reviewService;
