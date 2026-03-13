import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adaptiveService, reportService } from '../services/api';

export default function Activity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [adaptiveDashboard, setAdaptiveDashboard] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [overviewRes, historyRes, adaptiveRes] = await Promise.all([
          reportService.getOverview(),
          reportService.getHistory(1, 6),
          adaptiveService.getDashboard(),
        ]);

        setOverview(overviewRes.data || null);
        setHistory(Array.isArray(historyRes.data?.items) ? historyRes.data.items : []);
        setAdaptiveDashboard(adaptiveRes.data || null);
        setError('');
      } catch (loadErr) {
        setError('Gagal memuat data activity.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const progressBars = useMemo(() => {
    const points = Array.isArray(overview?.progress) ? overview.progress : [];
    return points.slice(-8);
  }, [overview]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-20 sm:space-y-5 lg:space-y-6 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Activity</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
          Adaptive learning, grafik peningkatan nilai, dan review tryout.
        </p>
      </section>

      {error && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</section>}

      <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Adaptive Learning</h3>
            <button
              type="button"
              onClick={() => navigate('/dashboard/adaptive')}
              className="w-full rounded-xl bg-[var(--header-color,#103c21)] px-3 py-2 text-xs font-semibold text-white sm:w-auto"
            >
              Buka Adaptive
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-600">Loading adaptive data...</p>
          ) : (
            <div className="space-y-2 text-sm text-[var(--secondary-color,#69655e)]">
              <p>
                Rekomendasi: <strong className="text-slate-900">{(adaptiveDashboard?.recommendedNextAction || []).length}</strong>
              </p>
              <p>
                Study Plan: <strong className="text-slate-900">{(adaptiveDashboard?.studyPlan || []).length}</strong>
              </p>
              <p>
                Weakness Insights: <strong className="text-slate-900">{(adaptiveDashboard?.weaknessInsights || []).length}</strong>
              </p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Report Belajar</h3>
            <button
              type="button"
              onClick={() => navigate('/dashboard/report')}
              className="w-full rounded-xl border border-[var(--secondary-color,#69655e)] px-3 py-2 text-xs font-semibold text-[var(--secondary-color,#69655e)] sm:w-auto"
            >
              Buka Report
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-600">Loading report data...</p>
          ) : progressBars.length === 0 ? (
            <p className="text-sm text-slate-600">Belum ada data progres nilai.</p>
          ) : (
            <div className="flex items-end gap-2 overflow-x-auto pt-2">
              {progressBars.map((point: any) => (
                <div key={`progress-${point.attemptId}`} className="min-w-[44px] text-center">
                  <div className="flex h-24 items-end justify-center rounded-t bg-slate-100 p-1">
                    <div
                      className="w-6 rounded-t bg-[var(--header-color,#103c21)]"
                      style={{ height: `${Math.min(100, Math.max(8, Number(point.score || 0) / 4))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{point.score}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5">
          <h3 className="text-base font-semibold text-slate-900">Review Tryout Terakhir</h3>
          <span className="text-xs text-[var(--secondary-color,#69655e)]">Maksimal 6 data terbaru</span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading riwayat tryout...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada riwayat tryout.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item: any) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.packageName || `Attempt #${item.id}`}</p>
                  <p className="text-xs text-[var(--secondary-color,#69655e)]">
                    Skor {item.score || 0} • {item.status || '-'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/review/${item.attemptId}`)}
                  className="w-full rounded-xl bg-[var(--header-color,#103c21)] px-3 py-2 text-xs font-semibold text-white sm:w-auto"
                >
                  Review Soal
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
