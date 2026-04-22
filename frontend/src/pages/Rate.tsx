import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await ratingService.getHighlights();
        const payload = response?.data || {};
        setPackages(Array.isArray(payload.packages) ? payload.packages : []);
        setReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
        setError('');
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Gagal memuat data rating.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const avgGlobal = useMemo(() => {
    const ratedPackages = packages.filter((item) => item.averageRating !== null && item.ratingCount > 0);
    if (ratedPackages.length === 0) return null;

    const totalWeighted = ratedPackages.reduce((sum, item) => sum + Number(item.averageRating || 0) * Number(item.ratingCount || 0), 0);
    const totalCount = ratedPackages.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0);
    if (totalCount <= 0) return null;

    return Number((totalWeighted / totalCount).toFixed(1));
  }, [packages]);

  const totalRatings = useMemo(
    () => packages.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0),
    [packages]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Rate & Testimoni</h2>
        <p className="mt-1 text-sm text-slate-600">
          Peserta bisa memberikan rating dan testimoni setelah menyelesaikan tryout. Pengisian bersifat opsional.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rata-rata Global</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-semibold text-slate-900">{avgGlobal !== null ? avgGlobal.toFixed(1) : '-'}</p>
              {avgGlobal !== null ? <div className="flex items-center gap-0.5">{renderStars(Math.round(avgGlobal), 12)}</div> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Rating</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalRatings}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paket Terlihat</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{packages.length}</p>
          </div>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Memuat data rating...</section>
      )}

      {!loading && error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</section>
      )}

      {!loading && !error && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Rating per Paket</h3>
            <div className="mt-3 space-y-3">
              {packages.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada data rating paket.</p>
              ) : (
                packages.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{item.averageRating !== null ? item.averageRating.toFixed(1) : '-'}</span>
                      {item.averageRating !== null ? <div className="flex items-center gap-0.5">{renderStars(Math.round(item.averageRating))}</div> : null}
                      <span>({item.ratingCount} rating)</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Testimoni Terbaru</h3>
            <div className="mt-3 space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada testimoni.</p>
              ) : (
                reviews.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.reviewerName}</p>
                      <div className="flex items-center gap-0.5">{renderStars(item.rating)}</div>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.packageName}</p>
                    {item.comment ? <p className="mt-2 text-sm text-slate-700">{item.comment}</p> : null}
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
