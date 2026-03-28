const { toNumber } = require('./helpers');

// Simple probabilistic model using average score, trend, and pass rate
const computePassingProbability = ({ averageScore, trendScore, passRate }) => {
  const avg = toNumber(averageScore);
  const trend = toNumber(trendScore);
  const pass = toNumber(passRate);

  // weighted score then sigmoid-ish clamp
  const weighted = avg * 0.6 + pass * 0.7 + trend * 8;
  const normalized = Math.max(0, Math.min(100, Math.round((weighted / 5.5))));

  let label = 'Low';
  if (normalized >= 75) label = 'High';
  else if (normalized >= 50) label = 'Medium';

  return {
    probability: normalized,
    label,
    factors: {
      averageScore: avg,
      trendScore: trend,
      passRate: pass,
    },
  };
};

module.exports = {
  computePassingProbability,
};
