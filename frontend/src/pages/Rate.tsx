import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import { ratingService } from '../services/api';

type PackageRating = {
  id: number;
  name: string;
  averageRating: number | null;
  ratingCount: number;
};

type ReviewItem = {
  id: number;
  rating: number;
  comment: string;
  reviewerName: string;
  packageId: number;
  packageName: string;
  createdAt: string;
};

const renderStars = (value: number, size = 14) =>
  Array.from({ length: 5 }).map((_, index) => {
    const active = index < value;
    return <Star key={`${value}-${index}`} size={size} className={active ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} />;
  });

export default function RatePage() {
  const [packages, setPackages] = useState<PackageRating[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [activePackageId, setActivePackageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await ratingService.getHighlights();
        const payload = response?.data || {};
        const packageRows = Array.isArray(payload.packages) ? payload.packages : [];
        const reviewRows = Array.isArray(payload.reviews) ? payload.reviews : [];

        setPackages(packageRows);
        setReviews(reviewRows);
        setActivePackageId(packageRows[0]?.id ?? null);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Data rating belum bisa dimuat. Coba lagi sebentar ya.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const avgGlobal = useMemo(() => {
    const ratedPackages = packages.filter((item) => item.averageRating !== null && item.ratingCount > 0);
    if (ratedPackages.length === 0) return null;

    const totalWeighted = ratedPackages.reduce(
      (sum, item) => sum + Number(item.averageRating || 0) * Number(item.ratingCount || 0),
      0
    );
    const totalCount = ratedPackages.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0);
    if (totalCount <= 0) return null;

    return Number((totalWeighted / totalCount).toFixed(1));
  }, [packages]);

  const totalRatings = useMemo(
    () => packages.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0),
    [packages]
  );

  const reviewsByPackage = useMemo(() => {
    return reviews.reduce((acc, item) => {
      const key = Number(item.packageId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<number, ReviewItem[]>);
  }, [reviews]);

  const activePackage = packages.find((item) => item.id === activePackageId) || null;
  const activeReviews = activePackageId ? reviewsByPackage[activePackageId] || [] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Rate & Testimoni</h2>
        <p className="mt-1 text-sm text-slate-600">
          Lihat penilaian peserta untuk setiap paket tryout. Klik nama paket untuk menampilkan rating dan testimoni.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rata-rata Semua Paket</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-semibold text-slate-900">{avgGlobal !== null ? avgGlobal.toFixed(1) : '-'}</p>
              {avgGlobal !== null ? <div className="flex items-center gap-0.5">{renderStars(Math.round(avgGlobal), 12)}</div> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Rating Masuk</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalRatings}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paket Tryout</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{packages.length}</p>
          </div>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Mengambil data rating terbaru...</section>
      )}

      {!loading && error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</section>
      )}

      {!loading && !error && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Daftar Paket</h3>
            <p className="mt-1 text-xs text-slate-500">Klik nama paket untuk menampilkan detail rating dan testimoni.</p>

            <div className="mt-3 space-y-2">
              {packages.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada paket yang memiliki rating.</p>
              ) : (
                packages.map((item) => {
                  const isOpen = item.id === activePackageId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActivePackageId(isOpen ? null : item.id)}
                      className={[
                        'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors',
                        isOpen
                          ? 'border-[var(--header-color,#103c21)] bg-emerald-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.ratingCount} rating</p>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        {item.averageRating !== null ? <span className="text-sm font-semibold">{item.averageRating.toFixed(1)}</span> : <span className="text-sm">-</span>}
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Detail Paket</h3>

            {!activePackage ? (
              <p className="mt-3 text-sm text-slate-500">Pilih salah satu paket di sebelah kiri untuk melihat rating dan testimoni.</p>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{activePackage.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-semibold text-slate-900">
                      {activePackage.averageRating !== null ? activePackage.averageRating.toFixed(1) : '-'}
                    </span>
                    {activePackage.averageRating !== null ? (
                      <div className="flex items-center gap-0.5">{renderStars(Math.round(activePackage.averageRating))}</div>
                    ) : null}
                    <span className="text-xs text-slate-500">({activePackage.ratingCount} rating)</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {activeReviews.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada testimoni untuk paket ini.</p>
                  ) : (
                    activeReviews.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.reviewerName}</p>
                          <div className="flex items-center gap-0.5">{renderStars(item.rating)}</div>
                        </div>
                        {item.comment ? <p className="mt-2 text-sm text-slate-700">{item.comment}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
