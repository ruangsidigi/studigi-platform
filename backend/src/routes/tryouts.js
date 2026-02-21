const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const eventPublisher = require('../architecture/core/events/eventPublisher');
const EVENTS = require('../architecture/core/events/eventTypes');
const adaptiveService = require('../services/adaptiveService');

const router = express.Router();

// Start a tryout session
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    // Check if user has access to this package
    const { data: purchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('package_id', packageId)
      .single();

    if (!purchase) {
      return res.status(403).json({ error: 'User does not have access to this package' });
    }

    // Create session
    const { data: session, error } = await supabase
      .from('tryout_sessions')
      .insert([
        {
          user_id: userId,
          package_id: packageId,
          started_at: new Date(),
          status: 'in_progress',
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Tryout session started',
      session: session,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit answer
router.post('/submit-answer', authenticateToken, async (req, res) => {
  try {
    const { sessionId, questionId, selectedAnswer, timeSpentMs, difficulty } = req.body;
    const userId = req.user.id;

    if (!sessionId || !questionId || !selectedAnswer) {
      return res.status(400).json({ error: 'Session ID, question ID, and selected answer are required' });
    }

    // Get question to check correct answer
    const { data: question } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Determine correctness: for TWK/TIU use true/false, for TKP leave as null
    const category = (question.category || '').toUpperCase();
    let isCorrect = null;
    if (category === 'TWK' || category === 'TIU') {
      isCorrect = selectedAnswer === question.correct_answer;
    } else if (category === 'TKP') {
      // For TKP we intentionally leave is_correct null (no true/false)
      isCorrect = null;
    }

    // Save answer
    const { data: answer, error } = await supabase
      .from('tryout_answers')
      .insert([
        {
          session_id: sessionId,
          question_id: questionId,
          user_answer: selectedAnswer,
          is_correct: isCorrect,
          submitted_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Publish AI edtech event (best effort)
    try {
      const { count: answeredCount } = await supabase
        .from('tryout_answers')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      const { data: sessionInfo } = await supabase
        .from('tryout_sessions')
        .select('package_id')
        .eq('id', sessionId)
        .single();

      let totalQuestions = 0;
      if (sessionInfo?.package_id) {
        const { data: packageInfo } = await supabase
          .from('packages')
          .select('question_count')
          .eq('id', sessionInfo.package_id)
          .single();

        totalQuestions = Number(packageInfo?.question_count || 0);
      }

      const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

      const topic = (question.category || 'GENERAL').toUpperCase();
      await eventPublisher.publish(EVENTS.QUESTION_ATTEMPTED, {
        userId,
        attemptId: Number(sessionId),
        questionId: Number(questionId),
        topic,
        isCorrect: Boolean(isCorrect),
        timeSpentMs: Number(timeSpentMs || 60000),
        score: Boolean(isCorrect) ? 1 : 0,
        progressPercent: Number(progressPercent.toFixed(2)),
      });
    } catch (aiEventError) {
      console.error('AI event publish warning:', aiEventError.message);
    }

    // Adaptive learning update (best effort, does not block tryout flow)
    try {
      const topic = (question.category || 'General').toUpperCase();
      let adaptiveIsCorrect = Boolean(isCorrect);

      if (topic === 'TKP') {
        const optionScores = ['a', 'b', 'c', 'd', 'e'].map((key) => Number(question[`point_${key}`] || 0));
        const maxScore = Math.max(...optionScores);
        const selectedPoint = Number(question[`point_${String(selectedAnswer || '').toLowerCase()}`] || 0);
        adaptiveIsCorrect = selectedPoint >= maxScore;
      }

      await adaptiveService.updateSkillFromAnswer({
        userId,
        questionId,
        topic,
        isCorrect: adaptiveIsCorrect,
        timeSpentMs: Number(timeSpentMs) > 0 ? Number(timeSpentMs) : 60000,
        difficulty: difficulty || 'medium',
        source: 'tryout',
        metadata: { sessionId },
      });
    } catch (adaptiveError) {
      console.error('Adaptive update warning:', adaptiveError.message);
    }

    res.json({
      message: 'Answer submitted',
      answer: answer,
      isCorrect: isCorrect,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Finish tryout and calculate score
router.post('/finish', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get session
    const { data: session } = await supabase
      .from('tryout_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all answers for this session
    const { data: answers } = await supabase
      .from('tryout_answers')
      .select('*, questions(*)')
      .eq('session_id', sessionId);

    if (!answers) {
      return res.status(400).json({ error: 'Could not retrieve answers' });
    }

    // Calculate scores by category
    // TWK & TIU: each correct answer = 5 points
    // TKP: each selected option yields its configured point (point_a..point_e) regardless of correctness
    let twkPoints = 0,
      tiuPoints = 0,
      tkpPoints = 0;

    answers.forEach((answer) => {
      const question = answer.questions;
      const category = (question.category || '').toUpperCase();

      if (category === 'TWK') {
        if (answer.user_answer && answer.user_answer === question.correct_answer) {
          twkPoints += 5;
        }
      } else if (category === 'TIU') {
        if (answer.user_answer && answer.user_answer === question.correct_answer) {
          tiuPoints += 5;
        }
      } else if (category === 'TKP') {
        if (answer.user_answer) {
          const key = `point_${answer.user_answer.toLowerCase()}`;
          const pts = parseFloat(question[key]) || 0;
          tkpPoints += pts;
        }
      }
    });

    // Determine pass/fail using absolute point thresholds
    const isPass = twkPoints > 65 && tiuPoints > 85 && tkpPoints > 166;

    // Update session with results (store raw point totals)
    const { data: updatedSession, error } = await supabase
      .from('tryout_sessions')
      .update({
        finished_at: new Date(),
        status: 'completed',
        twk_score: twkPoints,
        tiu_score: tiuPoints,
        tkp_score: tkpPoints,
        total_score: Math.round(twkPoints + tiuPoints + tkpPoints),
        is_passed: isPass,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Event-driven retention pipeline trigger
    try {
      await eventPublisher.publish(EVENTS.TEST_SUBMITTED, {
        userId,
        attemptId: sessionId,
        packageId: updatedSession.package_id,
        score: Math.round(updatedSession.total_score || 0),
        finishedAt: updatedSession.finished_at,
      });

      await eventPublisher.publish(EVENTS.ATTEMPT_COMPLETED, {
        userId,
        attemptId: updatedSession.id,
        score: Math.round(updatedSession.total_score || 0),
        finishedAt: updatedSession.finished_at,
      });
    } catch (eventError) {
      console.error('Event publish warning:', eventError.message);
    }

    res.json({
      message: 'Tryout completed',
      result: {
        sessionId: updatedSession.id,
        twkScore: Math.round(updatedSession.twk_score || 0),
        tiuScore: Math.round(updatedSession.tiu_score || 0),
        tkpScore: updatedSession.tkp_score || 0,
        totalScore: Math.round(updatedSession.total_score || 0),
        isPassed: updatedSession.is_passed,
        status: updatedSession.is_passed ? 'LULUS' : 'TIDAK LULUS',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session results with explanations
router.get('/:sessionId/results', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Get session
    const { data: session } = await supabase
      .from('tryout_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get answers with questions
    const { data: answers } = await supabase
      .from('tryout_answers')
      .select('*, questions(*)')
      .eq('session_id', sessionId);

    const results = answers.map((answer) => ({
      questionId: answer.question_id,
      questionNumber: answer.questions.number,
      questionText: answer.questions.question_text,
      category: answer.questions.category,
      userAnswer: answer.user_answer,
      correctAnswer: answer.questions.correct_answer,
      isCorrect: answer.is_correct,
      // For TKP, frontend can use this flag to force green highlight while leaving correctness empty
      forceGreen: (answer.questions.category || '').toUpperCase() === 'TKP',
      explanation: answer.questions.explanation,
      imageUrl: answer.questions.image_url,
    }));

    res.json({
      sessionData: {
        id: session.id,
        twkScore: Math.round(session.twk_score),
        tiuScore: Math.round(session.tiu_score),
        tkpScore: session.tkp_score,
        totalScore: Math.round(session.total_score),
        isPassed: session.is_passed,
        status: session.is_passed ? 'LULUS' : 'TIDAK LULUS',
        startedAt: session.started_at,
        finishedAt: session.finished_at,
      },
      results: results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
