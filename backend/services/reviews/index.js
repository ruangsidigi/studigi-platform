const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const asNumber = (value) => Number(value || 0);

const latestAnswerMapByQuestionId = (answers) => {
  const map = new Map();
  for (const answer of answers || []) {
    const key = Number(answer.question_id);
    if (!Number.isInteger(key)) continue;
    const current = map.get(key);
    if (!current) {
      map.set(key, answer);
      continue;
    }
    const currentTime = current.submitted_at ? new Date(current.submitted_at).getTime() : 0;
    const incomingTime = answer.submitted_at ? new Date(answer.submitted_at).getTime() : 0;
    if (incomingTime >= currentTime) map.set(key, answer);
  }
  return map;
};

const loadAttempt = async (db, attemptId, userId) => {
  const attemptResult = await db.query(
    `SELECT id, user_id, package_id, twk_score, tiu_score, tkp_score, total_score, is_passed
     FROM tryout_sessions
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [attemptId, userId]
  );
  return attemptResult.rows[0] || null;
};

const loadBookmarksMap = async (db, attemptId, userId) => {
  try {
    const bookmarkRows = await db.query(
      'SELECT question_id, notes FROM question_bookmarks WHERE session_id = $1 AND user_id = $2',
      [attemptId, userId]
    );
    return new Map((bookmarkRows.rows || []).map((row) => [Number(row.question_id), row.notes || null]));
  } catch (_) {
    return new Map();
  }
};

router.get('/reviews/attempt/:attemptId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    if (!Number.isInteger(attemptId)) return res.status(400).json({ error: 'Invalid attempt id' });

    const attempt = await loadAttempt(db, attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found or unauthorized' });

    const questionsResult = await db.query(
      `SELECT id, number, category, correct_answer
       FROM questions
       WHERE package_id = $1
       ORDER BY number ASC, id ASC`,
      [attempt.package_id]
    );

    const answersResult = await db.query(
      `SELECT question_id, user_answer, is_correct, submitted_at
       FROM tryout_answers
       WHERE session_id = $1`,
      [attemptId]
    );

    const answerMap = latestAnswerMapByQuestionId(answersResult.rows || []);
    const bookmarkMap = await loadBookmarksMap(db, attemptId, req.user.id);

    const review = (questionsResult.rows || []).map((question) => {
      const answer = answerMap.get(Number(question.id));
      const userAnswer = answer?.user_answer || null;
      const correctAnswer = question.correct_answer || null;
      const category = String(question.category || '').toUpperCase();

      let status = 'unanswered';
      if (userAnswer) {
        if (category === 'TWK' || category === 'TIU') {
          status = String(userAnswer).toUpperCase() === String(correctAnswer || '').toUpperCase() ? 'correct' : 'incorrect';
        } else if (category === 'TKP') {
          status = 'partial';
        }
      }

      return {
        questionId: question.id,
        questionNumber: question.number,
        category,
        status,
        userAnswer,
        correctAnswer,
        isBookmarked: bookmarkMap.has(Number(question.id)),
        bookmarkNotes: bookmarkMap.get(Number(question.id)) || null,
      };
    });

    const stats = {
      total: review.length,
      correct: review.filter((row) => row.status === 'correct').length,
      incorrect: review.filter((row) => row.status === 'incorrect').length,
      unanswered: review.filter((row) => row.status === 'unanswered').length,
      bookmarked: review.filter((row) => row.isBookmarked).length,
    };

    return res.json({
      attempt: {
        id: attempt.id,
        twkScore: Math.round(asNumber(attempt.twk_score)),
        tiuScore: Math.round(asNumber(attempt.tiu_score)),
        tkpScore: asNumber(attempt.tkp_score),
        totalScore: asNumber(attempt.total_score),
        isPassed: !!attempt.is_passed,
        status: attempt.is_passed ? 'LULUS' : 'TIDAK LULUS',
      },
      review,
      stats,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Gagal memuat review' });
  }
});

router.get('/reviews/attempt/:attemptId/question/:questionNumber', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    const questionNumber = Number(req.params.questionNumber);
    if (!Number.isInteger(attemptId) || !Number.isInteger(questionNumber)) {
      return res.status(400).json({ error: 'Invalid attempt or question number' });
    }

    const attempt = await loadAttempt(db, attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found or unauthorized' });

    const questionResult = await db.query(
      `SELECT id, number, question_text, option_a, option_b, option_c, option_d, option_e,
              correct_answer, explanation, category, image_url
       FROM questions
       WHERE package_id = $1 AND number = $2
       ORDER BY id ASC
       LIMIT 1`,
      [attempt.package_id, questionNumber]
    );

    const question = questionResult.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found in this attempt' });

    const answerResult = await db.query(
      `SELECT user_answer, is_correct
       FROM tryout_answers
       WHERE session_id = $1 AND question_id = $2
       ORDER BY submitted_at DESC NULLS LAST
       LIMIT 1`,
      [attemptId, question.id]
    );

    const answer = answerResult.rows[0] || null;
    const userAnswer = answer?.user_answer || null;
    const category = String(question.category || '').toUpperCase();

    let isCorrect = null;
    if (category === 'TWK' || category === 'TIU') {
      isCorrect = userAnswer ? String(userAnswer).toUpperCase() === String(question.correct_answer || '').toUpperCase() : false;
    }

    let isBookmarked = false;
    let bookmarkNotes = null;
    try {
      const bookmarkResult = await db.query(
        'SELECT notes FROM question_bookmarks WHERE session_id = $1 AND question_id = $2 AND user_id = $3 LIMIT 1',
        [attemptId, question.id, req.user.id]
      );
      if (bookmarkResult.rows[0]) {
        isBookmarked = true;
        bookmarkNotes = bookmarkResult.rows[0].notes || null;
      }
    } catch (_) {}

    return res.json({
      questionId: question.id,
      questionNumber: question.number,
      questionText: question.question_text,
      question_number: question.number,
      question_text: question.question_text,
      imageUrl: question.image_url || null,
      image_url: question.image_url || null,
      category,
      options: [
        { label: 'A', text: question.option_a },
        { label: 'B', text: question.option_b },
        { label: 'C', text: question.option_c },
        { label: 'D', text: question.option_d },
        { label: 'E', text: question.option_e },
      ].filter((opt) => opt.text),
      userAnswer,
      user_answer: userAnswer,
      correctAnswer: question.correct_answer || null,
      correct_answer: question.correct_answer || null,
      isCorrect,
      is_correct: isCorrect,
      explanation: question.explanation || 'Penjelasan tidak tersedia',
      isBookmarked,
      bookmarkNotes,
    });
  } catch (error) {
    return res.status(404).json({ error: error.message || 'Gagal memuat soal' });
  }
});

router.post('/reviews/attempt/:attemptId/bookmark', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    const questionIdRaw = Number(req.body?.questionId);
    const notes = req.body?.notes || null;
    if (!Number.isInteger(attemptId) || !Number.isInteger(questionIdRaw)) {
      return res.status(400).json({ error: 'questionId required' });
    }

    const attempt = await loadAttempt(db, attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found or unauthorized' });

    let questionId = questionIdRaw;
    const byId = await db.query('SELECT id FROM questions WHERE id = $1 AND package_id = $2 LIMIT 1', [questionIdRaw, attempt.package_id]);
    if (!byId.rows[0]) {
      const byNumber = await db.query('SELECT id FROM questions WHERE package_id = $1 AND number = $2 LIMIT 1', [attempt.package_id, questionIdRaw]);
      if (byNumber.rows[0]) questionId = Number(byNumber.rows[0].id);
    }

    try {
      const existing = await db.query(
        'SELECT id FROM question_bookmarks WHERE session_id = $1 AND question_id = $2 AND user_id = $3 LIMIT 1',
        [attemptId, questionId, req.user.id]
      );

      if (existing.rows[0]) {
        await db.query('DELETE FROM question_bookmarks WHERE id = $1', [existing.rows[0].id]);
        return res.json({ bookmarked: false });
      }

      await db.query(
        `INSERT INTO question_bookmarks (user_id, session_id, question_id, notes, bookmarked_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [req.user.id, attemptId, questionId, notes]
      );
      return res.json({ bookmarked: true });
    } catch (_) {
      return res.json({ bookmarked: false, note: 'bookmark feature unavailable' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reviews/attempt/:attemptId/bookmarks', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    if (!Number.isInteger(attemptId)) return res.status(400).json({ error: 'Invalid attempt id' });

    const attempt = await loadAttempt(db, attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'Attempt not found or unauthorized' });

    try {
      const rows = await db.query(
        `SELECT qb.id, qb.question_id, qb.notes, qb.bookmarked_at, q.number, q.category, q.question_text
         FROM question_bookmarks qb
         LEFT JOIN questions q ON q.id = qb.question_id
         WHERE qb.session_id = $1 AND qb.user_id = $2
         ORDER BY qb.bookmarked_at DESC NULLS LAST`,
        [attemptId, req.user.id]
      );

      const bookmarks = (rows.rows || []).map((row) => ({
        id: row.id,
        question_id: row.question_id,
        notes: row.notes,
        bookmarked_at: row.bookmarked_at,
        questions: {
          number: row.number,
          category: row.category,
          question_text: row.question_text,
        },
      }));

      return res.json({ bookmarks });
    } catch (_) {
      return res.json({ bookmarks: [] });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
