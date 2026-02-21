import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { categoryService, packageService, purchaseService } from '../services/api';
import '../styles/dashboard.css';

const CategoryPackages = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();

  const [category, setCategory] = useState(null);
  const [packages, setPackages] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState([]);
  const [leaderboardDetail, setLeaderboardDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [categoryId]);

  const fetchData = async () => {
    try {
      const [categoryRes, purchasesRes] = await Promise.all([
        categoryService.getPackagesByCategory(categoryId),
        purchaseService.getAll(),
      ]);

      setCategory(categoryRes.data?.category || null);
      setPackages(categoryRes.data?.packages || []);
      setPurchases(purchasesRes.data || []);
    } catch (err) {
      setError('Gagal memuat daftar paket kategori');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (pkg) => {
    if (cart.some((item) => item.id === pkg.id)) return;
    setCart((prev) => [...prev, pkg]);
  };

  const handleRemoveFromCart = (pkgId) => {
    setCart((prev) => prev.filter((item) => item.id !== pkgId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Silakan pilih paket terlebih dahulu');
      return;
    }

    try {
      const packageIds = cart.map((item) => item.id);
      const subtotal = cart.reduce((sum, item) => sum + (item.price || 0), 0);
      const discount = cart.length > 2 ? subtotal * 0.1 : 0;
      const finalPrice = subtotal - discount;

      await purchaseService.create(packageIds, finalPrice);
      alert(`Pembelian berhasil. Total: Rp ${finalPrice.toLocaleString('id-ID')}`);
      setCart([]);
      fetchData();
    } catch (err) {
      alert('Pembelian gagal: ' + (err.response?.data?.error || 'Unknown error'));
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

  if (loading) return <div className="container">Loading...</div>;

  const ownedPackageIds = purchases.map((purchase) => purchase.package_id);

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>{category?.name || 'Kategori'}</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Kembali ke Kategori
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="dashboard-layout">
        <div className="main-content">
          <div className="card">
            <div className="card-title">Daftar Paket</div>
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
                  <p className="package-desc">{pkg.description}</p>

                  <div className="package-info">
                    <span>{pkg.question_count || 0} soal</span>
                    <span className="package-price">Rp {(pkg.price || 0).toLocaleString('id-ID')}</span>
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

                  {ownedPackageIds.includes(pkg.id) ? (
                    <button
                      className="btn btn-success participant-start-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/quiz/${pkg.id}`);
                      }}
                    >
                      Mulai
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary participant-cart-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToCart(pkg);
                      }}
                    >
                      Tambah ke Keranjang
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
                  Checkout
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
    </div>
  );
};

export default CategoryPackages;
