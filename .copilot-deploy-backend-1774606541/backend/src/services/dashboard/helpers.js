const toNumber = (value) => Number(value || 0);

const safePercent = (numerator, denominator) => {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
};

const trendSlope = (scores) => {
  if (!scores || scores.length < 2) return 0;

  // simple linear regression slope
  const n = scores.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  scores.forEach((score, index) => {
    const x = index + 1;
    const y = toNumber(score);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(2));
};

const levelFromXp = (xp) => {
  // simple progressive model: level^2 * 100 threshold
  const totalXp = toNumber(xp);
  let level = 1;
  while (totalXp >= level * level * 100) {
    level += 1;
  }
  const nextThreshold = level * level * 100;
  return { level, xpToNextLevel: Math.max(0, nextThreshold - totalXp) };
};

const masteryLevel = (accuracy) => {
  if (accuracy >= 80) return 'expert';
  if (accuracy >= 65) return 'intermediate';
  return 'beginner';
};

module.exports = {
  toNumber,
  safePercent,
  trendSlope,
  levelFromXp,
  masteryLevel,
};
