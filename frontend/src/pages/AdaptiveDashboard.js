import React, { useEffect, useState } from 'react';
import { adaptiveService } from '../services/api';
import '../styles/adaptive-dashboard.css';

const AdaptiveDashboard = () => {
  const [data, setData] = useState({ progressChart: [], weaknessInsights: [], recommendedNextAction: [], studyPlan: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAdaptiveData = async () => {
    try {
      setLoading(true);
      let response = await adaptiveService.getDashboard();
      const current = response.data || { progressChart: [], weaknessInsights: [], recommendedNextAction: [], studyPlan: [] };

      if ((current.progressChart || []).length === 0) {
        try {
          await adaptiveService.backfill();
          response = await adaptiveService.getDashboard();
        } catch (backfillErr) {
          console.warn('Adaptive backfill skipped:', backfillErr.message);
        }
      }

      setData(response.data || { progressChart: [], weaknessInsights: [], recommendedNextAction: [], studyPlan: [] });
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load adaptive dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdaptiveData();
  }, []);

  if (loading) return <div className="container">Loading adaptive dashboard...</div>;

  return (
    <div className="adaptive-dashboard container">
      <div className="adaptive-header">
        <h1>Adaptive Learning Dashboard</h1>
        <p>Pantau skill, kelemahan, dan rekomendasi belajar berikutnya.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="adaptive-grid">
        <section className="adaptive-card">
          <h2>Progress Chart</h2>
          {data.progressChart.length === 0 ? (
            <p className="text-muted">Belum ada data progres.</p>
          ) : (
            <div className="progress-list">
              {data.progressChart.map((item) => (
                <div className="progress-row" key={item.topic}>
                  <div className="progress-label">{item.topic}</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${Math.max(5, item.skillScore)}%` }} />
                  </div>
                  <div className="progress-value">{item.skillScore.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="adaptive-card">
          <h2>Weakness Insights</h2>
          {data.weaknessInsights.length === 0 ? (
            <p className="text-muted">Tidak ada kelemahan signifikan saat ini.</p>
          ) : (
            <ul className="insight-list">
              {data.weaknessInsights.map((item) => (
                <li key={item.topic}>
                  <strong>{item.topic}</strong>
                  <span>Skill {Number(item.skill_score || 0).toFixed(1)} • Weakness {item.weakness_level}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="adaptive-grid single">
        <section className="adaptive-card">
          <h2>Recommended Next Action</h2>
          {data.recommendedNextAction.length === 0 ? (
            <p className="text-muted">Belum ada rekomendasi.</p>
          ) : (
            <ul className="action-list">
              {data.recommendedNextAction.map((item) => (
                <li key={item.id}>
                  <div className="action-type">{item.recommendation_type}</div>
                  <div className="action-reason">{item.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adaptive-card">
          <h2>Study Plan</h2>
          {data.studyPlan.length === 0 ? (
            <p className="text-muted">Belum ada study plan.</p>
          ) : (
            <table className="study-plan-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Topic</th>
                  <th>Action</th>
                  <th>Target Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {data.studyPlan.map((item) => (
                  <tr key={`${item.topic}-${item.priority}`}>
                    <td>{item.priority}</td>
                    <td>{item.topic}</td>
                    <td>{item.action}</td>
                    <td>{item.targetAccuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdaptiveDashboard;
