import React from 'react';

export default function Activity() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Activity</h2>
        <p className="mt-1 text-sm text-slate-600">Riwayat aktivitas belajar dan sesi tryout terbaru.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-600">Belum ada aktivitas baru.</p>
      </section>
    </div>
  );
}
