import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TryoutCard from '../components/TryoutCard.tsx';
import { AuthContext } from '../context/AuthContext';
import { packageService, purchaseService } from '../services/api';

export default function Library() {
  const { user } = useContext(AuthContext as any);
  const navigate = useNavigate();
  const [ownedPackages, setOwnedPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOwnedPackages = async () => {
      if (!user) {
        setOwnedPackages([]);
        setLoading(false);
        return;
      }

      const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

      try {
        setLoading(true);

        if (isAdmin) {
          const allPackagesRes = await packageService.getAll();
          const allPackages = Array.isArray(allPackagesRes.data) ? allPackagesRes.data : [];
          setOwnedPackages(allPackages);
          setError('');
          return;
        }

        const [purchasesRes, allPackagesRes] = await Promise.all([
          purchaseService.getAll(),
          packageService.getAll(),
        ]);

        const allPackages = Array.isArray(allPackagesRes.data) ? allPackagesRes.data : [];
        const purchases = Array.isArray(purchasesRes.data) ? purchasesRes.data : [];
        const packageMap = new Map(allPackages.map((item) => [String(item.id), item]));

        const completedStatuses = ['completed', 'paid', 'success'];
        const result: any[] = [];

        purchases.forEach((purchase) => {
          const normalizedStatus = String(purchase.payment_status || '').toLowerCase();
          if (!completedStatuses.includes(normalizedStatus)) return;
          const pkg = packageMap.get(String(purchase.package_id));
          if (pkg) result.push(pkg);
        });

        const dedupeById = (list: any[]) => {
          const used = new Set();
          return list.filter((item) => {
            if (used.has(item.id)) return false;
            used.add(item.id);
            return true;
          });
        };

        setOwnedPackages(dedupeById(result));
        setError('');
      } catch (err) {
        setError('Gagal memuat paket library.');
      } finally {
        setLoading(false);
      }
    };

    loadOwnedPackages();
  }, [user]);

  const cards = useMemo(
    () =>
      ownedPackages.map((pkg) => ({
        id: pkg.id,
        title: pkg.name,
        description: pkg.description || 'Paket milikmu, siap dikerjakan.',
        questions: Number(pkg.question_count || 0),
        duration: Number(pkg.duration || 100),
        category: (pkg.category_name || pkg.type || 'Tryout').toUpperCase(),
        actionLabel: 'Mulai Tryout',
      })),
    [ownedPackages]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Library</h2>
        <p className="mt-1 text-sm text-slate-600">
          {String(user?.role || '').toLowerCase() === 'admin'
            ? 'Mode Admin: semua paket bisa langsung dikerjakan tanpa pembelian.'
            : 'Semua paket tryout yang sudah kamu beli.'}
        </p>
      </section>

      {!user && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-sm text-slate-600">Silakan login untuk melihat library dan mulai tryout.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-3 rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white"
          >
            Masuk
          </button>
        </section>
      )}

      {user && loading && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Loading library...
        </section>
      )}

      {user && error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </section>
      )}

      {user && !loading && !error && cards.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Belum ada paket aktif di library kamu.
        </section>
      )}

      {user && !loading && !error && cards.length > 0 && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((item) => (
            <TryoutCard key={item.id} {...item} onAction={() => navigate(`/quiz/${item.id}`)} />
          ))}
        </section>
      )}
    </div>
  );
}
