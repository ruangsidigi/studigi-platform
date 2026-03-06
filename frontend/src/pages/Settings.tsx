import React from 'react';

export default function Settings() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Kelola preferensi akun dan pengaturan aplikasi.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm text-slate-600">Pengaturan lanjutan akan ditampilkan di sini.</p>
      </section>
    </div>
  );
}
