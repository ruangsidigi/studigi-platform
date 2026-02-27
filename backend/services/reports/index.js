const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const asNumber = (value) => Number(value || 0);

const mapLatestAnswers = (rows) => {
  const latestByQuestion = new Map();
  for (const row of rows || []) {
    const key = Number(row.question_id);
    const current = latestByQuestion.get(key);
    if (!current) {
      latestByQuestion.set(key, row);
      continue;
    }
    const currentTime = current.submitted_at ? new Date(current.submitted_at).getTime() : 0;
    const incomingTime = row.submitted_at ? new Date(row.submitted_at).getTime() : 0;
    if (incomingTime >= currentTime) latestByQuestion.set(key, row);
  }
  return Array.from(latestByQuestion.values());
};

router.get('/reports/overview', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptsResult = await db.query(
      `SELECT ts.id, ts.package_id, ts.started_at, ts.finished_at, ts.total_score, ts.is_passed, ts.created_at,
              p.name AS package_name, p.category_id
       FROM tryout_sessions ts
       LEFT JOIN packages p ON p.id = ts.package_id
       WHERE ts.user_id = $1 AND ts.status = 'completed'
       ORDER BY ts.finished_at ASC NULLS LAST, ts.id ASC`,
      [req.user.id]
    );

    const attempts = attemptsResult.rows || [];
    if (attempts.length === 0) {
      return res.json({
        totalTests: 0,
        averageScore: 0,
        highestScore: 0,
        passRate: 0,
        progress: [],
        categoryStats: [],
        latestPercentile: null,
      });
    }

    const totalTests = attempts.length;
    const totalScore = attempts.reduce((sum, item) => sum + asNumber(item.total_score), 0);
    const averageScore = Math.round(totalScore / Math.max(1, totalTests));
    const highestScore = Math.max(...attempts.map((item) => asNumber(item.total_score)));
    const passedCount = attempts.filter((item) => item.is_passed).length;
    const passRate = Math.round((passedCount / Math.max(1, totalTests)) * 100);

    const progress = attempts.map((item) => ({
      attemptId: item.id,
      date: item.finished_at || item.created_at,
      score: asNumber(item.total_score),
      packageName: item.package_name || '-',
    }));

    const categoriesResult = await db.query('SELECT id, name FROM categories');
    const categoryNameMap = new Map((categoriesResult.rows || []).map((row) => [String(row.id), row.name]));

    const categoryMap = new Map();
    for (const item of attempts) {
      const key = String(item.category_id || 'uncategorized');
      const current = categoryMap.get(key) || {
        categoryId: item.category_id || null,
        attempts: 0,
        scoreTotal: 0,
        passed: 0,
      };
      current.attempts += 1;
      current.scoreTotal += asNumber(item.total_score);
      if (item.is_passed) current.passed += 1;
      categoryMap.set(key, current);
    }

    const categoryStats = Array.from(categoryMap.values()).map((item) => ({
      categoryId: item.categoryId,
      categoryName: categoryNameMap.get(String(item.categoryId)) || 'Uncategorized',
      attempts: item.attempts,
      averageScore: Math.round(item.scoreTotal / Math.max(1, item.attempts)),
      passRate: Math.round((item.passed / Math.max(1, item.attempts)) * 100),
    }));

    const latest = attempts[attempts.length - 1];
    let latestPercentile = null;
    if (latest?.package_id) {
      const samePackageScores = await db.query(
        'SELECT total_score FROM tryout_sessions WHERE package_id = $1 AND status = $2',
        [latest.package_id, 'completed']
      );
      const allScores = (samePackageScores.rows || []).map((row) => asNumber(row.total_score));
      const below = allScores.filter((score) => score <= asNumber(latest.total_score)).length;
      if (allScores.length) latestPercentile = Math.round((below / allScores.length) * 100);
    }

    return res.json({
      totalTests,
      averageScore,
      highestScore,
      passRate,
      progress,
      categoryStats,
      latestPercentile,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/history', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;

    const totalResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM tryout_sessions WHERE user_id = $1 AND status = $2',
      [req.user.id, 'completed']
    );
    const total = totalResult.rows[0]?.total || 0;

    const result = await db.query(
      `SELECT ts.id, ts.package_id, ts.finished_at, ts.total_score, ts.is_passed, ts.created_at,
              p.name AS package_name, p.category_id, c.name AS category_name
       FROM tryout_sessions ts
       LEFT JOIN packages p ON p.id = ts.package_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ts.user_id = $1 AND ts.status = 'completed'
       ORDER BY ts.finished_at DESC NULLS LAST, ts.id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const items = (result.rows || []).map((row) => ({
      attemptId: row.id,
      packageId: row.package_id,
      packageName: row.package_name || '-',
      categoryName: row.category_name || '-',
      date: row.finished_at || row.created_at,
      score: asNumber(row.total_score),
      status: row.is_passed ? 'LULUS' : 'TIDAK LULUS',
      isPassed: !!row.is_passed,
    }));

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/analytics', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const sessionsResult = await db.query(
      `SELECT id, total_score
       FROM tryout_sessions
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY id ASC`,
      [req.user.id]
    );
    const sessions = sessionsResult.rows || [];
    if (!sessions.length) {
      return res.json({ strengths: [], weaknesses: [], trends: [], recommendations: [] });
    }

    const sessionIds = sessions.map((session) => Number(session.id));
    const answersResult = await db.query(
      `SELECT a.session_id, a.question_id, a.user_answer, a.is_correct, a.submitted_at,
              q.category, q.correct_answer, q.point_a, q.point_b, q.point_c, q.point_d, q.point_e
       FROM tryout_answers a
       LEFT JOIN questions q ON q.id = a.question_id
       WHERE a.session_id = ANY($1::int[])`,
      [sessionIds]
    );

    const latestAnswers = mapLatestAnswers(answersResult.rows || []);
    const topicMap = new Map();
    for (const item of latestAnswers) {
      const topic = String(item.category || 'LAINNYA').toUpperCase();
      const current = topicMap.get(topic) || { topic, total: 0, correct: 0, wrong: 0, tkpPoints: 0, tkpMax: 0 };
      current.total += 1;

      if (topic === 'TKP') {
        const option = String(item.user_answer || '').toLowerCase();
        const selected = asNumber(item[`point_${option}`]);
        const maxPoint = Math.max(asNumber(item.point_a), asNumber(item.point_b), asNumber(item.point_c), asNumber(item.point_d), asNumber(item.point_e));
        current.tkpPoints += selected;
        current.tkpMax += maxPoint > 0 ? maxPoint : 5;
      } else {
        const isCorrect = item.user_answer && item.correct_answer && item.user_answer === item.correct_answer;
        if (isCorrect) current.correct += 1;
        else current.wrong += 1;
      }

      topicMap.set(topic, current);
    }

    const trends = sessions.map((session, index) => ({ index: index + 1, attemptId: session.id, score: asNumber(session.total_score) }));
    const topicRows = Array.from(topicMap.values()).map((row) => {
      const objectiveTotal = row.correct + row.wrong;
      const accuracy = row.topic === 'TKP'
        ? Math.round((row.tkpPoints / Math.max(1, row.tkpMax)) * 100)
        : Math.round((row.correct / Math.max(1, objectiveTotal)) * 100);
      return { topic: row.topic, total: row.total, correct: row.correct, wrong: row.wrong, accuracy };
    });

    const strengths = topicRows.filter((row) => row.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy);
    const weaknesses = topicRows.filter((row) => row.accuracy < 55).sort((a, b) => a.accuracy - b.accuracy);

    const materialsResult = await db.query('SELECT id, title, description, COALESCE(file_url, storage_key) AS file_url FROM materials ORDER BY created_at DESC NULLS LAST LIMIT 50');
    const recommendations = weaknesses.map((weak) => {
      const related = (materialsResult.rows || [])
        .filter((mat) => String(mat.title || '').toUpperCase().includes(weak.topic) || String(mat.description || '').toUpperCase().includes(weak.topic))
        .slice(0, 3)
        .map((mat) => ({ id: mat.id, title: mat.title, description: mat.description, fileUrl: mat.file_url }));

      return {
        topic: weak.topic,
        reason: `Akurasi ${weak.accuracy}% pada ${weak.topic}. Fokuskan latihan bertahap.`,
        actionPlan: [
          `Ulangi konsep inti ${weak.topic}`,
          `Kerjakan minimal 20 soal latihan ${weak.topic}`,
          'Review pembahasan soal yang salah di report detail',
        ],
        materials: related,
      };
    });

    return res.json({ strengths, weaknesses, trends, recommendations });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/:attemptId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    if (!Number.isInteger(attemptId)) return res.status(400).json({ error: 'Invalid attempt id' });

    const attemptResult = await db.query(
      `SELECT ts.id, ts.user_id, ts.package_id, ts.started_at, ts.finished_at, ts.twk_score, ts.tiu_score, ts.tkp_score,
              ts.total_score, ts.is_passed, ts.status, p.name AS package_name
       FROM tryout_sessions ts
       LEFT JOIN packages p ON p.id = ts.package_id
       WHERE ts.id = $1 AND ts.user_id = $2
       LIMIT 1`,
      [attemptId, req.user.id]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    const answersResult = await db.query(
      `SELECT a.question_id, a.user_answer, a.is_correct, a.submitted_at,
              q.id, q.number, q.category, q.correct_answer, q.explanation
       FROM tryout_answers a
       LEFT JOIN questions q ON q.id = a.question_id
       WHERE a.session_id = $1`,
      [attemptId]
    );
    const answers = mapLatestAnswers(answersResult.rows || []).sort((a, b) => asNumber(a.number) - asNumber(b.number));

    const totalQuestionsResult = await db.query('SELECT COUNT(*)::int AS total FROM questions WHERE package_id = $1', [attempt.package_id]);
    const totalQuestions = totalQuestionsResult.rows[0]?.total || answers.length;
    const correct = answers.filter((item) => item.is_correct === true).length;
    const wrong = answers.filter((item) => item.is_correct === false).length;
    const blank = Math.max(0, totalQuestions - answers.length);

    const answerDistribution = answers.reduce((acc, item) => {
      const key = String(item.user_answer || '-').toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const review = answers.map((item) => ({
      questionId: item.question_id,
      questionNumber: item.number,
      category: String(item.category || 'LAINNYA').toUpperCase(),
      userAnswer: item.user_answer,
      correctAnswer: item.correct_answer,
      isCorrect: item.is_correct,
    }));

    const durationMinutes = attempt.started_at && attempt.finished_at
      ? Math.max(0, Math.round((new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime()) / 60000))
      : null;

    return res.json({
      attempt: {
        id: attempt.id,
        packageId: attempt.package_id,
        packageName: attempt.package_name || '-',
        totalScore: asNumber(attempt.total_score),
        status: attempt.is_passed ? 'LULUS' : 'TIDAK LULUS',
        durationMinutes,
      },
      sectionBreakdown: {
        TWK: asNumber(attempt.twk_score),
        TIU: asNumber(attempt.tiu_score),
        TKP: asNumber(attempt.tkp_score),
      },
      answerSummary: {
        totalQuestions,
        correct,
        wrong,
        blank,
        correctPercentage: Math.round((correct / Math.max(1, totalQuestions)) * 100),
      },
      answerDistribution,
      review,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/reports/attempt/:attemptId/question/:questionNumber', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const attemptId = Number(req.params.attemptId);
    const questionNumber = Number(req.params.questionNumber);
    if (!Number.isInteger(attemptId) || !Number.isInteger(questionNumber)) {
      return res.status(400).json({ error: 'Invalid attempt or question number' });
    }

    const rowResult = await db.query(
      `SELECT a.user_answer, a.is_correct,
              q.number AS question_number, q.category, q.question_text, q.image_url,
              q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
              q.correct_answer, q.explanation
       FROM tryout_sessions ts
       JOIN questions q ON q.package_id = ts.package_id
       LEFT JOIN tryout_answers a ON a.session_id = ts.id AND a.question_id = q.id
       WHERE ts.id = $1 AND ts.user_id = $2 AND q.number = $3
       ORDER BY a.submitted_at DESC NULLS LAST
       LIMIT 1`,
      [attemptId, req.user.id, questionNumber]
    );

    const row = rowResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Question detail not found' });

    return res.json({
      question_number: row.question_number,
      category: String(row.category || 'LAINNYA').toUpperCase(),
      question_text: row.question_text,
      image_url: row.image_url || null,
      options: [
        { label: 'A', text: row.option_a },
        { label: 'B', text: row.option_b },
        { label: 'C', text: row.option_c },
        { label: 'D', text: row.option_d },
        { label: 'E', text: row.option_e },
      ],
      user_answer: row.user_answer,
      correct_answer: row.correct_answer,
      is_correct: row.is_correct,
      explanation: row.explanation || 'Belum ada pembahasan.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
