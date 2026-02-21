import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../services/api';
import QuestionDetailModal from '../components/QuestionDetailModal';
import '../styles/reports.css';

const Reports = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initLoad();
  }, []);

  const initLoad = async () => {
    try {
      setLoading(true);
      const [overviewRes, analyticsRes, historyRes] = await Promise.all([
        reportService.getOverview(),
        reportService.getAnalytics(),
        reportService.getHistory(1, 10),
      ]);

      setOverview(overviewRes.data);
      setAnalytics(analyticsRes.data);
      setHistory(historyRes.data?.items || []);
      setHistoryMeta({
        page: historyRes.data?.page || 1,
        totalPages: historyRes.data?.totalPages || 1,
        total: historyRes.data?.total || 0,
        limit: historyRes.data?.limit || 10,
      });
    } catch (err) {
      setError('Gagal memuat report');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (page) => {
    try {
      const res = await reportService.getHistory(page, historyMeta.limit || 10);
      setHistory(res.data?.items || []);
      setHistoryMeta({
        page: res.data?.page || 1,
        totalPages: res.data?.totalPages || 1,
        total: res.data?.total || 0,
        limit: res.data?.limit || 10,
      });
    } catch (err) {
      setError('Gagal memuat riwayat attempt');
    }
  };

  const openAttemptDetail = async (attemptId) => {
    try {
      setLoadingDetail(true);
      const res = await reportService.getDetail(attemptId);
      setSelectedAttempt(res.data);
    } catch (err) {
      setError('Gagal memuat detail report');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openQuestionDetail = async (attemptId, questionNumber) => {
    try {
      setLoadingQuestion(true);
      setSelectedQuestion(null);
      const res = await reportService.getQuestionDetail(attemptId, questionNumber);
      setSelectedQuestion(res.data);
    } catch (err) {
      console.error('Error fetching question detail:', err);
      setSelectedQuestion({ error: 'Gagal memuat detail soal' });
    } finally {
      setLoadingQuestion(false);
    }
  };

  const downloadPdf = () => {
    if (!selectedAttempt) return;

    const summary = selectedAttempt.answerSummary;
    const detail = selectedAttempt.attempt;
    const breakdown = selectedAttempt.sectionBreakdown;

    const html = `
      <html>
        <head>
          <title>Report Attempt ${detail.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            h1, h2 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .muted { color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Report Attempt</h1>
          <p class="muted">Paket: ${detail.packageName} | Attempt ID: ${detail.id}</p>

          <h2>Skor</h2>
          <p>Total: <strong>${detail.totalScore}</strong> (${detail.status})</p>
          <p>TWK: ${breakdown.TWK} | TIU: ${breakdown.TIU} | TKP: ${breakdown.TKP}</p>

          <h2>Ringkasan Jawaban</h2>
          <p>Total Soal: ${summary.totalQuestions}, Benar: ${summary.correct}, Salah: ${summary.wrong}, Kosong: ${summary.blank}</p>
          <p>Persentase Benar: ${summary.correctPercentage}%</p>

          <h2>Review Jawaban</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kategori</th>
                <th>Jawaban Kamu</th>
                <th>Kunci</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${selectedAttempt.review
                .map(
                  (row) => `
                    <tr>
                      <td>${row.questionNumber || '-'}</td>
                      <td>${row.category || '-'}</td>
                      <td>${row.userAnswer || '-'}</td>
                      <td>${row.correctAnswer || '-'}</td>
                      <td>${row.isCorrect === null ? '-' : row.isCorrect ? 'Benar' : 'Salah'}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const popup = window.open('', '_blank');
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  if (loading) return <div className="container">Loading report...</div>;

  return (
    <div className="container report-page">
      <div className="dashboard-header">
        <h1>Report Belajar</h1>
        <p className="text-muted">Analisis performa, progres, dan insight belajar kamu.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!overview || overview.totalTests === 0 ? (
        <div className="card">
          <div className="card-title">Belum ada data report</div>
          <p className="text-muted">Selesaikan minimal 1 tryout untuk melihat report lengkap.</p>
        </div>
      ) : (
        <>
          <div className="report-kpi-grid">
            <div className="stat-card"><div className="stat-value">{overview.totalTests}</div><div className="stat-label">Total Tes</div></div>
            <div className="stat-card"><div className="stat-value">{overview.averageScore}</div><div className="stat-label">Rata-rata Skor</div></div>
            <div className="stat-card"><div className="stat-value">{overview.highestScore}</div><div className="stat-label">Skor Tertinggi</div></div>
            <div className="stat-card"><div className="stat-value">{overview.passRate}%</div><div className="stat-label">Persentase Lulus</div></div>
            <div className="stat-card"><div className="stat-value">{overview.latestPercentile ?? '-'}</div><div className="stat-label">Percentile Terakhir</div></div>
          </div>

          <div className="report-grid-two">
            <div className="card">
              <div className="card-title">Grafik Progres Skor</div>
              <div className="mini-chart">
                {overview.progress.map((point) => (
                  <div key={`p-${point.attemptId}`} className="mini-chart-item" title={`${point.packageName}: ${point.score}`}>
                    <div className="mini-chart-bar" style={{ height: `${Math.min(100, Math.max(6, point.score / 4))}%` }} />
                    <span>{point.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Statistik per Kategori Tes</div>
              <table className="admin-table">
                <thead>
                  <tr><th>Kategori</th><th>Attempt</th><th>Rata-rata</th><th>Pass Rate</th></tr>
                </thead>
                <tbody>
                  {(overview.categoryStats || []).map((row) => (
                    <tr key={`cat-${row.categoryId || row.categoryName}`}>
                      <td>{row.categoryName}</td>
                      <td>{row.attempts}</td>
                      <td>{row.averageScore}</td>
                      <td>{row.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Riwayat Attempt</div>
            {history.length === 0 ? (
              <p className="text-muted">Belum ada riwayat attempt.</p>
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Paket</th>
                      <th>Kategori</th>
                      <th>Tanggal</th>
                      <th>Skor</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={`attempt-${row.attemptId}`}>
                        <td>{row.packageName}</td>
                        <td>{row.categoryName}</td>
                        <td>{new Date(row.date).toLocaleDateString('id-ID')}</td>
                        <td>{row.score}</td>
                        <td>
                          <span className={row.isPassed ? 'status-passed' : 'status-failed'}>{row.status}</span>
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => openAttemptDetail(row.attemptId)}>
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pagination-row">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={historyMeta.page <= 1}
                    onClick={() => loadHistory(historyMeta.page - 1)}
                  >
                    Prev
                  </button>
                  <span>Page {historyMeta.page} / {historyMeta.totalPages}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={historyMeta.page >= historyMeta.totalPages}
                    onClick={() => loadHistory(historyMeta.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="report-grid-two">
            <div className="card">
              <div className="card-title">Kekuatan & Kelemahan</div>
              <h4>Kekuatan</h4>
              {(analytics?.strengths || []).length === 0 ? (
                <p className="text-muted">Belum ada kekuatan dominan.</p>
              ) : (
                <ul>
                  {analytics.strengths.map((row) => (
                    <li key={`s-${row.topic}`}>{row.topic} — akurasi {row.accuracy}%</li>
                  ))}
                </ul>
              )}

              <h4 style={{ marginTop: 16 }}>Kelemahan</h4>
              {(analytics?.weaknesses || []).length === 0 ? (
                <p className="text-muted">Belum ada kelemahan signifikan.</p>
              ) : (
                <ul>
                  {analytics.weaknesses.map((row) => (
                    <li key={`w-${row.topic}`}>{row.topic} — akurasi {row.accuracy}%</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="card-title">Rekomendasi Belajar</div>
              {(analytics?.recommendations || []).length === 0 ? (
                <p className="text-muted">Belum ada rekomendasi khusus.</p>
              ) : (
                analytics.recommendations.map((rec) => (
                  <div key={`rec-${rec.topic}`} className="recommendation-box">
                    <strong>{rec.topic}</strong>
                    <p className="text-muted" style={{ marginTop: 6 }}>{rec.reason}</p>
                    <ul>
                      {(rec.actionPlan || []).map((step, idx) => (
                        <li key={`step-${rec.topic}-${idx}`}>{step}</li>
                      ))}
                    </ul>
                    {(rec.materials || []).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>Materi terkait:</strong>
                        <ul>
                          {rec.materials.map((material) => (
                            <li key={`mat-${material.id}`}>
                              <a href={material.fileUrl} target="_blank" rel="noopener noreferrer">{material.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {loadingDetail && (
        <div className="bundle-modal-overlay">
          <div className="bundle-modal-content">Loading detail...</div>
        </div>
      )}

      {selectedAttempt && (
        <div className="bundle-modal-overlay" onClick={() => setSelectedAttempt(null)}>
          <div className="bundle-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="bundle-modal-header">
              <h3>Detail Attempt #{selectedAttempt.attempt.id}</h3>
              <div className="d-flex gap-10">
                <button className="btn btn-info btn-sm" onClick={() => {
                  setSelectedAttempt(null);
                  navigate(`/review/${selectedAttempt.attempt.id}`);
                }}>📖 Review Soal</button>
                <button className="btn btn-secondary btn-sm" onClick={downloadPdf}>Download PDF</button>
                <button className="btn btn-danger btn-sm" onClick={() => setSelectedAttempt(null)}>Tutup</button>
              </div>
            </div>

            <div className="detail-grid">
              <div><strong>Skor Total:</strong> {selectedAttempt.attempt.totalScore}</div>
              <div><strong>Status:</strong> {selectedAttempt.attempt.status}</div>
              <div><strong>Durasi:</strong> {selectedAttempt.attempt.durationMinutes || '-'} menit</div>
              <div><strong>Persentase Benar:</strong> {selectedAttempt.answerSummary.correctPercentage}%</div>
            </div>

            <div className="detail-grid" style={{ marginTop: 10 }}>
              <div>TWK: {selectedAttempt.sectionBreakdown.TWK}</div>
              <div>TIU: {selectedAttempt.sectionBreakdown.TIU}</div>
              <div>TKP: {selectedAttempt.sectionBreakdown.TKP}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Ringkasan Jawaban</strong>
              <div className="detail-grid" style={{ marginTop: 6 }}>
                <div>Benar: {selectedAttempt.answerSummary.correct}</div>
                <div>Salah: {selectedAttempt.answerSummary.wrong}</div>
                <div>Kosong: {selectedAttempt.answerSummary.blank}</div>
                <div>Total: {selectedAttempt.answerSummary.totalQuestions}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Distribusi Jawaban</strong>
              <div className="detail-grid" style={{ marginTop: 6 }}>
                {Object.entries(selectedAttempt.answerDistribution || {}).map(([key, value]) => (
                  <div key={`dist-${key}`}>{key}: {value}</div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
              <strong>Review Jawaban Soal</strong>
              <table className="admin-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Kategori</th>
                    <th>Jawaban</th>
                    <th>Kunci</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAttempt.review.map((row) => (
                    <tr key={`review-${row.questionId}`}>
                      <td>
                        <button
                          className="question-link-btn"
                          onClick={() =>
                            openQuestionDetail(
                              selectedAttempt.attempt.id,
                              row.questionNumber
                            )
                          }
                          title="Lihat detail soal"
                        >
                          {row.questionNumber}
                        </button>
                      </td>
                      <td>{row.category}</td>
                      <td>{row.userAnswer || '-'}</td>
                      <td>{row.correctAnswer || '-'}</td>
                      <td>{row.isCorrect === null ? '-' : row.isCorrect ? 'Benar' : 'Salah'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Question Detail Modal */}
      {selectedQuestion && (
        <QuestionDetailModal
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
          loading={loadingQuestion}
          error={selectedQuestion?.error}
        />
      )}
    </div>
  );
};

export default Reports;
