import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bundleService, materialService, purchaseService } from '../services/api';
import '../styles/dashboard.css';

const BundleDetail = () => {
  const { bundleId } = useParams();
  const navigate = useNavigate();

  const [bundleDetail, setBundleDetail] = useState(null);
  const [bundleMaterials, setBundleMaterials] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [detailRes, purchasesRes] = await Promise.all([
          bundleService.getById(bundleId),
          purchaseService.getAll(),
        ]);

        setBundleDetail(detailRes.data);
        const fetchedPurchases = purchasesRes.data || [];
        setPurchases(fetchedPurchases);

        const ownedIds = new Set(fetchedPurchases.map((purchase) => String(purchase.package_id)));
        const bundleOwned = ownedIds.has(String(bundleId));

        if (bundleOwned || isAdmin) {
          try {
            const materialsRes = await materialService.listByPackage(bundleId);
            setBundleMaterials(materialsRes.data || []);
          } catch (materialErr) {
            setBundleMaterials([]);
          }
        } else {
          setBundleMaterials([]);
        }
      } catch (err) {
        setError('Gagal memuat detail bundling');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [bundleId, isAdmin]);

  const ownedIds = useMemo(() => new Set((purchases || []).map((p) => String(p.package_id))), [purchases]);
  const bundleOwned = ownedIds.has(String(bundleId));
  const canViewBundleMaterials = bundleOwned || isAdmin;

  const openMaterial = async (materialId) => {
    try {
      const response = await materialService.getAccessUrl(materialId);
      const url = response.data?.access_url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuka materi bundle');
    }
  };

  if (loading) return <div className="container">Loading detail bundling...</div>;

  if (error) return <div className="container"><div className="alert alert-danger">{error}</div></div>;

  const bundle = bundleDetail?.bundle;
  const packages = bundleDetail?.packages || [];

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>Detail Bundling</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Kembali
        </button>
      </div>

      <div className="bundle-hero">
        <div>
          <div className="bundle-hero-badge">Premium Bundle</div>
          <h2>{bundle?.name || 'Bundling'}</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>ID Bundle: #{bundle?.id || bundleId}</p>
          <p className="text-muted">{bundle?.description || 'Paket bundling pilihan terbaik.'}</p>
        </div>
        <div className="bundle-hero-price">
          <div className="bundle-hero-label">Harga</div>
          <div className="bundle-hero-value">Rp {(bundle?.price || 0).toLocaleString('id-ID')}</div>
          <div className="bundle-hero-meta">{packages.length} paket di dalamnya</div>
        </div>
      </div>

      <div className="card mt-20">
        <div className="card-title">Paket di dalam bundling</div>
        {packages.length === 0 ? (
          <p className="text-muted">Belum ada paket di bundling ini.</p>
        ) : (
          <div className="bundle-package-grid">
            {packages.map((pkg) => {
              const owned = bundleOwned || ownedIds.has(String(pkg.id));
              return (
                <div key={pkg.id} className="bundle-package-card">
                  <div className="bundle-package-header">
                    <h3>{pkg.name}</h3>
                    <span className="bundle-package-type">
                      {pkg.type === 'tryout' ? '📝 Tryout' : pkg.type === 'latihan' ? '📚 Latihan' : '📦 Bundle'}
                    </span>
                  </div>
                  <p className="package-desc">{pkg.description || 'Paket latihan dan tryout terbaik.'}</p>
                  <div className="package-info">
                    <span>{pkg.question_count || 0} soal</span>
                    <span className="package-price">Rp {(pkg.price || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <button
                    className={`btn ${owned ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => owned && navigate(`/quiz/${pkg.id}`)}
                    disabled={!owned}
                  >
                    {owned ? 'Mulai' : 'Belum dibeli'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card mt-20">
        <div className="card-title">Materi Bundle</div>
        {!canViewBundleMaterials ? (
          <p className="text-muted">Beli bundling ini untuk membuka materi PDF.</p>
        ) : bundleMaterials.length === 0 ? (
          <p className="text-muted">Belum ada materi yang di-attach ke bundling ini.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Deskripsi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bundleMaterials.map((material) => (
                <tr key={material.id}>
                  <td>{material.title}</td>
                  <td>{material.description || '-'}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => openMaterial(material.id)}>
                      Buka PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BundleDetail;
