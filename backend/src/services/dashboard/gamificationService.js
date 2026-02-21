const supabase = require('../../config/supabase');
const { levelFromXp } = require('./helpers');

const calculateXpGain = (session) => {
  const base = 50;
  const scoreBonus = Math.round((Number(session.total_score || 0) / 500) * 100);
  const passBonus = session.is_passed ? 40 : 0;
  return Math.max(20, base + scoreBonus + passBonus);
};

const upsertXp = async (userId, gainedXp) => {
  const { data: existing, error: readError } = await supabase
    .from('user_xp')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const totalXp = Number(existing?.total_xp || 0) + Number(gainedXp || 0);
  const levelInfo = levelFromXp(totalXp);

  const payload = {
    user_id: userId,
    total_xp: totalXp,
    level: levelInfo.level,
    xp_to_next_level: levelInfo.xpToNextLevel,
    updated_at: new Date(),
  };

  const { error } = await supabase.from('user_xp').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);

  return payload;
};

const upsertStreak = async (userId, finishedAt) => {
  const today = new Date(finishedAt || new Date()).toISOString().slice(0, 10);

  const { data: existing, error: readError } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  let currentStreak = Number(existing?.current_streak || 0);
  const longestStreak = Number(existing?.longest_streak || 0);
  const lastDate = existing?.last_activity_date;

  if (!lastDate) {
    currentStreak = 1;
  } else {
    const prev = new Date(lastDate);
    const now = new Date(today);
    const diffDays = Math.round((now - prev) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      // same day; unchanged
    } else if (diffDays === 1) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
  }

  const payload = {
    user_id: userId,
    current_streak: currentStreak,
    longest_streak: Math.max(longestStreak, currentStreak),
    last_activity_date: today,
    updated_at: new Date(),
  };

  const { error } = await supabase.from('user_streaks').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);

  return payload;
};

const awardBadges = async (userId, context) => {
  const badges = [];

  if (context.totalAttempts >= 1) {
    badges.push({ badge_code: 'first_attempt', badge_name: 'First Attempt' });
  }
  if (context.currentStreak >= 3) {
    badges.push({ badge_code: 'streak_3', badge_name: 'Streak 3 Hari' });
  }
  if (context.level >= 5) {
    badges.push({ badge_code: 'level_5', badge_name: 'Level 5 Achiever' });
  }
  if (context.latestPassed) {
    badges.push({ badge_code: 'passed_once', badge_name: 'Pernah Lulus' });
  }

  if (badges.length === 0) return [];

  const payload = badges.map((badge) => ({
    user_id: userId,
    ...badge,
    earned_at: new Date(),
    metadata: {},
  }));

  const { error } = await supabase.from('user_badges').upsert(payload, { onConflict: 'user_id,badge_code' });
  if (error) throw new Error(error.message);

  return badges;
};

module.exports = {
  calculateXpGain,
  upsertXp,
  upsertStreak,
  awardBadges,
};
