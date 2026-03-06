import React from 'react';

export default function Payouts() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Payouts</h2>
        <p className="mt-1 text-sm text-slate-600">Riwayat pembayaran paket tryout kamu.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-600">Belum ada data payout yang ditampilkan.</p>
      </section>
    </div>
  );
}
