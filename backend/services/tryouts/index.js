const express = require('express');

const router = express.Router();

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const isAdminUser = (user) => {
  const roleNames = getUserRoleNames(user);
  return (
    roleNames.includes('admin') ||
    String(user?.role || '').toLowerCase() === 'admin' ||
    String(user?.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase()
  );
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

router.post('/tryouts/start', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const packageId = Number(req.body?.packageId);

    if (!Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    if (!isAdminUser(req.user)) {
      const purchaseResult = await db.query(
        'SELECT id FROM purchases WHERE user_id = $1 AND package_id = $2 LIMIT 1',
        [userId, packageId]
      );
      if (!purchaseResult.rows[0]) {
        return res.status(403).json({ error: 'User does not have access to this package' });
      }
    }

    const sessionResult = await db.query(
      `INSERT INTO tryout_sessions (user_id, package_id, started_at, status)
       VALUES ($1, $2, NOW(), 'in_progress')
       RETURNING *`,
      [userId, packageId]
    );

    return res.json({
      message: 'Tryout session started',
      session: sessionResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/tryouts/submit-answer', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.body?.sessionId);
    const questionId = Number(req.body?.questionId);
    const selectedAnswer = String(req.body?.selectedAnswer || '').toUpperCase();

    if (!Number.isInteger(sessionId) || !Number.isInteger(questionId) || !selectedAnswer) {
      return res.status(400).json({ error: 'Session ID, question ID, and selected answer are required' });
    }

    const sessionResult = await db.query('SELECT id FROM tryout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1', [sessionId, userId]);
    if (!sessionResult.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const questionResult = await db.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [questionId]);
    const question = questionResult.rows[0];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const category = String(question.category || '').toUpperCase();
    let isCorrect = null;
    if (category === 'TWK' || category === 'TIU') {
      isCorrect = selectedAnswer === String(question.correct_answer || '').toUpperCase();
    }

    const answerResult = await db.query(
      `INSERT INTO tryout_answers (session_id, question_id, user_answer, is_correct, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [sessionId, questionId, selectedAnswer, isCorrect]
    );

    return res.json({
      message: 'Answer submitted',
      answer: answerResult.rows[0],
      isCorrect,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/tryouts/finish', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.body?.sessionId);

    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionResult = await db.query('SELECT * FROM tryout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1', [sessionId, userId]);
    const session = sessionResult.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const answersResult = await db.query(
      `SELECT a.user_answer, q.category, q.correct_answer, q.point_a, q.point_b, q.point_c, q.point_d, q.point_e
       FROM tryout_answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.session_id = $1`,
      [sessionId]
    );

    let twkPoints = 0;
    let tiuPoints = 0;
    let tkpPoints = 0;

    for (const row of answersResult.rows || []) {
      const category = String(row.category || '').toUpperCase();
      const answer = String(row.user_answer || '').toUpperCase();
      const correctAnswer = String(row.correct_answer || '').toUpperCase();

      if (category === 'TWK') {
        if (answer && answer === correctAnswer) twkPoints += 5;
      } else if (category === 'TIU') {
        if (answer && answer === correctAnswer) tiuPoints += 5;
      } else if (category === 'TKP') {
        const key = `point_${answer.toLowerCase()}`;
        tkpPoints += Number(row[key] || 0);
      }
    }

    const isPass = twkPoints > 65 && tiuPoints > 85 && tkpPoints > 166;
    const totalScore = Math.round(twkPoints + tiuPoints + tkpPoints);

    const updatedResult = await db.query(
      `UPDATE tryout_sessions
       SET finished_at = NOW(),
           status = 'completed',
           twk_score = $1,
           tiu_score = $2,
           tkp_score = $3,
           total_score = $4,
           is_passed = $5
       WHERE id = $6
       RETURNING *`,
      [twkPoints, tiuPoints, tkpPoints, totalScore, isPass, sessionId]
    );

    return res.json({
      message: 'Tryout finished',
      session: updatedResult.rows[0],
      scores: {
        twk: twkPoints,
        tiu: tiuPoints,
        tkp: tkpPoints,
        total: totalScore,
      },
      isPass,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/tryouts/:sessionId/results', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const result = await db.query(
      `SELECT id, user_id, package_id, started_at, finished_at, twk_score, tiu_score, tkp_score, total_score, is_passed, status
       FROM tryout_sessions
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [sessionId, userId]
    );

    const session = result.rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
