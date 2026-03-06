import React from 'react';
import TryoutCard from '../components/TryoutCard.tsx';

const ownedTryouts = [
  {
    title: 'SKD CPNS Full Paket 1',
    description: 'Paket milikmu, bisa langsung lanjut belajar.',
    questions: 110,
    duration: 100,
    category: 'CPNS',
    actionLabel: 'Mulai Tryout',
    actionTo: '/quiz/1',
  },
  {
    title: 'PPPK Teknis Simulasi',
    description: 'Lanjutkan progres latihan paket PPPK.',
    questions: 90,
    duration: 90,
    category: 'PPPK',
    actionLabel: 'Lanjutkan',
    actionTo: '/my-materials',
  },
];

export default function Library() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Library</h2>
        <p className="mt-1 text-sm text-slate-600">Semua paket tryout yang sudah kamu beli.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ownedTryouts.map((item) => (
          <TryoutCard key={item.title} {...item} />
        ))}
      </section>
    </div>
  );
}
