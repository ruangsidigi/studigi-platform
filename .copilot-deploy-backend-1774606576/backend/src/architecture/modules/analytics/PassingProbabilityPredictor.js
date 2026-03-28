class PassingProbabilityPredictor {
  predict({ averageScore = 0, trend = 0, consistency = 0 }) {
    const raw = averageScore * 0.55 + trend * 20 + consistency * 0.25;
    const probability = Math.max(0, Math.min(100, Math.round(raw / 6)));

    let band = 'Low';
    if (probability >= 75) band = 'High';
    else if (probability >= 50) band = 'Medium';

    return { probability, band };
  }
}

module.exports = new PassingProbabilityPredictor();
