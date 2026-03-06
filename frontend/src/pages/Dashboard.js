import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, CircleDollarSign, FileText, Package } from 'lucide-react';
import { packageService, purchaseService } from '../services/api';
import DashboardStatCard from '../components/dashboard/DashboardStatCard';
import TryoutPackageCard from '../components/dashboard/TryoutPackageCard';

const Dashboard = () => {
  const [ownedPackages, setOwnedPackages] = useState([]);
  const [pendingPackages, setPendingPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOwnedPackages = async () => {
      try {
        const [purchasesRes, allPackagesRes] = await Promise.all([
          purchaseService.getAll(),
          packageService.getAll(),
        ]);

        const allPackages = Array.isArray(allPackagesRes.data) ? allPackagesRes.data : [];
        const packageMap = new Map(allPackages.map((item) => [String(item.id), item]));
        const purchases = Array.isArray(purchasesRes.data) ? purchasesRes.data : [];

        const completedStatuses = ['completed', 'paid', 'success'];
        const pendingStatuses = ['pending'];

        const owned = [];
        const pending = [];

        purchases.forEach((purchase) => {
          const normalizedStatus = String(purchase.payment_status || '').toLowerCase();
          const pkg = packageMap.get(String(purchase.package_id));
          if (!pkg) return;

          if (completedStatuses.includes(normalizedStatus)) {
            owned.push(pkg);
          } else if (pendingStatuses.includes(normalizedStatus)) {
            pending.push(pkg);
          }
        });

        const dedupeById = (list) => {
          const used = new Set();
          return list.filter((item) => {
            if (used.has(item.id)) return false;
            used.add(item.id);
            return true;
          });
        };

        setOwnedPackages(dedupeById(owned));
        setPendingPackages(dedupeById(pending));
      } catch (err) {
        setError('Gagal memuat paket yang sudah dibeli.');
      } finally {
        setLoading(false);
      }
    };

    fetchOwnedPackages();
  }, []);

  const stats = useMemo(() => {
    const totalQuestions = ownedPackages.reduce(
      (sum, pkg) => sum + Number(pkg.question_count || 0),
      0
    );
    const estimatedValue = ownedPackages.reduce((sum, pkg) => sum + Number(pkg.price || 0), 0);

    return [
      {
        title: 'Paket Aktif',
        value: ownedPackages.length,
        helper: 'Paket siap dikerjakan',
        icon: Package,
      },
      {
        title: 'Menunggu Pembayaran',
        value: pendingPackages.length,
        helper: 'Segera selesaikan pembayaran',
        icon: CircleDollarSign,
      },
      {
        title: 'Total Soal',
        value: totalQuestions,
        helper: 'Akumulasi dari paket aktif',
        icon: FileText,
      },
      {
        title: 'Nilai Investasi',
        value: `Rp ${estimatedValue.toLocaleString('id-ID')}`,
        helper: 'Total harga paket aktif',
        icon: Boxes,
      },
    ];
  }, [ownedPackages, pendingPackages]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading dashboard...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl bg-[var(--header-color,#103c21)] p-5 text-white sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Dashboard Tryout</h2>
        <p className="mt-1 text-sm text-emerald-100">Kelola paket tryout, pantau progres belajar, dan mulai sesi latihan kapan saja.</p>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Paket Aktif</h3>
          <p className="text-xs text-slate-500 sm:text-sm">{ownedPackages.length} paket</p>
        </div>

        {ownedPackages.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
            Belum ada paket aktif. Silakan pilih paket di halaman Home.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownedPackages.map((pkg) => (
              <TryoutPackageCard key={pkg.id} item={pkg} status="owned" onStart={() => navigate(`/quiz/${pkg.id}`)} />
            ))}
          </div>
        )}
      </section>

      {pendingPackages.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Menunggu Pembayaran</h3>
            <p className="text-xs text-amber-600 sm:text-sm">{pendingPackages.length} paket</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pendingPackages.map((pkg) => (
              <TryoutPackageCard key={pkg.id} item={pkg} status="pending" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
