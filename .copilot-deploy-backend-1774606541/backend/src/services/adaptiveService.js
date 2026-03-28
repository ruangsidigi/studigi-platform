const supabase = require('../config/supabase');

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const getTargetTimeByDifficulty = (difficulty) => {
  const normalized = String(difficulty || 'medium').toLowerCase();
  if (normalized === 'easy') return 45000;
  if (normalized === 'hard') return 75000;
  return 60000;
};

const getDifficultyBonus = (difficulty) => {
  const normalized = String(difficulty || 'medium').toLowerCase();
  if (normalized === 'hard') return 8;
  if (normalized === 'medium') return 4;
  return 0;
};

const computeWeaknessLevel = (skillScore) => {
  if (skillScore < 55) return 'high';
  if (skillScore < 70) return 'medium';
  return 'low';
};

const recommendDifficulty = (skillScore) => {
  if (skillScore >= 80) return 'hard';
  if (skillScore >= 60) return 'medium';
  return 'easy';
};

const buildRecommendation = ({ topic, skillScore, weaknessLevel, accuracy, avgTimeMs }) => {
  if (weaknessLevel === 'high') {
    return {
      recommendationType: 'practice',
      reason: `Topik ${topic} masih lemah (skill ${skillScore.toFixed(1)}). Fokus latihan dasar untuk meningkatkan akurasi.`,
      priority: 3,
      metadata: { target: 'accuracy', minimumAccuracy: 0.7, avgTimeMs },
    };
  }

  if (weaknessLevel === 'medium') {
    return {
      recommendationType: 'review',
      reason: `Topik ${topic} cukup stabil namun perlu review terarah untuk naik level.`,
      priority: 2,
      metadata: { target: 'consistency', currentAccuracy: accuracy, avgTimeMs },
    };
  }

  return {
    recommendationType: 'challenge',
    reason: `Topik ${topic} kuat. Naikkan difficulty agar kemampuan terus berkembang.`,
    priority: 1,
    metadata: { target: 'difficulty_upgrade', currentAccuracy: accuracy, avgTimeMs },
  };
};

const getExistingPerformance = async (userId, topic) => {
  const { data, error } = await supabase
    .from('topic_performance')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

const getExistingSkill = async (userId, topic) => {
  const { data, error } = await supabase
    .from('user_skills')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

const insertLearningEvent = async ({ userId, questionId, topic, isCorrect, timeSpentMs, difficulty, source, metadata }) => {
  const { data, error } = await supabase
    .from('learning_events')
    .insert([
      {
        user_id: userId,
        question_id: questionId || null,
        topic,
        is_correct: Boolean(isCorrect),
        time_spent_ms: Number(timeSpentMs),
        difficulty: String(difficulty || 'medium').toLowerCase(),
        source: source || 'adaptive_quiz',
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const upsertRecommendation = async ({ userId, topic, recommendationType, reason, priority, metadata }) => {
  const { error } = await supabase
    .from('recommendations')
    .insert([
      {
        user_id: userId,
        topic,
        recommendation_type: recommendationType,
        reason,
        priority,
        status: 'active',
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      },
    ]);

  if (error) throw new Error(error.message);
};

const updateSkillFromAnswer = async ({ userId, questionId, topic, isCorrect, timeSpentMs, difficulty = 'medium', source = 'adaptive_quiz', metadata = null }) => {
  if (!topic) throw new Error('topic is required');
  if (typeof isCorrect === 'undefined') throw new Error('isCorrect is required');
  if (!timeSpentMs || Number(timeSpentMs) <= 0) throw new Error('timeSpentMs must be > 0');

  const normalizedTopic = String(topic).trim();
  const normalizedDifficulty = String(difficulty || 'medium').toLowerCase();

  const learningEvent = await insertLearningEvent({
    userId,
    questionId,
    topic: normalizedTopic,
    isCorrect,
    timeSpentMs,
    difficulty: normalizedDifficulty,
    source,
    metadata,
  });

  const existingPerformance = await getExistingPerformance(userId, normalizedTopic);
  const previousTotal = Number(existingPerformance?.total_answered || 0);
  const previousCorrect = Number(existingPerformance?.correct_answers || 0);
  const previousAvgTime = Number(existingPerformance?.avg_time_ms || 0);

  const totalAnswered = previousTotal + 1;
  const correctAnswers = previousCorrect + (isCorrect ? 1 : 0);
  const accuracy = totalAnswered > 0 ? correctAnswers / totalAnswered : 0;
  const avgTimeMs = Math.round(((previousAvgTime * previousTotal) + Number(timeSpentMs)) / totalAnswered);

  const targetTime = getTargetTimeByDifficulty(normalizedDifficulty);
  const speedScore = clamp((targetTime / Number(timeSpentMs)) * 100, 0, 100);
  const accuracyScore = accuracy * 100;
  const difficultyBonus = getDifficultyBonus(normalizedDifficulty);
  const rawSkillScore = clamp((accuracyScore * 0.65) + (speedScore * 0.25) + (difficultyBonus * 0.10), 0, 100);

  const existingSkill = await getExistingSkill(userId, normalizedTopic);
  const previousSkillScore = Number(existingSkill?.skill_score || 50);
  const smoothedSkillScore = Number((previousSkillScore * 0.7 + rawSkillScore * 0.3).toFixed(2));

  const weaknessLevel = computeWeaknessLevel(smoothedSkillScore);
  const nextDifficulty = recommendDifficulty(smoothedSkillScore);

  const { error: tpError } = await supabase
    .from('topic_performance')
    .upsert([
      {
        user_id: userId,
        topic: normalizedTopic,
        total_answered: totalAnswered,
        correct_answers: correctAnswers,
        accuracy: Number(accuracy.toFixed(4)),
        avg_time_ms: avgTimeMs,
        skill_score: smoothedSkillScore,
        weakness_level: weaknessLevel,
        recommended_difficulty: nextDifficulty,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ], { onConflict: 'user_id,topic' });

  if (tpError) throw new Error(tpError.message);

  const { error: skillError } = await supabase
    .from('user_skills')
    .upsert([
      {
        user_id: userId,
        topic: normalizedTopic,
        skill_score: smoothedSkillScore,
        accuracy: Number(accuracy.toFixed(4)),
        avg_time_ms: avgTimeMs,
        total_answered: totalAnswered,
        last_difficulty: normalizedDifficulty,
        updated_at: new Date().toISOString(),
      },
    ], { onConflict: 'user_id,topic' });

  if (skillError) throw new Error(skillError.message);

  const recommendation = buildRecommendation({
    topic: normalizedTopic,
    skillScore: smoothedSkillScore,
    weaknessLevel,
    accuracy: Number(accuracy.toFixed(4)),
    avgTimeMs,
  });

  await upsertRecommendation({
    userId,
    topic: normalizedTopic,
    recommendationType: recommendation.recommendationType,
    reason: recommendation.reason,
    priority: recommendation.priority,
    metadata: recommendation.metadata,
  });

  return {
    learningEvent,
    topic: normalizedTopic,
    accuracy: Number((accuracy * 100).toFixed(2)),
    avgTimeMs,
    skillScore: smoothedSkillScore,
    weaknessLevel,
    nextDifficulty,
    recommendation,
  };
};

const getRecommendations = async (userId, limit = 5) => {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
};

const getStudyPlan = async (userId) => {
  const { data: topics, error } = await supabase
    .from('topic_performance')
    .select('topic, skill_score, weakness_level, recommended_difficulty, accuracy, avg_time_ms, total_answered')
    .eq('user_id', userId)
    .order('skill_score', { ascending: true });

  if (error) throw new Error(error.message);

  const plan = (topics || []).map((topic, index) => {
    const action = topic.weakness_level === 'high'
      ? 'Kerjakan 15 soal latihan dasar + review konsep inti'
      : topic.weakness_level === 'medium'
        ? 'Kerjakan 10 soal campuran + evaluasi kesalahan'
        : 'Naikkan difficulty dan lakukan challenge set 10 soal';

    return {
      priority: index + 1,
      topic: topic.topic,
      skillScore: Number(topic.skill_score || 0),
      weaknessLevel: topic.weakness_level,
      recommendedDifficulty: topic.recommended_difficulty,
      action,
      targetAccuracy: topic.weakness_level === 'high' ? 70 : topic.weakness_level === 'medium' ? 80 : 90,
    };
  });

  return plan;
};

const getAdaptiveDashboard = async (userId) => {
  const { data: skills, error: skillError } = await supabase
    .from('user_skills')
    .select('topic, skill_score, accuracy, avg_time_ms, total_answered, updated_at')
    .eq('user_id', userId)
    .order('skill_score', { ascending: false });

  if (skillError) throw new Error(skillError.message);

  const { data: weaknesses, error: weaknessError } = await supabase
    .from('topic_performance')
    .select('topic, weakness_level, skill_score, accuracy, avg_time_ms, recommended_difficulty')
    .eq('user_id', userId)
    .in('weakness_level', ['high', 'medium'])
    .order('skill_score', { ascending: true });

  if (weaknessError) throw new Error(weaknessError.message);

  const recommendations = await getRecommendations(userId, 5);
  const studyPlan = await getStudyPlan(userId);

  return {
    progressChart: (skills || []).map((item) => ({
      topic: item.topic,
      skillScore: Number(item.skill_score || 0),
      accuracy: Number((Number(item.accuracy || 0) * 100).toFixed(2)),
      avgTimeMs: Number(item.avg_time_ms || 0),
    })),
    weaknessInsights: weaknesses || [],
    recommendedNextAction: recommendations,
    studyPlan,
  };
};

const backfillAdaptiveFromCompletedTryouts = async (userId) => {
  const { count: existingSkillCount, error: skillCountError } = await supabase
    .from('user_skills')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (skillCountError) throw new Error(skillCountError.message);

  if (Number(existingSkillCount || 0) > 0) {
    return { processedAnswers: 0, skipped: true, reason: 'Skills already exist' };
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('tryout_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: true });

  if (sessionsError) throw new Error(sessionsError.message);

  let processedAnswers = 0;

  for (const session of sessions || []) {
    const { data: answers, error: answersError } = await supabase
      .from('tryout_answers')
      .select('question_id, user_answer, is_correct, questions(category, correct_answer, point_a, point_b, point_c, point_d, point_e)')
      .eq('session_id', session.id);

    if (answersError) throw new Error(answersError.message);

    for (const answer of answers || []) {
      const topic = String(answer?.questions?.category || 'General').toUpperCase();
      let adaptiveIsCorrect = Boolean(answer.is_correct);

      if (topic === 'TKP') {
        const pointMap = {
          a: Number(answer?.questions?.point_a || 0),
          b: Number(answer?.questions?.point_b || 0),
          c: Number(answer?.questions?.point_c || 0),
          d: Number(answer?.questions?.point_d || 0),
          e: Number(answer?.questions?.point_e || 0),
        };
        const maxPoint = Math.max(...Object.values(pointMap));
        const selectedPoint = pointMap[String(answer.user_answer || '').toLowerCase()] || 0;
        adaptiveIsCorrect = selectedPoint >= maxPoint;
      }

      await updateSkillFromAnswer({
        userId,
        questionId: answer.question_id,
        topic,
        isCorrect: adaptiveIsCorrect,
        timeSpentMs: 60000,
        difficulty: 'medium',
        source: 'tryout_backfill',
        metadata: { sessionId: session.id, backfill: true },
      });

      processedAnswers += 1;
    }
  }

  return {
    processedAnswers,
    skipped: false,
  };
};

module.exports = {
  updateSkillFromAnswer,
  getRecommendations,
  getStudyPlan,
  getAdaptiveDashboard,
  backfillAdaptiveFromCompletedTryouts,
};
