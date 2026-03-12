import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { categoryService, packageService, paymentService, purchaseService } from '../services/api';
import '../styles/dashboard.css';
import { formatRupiah, getOriginalPrice } from '../utils/pricing';

const TERMS_TEXT_PATH = '/terms-and-conditions.txt';
const CART_STORAGE_KEY = 'studigi:cart';

const CategoryPackages = () => {
  const termsVersion = 'T&C-studigi-2026-03-01';

  const { categoryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const isHomeMode = !categoryId;

  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  });
  const [leaderboardDetail, setLeaderboardDetail] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsLoadError, setTermsLoadError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (isHomeMode) {
        const [allPackagesRes, allCategoriesRes, groupedCategoriesRes] = await Promise.allSettled([
          packageService.getAll(),
          categoryService.getAll(),
          categoryService.getWithPackages(),
        ]);

        const packageRows = allPackagesRes.status === 'fulfilled' && Array.isArray(allPackagesRes.value?.data)
          ? allPackagesRes.value.data
          : [];

        const explicitCategories = allCategoriesRes.status === 'fulfilled' && Array.isArray(allCategoriesRes.value?.data)
          ? allCategoriesRes.value.data
          : [];

        const categoryNameMap = new Map(
          explicitCategories.map((item) => [String(item.id), item.name])
        );

        const normalizedPackages = packageRows.map((pkg) => ({
          ...pkg,
          category_name: categoryNameMap.get(String(pkg.category_id)) || pkg.category_name || 'Lainnya',
        }));

        setPackages(normalizedPackages);
        setCategory(null);

        if (explicitCategories.length > 0) {
          const categoryUsage = new Map();
          for (const pkg of normalizedPackages) {
            const key = String(pkg.category_id || '');
            if (!key) continue;
            categoryUsage.set(key, (categoryUsage.get(key) || 0) + 1);
          }

          const builtCategories = explicitCategories.map((item) => ({
            ...item,
            package_count: categoryUsage.get(String(item.id)) || 0,
          }));

          setCategories(builtCategories);
        } else if (groupedCategoriesRes.status === 'fulfilled' && Array.isArray(groupedCategoriesRes.value?.data)) {
          setCategories(groupedCategoriesRes.value.data || []);
        } else {
          setCategories([]);
        }
      } else {
        const categoryRes = await categoryService.getPackagesByCategory(categoryId);
        setCategory(categoryRes.data?.category || null);
        setPackages(categoryRes.data?.packages || []);
      }
    } catch (err) {
      setError('Gagal memuat daftar paket kategori');
      setPackages([]);
      setCategories([]);
      setCategory(null);
    }

    if (!user) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    try {
      const purchasesRes = await purchaseService.getAll();
      setPurchases(purchasesRes.data || []);
    } catch (err) {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, isHomeMode, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!showTermsModal || termsText) return;

    const loadTermsText = async () => {
      setTermsLoading(true);
      setTermsLoadError('');

      try {
        const response = await fetch(TERMS_TEXT_PATH, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Gagal mengambil dokumen teks T&C');
        }
        const text = await response.text();
        setTermsText(String(text || '').replace(/\r/g, '').trim());
      } catch (err) {
        setTermsLoadError('Isi dokumen Syarat & Ketentuan belum berhasil dimuat. Silakan tutup modal lalu coba lagi.');
      } finally {
        setTermsLoading(false);
      }
    };

    loadTermsText();
  }, [showTermsModal, termsText]);

  const handleAddToCart = (pkg) => {
    if (cart.some((item) => item.id === pkg.id)) return;
    setCart((prev) => [...prev, pkg]);
  };

  const handleRemoveFromCart = (pkgId) => {
    setCart((prev) => prev.filter((item) => item.id !== pkgId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Silakan pilih paket terlebih dahulu');
      return;
    }

    if (!user) {
      navigate('/login', {
        state: {
          redirectTo: location.pathname + location.search,
          reason: 'checkout',
        },
      });
      return;
    }

    setTermsAccepted(false);
    setShowTermsModal(true);
  };

  const proceedCheckout = async () => {
    if (!termsAccepted) return;

    setIsCheckingOut(true);
    try {
      const packageIds = cart.map((item) => item.id);
      const checkoutTotal = cart.length > 2
        ? cart.reduce((sum, item) => sum + (item.price || 0), 0) * 0.9
        : cart.reduce((sum, item) => sum + (item.price || 0), 0);
      const checkoutRes = await paymentService.checkout(packageIds, 'midtrans', {
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion,
        totalPrice: checkoutTotal,
      });
      const rawData = checkoutRes.data || {};
      const payment = rawData.payment || rawData;
      const paymentUrl = payment?.payment_url || payment?.redirect_url || rawData?.payment_url || rawData?.redirect_url;
      const paymentId = payment?.id || rawData?.id || null;
      const hasLegacyPurchaseSuccess =
        Array.isArray(rawData?.purchases) &&
        rawData.purchases.length > 0;

      if (!paymentId && !hasLegacyPurchaseSuccess) {
        throw new Error('Payment transaction tidak valid');
      }

      if (paymentUrl) {
        alert(
          `Checkout berhasil dibuat (Ref: ${payment.reference || '-' }).\n` +
            `Total: Rp ${Number(payment.total_amount || checkoutTotal || 0).toLocaleString('id-ID')}\n\n` +
            'Anda akan diarahkan ke halaman pembayaran Midtrans.'
        );
      } else {
        alert('Pembelian berhasil diproses. Paket Anda telah ditambahkan ke akun.');
      }

      setShowTermsModal(false);
      setCart([]);
      await fetchData();
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    } catch (err) {
      const apiError = err.response?.data?.error || err.message || 'Unknown error';
      const apiStatus = err.response?.status;
      const rawResponse = err.response?.data;
      const responseText = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse || {});
      alert(`Pembelian gagal: ${apiError}${apiStatus ? ` (HTTP ${apiStatus})` : ''}\nDetail: ${responseText}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const openBundleDetail = (pkgId) => {
    navigate(`/bundles/${pkgId}`);
  };

  const openLeaderboard = async (pkgId) => {
    try {
      const res = await packageService.getLeaderboard(pkgId);
      setLeaderboardDetail(res.data);
    } catch (err) {
      alert('Gagal memuat leaderboard paket');
    }
  };

  const categoryMap = useMemo(
    () =>
      new Map(
        categories.map((item) => [
          String(item.id),
          {
            id: item.id,
            name: item.name,
            packageCount: item.package_count || (Array.isArray(item.packages) ? item.packages.length : 0),
          },
        ])
      ),
    [categories]
  );

  if (loading) return <div className="container">Loading...</div>;

  const completedStatuses = ['completed', 'paid', 'success'];
  const pendingStatuses = ['pending'];

  const ownedPackageIds = purchases
    .filter((purchase) => completedStatuses.includes(String(purchase.payment_status || '').toLowerCase()))
    .map((purchase) => purchase.package_id);

  const pendingPackageIds = purchases
    .filter((purchase) => pendingStatuses.includes(String(purchase.payment_status || '').toLowerCase()))
    .map((purchase) => purchase.package_id);

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>{isHomeMode ? 'Home - Katalog Paket' : (category?.name || 'Kategori')}</h1>
        {isHomeMode ? (
          <p className="text-muted">Lihat kategori dan paket soal, tambah ke keranjang, lalu checkout.</p>
        ) : (
          <button className="btn btn-secondary" onClick={() => navigate('/home')}>
            ← Kembali ke Home
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {isHomeMode && categories.length > 0 && (
        <div className="card">
          <div className="card-title">Kategori Tersedia</div>
          <div className="categories-grid">
            {categories.map((item) => (
              <button
                key={item.id}
                className="category-card"
                onClick={() => navigate(`/categories/${item.id}/packages`)}
              >
                <h3>{item.name}</h3>
                <p className="package-desc">{item.description || 'Kategori tes'}</p>
                <div className="category-meta">
                  <span>{item.package_count || (item.packages || []).length} paket</span>
                  <span>Lihat Paket</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-layout">
        <div className="main-content">
          <div className="card">
            <div className="card-title">{isHomeMode ? 'Semua Paket' : 'Daftar Paket'}</div>
            <div className="packages-grid">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`package-card ${pkg.is_bundle ? 'bundle-premium-card' : ''}`}
                  role={pkg.is_bundle ? 'button' : undefined}
                  tabIndex={pkg.is_bundle ? 0 : undefined}
                  onClick={() => pkg.is_bundle && openBundleDetail(pkg.id)}
                  onKeyDown={(event) => {
                    if (!pkg.is_bundle) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openBundleDetail(pkg.id);
                    }
                  }}
                >
                  <div className="bundle-header-row">
                    <h3>{pkg.name}</h3>
                    {pkg.is_bundle && <span className="bundle-badge">Bundling</span>}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    ID Paket: #{pkg.id}
                  </div>

                  <p className="package-type">
                    {pkg.type === 'tryout' ? '📝 Tryout' : pkg.type === 'latihan' ? '📚 Latihan' : '📦 Bundle'}
                  </p>
                  {isHomeMode && (
                    <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Kategori: {pkg.category_name || categoryMap.get(String(pkg.category_id))?.name || '-'}
                    </p>
                  )}
                  <p className="package-desc">{pkg.description}</p>

                  <div className="package-info">
                    <span>{pkg.question_count || 0} soal</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {getOriginalPrice(pkg) ? (
                        <span className="text-muted" style={{ fontSize: 12, textDecoration: 'line-through' }}>
                          {formatRupiah(getOriginalPrice(pkg))}
                        </span>
                      ) : null}
                      <span className="package-price">{formatRupiah(pkg.price)}</span>
                    </div>
                  </div>

                  {pkg.is_bundle && (
                    <button
                      className="btn btn-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        openBundleDetail(pkg.id);
                      }}
                    >
                      Lihat Detail Bundling
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      openLeaderboard(pkg.id);
                    }}
                  >
                    Lihat Ranking
                  </button>

                  {user && ownedPackageIds.includes(pkg.id) ? (
                    <button
                      className="btn btn-success participant-start-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/quiz/${pkg.id}`);
                      }}
                    >
                      Mulai
                    </button>
                  ) : user && pendingPackageIds.includes(pkg.id) ? (
                    <button className="btn btn-secondary participant-cart-btn" disabled>
                      Menunggu Pembayaran
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary participant-cart-btn"
                      disabled={cart.some((item) => item.id === pkg.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToCart(pkg);
                      }}
                    >
                      {cart.some((item) => item.id === pkg.id) ? 'Sudah di Keranjang' : 'Tambah ke Keranjang'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className="card">
            <div className="card-title">Keranjang Belanja</div>
            {cart.length === 0 ? (
              <p className="text-muted">Keranjang kosong</p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <div className="cart-price">Rp {(item.price || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFromCart(item.id)}>
                      Hapus
                    </button>
                  </div>
                ))}

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>Rp {cart.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString('id-ID')}</span>
                  </div>
                  {cart.length > 2 && (
                    <div className="summary-row discount">
                      <span>Diskon 10%</span>
                      <span>
                        -Rp {(cart.reduce((sum, item) => sum + (item.price || 0), 0) * 0.1).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  <div className="summary-row total">
                    <span>Total</span>
                    <span>
                      Rp {(
                        cart.length > 2
                          ? cart.reduce((sum, item) => sum + (item.price || 0), 0) * 0.9
                          : cart.reduce((sum, item) => sum + (item.price || 0), 0)
                      ).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <button className="btn btn-success" onClick={handleCheckout}>
                  {user ? 'Checkout' : 'Login untuk Checkout'}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {leaderboardDetail && (
        <div className="bundle-modal-overlay" onClick={() => setLeaderboardDetail(null)}>
          <div className="bundle-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="bundle-modal-header">
              <h3>Ranking - {leaderboardDetail.package_name || 'Paket'}</h3>
              <button className="btn btn-danger btn-sm" onClick={() => setLeaderboardDetail(null)}>
                Tutup
              </button>
            </div>

            <p className="text-muted">Total peserta: {leaderboardDetail.participant_count || 0}</p>

            {!leaderboardDetail.ranking || leaderboardDetail.ranking.length === 0 ? (
              <p>Belum ada peserta yang menyelesaikan paket ini.</p>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Nama</th>
                      <th>Skor</th>
                      <th>Durasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardDetail.ranking.map((row) => {
                      const durationMinutes = row.duration_ms ? Math.round(row.duration_ms / 60000) : null;
                      return (
                        <tr key={`${row.user_id}-${row.rank}`} style={row.is_me ? { backgroundColor: '#e6ffed' } : {}}>
                          <td><strong>#{row.rank}</strong></td>
                          <td>{row.user_name}{row.is_me ? ' (Anda)' : ''}</td>
                          <td><strong>{Math.round(row.total_score || 0)}</strong></td>
                          <td>{durationMinutes !== null ? `${durationMinutes} menit` : '-'}</td>
                          <td>{row.is_passed ? 'LULUS' : 'TIDAK'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showTermsModal && (
        <div className="bundle-modal-overlay" onClick={() => !isCheckingOut && setShowTermsModal(false)}>
          <div
            className="bundle-modal-content"
            style={{ maxWidth: 900, width: '95%', maxHeight: '90vh', overflow: 'hidden' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bundle-modal-header">
              <h3>Syarat & Ketentuan Pembayaran</h3>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowTermsModal(false)}
                disabled={isCheckingOut}
              >
                Tutup
              </button>
            </div>

            <p className="text-muted" style={{ marginBottom: 12 }}>
              Mohon baca seluruh isi dokumen berikut sampai selesai. Checkout hanya dapat dilanjutkan setelah Anda menyetujui Syarat & Ketentuan.
            </p>

            <div
              style={{
                width: '100%',
                height: '55vh',
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 12,
                overflowY: 'auto',
                background: '#fff',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {termsLoading && 'Sedang memuat teks Syarat & Ketentuan...'}
              {!termsLoading && termsLoadError && <span className="text-danger">{termsLoadError}</span>}
              {!termsLoading && !termsLoadError && (termsText || 'Dokumen tidak memiliki teks yang dapat ditampilkan. Silakan hubungi admin.')} 
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="termsAccepted"
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                disabled={isCheckingOut}
              />
              <label htmlFor="termsAccepted">Saya telah membaca seluruh Syarat & Ketentuan di atas dan menyetujuinya.</label>
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowTermsModal(false)} disabled={isCheckingOut}>
                Batal
              </button>
              <button
                className="btn btn-success"
                onClick={proceedCheckout}
                disabled={!termsAccepted || isCheckingOut}
              >
                {isCheckingOut ? 'Memproses checkout...' : 'Saya Setuju, Lanjutkan Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryPackages;
