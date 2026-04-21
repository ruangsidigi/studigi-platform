import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TryoutCard from '../components/TryoutCard.tsx';
import { AuthContext } from '../context/AuthContext';
import { materialService, packageService, purchaseService } from '../services/api';

const isBundlePackage = (pkg: any) => {
  const packageType = String(pkg?.type || '').toLowerCase();
  return (
    packageType === 'bundle' ||
    packageType === 'bundling' ||
    (Array.isArray(pkg?.included_package_ids) && pkg.included_package_ids.length > 0)
  );
};


export default function Library() {
  const { user } = useContext(AuthContext as any);
  const navigate = useNavigate();
  const [ownedPackages, setOwnedPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const openEbook = async (pkg: any) => {
    try {
      const response = await materialService.listByPackagePreview(pkg.id);
      const materials = Array.isArray(response?.data) ? response.data : [];
      const firstMaterial = materials[0];

      if (firstMaterial?.id) {
        navigate(`/materials/${firstMaterial.id}/view`, { state: { backTo: '/library' } });
        return;
      }

      const directUrl = String(pkg?.pdf_file_path || '').trim();
      if (directUrl) {
        window.open(directUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      window.alert('Materi PDF belum tersedia untuk paket ini.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Gagal membuka ebook';
      window.alert(String(msg));
    }
  };

  const handleCardAction = async (pkg: any) => {
    const packageType = String(pkg?.type || '').toLowerCase();
    const categoryName = String(pkg?.category_name || pkg?.category || '').toUpperCase();
    const isBundle =
      packageType === 'bundle' ||
      packageType === 'bundling' ||
      (Array.isArray(pkg?.included_package_ids) && pkg.included_package_ids.length > 0);
    const isEbook =
      packageType === 'ebook' ||
      String(pkg?.content_type || '').toLowerCase() === 'material' ||
      categoryName === 'EBOOK';

    if (isEbook) {
      await openEbook(pkg);
      return;
    }

    if (isBundle) {
      navigate(`/bundles/${pkg.id}`);
      return;
    }

    navigate(`/quiz/${pkg.id}`);
  };

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

        // Build a map of packageId -> latest purchase attempts info
        const attemptsMap = new Map<string, { maxAttempts: number; usedAttempts: number }>();
        purchases.forEach((purchase) => {
          const pkgIdKey = String(purchase.package_id);
          const maxAttempts = purchase.max_attempts ?? 10;
          const usedAttempts = purchase.used_attempts ?? 0;
          // Keep the last (highest id) purchase — data is ordered DESC
          if (!attemptsMap.has(pkgIdKey)) {
            attemptsMap.set(pkgIdKey, { maxAttempts, usedAttempts });
          }
        });

        const completedStatuses = ['completed', 'paid', 'success', 'settlement'];
        const result: any[] = [];

        purchases.forEach((purchase) => {
          const normalizedStatus = String(purchase.payment_status || '').toLowerCase();
          if (!completedStatuses.includes(normalizedStatus)) return;
          const rawPurchasePackageId = purchase.package_id ?? purchase.package_ref_id ?? purchase.packages?.id;
          const pkgIdKey = String(rawPurchasePackageId || '').trim();
          if (!pkgIdKey) return;

          // Prefer full package data from packageMap; then purchase.packages; then top-level purchase fields.
          const pkg =
            packageMap.get(pkgIdKey) ||
            (purchase.packages && purchase.packages.id ? purchase.packages : null) ||
            {
              id: pkgIdKey,
              name: purchase.package_name || `Paket #${pkgIdKey}`,
              type: purchase.package_type || 'tryout',
              description: 'Paket milikmu, siap dikerjakan.',
              question_count: 0,
              duration: 100,
              category_name: purchase.package_type || 'Tryout',
            };
          if (!pkg) return;
          const attemptsInfo = attemptsMap.get(pkgIdKey);
          result.push({
            ...pkg,
            _maxAttempts: attemptsInfo?.maxAttempts ?? 10,
            _usedAttempts: attemptsInfo?.usedAttempts ?? 0,
          });
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

  const visibleOwnedPackages = useMemo(() => {
    if (!Array.isArray(ownedPackages) || ownedPackages.length === 0) return [];

    return ownedPackages.filter((pkg) => {
      const id = String(pkg?.id ?? '').trim();
      return id.length > 0;
    });
  }, [ownedPackages]);

  const cards = useMemo(
    () =>
      visibleOwnedPackages.map((pkg) => {
        const packageType = String(pkg?.type || '').toLowerCase();
        const categoryName = String(pkg?.category_name || pkg?.category || '').toUpperCase();
        const isBundle = isBundlePackage(pkg);
        const isEbook =
          packageType === 'ebook' ||
          String(pkg?.content_type || '').toLowerCase() === 'material' ||
          categoryName === 'EBOOK';

        const maxAttempts: number = pkg._maxAttempts ?? 10;
        const usedAttempts: number = pkg._usedAttempts ?? 0;
        const attemptsLeft: number = maxAttempts - usedAttempts;

        return {
          id: pkg.id,
          raw: pkg,
          title: pkg.name,
          description: pkg.description || 'Paket milikmu, siap dikerjakan.',
          questions: Number(pkg.question_count || 0),
          duration: Number(pkg.duration || 100),
          category: (pkg.category_name || pkg.type || 'Tryout').toUpperCase(),
          attemptsLeft: isBundle || isEbook ? null : attemptsLeft,
          maxAttempts: isBundle || isEbook ? null : maxAttempts,
          actionLabel: (() => {
            if (isBundle) return 'Detail';
            if (isEbook) return 'Buka';
            return 'Mulai';
          })(),
        };
      }),
    [visibleOwnedPackages]
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
            <div key={item.id} className="flex flex-col gap-1">
              <TryoutCard {...item} onAction={() => handleCardAction(item.raw)} />
              {item.attemptsLeft !== null && (
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-medium ${
                    item.attemptsLeft === 0
                      ? 'bg-red-50 text-red-700'
                      : item.attemptsLeft <= 3
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <span>
                    {item.attemptsLeft === 0
                      ? 'Batas pengerjaan habis — silakan beli ulang'
                      : `Sisa ${item.attemptsLeft} dari ${item.maxAttempts} kali pengerjaan`}
                  </span>
                  {item.attemptsLeft <= 3 && item.attemptsLeft > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                      Hampir habis!
                    </span>
                  )}
                  {item.attemptsLeft === 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/packages/${item.id}`)}
                      className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-red-800 hover:bg-red-200"
                    >
                      Beli ulang
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
