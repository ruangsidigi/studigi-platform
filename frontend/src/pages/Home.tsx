import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock3, FileText, ShoppingCart } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { categoryService, materialService, packageService, purchaseService } from '../services/api';
import CartWidget, { CartItem } from '../components/CartWidget.tsx';
import { formatRupiah, getOriginalPrice } from '../utils/pricing';

const CATEGORY_TABS = ['CPNS', 'PPPK', 'BUMN', 'TOEFL', 'EBOOK', 'Lainnya'] as const;

const normalizeCategoryName = (value: any) => String(value || '').trim().toUpperCase();

const getCategoryName = (pkg: any, categoryMap: Record<string, string>) => {
  const directCategoryName = normalizeCategoryName(pkg?.category_name || pkg?.category || '');
  if (directCategoryName) return directCategoryName;

  const categoryId = String(pkg?.category_id || '').trim();
  if (categoryId && categoryMap[categoryId]) {
    return normalizeCategoryName(categoryMap[categoryId]);
  }

  return '';
};

const normalizePackageToCartItem = (pkg: any, categoryMap: Record<string, string>): CartItem => ({
  id: Number(pkg.id),
  name: String(pkg.name || 'Paket Tryout'),
  category: getCategoryName(pkg, categoryMap) || 'LAINNYA',
  price: Number(pkg.price || 0),
});

const isEbookPackage = (pkg: any, categoryMap: Record<string, string>) => {
  const packageType = String(pkg?.type || '').trim().toLowerCase();
  const contentType = String(pkg?.content_type || '').trim().toLowerCase();
  const categoryName = getCategoryName(pkg, categoryMap);
  return packageType === 'ebook' || contentType === 'material' || categoryName === 'EBOOK';
};

const isBundlePackage = (pkg: any) => {
  const packageType = String(pkg?.type || '').trim().toLowerCase();
  return packageType === 'bundling' || packageType === 'bundle' || (Array.isArray(pkg?.included_package_ids) && pkg.included_package_ids.length > 0);
};

const getPurchasePackageId = (purchase: any) => {
  const rawId = purchase?.package_id ?? purchase?.package_ref_id ?? purchase?.packages?.id;
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext as any);
  const [packages, setPackages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_TABS)[number]>('CPNS');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [ownedPackageIds, setOwnedPackageIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const loadPackages = async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2500;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (cancelled) return;
          setLoading(true);
          setError('');
          const [packagesResponse, categoriesResponse, purchasesResponse] = await Promise.all([
            packageService.getAll(),
            categoryService.getAll().catch(() => ({ data: [] })),
            user ? purchaseService.getAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          ]);

          if (cancelled) return;
          const allPackages = Array.isArray(packagesResponse.data) ? packagesResponse.data : [];
          const allCategories = Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [];
          const allPurchases = Array.isArray(purchasesResponse.data) ? purchasesResponse.data : [];
          const validPackages = allPackages.filter((item) => Number(item?.id) > 0);
          setPackages(validPackages);
          setCategories(allCategories);

          const paidStatuses = new Set(['paid', 'completed', 'success', 'settlement']);
          const paidPackageIds = new Set(
            allPurchases
              .filter((purchase) => paidStatuses.has(String(purchase?.payment_status || '').toLowerCase()))
              .map((purchase) => getPurchasePackageId(purchase))
              .filter((id): id is number => id !== null)
          );
          setOwnedPackageIds(paidPackageIds);
          setError('');
          setLoading(false);
          return; // success — stop retrying
        } catch (loadErr) {
          if (cancelled) return;
          if (attempt < MAX_RETRIES) {
            // Wait before retrying (handles cold-start DB timeouts)
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          } else {
            setError('Gagal memuat katalog tryout. Silakan refresh halaman.');
            setLoading(false);
          }
        }
      }
    };

    loadPackages();
    return () => { cancelled = true; };
  }, [user, retryCount]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((category) => {
      const id = String(category?.id || '').trim();
      const name = String(category?.name || '').trim();
      if (id && name) map[id] = name;
    });
    return map;
  }, [categories]);

  const activePackages = useMemo(() => {
    return packages.filter((pkg) => {
      const visibility = String(pkg?.visibility || 'visible').trim().toLowerCase();
      return visibility === 'visible' || visibility === 'active' || visibility === '';
    });
  }, [packages]);

  const visibleCategoryTabs = useMemo(() => {
    const baseCategories = ['CPNS', 'PPPK', 'BUMN', 'TOEFL', 'EBOOK'];

    return CATEGORY_TABS.filter((tab) => {
      if (tab === 'Lainnya') {
        return activePackages.some((pkg) => !baseCategories.includes(getCategoryName(pkg, categoryMap)));
      }

      return activePackages.some((pkg) => getCategoryName(pkg, categoryMap) === tab);
    });
  }, [activePackages, categoryMap]);

  useEffect(() => {
    if (!visibleCategoryTabs.length) return;
    if (!visibleCategoryTabs.includes(activeCategory)) {
      setActiveCategory(visibleCategoryTabs[0]);
    }
  }, [visibleCategoryTabs, activeCategory]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('studigi:cart') || '[]');
      setCartItems(Array.isArray(stored) ? stored : []);
    } catch (readErr) {
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('studigi:cart', JSON.stringify(cartItems));
    window.dispatchEvent(new CustomEvent('studigi:cart-updated', { detail: { count: cartItems.length } }));
  }, [cartItems]);

  useEffect(() => {
    if (!ownedPackageIds.size) return;
    setCartItems((prev) => prev.filter((item) => !ownedPackageIds.has(Number(item.id))));
  }, [ownedPackageIds]);

  const filteredPackages = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const searchTerm = String(params.get('q') || '').trim().toLowerCase();

    const byCategory =
      activeCategory === 'Lainnya'
        ? activePackages.filter((pkg) => !['CPNS', 'PPPK', 'BUMN', 'TOEFL', 'EBOOK'].includes(getCategoryName(pkg, categoryMap)))
        : activePackages.filter((pkg) => getCategoryName(pkg, categoryMap) === activeCategory);

    if (!searchTerm) return byCategory;

    const searchablePackages = activePackages;

    return searchablePackages.filter((pkg) => {
      const packageName = String(pkg?.name || '').toLowerCase();
      const categoryName = getCategoryName(pkg, categoryMap).toLowerCase();
      const packageType = String(pkg?.type || pkg?.package_type || pkg?.packageType || pkg?.bundle_type || '').toLowerCase();

      return (
        packageName.includes(searchTerm) ||
        categoryName.includes(searchTerm) ||
        packageType.includes(searchTerm)
      );
    });
  }, [activePackages, activeCategory, categoryMap, location.search]);

  const bundlePackages = useMemo(() => filteredPackages.filter((pkg) => isBundlePackage(pkg)), [filteredPackages]);
  const singlePackages = useMemo(() => filteredPackages.filter((pkg) => !isBundlePackage(pkg)), [filteredPackages]);

  const handleAddToCart = (pkg: any) => {
    if (ownedPackageIds.has(Number(pkg.id))) return;
    const mapped = normalizePackageToCartItem(pkg, categoryMap);
    setCartItems((prev) => {
      if (prev.some((item) => item.id === mapped.id)) return prev;
      return [...prev, mapped];
    });
  };

  const handleRemoveCart = (id: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    if (user) {
      navigate('/payment');
      return;
    }

    navigate('/login', {
      state: {
        redirectTo: '/payment',
        fromCart: true,
      },
    });
  };

  const handleReadEbook = async (pkg: any) => {
    if (!user) {
      navigate('/login', {
        state: {
          redirectTo: '/home',
        },
      });
      return;
    }

    try {
      const response = await materialService.listByPackagePreview(pkg.id);
      const materials = Array.isArray(response?.data) ? response.data : [];
      const firstMaterial = materials[0];
      if (firstMaterial?.id) {
        navigate(`/materials/${firstMaterial.id}/view`, { state: { backTo: '/home' } });
        return;
      }

      const directUrl = String(pkg?.pdf_file_path || '').trim();
      if (directUrl) {
        window.open(directUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      window.alert('Materi PDF belum tersedia untuk paket ini.');
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (status === 401) {
        navigate('/login', {
          state: {
            redirectTo: '/home',
          },
        });
        return;
      }

      const errMsg = error?.response?.data?.error || error?.message || 'Gagal membuka PDF';
      window.alert(String(errMsg));
    }
  };

  const renderPackageCard = (pkg: any) => {
    const inCart = cartItems.some((item) => item.id === Number(pkg.id));
    const isOwned = user && ownedPackageIds.has(Number(pkg.id));
    const categoryLabel = getCategoryName(pkg, categoryMap) || 'LAINNYA';
    const isEbook = isEbookPackage(pkg, categoryMap);
    const isBundle = isBundlePackage(pkg);

    return (
      <article key={pkg.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{categoryLabel}</span>
            {isBundle ? (
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">BUNDLING</span>
            ) : null}
            {isEbook ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">EBOOK</span>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            {getOriginalPrice(pkg) ? (
              <span className="text-xs text-slate-400 line-through">
                {formatRupiah(getOriginalPrice(pkg))}
              </span>
            ) : null}
            <span className="text-sm font-semibold text-[var(--header-color,#103c21)]">
              {formatRupiah(pkg.price)}
            </span>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-slate-900">{pkg.name}</h3>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">{pkg.description || 'Paket tryout terbaik untuk latihan.'}</p>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <FileText size={13} />
            <span>{Number(pkg.question_count || 0)} soal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock3 size={13} />
            <span>{Number(pkg.duration || 100)} menit</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => handleAddToCart(pkg)}
            disabled={inCart || Boolean(isOwned)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <ShoppingCart size={15} />
            {isOwned ? 'Sudah Dibeli' : inCart ? 'Sudah di Cart' : 'Add to Cart'}
          </button>

          {isBundle && (
            <button
              type="button"
              onClick={() => navigate(`/bundles/${pkg.id}`)}
              className="w-full rounded-xl border border-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-[var(--header-color,#103c21)] hover:bg-emerald-50 sm:w-auto"
            >
              Detail
            </button>
          )}

          {isEbook && (
            <button
              type="button"
              onClick={() => handleReadEbook(pkg)}
              className="w-full rounded-xl border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 sm:w-auto"
            >
              Baca PDF
            </button>
          )}

          {user && ownedPackageIds.has(Number(pkg.id)) && (
            <button
              type="button"
              onClick={() => navigate(`/quiz/${pkg.id}`)}
              className="w-full rounded-xl border border-[var(--secondary-color,#69655e)] px-4 py-2 text-sm font-semibold text-[var(--secondary-color,#69655e)] hover:bg-slate-50 sm:w-auto"
            >
              Start Tryout
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl bg-[var(--header-color,#103c21)] p-5 text-white sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Tryout Marketplace</h2>
        <p className="mt-1 text-sm text-emerald-100">Kategori: CPNS, PPPK, BUMN, TOEFL, Ebook, dan lainnya.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        {visibleCategoryTabs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleCategoryTabs.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  activeCategory === category
                    ? 'bg-[var(--header-color,#103c21)] text-white'
                    : 'bg-slate-100 text-[var(--secondary-color,#69655e)] hover:bg-slate-200',
                ].join(' ')}
              >
                {category}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Belum ada paket aktif yang tersedia.</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
        <div className="space-y-4">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading katalog...</div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 flex items-center justify-between gap-4">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!loading && !error && filteredPackages.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Belum ada paket pada kategori ini.
            </div>
          )}

          {!loading && !error && filteredPackages.length > 0 && (
            <div className="space-y-5">
              {bundlePackages.length > 0 && (
                <section className="space-y-3">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                    <h3 className="text-sm font-semibold text-indigo-900 sm:text-base">Paket Bundling</h3>
                    <p className="mt-0.5 text-xs text-indigo-700 sm:text-sm">Kumpulan paket pilihan dengan harga lebih hemat.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {bundlePackages.map((pkg) => renderPackageCard(pkg))}
                  </div>
                </section>
              )}

              {singlePackages.length > 0 && (
                <section className="space-y-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                    <h3 className="text-sm font-semibold text-emerald-900 sm:text-base">Paket Tryout</h3>
                    <p className="mt-0.5 text-xs text-emerald-700 sm:text-sm">Pilih paket per tryout sesuai kebutuhan latihanmu.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {singlePackages.map((pkg) => renderPackageCard(pkg))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <CartWidget items={cartItems} onRemove={handleRemoveCart} onCheckout={handleCheckout} />
      </section>
    </div>
  );
}
