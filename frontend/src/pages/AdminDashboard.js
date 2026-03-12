import React, { useCallback, useEffect, useState } from 'react';
import { adminService, packageService, questionService, materialService, brandingService, purchaseService } from '../services/api';
import {
  BarChart3,
  Boxes,
  FileEdit,
  FileSpreadsheet,
  Image,
  Medal,
  Palette,
  Users,
  Wallet,
} from 'lucide-react';
import '../styles/admin.css';
import { formatRupiah, getOriginalPrice } from '../utils/pricing';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_ROOT = isLocalHost
  ? (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')
  : '';
const BASE_CATEGORY_NAMES = ['CPNS', 'BUMN', 'TOEFL'];
const ADMIN_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'packages', label: 'Kelola Paket', icon: Boxes },
  { key: 'upload', label: 'Upload Soal', icon: FileSpreadsheet },
  { key: 'materials', label: 'Materi PDF', icon: Image },
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'results', label: 'Hasil Tryout', icon: Wallet },
  { key: 'ranking', label: 'Ranking Paket', icon: Medal },
  { key: 'users', label: 'Daftar Pengguna', icon: Users },
  { key: 'editQuestions', label: 'Edit Soal', icon: FileEdit },
];
const normalizeIncludedPackageIds = (rawValue) => {
  if (Array.isArray(rawValue)) return rawValue;
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const normalizeCurrencyDigits = (rawValue) => String(rawValue ?? '').replace(/[^\d]/g, '');

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [adminPurchases, setAdminPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Form states
  const [newPackage, setNewPackage] = useState({ name: '', description: '', type: 'tryout', price: 0, original_price: '', question_count: 0, category_id: '', included_package_ids: [] });
  const [otherCategoryName, setOtherCategoryName] = useState('');
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [editPackage, setEditPackage] = useState(null);
  const [editOtherCategoryName, setEditOtherCategoryName] = useState('');
  const [editBundleSearch, setEditBundleSearch] = useState('');
  const [selectedPackageForUpload, setSelectedPackageForUpload] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [bundleSearch, setBundleSearch] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const statsRes = await adminService.getStats();
      setStats(statsRes.data);

      const packagesRes = await packageService.getAll();
      setPackages(packagesRes.data);
      const catRes = await fetch(API_ROOT + '/api/categories');
      const catJson = await catRes.json();
      setCategories(catJson);
      const matRes = await materialService.listAdmin();
      setMaterials(matRes.data || []);
      const purchasesRes = await purchaseService.getAllAdmin();
      setAdminPurchases(purchasesRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard data', err);
      const errMsg = err.response?.data?.error || err.response?.data || err.message || 'Error loading dashboard data';
      setMessage('Error loading dashboard data: ' + errMsg);
      setLoading(false);
    }
  };
  const ensureCategoryIdByName = async (rawName) => {
    const normalizedName = String(rawName || '').trim();
    if (!normalizedName) return null;

    const existing = categories.find(
      (category) => String(category?.name || '').trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (existing?.id) return existing.id;

    const res = await fetch(API_ROOT + '/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name: normalizedName, description: '' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText || 'Gagal membuat kategori');

    setCategories((prev) => {
      if ((prev || []).some((item) => String(item?.id) === String(json?.id))) return prev;
      return [...prev, json];
    });
    return json.id;
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    try {
      // resolve category: allow selecting preset names or creating a new one
      let payload = { ...newPackage };
      let resolvedCategoryId = null;
      if (payload.category_id === 'other') {
        if (!otherCategoryName) {
          setMessage('Nama kategori baru harus diisi');
          return;
        }
        resolvedCategoryId = await ensureCategoryIdByName(otherCategoryName);
      } else if (BASE_CATEGORY_NAMES.includes(payload.category_id)) {
        resolvedCategoryId = await ensureCategoryIdByName(payload.category_id);
      } else if (payload.category_id) {
        resolvedCategoryId = payload.category_id;
      }

      if (resolvedCategoryId) payload.category_id = resolvedCategoryId;

      if ((payload.type === 'bundle' || payload.type === 'bundling') && !payload.category_id) {
        setMessage('Bundling harus memiliki kategori agar tampil di dashboard peserta');
        return;
      }

      if (payload.type !== 'bundle' && payload.type !== 'bundling') {
        payload.included_package_ids = [];
      }

      const normalizedPrice = Number(normalizeCurrencyDigits(payload.price)) || 0;
      const normalizedOriginalPriceDigits = normalizeCurrencyDigits(payload.original_price);
      const normalizedOriginalPrice = normalizedOriginalPriceDigits ? Number(normalizedOriginalPriceDigits) : null;

      if (normalizedOriginalPrice !== null && normalizedOriginalPrice <= normalizedPrice) {
        setMessage('Harga coret harus lebih besar dari harga jual');
        return;
      }

      payload.price = normalizedPrice;
      payload.original_price = normalizedOriginalPrice;

      await packageService.create(payload);
      setMessage('Package created successfully');
      setNewPackage({ name: '', description: '', type: 'tryout', price: 0, original_price: '', question_count: 0, category_id: '', included_package_ids: [] });
      setOtherCategoryName('');
      loadDashboardData();
    } catch (err) {
      setMessage('Error creating package: ' + err.response?.data?.error);
    }
  };
  const handleStartEditPackage = (pkg) => {
    const mapped = {
      name: pkg.name || '',
      description: pkg.description || '',
      type: pkg.type || 'tryout',
      price: Number(pkg.price || 0),
      original_price: pkg.original_price ? Number(pkg.original_price) : '',
      question_count: Number(pkg.question_count || 0),
      category_id: pkg.category_id ? String(pkg.category_id) : '',
      included_package_ids: normalizeIncludedPackageIds(pkg.included_package_ids),
    };

    setEditingPackageId(pkg.id);
    setEditPackage(mapped);
    setEditOtherCategoryName('');
    setEditBundleSearch('');
  };

  const handleCancelEdit = () => {
    setEditingPackageId(null);
    setEditPackage(null);
    setEditOtherCategoryName('');
    setEditBundleSearch('');
  };

  const handleSaveEditPackage = async (e) => {
    e.preventDefault();
    if (!editingPackageId || !editPackage) return;

    try {
      let payload = { ...editPackage };
      let resolvedCategoryId = null;

      if (payload.category_id === 'other') {
        if (!editOtherCategoryName) {
          setMessage('Nama kategori baru harus diisi');
          return;
        }
        resolvedCategoryId = await ensureCategoryIdByName(editOtherCategoryName);
      } else if (BASE_CATEGORY_NAMES.includes(payload.category_id)) {
        resolvedCategoryId = await ensureCategoryIdByName(payload.category_id);
      } else if (payload.category_id) {
        resolvedCategoryId = payload.category_id;
      }

      payload.category_id = resolvedCategoryId || null;

      if ((payload.type === 'bundle' || payload.type === 'bundling') && !payload.category_id) {
        setMessage('Bundling harus memiliki kategori agar tampil di dashboard peserta');
        return;
      }

      if (payload.type !== 'bundle' && payload.type !== 'bundling') {
        payload.included_package_ids = [];
      }

      const normalizedPrice = Number(normalizeCurrencyDigits(payload.price)) || 0;
      const normalizedOriginalPriceDigits = normalizeCurrencyDigits(payload.original_price);
      const normalizedOriginalPrice = normalizedOriginalPriceDigits ? Number(normalizedOriginalPriceDigits) : null;

      if (normalizedOriginalPrice !== null && normalizedOriginalPrice <= normalizedPrice) {
        setMessage('Harga coret harus lebih besar dari harga jual');
        return;
      }

      payload.price = normalizedPrice;
      payload.original_price = normalizedOriginalPrice;

      const updateRes = await packageService.update(editingPackageId, payload);
      const updatedPackage = updateRes?.data?.package || null;
      if (updatedPackage) {
        setPackages((prev) =>
          (prev || []).map((pkg) =>
            String(pkg.id) === String(updatedPackage.id)
              ? { ...pkg, ...updatedPackage }
              : pkg
          )
        );
      }
      setMessage('Package updated successfully');
      handleCancelEdit();
      await loadDashboardData();
    } catch (err) {
      setMessage('Error updating package: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUploadQuestions = async (e) => {
    e.preventDefault();
    if (!selectedPackageForUpload || !excelFile) {
      setMessage('Please select package and file');
      return;
    }

    try {
      await questionService.upload(selectedPackageForUpload, excelFile);
      setMessage('Questions uploaded successfully');
      setExcelFile(null);
      setSelectedPackageForUpload('');
      loadDashboardData();
    } catch (err) {
      setMessage('Error uploading questions: ' + err.response?.data?.error);
    }
  };

  const handleDeletePackage = async (id) => {
    if (window.confirm('Are you sure you want to delete this package?')) {
      try {
        await packageService.delete(id);
        setMessage('Package deleted successfully');
        loadDashboardData();
      } catch (err) {
        setMessage('Error deleting package');
      }
    }
  };

  const handleDeleteAllPackages = async () => {
    if (!packages.length) {
      setMessage('Tidak ada paket untuk dihapus');
      return;
    }

    if (!window.confirm('Hapus SEMUA paket? Tindakan ini tidak bisa dibatalkan.')) {
      return;
    }

    try {
      const res = await packageService.deleteAll();
      const deletedCount = Number(res?.data?.deletedCount || 0);
      setMessage(`Berhasil menghapus ${deletedCount} paket`);
      await loadDashboardData();
    } catch (err) {
      setMessage('Error deleting all packages: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID');
  };

  const recentTermsAudits = (adminPurchases || [])
    .filter((purchase) => purchase?.payment_transaction?.id)
    .filter((purchase, index, arr) => {
      const txId = purchase.payment_transaction.id;
      return arr.findIndex((item) => item?.payment_transaction?.id === txId) === index;
    })
    .slice(0, 10);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Pusat kontrol konten, paket tryout, dan operasional pengguna.</p>
      </div>

      {message && (
        <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`}>
          <span>{message}</span>
          <button className="alert-close" onClick={() => setMessage('')}>
            ✕
          </button>
        </div>
      )}

      <div className="admin-tabs">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} className="tab-icon" />
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="admin-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.stats.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.stats.totalPackages}</div>
                <div className="stat-label">Total Packages</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.stats.totalPurchases}</div>
                <div className="stat-label">Total Purchases</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">Rp {stats.stats.totalRevenue?.toLocaleString('id-ID') || 0}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>

            {stats.recentPurchases && (
              <div className="card mt-20">
                <div className="card-title">Pembelian Terbaru</div>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Pengguna</th>
                      <th>Paket</th>
                      <th>Harga</th>
                      <th>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentPurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>{purchase.users?.name}</td>
                        <td>{purchase.packages?.name}</td>
                        <td>Rp {purchase.total_price?.toLocaleString('id-ID') || 0}</td>
                        <td>{new Date(purchase.created_at).toLocaleDateString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card mt-20">
              <div className="card-title">Audit Persetujuan Syarat & Ketentuan</div>
              {recentTermsAudits.length === 0 ? (
                <p className="text-muted">Belum ada data transaksi pembayaran.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Payment Ref</th>
                      <th>Pengguna</th>
                      <th>Status</th>
                      <th>Disetujui</th>
                      <th>Waktu Persetujuan</th>
                      <th>Versi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTermsAudits.map((purchase) => {
                      const terms = purchase?.payment_transaction?.terms_acceptance;
                      return (
                        <tr key={`terms-audit-${purchase.payment_transaction.id}`}>
                          <td>{purchase?.payment_transaction?.reference || '-'}</td>
                          <td>{purchase?.users?.name || purchase?.users?.email || '-'}</td>
                          <td>{String(purchase?.payment_transaction?.status || '-').toUpperCase()}</td>
                          <td>{terms?.accepted ? 'Ya' : 'Tidak / Tidak Tercatat'}</td>
                          <td>{formatDateTime(terms?.accepted_at)}</td>
                          <td>{terms?.terms_version || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Packages Tab */}
        {activeTab === 'packages' && (
          <div>
            <div className="card">
              <div className="card-title">Buat Paket Baru</div>
              <form onSubmit={handleCreatePackage}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nama Paket</label>
                    <input
                      type="text"
                      value={newPackage.name}
                      onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipe</label>
                    <select
                      value={newPackage.type}
                      onChange={(e) => setNewPackage({ ...newPackage, type: e.target.value })}
                    >
                      <option value="tryout">Tryout</option>
                      <option value="latihan">Latihan</option>
                      <option value="bundling">Bundling</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kategori</label>
                    <select
                      value={newPackage.category_id || 'select'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'other') {
                          setNewPackage({ ...newPackage, category_id: 'other' });
                        } else if (v === 'select') {
                          setNewPackage({ ...newPackage, category_id: '' });
                        } else {
                          setNewPackage({ ...newPackage, category_id: v });
                        }
                      }}
                    >
                      <option value="select">-- Pilih Kategori --</option>
                      <option value="CPNS">CPNS</option>
                      <option value="BUMN">BUMN</option>
                      <option value="TOEFL">TOEFL</option>
                      <option value="other">Lainnya</option>
                    </select>
                    {newPackage.category_id === 'other' && (
                      <input
                        type="text"
                        placeholder="Nama kategori"
                        value={otherCategoryName}
                        onChange={(e) => setOtherCategoryName(e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </div>
                  {newPackage.type === 'bundling' && (
                    <div className="form-group">
                      <label>Bundling (pilih paket yang termasuk)</label>
                      <div className="bundle-picker-header">
                        <input
                          type="text"
                          placeholder="Cari paket..."
                          value={bundleSearch}
                          onChange={(e) => setBundleSearch(e.target.value)}
                          className="bundle-search"
                        />
                        <div className="bundle-picker-count">
                          {newPackage.included_package_ids?.length || 0} paket dipilih
                        </div>
                      </div>
                      <div className="bundle-picker-grid">
                        {packages
                          .filter((p) => p.type !== 'bundle' && p.type !== 'bundling')
                          .filter((p) => {
                            if (!bundleSearch.trim()) return true;
                            const term = bundleSearch.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(term) ||
                              String(p.type || '').toLowerCase().includes(term) ||
                              String(categories.find((c) => String(c.id) === String(p.category_id))?.name || '')
                                .toLowerCase()
                                .includes(term)
                            );
                          })
                          .map((p) => {
                            const selected = (newPackage.included_package_ids || [])
                              .map(String)
                              .includes(String(p.id));
                            const categoryName = categories.find((c) => String(c.id) === String(p.category_id))?.name || '-';
                            const isHidden = p.visibility === 'hidden';
                            
                            return (
                              <label key={`pkgchk-${p.id}`} className={`bundle-picker-item ${selected ? 'selected' : ''} ${isHidden ? 'hidden' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    const cur = newPackage.included_package_ids || [];
                                    const idVal = p.id;
                                    let next = [];
                                    if (cur.map(String).includes(String(idVal))) {
                                      next = cur.filter((x) => String(x) !== String(idVal));
                                    } else {
                                      next = [...cur, idVal];
                                    }
                                    setNewPackage({ ...newPackage, included_package_ids: next });
                                  }}
                                />
                                <div>
                                  <div className="bundle-picker-title">
                                    {p.name}
                                    {isHidden && <span className="badge-hidden-label">(Arsip Admin)</span>}
                                  </div>
                                  <div className="bundle-picker-meta">
                                    <span>{p.type}</span>
                                    <span>•</span>
                                    <span>{categoryName}</span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Harga (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPackage.price}
                      onChange={(e) => {
                        const nextValue = Number(normalizeCurrencyDigits(e.target.value)) || 0;
                        setNewPackage({ ...newPackage, price: nextValue });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Harga Coret (Opsional)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPackage.original_price}
                      onChange={(e) => {
                        const nextDigits = normalizeCurrencyDigits(e.target.value);
                        setNewPackage({ ...newPackage, original_price: nextDigits });
                      }}
                      placeholder="Contoh: 50000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Jumlah Soal</label>
                    <input
                      type="number"
                      value={newPackage.question_count}
                      onChange={(e) => setNewPackage({ ...newPackage, question_count: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Deskripsi</label>
                  <textarea
                    value={newPackage.description}
                    onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                    rows="3"
                  />
                </div>
                <button type="submit" className="btn btn-success">
                  Buat Paket
                </button>
              </form>
            </div>

            <div className="card mt-20">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Daftar Paket</div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteAllPackages}
                >
                  Hapus Semua Paket
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Tipe</th>
                    <th>Harga</th>
                    <th>Jumlah Soal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td>{pkg.name}</td>
                      <td>{categories.find((c)=>c.id===pkg.category_id)?.name || '-'}</td>
                      <td>{pkg.type}</td>
                      <td>
                        {getOriginalPrice(pkg) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ color: '#94a3b8', fontSize: 12, textDecoration: 'line-through' }}>
                              {formatRupiah(getOriginalPrice(pkg))}
                            </span>
                            <span>{formatRupiah(pkg.price)}</span>
                          </div>
                        ) : (
                          formatRupiah(pkg.price)
                        )}
                      </td>
                      <td>{pkg.question_count || 0}</td>
                      <td>
                            <button
                              onClick={() => handleStartEditPackage(pkg)}
                              className="btn btn-warning btn-sm"
                              style={{ marginRight: 8 }}
                            >
                              Edit
                            </button>
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editPackage && (
              <div className="card mt-20">
                <div className="card-title">Edit Paket #{editingPackageId}</div>
                <form onSubmit={handleSaveEditPackage}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nama Paket</label>
                      <input
                        type="text"
                        value={editPackage.name}
                        onChange={(e) => setEditPackage({ ...editPackage, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Tipe</label>
                      <select
                        value={editPackage.type}
                        onChange={(e) => setEditPackage({ ...editPackage, type: e.target.value })}
                      >
                        <option value="tryout">Tryout</option>
                        <option value="latihan">Latihan</option>
                        <option value="bundling">Bundling</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Kategori</label>
                      <select
                        value={editPackage.category_id || 'select'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'other') {
                            setEditPackage({ ...editPackage, category_id: 'other' });
                          } else if (v === 'select') {
                            setEditPackage({ ...editPackage, category_id: '' });
                          } else {
                            setEditPackage({ ...editPackage, category_id: v });
                          }
                        }}
                      >
                        <option value="select">-- Pilih Kategori --</option>
                        <option value="CPNS">CPNS</option>
                        <option value="BUMN">BUMN</option>
                        <option value="TOEFL">TOEFL</option>
                        {(categories || []).map((category) => (
                          <option key={`edit-cat-${category.id}`} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                        <option value="other">Lainnya</option>
                      </select>
                      {editPackage.category_id === 'other' && (
                        <input
                          type="text"
                          placeholder="Nama kategori"
                          value={editOtherCategoryName}
                          onChange={(e) => setEditOtherCategoryName(e.target.value)}
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </div>

                    {(editPackage.type === 'bundle' || editPackage.type === 'bundling') && (
                      <div className="form-group">
                        <label>Bundling (pilih paket yang termasuk)</label>
                        <div className="bundle-picker-header">
                          <input
                            type="text"
                            placeholder="Cari paket..."
                            value={editBundleSearch}
                            onChange={(e) => setEditBundleSearch(e.target.value)}
                            className="bundle-search"
                          />
                          <div className="bundle-picker-count">
                            {editPackage.included_package_ids?.length || 0} paket dipilih
                          </div>
                        </div>
                        <div className="bundle-picker-grid">
                          {(packages || [])
                            .filter((p) => String(p.id) !== String(editingPackageId))
                            .filter((p) => p.type !== 'bundle' && p.type !== 'bundling')
                            .filter((p) => {
                              if (!editBundleSearch.trim()) return true;
                              const term = editBundleSearch.toLowerCase();
                              return (
                                String(p.name || '').toLowerCase().includes(term) ||
                                String(p.type || '').toLowerCase().includes(term) ||
                                String(categories.find((c) => String(c.id) === String(p.category_id))?.name || '')
                                  .toLowerCase()
                                  .includes(term)
                              );
                            })
                            .map((p) => {
                              const selected = (editPackage.included_package_ids || [])
                                .map(String)
                                .includes(String(p.id));

                              return (
                                <label key={`edit-pkgchk-${p.id}`} className={`bundle-picker-item ${selected ? 'selected' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => {
                                      const currentIds = editPackage.included_package_ids || [];
                                      const nextIds = currentIds.map(String).includes(String(p.id))
                                        ? currentIds.filter((x) => String(x) !== String(p.id))
                                        : [...currentIds, p.id];
                                      setEditPackage({ ...editPackage, included_package_ids: nextIds });
                                    }}
                                  />
                                  <div>
                                    <div className="bundle-picker-title">{p.name}</div>
                                    <div className="bundle-picker-meta">
                                      <span>{p.type}</span>
                                      <span>•</span>
                                      <span>{categories.find((c) => String(c.id) === String(p.category_id))?.name || '-'}</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Harga (Rp)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editPackage.price}
                        onChange={(e) => {
                          const nextValue = Number(normalizeCurrencyDigits(e.target.value)) || 0;
                          setEditPackage({ ...editPackage, price: nextValue });
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Harga Coret (Opsional)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editPackage.original_price}
                        onChange={(e) => {
                          const nextDigits = normalizeCurrencyDigits(e.target.value);
                          setEditPackage({ ...editPackage, original_price: nextDigits });
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Jumlah Soal</label>
                      <input
                        type="number"
                        value={editPackage.question_count}
                        onChange={(e) => setEditPackage({ ...editPackage, question_count: parseInt(e.target.value || '0', 10) })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Deskripsi</label>
                    <textarea
                      value={editPackage.description}
                      onChange={(e) => setEditPackage({ ...editPackage, description: e.target.value })}
                      rows="3"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-success">Simpan Perubahan</button>
                    <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Batal</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="card">
              <div className="card-title">Kelola Kategori</div>
              <CategoryManager categories={categories} setCategories={setCategories} setMessage={setMessage} />
            </div>
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div className="card">
            <div className="card-title">Upload Materi (PDF)</div>
            <MaterialUploader categories={categories} setCategories={setCategories} packages={packages} materials={materials} setMaterials={setMaterials} setMessage={setMessage} />
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="card">
            <div className="card-title">Branding Settings</div>
            <BrandingSettingsForm setMessage={setMessage} />
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="card">
            <div className="card-title">Upload Soal dari Excel</div>
            <form onSubmit={handleUploadQuestions}>
              <div className="form-group">
                <label>Pilih Paket</label>
                <select
                  value={selectedPackageForUpload}
                  onChange={(e) => setSelectedPackageForUpload(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Paket --</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>File Excel</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setExcelFile(e.target.files[0])}
                  required
                />
                <small>
                  Format: number | question_text | option_a | option_b | option_c | option_d | option_e |
                  correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e |
                  image_url
                </small>
              </div>
              <button type="submit" className="btn btn-success">
                Upload Soal
              </button>
            </form>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <ResultsTab />
        )}

        {/* Ranking Tab */}
        {activeTab === 'ranking' && (
          <RankingTab packages={packages} />
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <UsersTab />
        )}

        {/* Edit Questions Tab */}
        {activeTab === 'editQuestions' && (
          <EditQuestionsTab />
        )}
      </div>
    </div>
  );
};

// Results Tab Component
const ResultsTab = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const res = await adminService.getTryoutResults();
      setResults(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <div className="card-title">Hasil Tryout Semua Pengguna</div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Pengguna</th>
            <th>Paket</th>
            <th>TWK</th>
            <th>TIU</th>
            <th>TKP</th>
            <th>Status</th>
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id}>
              <td>{result.users?.name}</td>
              <td>{result.packages?.name}</td>
              <td>{Math.round(result.twk_score || 0)}</td>
              <td>{Math.round(result.tiu_score || 0)}</td>
              <td>{result.tkp_score || 0}</td>
              <td>
                <span className={result.is_passed ? 'status-passed' : 'status-failed'}>
                  {result.is_passed ? 'LULUS' : 'TIDAK LULUS'}
                </span>
              </td>
              <td>{new Date(result.finished_at).toLocaleDateString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Users Tab Component
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await adminService.getAllUsers();
      setUsers(res.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <div className="card-title">Daftar Pengguna</div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>Role</th>
            <th>Tanggal Daftar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className={user.role === 'admin' ? 'role-admin' : 'role-user'}>
                  {user.role}
                </span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Ranking Tab Component
const RankingTab = ({ packages }) => {
  const [selectedPackage, setSelectedPackage] = useState('');
  const [ranking, setRanking] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadRanking = async (packageId) => {
    if (!packageId) {
      setRanking([]);
      setParticipantCount(0);
      return;
    }

    try {
      setLoading(true);
      const res = await adminService.getRankingByPackage(packageId);
      setRanking(res.data?.ranking || []);
      setParticipantCount(res.data?.participant_count || 0);
    } catch (err) {
      setRanking([]);
      setParticipantCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">Ranking Peserta per Paket</div>

      <div className="form-group" style={{ maxWidth: 420 }}>
        <label>Pilih Paket</label>
        <select
          value={selectedPackage}
          onChange={(e) => {
            const packageId = e.target.value;
            setSelectedPackage(packageId);
            loadRanking(packageId);
          }}
        >
          <option value="">-- Pilih Paket --</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
            </option>
          ))}
        </select>
      </div>

      {selectedPackage && (
        <p className="text-muted" style={{ marginBottom: 12 }}>
          Total peserta ter-ranking: {participantCount}
        </p>
      )}

      {loading ? (
        <div>Loading ranking...</div>
      ) : ranking.length === 0 ? (
        <div className="text-muted">Belum ada data ranking untuk paket ini.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Nama</th>
              <th>Email</th>
              <th>TWK</th>
              <th>TIU</th>
              <th>TKP</th>
              <th>Total</th>
              <th>Durasi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => {
              const durationMinutes = row.duration_ms ? Math.round(row.duration_ms / 60000) : null;
              return (
                <tr key={row.session_id}>
                  <td><strong>#{row.rank}</strong></td>
                  <td>{row.user_name}</td>
                  <td>{row.user_email}</td>
                  <td>{Math.round(row.twk_score || 0)}</td>
                  <td>{Math.round(row.tiu_score || 0)}</td>
                  <td>{Math.round(row.tkp_score || 0)}</td>
                  <td><strong>{Math.round(row.total_score || 0)}</strong></td>
                  <td>{durationMinutes !== null ? `${durationMinutes} menit` : '-'}</td>
                  <td>
                    <span className={row.is_passed ? 'status-passed' : 'status-failed'}>
                      {row.is_passed ? 'LULUS' : 'TIDAK'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

// Edit Questions Tab Component
const EditQuestionsTab = () => {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const res = await packageService.getAll();
      setPackages(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading packages:', err);
      setLoading(false);
    }
  };

  const handlePackageChange = async (e) => {
    const packageId = e.target.value;
    setSelectedPackage(packageId);
    setSelectedQuestion(null);
    setEditFormData({});
    setSelectedImageFile(null);
    setSelectedImagePreview('');
    setMessage('');

    if (packageId) {
      try {
        const res = await questionService.getByPackage(packageId);
        setQuestions(res.data || []);
      } catch (err) {
        console.error('Error loading questions:', err);
        setMessage('Error loading questions');
      }
    }
  };

  const handleSelectQuestion = (question) => {
    setSelectedQuestion(question);
    setEditFormData(question);
    setSelectedImageFile(null);
    setSelectedImagePreview('');
  };

  const handleFormChange = (field, value) => {
    setEditFormData({ ...editFormData, [field]: value });
  };

  const handleSaveQuestion = async () => {
    try {
      await questionService.updateQuestion(selectedQuestion.id, editFormData);
      setMessage('Question updated successfully');
      // Reload questions
      const res = await questionService.getByPackage(selectedPackage);
      setQuestions(res.data || []);
      setSelectedQuestion(null);
      setEditFormData({});
      setSelectedImageFile(null);
      setSelectedImagePreview('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving question: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Hapus soal ini? Tindakan ini tidak bisa dibatalkan.')) return;

    try {
      await questionService.delete(questionId);
      setMessage('Question deleted successfully');
      const res = await questionService.getByPackage(selectedPackage);
      setQuestions(res.data || []);

      if (selectedQuestion?.id === questionId) {
        setSelectedQuestion(null);
        setEditFormData({});
        setSelectedImageFile(null);
        setSelectedImagePreview('');
      }

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error deleting question: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="form-group">
        <label>Pilih Paket</label>
        <select value={selectedPackage} onChange={handlePackageChange}>
          <option value="">-- Pilih Paket --</option>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`}>
          {message}
        </div>
      )}

      {selectedPackage && (
        <div className="form-row" style={{ gap: '20px' }}>
          {/* Daftar Soal */}
          <div className="card" style={{ flex: 1, minWidth: '300px' }}>
            <div className="card-title">Daftar Soal ({questions.length})</div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
              {questions.map((q) => (
                <div
                  key={q.id}
                  onClick={() => handleSelectQuestion(q)}
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    backgroundColor: selectedQuestion?.id === q.id ? '#e3f2fd' : 'white',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>Soal {q.number}</strong> - {q.category}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteQuestion(q.id);
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {q.question_text.substring(0, 60)}...
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Edit */}
          {selectedQuestion && (
            <div className="card" style={{ flex: 1, minWidth: '400px' }}>
              <div className="card-title">Edit Soal #{selectedQuestion.number}</div>

              <div className="form-group">
                <label>Nomor Soal</label>
                <input
                  type="number"
                  value={editFormData.number || ''}
                  onChange={(e) => handleFormChange('number', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Teks Soal</label>
                <textarea
                  value={editFormData.question_text || ''}
                  onChange={(e) => handleFormChange('question_text', e.target.value)}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Kategori</label>
                <select
                  value={editFormData.category || ''}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                >
                  <option value="TWK">TWK</option>
                  <option value="TIU">TIU</option>
                  <option value="TKP">TKP</option>
                </select>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <strong>Pilihan Jawaban</strong>
              </div>
              {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                <div className="form-group" key={opt}>
                  <label>Opsi {opt}</label>
                  <input
                    type="text"
                    value={editFormData[`option_${opt.toLowerCase()}`] || ''}
                    onChange={(e) => handleFormChange(`option_${opt.toLowerCase()}`, e.target.value)}
                  />
                </div>
              ))}

              <div className="form-group">
                <label>Jawaban Benar</label>
                <select
                  value={editFormData.correct_answer || ''}
                  onChange={(e) => handleFormChange('correct_answer', e.target.value)}
                >
                  <option value="">-- Pilih --</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>

              <div className="form-group">
                <label>Penjelasan</label>
                <textarea
                  value={editFormData.explanation || ''}
                  onChange={(e) => handleFormChange('explanation', e.target.value)}
                  rows="2"
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <strong>Poin (untuk TKP)</strong>
              </div>
              {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                <div className="form-group" key={`point-${opt}`}>
                  <label>Point {opt}</label>
                  <input
                    type="number"
                    value={editFormData[`point_${opt.toLowerCase()}`] || ''}
                    onChange={(e) => handleFormChange(`point_${opt.toLowerCase()}`, e.target.value)}
                  />
                </div>
              ))}

              <button onClick={handleSaveQuestion} className="btn btn-success">
                Simpan Perubahan
              </button>
              <button
                onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                className="btn btn-danger"
                style={{ marginLeft: 8 }}
              >
                Hapus Soal Ini
              </button>

              <hr style={{ margin: '20px 0' }} />

              <div style={{ marginBottom: '10px' }}>
                <strong>Gambar Soal</strong>
              </div>

              {(selectedImagePreview || editFormData.image_url) && (
                <div style={{ marginBottom: '10px' }}>
                  <img
                    src={selectedImagePreview || editFormData.image_url}
                    alt="Current"
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Upload Gambar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const previewUrl = URL.createObjectURL(file);
                      setSelectedImageFile(file);
                      setSelectedImagePreview(previewUrl);
                      setMessage('Preview gambar berhasil dimuat');
                      setTimeout(() => setMessage(''), 2000);
                    }
                  }}
                />
                <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                  Format: JPG, PNG, GIF (Max 5MB)
                </small>
              </div>

              <button
                onClick={async () => {
                  if (!selectedImageFile) {
                    setMessage('Pilih gambar terlebih dahulu');
                    return;
                  }
                  try {
                    const formData = new FormData();
                    formData.append('image', selectedImageFile);
                    const uploadRes = await questionService.uploadQuestionImage(selectedQuestion.id, formData);
                    const uploadedUrl = uploadRes?.data?.image_url;
                    if (uploadedUrl) {
                      setEditFormData((prev) => ({ ...prev, image_url: uploadedUrl }));
                    }
                    setSelectedImageFile(null);
                    setSelectedImagePreview('');
                    setMessage('Gambar berhasil disimpan!');
                    setTimeout(() => setMessage(''), 3000);
                  } catch (err) {
                    setMessage('Error saving image: ' + (err.response?.data?.error || err.message));
                  }
                }}
                className="btn btn-info"
              >
                Simpan Gambar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

const BrandingSettingsForm = ({ setMessage }) => {
  const BRANDING_LOGO_CACHE_KEY = 'brandingLogoUrl';
  const FAVICON_CACHE_KEY = 'appFaviconUrl';

  const extractBrandingPayload = (response) => {
    const raw = response?.data || response || {};
    if (raw?.settings && typeof raw.settings === 'object') return raw.settings;
    if (raw?.data && typeof raw.data === 'object') return raw.data;
    return raw;
  };

  const normalizeLogoUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${window.location.origin}${raw}?t=${Date.now()}`;
    return raw;
  };

  const [headerColor, setHeaderColor] = useState('#103c21');
  const [buttonColor, setButtonColor] = useState('#007bff');
  const [lineColor, setLineColor] = useState('#dddddd');
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconFile, setFaviconFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const colorRegex = /^#([0-9a-fA-F]{6})$/;

  const loadSettings = useCallback(async () => {
    try {
      const response = await brandingService.getSettings();
      const data = extractBrandingPayload(response);
      setHeaderColor(data.headerColor || '#103c21');
      setButtonColor(data.buttonColor || '#007bff');
      setLineColor(data.lineColor || '#dddddd');
      const nextLogo = normalizeLogoUrl(data.logoUrl || data.logo_url || data.logo || '');
      setLogoUrl(nextLogo);
      if (nextLogo) {
        localStorage.setItem(BRANDING_LOGO_CACHE_KEY, nextLogo);
      }
    } catch (error) {
      setMessage('Gagal memuat branding settings');
    }
  }, [setMessage]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveColor = async (e) => {
    e.preventDefault();

    if (!colorRegex.test(headerColor)) {
      setMessage('Header color harus format hex 6 digit, contoh: #103c21');
      return;
    }
    if (!colorRegex.test(buttonColor)) {
      setMessage('Button color harus format hex 6 digit, contoh: #007bff');
      return;
    }
    if (!colorRegex.test(lineColor)) {
      setMessage('Line color harus format hex 6 digit, contoh: #dddddd');
      return;
    }

    try {
      setLoading(true);
      await brandingService.updateSettings({ headerColor, buttonColor, lineColor });
      document.documentElement.style.setProperty('--header-color', headerColor);
      document.documentElement.style.setProperty('--button-color', buttonColor);
      document.documentElement.style.setProperty('--line-color', lineColor);
      setMessage('Branding color updated');
    } catch (error) {
      setMessage('Error update color: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadLogo = async (e) => {
    e.preventDefault();

    if (!logoFile) {
      setMessage('Pilih file logo terlebih dahulu');
      return;
    }

    const validTypes = ['image/png', 'image/jpg', 'image/jpeg'];
    if (!validTypes.includes(logoFile.type)) {
      setMessage('Logo harus PNG/JPG/JPEG');
      return;
    }

    try {
      setLoading(true);
      const response = await brandingService.uploadLogo(logoFile);
      const data = response?.data || {};
      const nextLogoUrl = normalizeLogoUrl(
        data?.settings?.logoUrl || data?.logoUrl || data?.logo_url || data?.url || ''
      );
      setLogoUrl(nextLogoUrl);
      setLogoFile(null);
      if (nextLogoUrl) {
        localStorage.setItem(BRANDING_LOGO_CACHE_KEY, nextLogoUrl);
      } else {
        localStorage.removeItem(BRANDING_LOGO_CACHE_KEY);
      }
      window.dispatchEvent(new CustomEvent('branding-updated', { detail: { logoUrl: nextLogoUrl } }));
      setMessage('Logo branding berhasil diupload');
    } catch (error) {
      setMessage('Error upload logo: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const applyFavicon = (faviconUrl) => {
    const nextUrl = String(faviconUrl || '').trim();
    if (!nextUrl) return;

    let iconLink = document.querySelector("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.setAttribute('rel', 'icon');
      document.head.appendChild(iconLink);
    }

    iconLink.setAttribute('href', nextUrl);
  };

  const handleUploadFavicon = async (e) => {
    e.preventDefault();

    if (!faviconFile) {
      setMessage('Pilih file favicon (.ico/png)');
      return;
    }

    try {
      setLoading(true);
      const form = new FormData();
      form.append('file', faviconFile);

      const res = await fetch(API_ROOT + '/api/admin/upload-favicon', {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setMessage(json.error || 'Error uploading favicon');
        return;
      }

      const nextFavicon = `/api/favicon.ico?t=${Date.now()}`;
      applyFavicon(nextFavicon);
      localStorage.setItem(FAVICON_CACHE_KEY, nextFavicon);
      setFaviconFile(null);
      setMessage('Favicon uploaded');
    } catch (error) {
      setMessage('Error upload favicon: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSaveColor} style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Header Color (Hex)</label>
            <input
              type="text"
              value={headerColor}
              onChange={(e) => setHeaderColor(e.target.value)}
              placeholder="#103c21"
              maxLength={7}
              required
            />
          </div>
          <div className="form-group">
            <label>Button Color (Hex)</label>
            <input
              type="text"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              placeholder="#007bff"
              maxLength={7}
              required
            />
          </div>
          <div className="form-group">
            <label>Line/Border Color (Hex)</label>
            <input
              type="text"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
              placeholder="#dddddd"
              maxLength={7}
              required
            />
          </div>
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label>Preview</label>
            <div style={{ height: 40, borderRadius: 6, border: `2px solid ${lineColor}`, background: headerColor }} />
            <div style={{ marginTop: 8, height: 32, borderRadius: 6, background: buttonColor }} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={loading}>Simpan Warna</button>
      </form>

      <form onSubmit={handleUploadLogo}>
        <div className="form-group">
          <label>Upload Logo (PNG/JPG/JPEG)</label>
          <input
            type="file"
            accept="image/png,image/jpg,image/jpeg"
            onChange={(e) => setLogoFile(e.target.files[0])}
          />
        </div>
        <button className="btn btn-success" disabled={loading}>Upload Logo</button>
      </form>

      <form onSubmit={handleUploadFavicon} style={{ marginTop: 12 }}>
        <div className="form-group">
          <label>Upload Favicon (ICO/PNG)</label>
          <input
            type="file"
            accept=".ico,image/x-icon,image/png"
            onChange={(e) => setFaviconFile(e.target.files[0])}
          />
        </div>
        <button className="btn btn-success" disabled={loading}>Upload Favicon</button>
      </form>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Logo Saat Ini</label>
        {logoUrl ? (
          <img src={logoUrl} alt="Current logo" style={{ maxHeight: 56, objectFit: 'contain' }} />
        ) : (
          <span className="text-muted">Belum ada logo</span>
        )}
      </div>
    </div>
  );
};

// Category Manager Component
const CategoryManager = ({ categories, setCategories, setMessage }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROOT + '/api/categories');
      const json = await res.json();
      setCategories(json);
    } catch (err) {
      console.error(err);
    }
  }, [setCategories]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(API_ROOT + '/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ name, description }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage('Category created');
        setName(''); setDescription('');
        load();
      } else setMessage(json.error || 'Error');
    } catch (err) {
      setMessage('Error creating category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus kategori?')) return;
    try {
      const res = await fetch(API_ROOT + '/api/categories/' + id, {
        method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) { setMessage('Category deleted'); load(); } else { const j = await res.json(); setMessage(j.error || 'Error'); }
    } catch (err) { setMessage('Error deleting'); }
  };

  return (
    <div>
      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Nama Kategori</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Deskripsi</label>
            <input value={description} onChange={(e)=>setDescription(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-success">Tambah Kategori</button>
      </form>

      <table className="admin-table">
        <thead><tr><th>Nama</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
        <tbody>
          {categories.map(c=> (
            <tr key={c.id}><td>{c.name}</td><td>{c.description}</td><td><button className="btn btn-danger btn-sm" onClick={()=>handleDelete(c.id)}>Hapus</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Material uploader component
const MaterialUploader = ({ categories, setCategories, packages, materials, setMaterials, setMessage }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [otherCategoryName, setOtherCategoryName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [attachPackageByMaterial, setAttachPackageByMaterial] = useState({});

  const ensureCategoryIdByName = async (rawName) => {
    const normalizedName = String(rawName || '').trim();
    if (!normalizedName) return null;

    const existing = categories.find(
      (category) => String(category?.name || '').trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (existing?.id) return existing.id;

    const res = await fetch(API_ROOT + '/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name: normalizedName, description: '' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText || 'Gagal membuat kategori');

    setCategories((prev) => {
      if ((prev || []).some((item) => String(item?.id) === String(json?.id))) return prev;
      return [...prev, json];
    });

    return json.id;
  };

  const reloadMaterials = async () => {
    const response = await materialService.listAdmin();
    setMaterials(response.data || []);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setMessage('Pilih file PDF'); return; }
    const lowerName = (file.name || '').toLowerCase();
    if (!(file.type === 'application/pdf' || lowerName.endsWith('.pdf'))) {
      setMessage('File harus berformat PDF');
      return;
    }

    let resolvedCategoryId = null;
    try {
      if (selectedCategory === 'other') {
        if (!otherCategoryName.trim()) {
          setMessage('Nama kategori harus diisi saat memilih Lainnya');
          return;
        }
        resolvedCategoryId = await ensureCategoryIdByName(otherCategoryName);
      } else if (BASE_CATEGORY_NAMES.includes(selectedCategory)) {
        resolvedCategoryId = await ensureCategoryIdByName(selectedCategory);
      }
    } catch (categoryError) {
      setMessage('Error kategori: ' + (categoryError.message || 'Gagal menyiapkan kategori'));
      return;
    }

    try {
      const form = new FormData();
      form.append('file', file);
      if (resolvedCategoryId) form.append('categoryId', resolvedCategoryId);
      if (packageId) form.append('packageId', packageId);
      if (title) form.append('title', title);
      if (description) form.append('description', description);

      await materialService.upload(file, {
        categoryId: resolvedCategoryId,
        packageId,
        title,
        description,
      });
      setMessage('Material uploaded'); setFile(null); setTitle(''); setDescription(''); setSelectedCategory(''); setOtherCategoryName(''); setPackageId('');
      await reloadMaterials();
    } catch (err) { setMessage(err.message || 'Error uploading material'); }
  };

  const handleEdit = async (material) => {
    const nextTitle = window.prompt('Judul materi', material.title || '');
    if (nextTitle === null) return;
    const nextDescription = window.prompt('Deskripsi materi', material.description || '');
    if (nextDescription === null) return;

    try {
      await materialService.update(material.id, {
        title: nextTitle,
        description: nextDescription,
        categoryId: material.category_id || null,
      });
      setMessage('Material updated');
      await reloadMaterials();
    } catch (err) {
      setMessage('Error updating material: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (materialId) => {
    if (!window.confirm('Hapus material ini?')) return;
    try {
      await materialService.delete(materialId);
      setMessage('Material deleted');
      await reloadMaterials();
    } catch (err) {
      setMessage('Error deleting material: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAttachPackage = async (materialId) => {
    const selected = Number(attachPackageByMaterial[materialId] || 0);
    if (!Number.isInteger(selected) || selected <= 0) {
      setMessage('Pilih paket terlebih dahulu');
      return;
    }

    try {
      await materialService.attachPackage(materialId, selected);
      setMessage('Package attached to material');
      await reloadMaterials();
    } catch (err) {
      setMessage('Error attaching package: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDetachPackage = async (materialId, selectedPackageId) => {
    try {
      await materialService.detachPackage(materialId, selectedPackageId);
      setMessage('Package detached from material');
      await reloadMaterials();
    } catch (err) {
      setMessage('Error detaching package: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <form onSubmit={handleUpload}>
        <div className="form-row">
          <div className="form-group">
            <label>Title</label>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={selectedCategory} onChange={(e)=>setSelectedCategory(e.target.value)}>
              <option value="">-- none --</option>
              <option value="CPNS">CPNS</option>
              <option value="BUMN">BUMN</option>
              <option value="TOEFL">TOEFL</option>
              <option value="other">Lainnya</option>
            </select>
            {selectedCategory === 'other' && (
              <input
                type="text"
                placeholder="Nama kategori"
                value={otherCategoryName}
                onChange={(e) => setOtherCategoryName(e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Package (optional)</label>
            <select value={packageId} onChange={(e)=>setPackageId(e.target.value)}>
              <option value="">-- none --</option>
              {packages.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>File (PDF)</label>
            <input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files[0])} />
          </div>
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={2} />
        </div>
        <button className="btn btn-success">Upload</button>
      </form>

      <div style={{marginTop:16}}>
        <div className="card-title">Daftar Materi</div>
        <table className="admin-table">
          <thead><tr><th>Title</th><th>Category</th><th>Packages</th><th>File</th><th>Aksi</th></tr></thead>
          <tbody>
            {materials.map(m=> (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{categories.find(c=>c.id===m.category_id)?.name || '-'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      {(m.attached_packages || []).length === 0 ? '-' : (m.attached_packages || []).map((pkg) => (
                        <span key={`${m.id}-${pkg.package_id}`} style={{ marginRight: 8 }}>
                          {pkg.package?.name || `Paket #${pkg.package_id}`} (#{pkg.package_id})
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={() => handleDetachPackage(m.id, pkg.package_id)}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={attachPackageByMaterial[m.id] || ''}
                        onChange={(e) => setAttachPackageByMaterial((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      >
                        <option value="">-- attach package --</option>
                        {packages.map((p) => <option key={p.id} value={p.id}>#{p.id} - {p.name}</option>)}
                      </select>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAttachPackage(m.id)}>
                        Attach
                      </button>
                    </div>
                  </div>
                </td>
                <td>{m.file_url ? <a href={m.file_url} target="_blank" rel="noreferrer">Download</a> : '-'}</td>
                <td>
                  <button type="button" className="btn btn-info btn-sm" onClick={() => handleEdit(m)} style={{ marginRight: 6 }}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
