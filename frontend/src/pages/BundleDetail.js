import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bundleService, materialService, purchaseService } from '../services/api';
import '../styles/dashboard.css';
import { formatRupiah, getOriginalPrice } from '../utils/pricing';

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
        const [detailRes, purchasesRes, materialsPreviewRes] = await Promise.all([
          bundleService.getById(bundleId),
          purchaseService.getAll(),
          materialService.listByPackagePreview(bundleId).catch(() => ({ data: [] })),
        ]);

        setBundleDetail(detailRes.data);
        setBundleMaterials(Array.isArray(materialsPreviewRes.data) ? materialsPreviewRes.data : []);
        const fetchedPurchases = purchasesRes.data || [];
        setPurchases(fetchedPurchases);
      } catch (err) {
        setError('Gagal memuat detail bundling');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [bundleId, isAdmin]);

  const ownedIds = useMemo(() => {
    const paidStatuses = new Set(['paid', 'completed', 'success', 'settlement']);
    return new Set(
      (purchases || [])
        .filter((purchase) => paidStatuses.has(String(purchase?.payment_status || '').toLowerCase()))
        .map((purchase) => String(purchase.package_id))
    );
  }, [purchases]);
  const bundleOwned = ownedIds.has(String(bundleId));
  const canViewBundleMaterials = bundleOwned || isAdmin;

  const attemptsMap = useMemo(() => {
    const paidStatuses = new Set(['paid', 'completed', 'success', 'settlement']);
    const map = {};

    for (const purchase of purchases || []) {
      if (!paidStatuses.has(String(purchase?.payment_status || '').toLowerCase())) continue;
      const packageKey = String(purchase?.package_id || '');
      if (!packageKey || map[packageKey]) continue;

      const maxAttempts = Number(purchase?.max_attempts ?? 10) || 10;
      const usedAttempts = Number(purchase?.used_attempts ?? 0) || 0;
      map[packageKey] = {
        maxAttempts,
        usedAttempts,
        attemptsLeft: Math.max(0, maxAttempts - usedAttempts),
      };
    }

    if (bundleOwned) {
      for (const pkg of bundleDetail?.packages || []) {
        const packageKey = String(pkg?.id || '');
        if (!packageKey || map[packageKey]) continue;
        map[packageKey] = {
          maxAttempts: 10,
          usedAttempts: 0,
          attemptsLeft: 10,
        };
      }
    }

    return map;
  }, [purchases, bundleOwned, bundleDetail]);

  const openMaterial = async (materialId) => {
    navigate(`/materials/${materialId}/view`, { state: { backTo: `/bundles/${bundleId}` } });
  };

  if (loading) return <div className="container">Loading detail bundling...</div>;

  if (error) return <div className="container"><div className="alert alert-danger">{error}</div></div>;

  const bundle = bundleDetail?.bundle;
  const packages = bundleDetail?.packages || [];
  const bundleOriginalPrice = getOriginalPrice(bundle);

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
          {bundleOriginalPrice ? (
            <div className="text-muted" style={{ fontSize: 14, textDecoration: 'line-through' }}>
              {formatRupiah(bundleOriginalPrice)}
            </div>
          ) : null}
          <div className="bundle-hero-value">{formatRupiah(bundle?.price || 0)}</div>
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
              const attemptInfo = attemptsMap[String(pkg.id)] || (owned
                ? { maxAttempts: 10, usedAttempts: 0, attemptsLeft: 10 }
                : null);
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {getOriginalPrice(pkg) ? (
                        <span className="text-muted" style={{ fontSize: 12, textDecoration: 'line-through' }}>
                          {formatRupiah(getOriginalPrice(pkg))}
                        </span>
                      ) : null}
                      <span className="package-price">{formatRupiah(pkg.price)}</span>
                    </div>
                  </div>
                  {owned ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {attemptInfo && (
                        <div
                          style={{
                            fontSize: 12,
                            padding: '6px 8px',
                            borderRadius: 6,
                            backgroundColor:
                              attemptInfo.attemptsLeft === 0
                                ? '#fee2e2'
                                : attemptInfo.attemptsLeft <= 3
                                ? '#fef3c7'
                                : '#dcfce7',
                            color:
                              attemptInfo.attemptsLeft === 0
                                ? '#991b1b'
                                : attemptInfo.attemptsLeft <= 3
                                ? '#92400e'
                                : '#166534',
                            fontWeight: 500,
                            textAlign: 'center',
                          }}
                        >
                          Sisa {attemptInfo.attemptsLeft} dari {attemptInfo.maxAttempts} kali
                        </div>
                      )}
                      <button
                        className="btn btn-success"
                        onClick={() => navigate(`/quiz/${pkg.id}`)}
                        disabled={attemptInfo?.attemptsLeft === 0}
                        style={{
                          opacity: attemptInfo?.attemptsLeft === 0 ? 0.6 : 1,
                          cursor: attemptInfo?.attemptsLeft === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Mulai
                      </button>
                    </div>
                  ) : (
                    <div
                      className="participant-lock"
                      title="Terkunci"
                      aria-label="Terkunci"
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      🔒
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card mt-20">
        <div className="card-title">Materi Bundle</div>
        {bundleMaterials.length === 0 ? (
          <p className="text-muted">Belum ada materi yang di-attach ke bundling ini.</p>
        ) : (
          <div className="bundle-package-grid">
            {bundleMaterials.map((material) => (
              <div key={material.id} className="bundle-package-card">
                <div className="bundle-package-header">
                  <h3>{material.title}</h3>
                  <span className="bundle-package-type">PDF</span>
                </div>
                <p className="package-desc">{material.description || 'Materi pembelajaran untuk bundle ini.'}</p>

                <div className="package-info">
                  <span>Materi PDF</span>
                  <span className="package-price">#{material.id}</span>
                </div>

                {canViewBundleMaterials ? (
                  <button className="btn btn-success participant-start-btn" onClick={() => openMaterial(material.id)}>
                    Buka PDF
                  </button>
                ) : (
                  <div
                    className="participant-lock"
                    title="Terkunci"
                    aria-label="Terkunci"
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    🔒
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!canViewBundleMaterials && bundleMaterials.length > 0 && (
          <p className="text-muted" style={{ marginTop: 12 }}>Beli bundling ini untuk membuka materi PDF.</p>
        )}
      </div>
    </div>
  );
};

export default BundleDetail;
