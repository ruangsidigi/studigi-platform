import React from 'react';
import TryoutCard from '../components/TryoutCard.tsx';

const tryoutData = [
  {
    title: 'SKD CPNS Full Paket 1',
    description: 'Latihan TWK, TIU, TKP lengkap dengan pembahasan.',
    questions: 110,
    duration: 100,
    category: 'CPNS',
    actionTo: '/dashboard/packages',
  },
  {
    title: 'SKD CPNS Full Paket 2',
    description: 'Paket terbaru dengan simulasi waktu ujian real.',
    questions: 110,
    duration: 100,
    category: 'CPNS',
    actionTo: '/dashboard/packages',
  },
  {
    title: 'PPPK Teknis Simulasi',
    description: 'Paket latihan kompetensi teknis dan manajerial.',
    questions: 90,
    duration: 90,
    category: 'PPPK',
    actionTo: '/dashboard/packages',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl bg-[var(--header-color,#103c21)] p-5 text-white sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Tryout Marketplace</h2>
        <p className="mt-1 text-sm text-emerald-100">Pilih paket terbaik untuk persiapan CPNS dan PPPK.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tryoutData.map((item) => (
          <TryoutCard key={item.title} {...item} />
        ))}
      </section>
    </div>
  );
}
