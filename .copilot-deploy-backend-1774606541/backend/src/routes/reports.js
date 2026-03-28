const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const asNumber = (value) => Number(value || 0);

const toMinutes = (startedAt, finishedAt) => {
  if (!startedAt || !finishedAt) return null;
  return Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000));
};

const buildLatestAnswerMap = (answers) => {
  const latestMap = new Map();

  (answers || []).forEach((answer) => {
    const key = `${answer.session_id}-${answer.question_id}`;
    const current = latestMap.get(key);
    if (!current) {
      latestMap.set(key, answer);
      return;
    }

    const currentTime = current.submitted_at ? new Date(current.submitted_at).getTime() : 0;
    const incomingTime = answer.submitted_at ? new Date(answer.submitted_at).getTime() : 0;

    if (incomingTime >= currentTime) {
      latestMap.set(key, answer);
    }
  });

  return Array.from(latestMap.values());
};

// GET /reports/overview
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: attempts, error } = await supabase
      .from('tryout_sessions')
      .select('id, package_id, started_at, finished_at, total_score, is_passed, twk_score, tiu_score, tkp_score, created_at, packages(id, name, category_id)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const attemptList = attempts || [];

    if (attemptList.length === 0) {
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

    const totalTests = attemptList.length;
    const totalScore = attemptList.reduce((sum, attempt) => sum + asNumber(attempt.total_score), 0);
    const averageScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
    const highestScore = Math.max(...attemptList.map((attempt) => asNumber(attempt.total_score)));
    const passedCount = attemptList.filter((attempt) => attempt.is_passed).length;
    const passRate = Math.round((passedCount / totalTests) * 100);

    const progress = attemptList.map((attempt) => ({
      attemptId: attempt.id,
      date: attempt.finished_at || attempt.created_at,
      score: asNumber(attempt.total_score),
      packageName: attempt.packages?.name || '-',
    }));

    const categoryMap = new Map();
    attemptList.forEach((attempt) => {
      const key = String(attempt.packages?.category_id || 'uncategorized');
      const current = categoryMap.get(key) || {
        categoryId: attempt.packages?.category_id || null,
        categoryName: attempt.packages?.category_id ? `Kategori ${attempt.packages.category_id}` : 'Uncategorized',
        attempts: 0,
        scoreTotal: 0,
        passed: 0,
      };

      current.attempts += 1;
      current.scoreTotal += asNumber(attempt.total_score);
      if (attempt.is_passed) current.passed += 1;

      categoryMap.set(key, current);
    });

    const { data: categories } = await supabase.from('categories').select('id, name');
    const categoryNameMap = new Map((categories || []).map((category) => [String(category.id), category.name]));

    const categoryStats = Array.from(categoryMap.values()).map((item) => ({
      categoryId: item.categoryId,
      categoryName: categoryNameMap.get(String(item.categoryId)) || item.categoryName,
      attempts: item.attempts,
      averageScore: Math.round(item.scoreTotal / Math.max(1, item.attempts)),
      passRate: Math.round((item.passed / Math.max(1, item.attempts)) * 100),
    }));

    const latest = attemptList[attemptList.length - 1];
    let latestPercentile = null;

    if (latest?.package_id) {
      const { data: samePackageScores } = await supabase
        .from('tryout_sessions')
        .select('total_score')
        .eq('package_id', latest.package_id)
        .eq('status', 'completed');

      const allScores = (samePackageScores || []).map((row) => asNumber(row.total_score));
      const below = allScores.filter((score) => score <= asNumber(latest.total_score)).length;
      if (allScores.length > 0) {
        latestPercentile = Math.round((below / allScores.length) * 100);
      }
    }

    res.json({
      totalTests,
      averageScore,
      highestScore,
      passRate,
      progress,
      categoryStats,
      latestPercentile,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/history?page=1&limit=10
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '10', 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { count, error: countError } = await supabase
      .from('tryout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (countError) return res.status(400).json({ error: countError.message });

    const { data: history, error } = await supabase
      .from('tryout_sessions')
      .select('id, package_id, finished_at, total_score, is_passed, status, created_at, packages(id, name, category_id)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(400).json({ error: error.message });

    const { data: categories } = await supabase.from('categories').select('id, name');
    const categoryNameMap = new Map((categories || []).map((category) => [String(category.id), category.name]));

    const rows = (history || []).map((attempt) => ({
      attemptId: attempt.id,
      packageId: attempt.package_id,
      packageName: attempt.packages?.name || '-',
      categoryName: categoryNameMap.get(String(attempt.packages?.category_id)) || '-',
      date: attempt.finished_at || attempt.created_at,
      score: asNumber(attempt.total_score),
      status: attempt.is_passed ? 'LULUS' : 'TIDAK LULUS',
      isPassed: !!attempt.is_passed,
    }));

    res.json({
      page,
      limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      items: rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: sessions, error: sessionsError } = await supabase
      .from('tryout_sessions')
      .select('id, package_id, total_score, status')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (sessionsError) return res.status(400).json({ error: sessionsError.message });

    const sessionIds = (sessions || []).map((session) => session.id);
    if (sessionIds.length === 0) {
      return res.json({
        strengths: [],
        weaknesses: [],
        trends: [],
        recommendations: [],
      });
    }

    const { data: answersRaw, error: answersError } = await supabase
      .from('tryout_answers')
      .select('session_id, question_id, user_answer, submitted_at, questions(category, correct_answer, point_a, point_b, point_c, point_d, point_e)')
      .in('session_id', sessionIds);

    if (answersError) return res.status(400).json({ error: answersError.message });

    const latestAnswers = buildLatestAnswerMap(answersRaw || []);

    const statsByTopic = new Map();

    latestAnswers.forEach((answer) => {
      const topic = (answer.questions?.category || 'LAINNYA').toUpperCase();
      const current = statsByTopic.get(topic) || {
        topic,
        total: 0,
        correct: 0,
        wrong: 0,
        tkpPoints: 0,
        tkpMaxPoints: 0,
      };

      current.total += 1;

      if (topic === 'TWK' || topic === 'TIU') {
        const isCorrect = answer.user_answer && answer.user_answer === answer.questions?.correct_answer;
        if (isCorrect) current.correct += 1;
        else current.wrong += 1;
      } else if (topic === 'TKP') {
        const selected = (answer.user_answer || '').toLowerCase();
        const fields = ['point_a', 'point_b', 'point_c', 'point_d', 'point_e'];
        const maxPoint = Math.max(...fields.map((field) => asNumber(answer.questions?.[field])));
        const selectedPoint = selected ? asNumber(answer.questions?.[`point_${selected}`]) : 0;

        current.tkpPoints += selectedPoint;
        current.tkpMaxPoints += maxPoint > 0 ? maxPoint : 5;
      }

      statsByTopic.set(topic, current);
    });

    const trends = (sessions || [])
      .sort((a, b) => a.id - b.id)
      .map((session, index) => ({
        index: index + 1,
        attemptId: session.id,
        score: asNumber(session.total_score),
      }));

    const topicRows = Array.from(statsByTopic.values()).map((row) => {
      const objectiveTotal = row.correct + row.wrong;
      let accuracy = 0;

      if (row.topic === 'TKP') {
        accuracy = row.tkpMaxPoints > 0 ? Math.round((row.tkpPoints / row.tkpMaxPoints) * 100) : 0;
      } else {
        accuracy = objectiveTotal > 0 ? Math.round((row.correct / objectiveTotal) * 100) : 0;
      }

      return {
        topic: row.topic,
        total: row.total,
        correct: row.correct,
        wrong: row.wrong,
        accuracy,
      };
    });

    const strengths = topicRows
      .filter((row) => row.accuracy >= 70)
      .sort((a, b) => b.accuracy - a.accuracy);

    const weaknesses = topicRows
      .filter((row) => row.accuracy < 55)
      .sort((a, b) => a.accuracy - b.accuracy);

    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, description, file_url')
      .order('created_at', { ascending: false })
      .limit(50);

    const recommendations = weaknesses.map((weak) => {
      const relatedMaterials = (materials || [])
        .filter((material) => {
          const title = (material.title || '').toUpperCase();
          const description = (material.description || '').toUpperCase();
          return title.includes(weak.topic) || description.includes(weak.topic);
        })
        .slice(0, 3)
        .map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description,
          fileUrl: material.file_url,
        }));

      return {
        topic: weak.topic,
        reason: `Akurasi ${weak.accuracy}% pada ${weak.topic}. Fokuskan latihan bertahap.` ,
        actionPlan: [
          `Ulangi konsep inti ${weak.topic}`,
          `Kerjakan minimal 20 soal latihan ${weak.topic}`,
          `Review pembahasan soal yang salah di report detail`,
        ],
        materials: relatedMaterials,
      };
    });

    res.json({
      strengths,
      weaknesses,
      trends,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/:attemptId
router.get('/:attemptId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    const { data: attempt, error: attemptError } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, started_at, finished_at, twk_score, tiu_score, tkp_score, total_score, is_passed, status, packages(id, name, category_id)')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single();

    if (attemptError || !attempt) return res.status(404).json({ error: 'Attempt not found' });

    const { data: answersRaw, error: answersError } = await supabase
      .from('tryout_answers')
      .select('id, session_id, question_id, user_answer, submitted_at, questions(id, number, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, category)')
      .eq('session_id', attemptId);

    if (answersError) return res.status(400).json({ error: answersError.message });

    const answers = buildLatestAnswerMap(answersRaw || []);

    const { count: totalQuestions } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', attempt.package_id);

    let correct = 0;
    let wrong = 0;
    const answerDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, EMPTY: 0 };

    const review = answers
      .sort((a, b) => asNumber(a.questions?.number) - asNumber(b.questions?.number))
      .map((answer) => {
        const category = (answer.questions?.category || '').toUpperCase();
        const userAnswer = answer.user_answer || null;
        const correctAnswer = answer.questions?.correct_answer || null;

        if (!userAnswer) {
          answerDistribution.EMPTY += 1;
        } else if (answerDistribution[userAnswer] !== undefined) {
          answerDistribution[userAnswer] += 1;
        }

        let isCorrect = null;
        if (category === 'TWK' || category === 'TIU') {
          isCorrect = userAnswer && correctAnswer ? userAnswer === correctAnswer : false;
          if (isCorrect) correct += 1;
          else wrong += 1;
        }

        return {
          questionId: answer.question_id,
          questionNumber: answer.questions?.number,
          category,
          questionText: answer.questions?.question_text,
          options: {
            A: answer.questions?.option_a,
            B: answer.questions?.option_b,
            C: answer.questions?.option_c,
            D: answer.questions?.option_d,
            E: answer.questions?.option_e,
          },
          userAnswer,
          correctAnswer,
          isCorrect,
          explanation: answer.questions?.explanation,
        };
      });

    const answeredCount = answers.filter((answer) => !!answer.user_answer).length;
    const blank = Math.max(0, asNumber(totalQuestions) - answeredCount);

    const objectiveTotal = correct + wrong;
    const correctPercentage = objectiveTotal > 0 ? Math.round((correct / objectiveTotal) * 100) : 0;

    res.json({
      attempt: {
        id: attempt.id,
        packageId: attempt.package_id,
        packageName: attempt.packages?.name || '-',
        totalScore: asNumber(attempt.total_score),
        isPassed: !!attempt.is_passed,
        status: attempt.is_passed ? 'LULUS' : 'TIDAK LULUS',
        startedAt: attempt.started_at,
        finishedAt: attempt.finished_at,
        durationMinutes: toMinutes(attempt.started_at, attempt.finished_at),
      },
      sectionBreakdown: {
        TWK: asNumber(attempt.twk_score),
        TIU: asNumber(attempt.tiu_score),
        TKP: asNumber(attempt.tkp_score),
      },
      answerSummary: {
        totalQuestions: asNumber(totalQuestions),
        answered: answeredCount,
        correct,
        wrong,
        blank,
        correctPercentage,
      },
      answerDistribution,
      review,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/attempt/:attemptId/question/:questionNumber
// Fetch detail soal spesifik dari attempt
router.get('/attempt/:attemptId/question/:questionNumber', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionNumber } = req.params;

    // Verify attempt belongs to user
    const { data: attempt, error: attemptError } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single();

    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Get the answer and question details
    const { data: totalQuestionsData } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', attempt.package_id);

    const { data: answersRaw, error: answersError } = await supabase
      .from('tryout_answers')
      .select('id, session_id, question_id, user_answer, submitted_at, questions(id, number, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, category, image_url)')
      .eq('session_id', attemptId);

    if (answersError) {
      return res.status(400).json({ error: answersError.message });
    }

    // Find the specific question
    const answer = answersRaw?.find((a) => String(a.questions?.number) === String(questionNumber));
    if (!answer || !answer.questions) {
      return res.status(404).json({ error: 'Question not found in this attempt' });
    }

    const q = answer.questions;
    const userAnswer = answer.user_answer || null;
    const correctAnswer = q.correct_answer || null;
    const category = (q.category || '').toUpperCase();

    // Determine if correct
    let isCorrect = null;
    if (category === 'TWK' || category === 'TIU') {
      isCorrect = userAnswer && correctAnswer ? userAnswer === correctAnswer : false;
    } else if (category === 'TKP') {
      // TKP doesn't have right/wrong
      isCorrect = null;
    }

    res.json({
      question_number: q.number,
      category,
      question_text: q.question_text,
      image_url: q.image_url || null,
      options: [
        { label: 'A', text: q.option_a },
        { label: 'B', text: q.option_b },
        { label: 'C', text: q.option_c },
        { label: 'D', text: q.option_d },
        { label: 'E', text: q.option_e },
      ].filter((opt) => opt.text),
      user_answer: userAnswer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      explanation: q.explanation || 'Penjelasan tidak tersedia',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
