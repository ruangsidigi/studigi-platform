import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock3, FileText, ShoppingCart } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { categoryService, packageService, purchaseService } from '../services/api';
import CartWidget, { CartItem } from '../components/CartWidget.tsx';

const CATEGORY_TABS = ['CPNS', 'PPPK', 'BUMN', 'TOEFL', 'Lainnya'] as const;

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

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext as any);
  const [packages, setPackages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_TABS)[number]>('CPNS');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [ownedPackageIds, setOwnedPackageIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadPackages = async () => {
      try {
        setLoading(true);
        const [packagesResponse, categoriesResponse, purchasesResponse] = await Promise.all([
          packageService.getAll(),
          categoryService.getAll().catch(() => ({ data: [] })),
          user ? purchaseService.getAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);

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
            .map((purchase) => Number(purchase?.package_id))
            .filter((id) => Number.isInteger(id) && id > 0)
        );
        setOwnedPackageIds(paidPackageIds);
        setError('');
      } catch (loadErr) {
        setError('Gagal memuat katalog tryout.');
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, [user]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((category) => {
      const id = String(category?.id || '').trim();
      const name = String(category?.name || '').trim();
      if (id && name) map[id] = name;
    });
    return map;
  }, [categories]);

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

  const filteredPackages = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const searchTerm = String(params.get('q') || '').trim().toLowerCase();

    const byCategory =
      activeCategory === 'Lainnya'
        ? packages.filter((pkg) => !['CPNS', 'PPPK', 'BUMN', 'TOEFL'].includes(getCategoryName(pkg, categoryMap)))
        : packages.filter((pkg) => getCategoryName(pkg, categoryMap) === activeCategory);

    if (!searchTerm) return byCategory;

    const searchablePackages = packages;

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
  }, [packages, activeCategory, categoryMap, location.search]);

  const handleAddToCart = (pkg: any) => {
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 md:pb-4 lg:pb-2">
      <section className="rounded-2xl bg-[var(--header-color,#103c21)] p-5 text-white sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Tryout Marketplace</h2>
        <p className="mt-1 text-sm text-emerald-100">Kategori: CPNS, PPPK, BUMN, TOEFL, dan lainnya.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((category) => (
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
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
        <div className="space-y-4">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading katalog...</div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && filteredPackages.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Belum ada paket pada kategori ini.
            </div>
          )}

          {!loading &&
            !error &&
            filteredPackages.length > 0 &&
            filteredPackages.map((pkg) => {
              const inCart = cartItems.some((item) => item.id === Number(pkg.id));
              const categoryLabel = getCategoryName(pkg, categoryMap) || 'LAINNYA';
              const isBundlePackage =
                String(pkg?.type || '').toLowerCase() === 'bundling' ||
                String(pkg?.type || '').toLowerCase() === 'bundle' ||
                (Array.isArray(pkg?.included_package_ids) && pkg.included_package_ids.length > 0);
              return (
                <article key={pkg.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{categoryLabel}</span>
                    <span className="text-sm font-semibold text-[var(--header-color,#103c21)]">
                      Rp {Number(pkg.price || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900">{pkg.name}</h3>
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
                      disabled={inCart}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      <ShoppingCart size={15} />
                      {inCart ? 'Sudah di Cart' : 'Add to Cart'}
                    </button>

                    {isBundlePackage && (
                      <button
                        type="button"
                        onClick={() => navigate(`/bundles/${pkg.id}`)}
                        className="w-full rounded-xl border border-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-[var(--header-color,#103c21)] hover:bg-emerald-50 sm:w-auto"
                      >
                        Detail
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
            })}
        </div>

        <CartWidget items={cartItems} onRemove={handleRemoveCart} onCheckout={handleCheckout} />
      </section>
    </div>
  );
}
