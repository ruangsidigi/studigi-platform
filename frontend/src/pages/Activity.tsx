import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { adaptiveService, packageService, reportService } from '../services/api';

export default function Activity() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext as any);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [adaptiveDashboard, setAdaptiveDashboard] = useState<any>(null);
  const [myRankings, setMyRankings] = useState<any[]>([]);
  const [expandedPackageId, setExpandedPackageId] = useState<number | null>(null);
  const [leaderboardScopeByPackage, setLeaderboardScopeByPackage] = useState<Record<number, 'national' | 'province'>>({});
  const [leaderboardData, setLeaderboardData] = useState<Record<string, any[]>>({});
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setOverview(null);
        setHistory([]);
        setAdaptiveDashboard(null);
        setMyRankings([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [overviewRes, historyRes, adaptiveRes, rankingsRes] = await Promise.allSettled([
          reportService.getOverview(),
          reportService.getHistory(1, 6),
          adaptiveService.getDashboard(),
          reportService.getMyRankings(),
        ]);

        const hasCoreFailure =
          overviewRes.status === 'rejected' ||
          historyRes.status === 'rejected' ||
          adaptiveRes.status === 'rejected';

        setOverview(overviewRes.status === 'fulfilled' ? overviewRes.value.data || null : null);
        setHistory(
          historyRes.status === 'fulfilled' && Array.isArray(historyRes.value.data?.items)
            ? historyRes.value.data.items
            : []
        );
        setAdaptiveDashboard(adaptiveRes.status === 'fulfilled' ? adaptiveRes.value.data || null : null);
        setMyRankings(
          rankingsRes.status === 'fulfilled' && Array.isArray(rankingsRes.value.data?.rankings)
            ? rankingsRes.value.data.rankings
            : []
        );

        setError(hasCoreFailure ? 'Gagal memuat sebagian data activity.' : '');
      } catch (loadErr) {
        setError('Gagal memuat data activity.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const buildBoardKey = (packageId: number, scope: 'national' | 'province') => `${packageId}_${scope}`;

  const fetchLeaderboard = async (packageId: number, scope: 'national' | 'province', province?: string | null) => {
    const boardKey = buildBoardKey(packageId, scope);
    if (leaderboardData[boardKey]) return;
    try {
      setLoadingLeaderboard(boardKey);
      const params: any = scope === 'province' ? { scope, province } : { scope };
      const res = await packageService.getLeaderboard(packageId, params);
      setLeaderboardData((prev) => ({ ...prev, [boardKey]: res.data?.ranking || [] }));
    } catch (_) {
      setLeaderboardData((prev) => ({ ...prev, [boardKey]: [] }));
    } finally {
      setLoadingLeaderboard(null);
    }
  };

  const toggleLeaderboard = async (packageId: number, province?: string | null) => {
    if (expandedPackageId === packageId) {
      setExpandedPackageId(null);
      return;
    }
    setExpandedPackageId(packageId);
    const currentScope = leaderboardScopeByPackage[packageId] || 'national';
    await fetchLeaderboard(packageId, currentScope, province || null);
  };

  const switchLeaderboardScope = async (packageId: number, scope: 'national' | 'province', province?: string | null) => {
    setLeaderboardScopeByPackage((prev) => ({ ...prev, [packageId]: scope }));
    await fetchLeaderboard(packageId, scope, province || null);
  };

  const progressBars = useMemo(() => {
    const points = Array.isArray(overview?.progress) ? overview.progress : [];
    return points.slice(-8);
  }, [overview]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 pb-20 sm:space-y-5 sm:px-4 md:px-5 lg:space-y-6 lg:px-0 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Activity</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
          Adaptive learning, grafik peningkatan nilai, dan review tryout.
        </p>
      </section>

      {error && <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:p-5">{error}</section>}

      <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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

        <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6">
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
              <div key={item.attemptId} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.packageName || `Attempt #${item.attemptId}`}</p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-1.5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Ranking Paket Tryout</h3>
            <p className="mt-0.5 text-xs text-[var(--secondary-color,#69655e)]">Posisi kamu dibanding seluruh peserta pada setiap paket yang sudah dikerjakan.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading data ranking...</p>
        ) : myRankings.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada data ranking. Selesaikan tryout untuk melihat posisimu.</p>
        ) : (
          <div className="space-y-3">
            {myRankings.map((pkg: any) => {
              const nationalRank = pkg.userRankNational;
              const provinceRank = pkg.userRankProvince;
              const rankForBadge = nationalRank;
              const medal = rankForBadge === 1 ? '🥇' : rankForBadge === 2 ? '🥈' : rankForBadge === 3 ? '🥉' : null;
              const isExpanded = expandedPackageId === pkg.packageId;
              const activeScope: 'national' | 'province' = leaderboardScopeByPackage[pkg.packageId] || 'national';
              const boardKey = buildBoardKey(pkg.packageId, activeScope);
              const board: any[] = leaderboardData[boardKey] || [];

              return (
                <div key={pkg.packageId} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-start gap-3 p-3 sm:items-center sm:p-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700">
                      {medal || `#${rankForBadge}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{pkg.packageName}</p>
                      <div className="space-y-0.5 text-xs text-[var(--secondary-color,#69655e)]">
                        <p>
                          Nasional: <strong className="text-slate-900">#{nationalRank}</strong> dari{' '}
                          <strong className="text-slate-900">{pkg.participantCountNational}</strong> peserta
                        </p>
                        <p>
                          Provinsi ({pkg.participantProvince || '-'}):{' '}
                          <strong className="text-slate-900">{provinceRank ? `#${provinceRank}` : '-'}</strong> dari{' '}
                          <strong className="text-slate-900">{pkg.participantCountProvince || 0}</strong> peserta
                          {' '}• Skor terbaik: <strong className="text-slate-900">{pkg.userBestScore}</strong>
                          {' '}• Skor terbaru: <strong className="text-slate-900">{pkg.userLatestScore ?? pkg.userBestScore}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLeaderboard(pkg.packageId, pkg.participantProvince)}
                      className="w-full shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto sm:py-1.5"
                    >
                      {isExpanded ? 'Tutup' : 'Lihat Semua'}
                    </button>
                  </div>

                  {!isExpanded && (pkg.topParticipantsNational || []).length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="mb-1.5 text-xs font-medium text-slate-500">Top 3 Nasional</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {(pkg.topParticipantsNational || []).slice(0, 3).map((p: any) => (
                          <div key={p.rank} className="flex items-center gap-1.5 text-xs text-slate-700">
                            <span>{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}</span>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-slate-400">{p.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => switchLeaderboardScope(pkg.packageId, 'national', pkg.participantProvince)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${activeScope === 'national' ? 'bg-[var(--header-color,#103c21)] text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          Nasional
                        </button>
                        <button
                          type="button"
                          disabled={!pkg.participantProvince}
                          onClick={() => switchLeaderboardScope(pkg.packageId, 'province', pkg.participantProvince)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${activeScope === 'province' ? 'bg-[var(--header-color,#103c21)] text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-50`}
                        >
                          Provinsi
                        </button>
                      </div>

                      {loadingLeaderboard === boardKey ? (
                        <p className="p-3 text-sm text-slate-500">Memuat leaderboard...</p>
                      ) : board.length === 0 ? (
                        <p className="p-3 text-sm text-slate-500">Belum ada data leaderboard.</p>
                      ) : (
                        <div>
                          <div className="space-y-2 p-3 sm:hidden">
                            {board.slice(0, 20).map((row: any) => {
                              const myRank = activeScope === 'province' ? pkg.userRankProvince : pkg.userRankNational;
                              const isMe = row.is_me || (row.rank === myRank && row.best_score === pkg.userBestScore);
                              return (
                                <div
                                  key={`mobile-${row.rank}-${row.user_name}`}
                                  className={`rounded-lg border border-slate-200 p-2.5 ${isMe ? 'bg-[var(--header-color,#103c21)]/5' : 'bg-white'}`}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">
                                      {row.rank <= 3
                                        ? row.rank === 1 ? '🥇 #1' : row.rank === 2 ? '🥈 #2' : '🥉 #3'
                                        : `#${row.rank}`}
                                    </span>
                                    <span className="font-mono text-sm text-slate-800">{row.best_score}</span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {row.user_name}
                                    {isMe && <span className="ml-1.5 rounded bg-[var(--header-color,#103c21)] px-1.5 py-0.5 text-[10px] text-white">Kamu</span>}
                                  </p>
                                  <p className="text-xs text-slate-500">{row.user_province || '-'}</p>
                                </div>
                              );
                            })}
                          </div>

                          <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                                <th className="px-3 py-2 w-12">No</th>
                                <th className="px-3 py-2">Peserta</th>
                                <th className="px-3 py-2">Provinsi</th>
                                <th className="px-3 py-2 text-right">Skor Terbaik</th>
                              </tr>
                            </thead>
                            <tbody>
                              {board.slice(0, 20).map((row: any) => {
                                const myRank = activeScope === 'province' ? pkg.userRankProvince : pkg.userRankNational;
                                const isMe = row.is_me || (row.rank === myRank && row.best_score === pkg.userBestScore);
                                return (
                                  <tr
                                    key={`${row.rank}-${row.user_name}`}
                                    className={`border-t border-slate-100 ${isMe ? 'bg-[var(--header-color,#103c21)]/5 font-semibold' : ''}`}
                                  >
                                    <td className="px-3 py-2 text-slate-500">
                                      {row.rank <= 3
                                        ? row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'
                                        : `#${row.rank}`}
                                    </td>
                                    <td className="px-3 py-2 text-slate-900">
                                      {row.user_name}{isMe && <span className="ml-1.5 rounded bg-[var(--header-color,#103c21)] px-1.5 py-0.5 text-[10px] text-white">Kamu</span>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{row.user_province || '-'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700">{row.best_score}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            </table>
                          </div>
                          {board.length > 20 && (
                            <p className="px-3 py-2 text-center text-xs text-slate-400">Menampilkan 20 teratas dari {board.length} peserta</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
