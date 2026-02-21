/**
 * Example: Content Management Admin Page
 * Shows how to integrate ContentUploadForm into admin panel
 */

import React, { useState, useEffect } from 'react';
import { packageService, contentService } from '../services/api';
import ContentUploadForm from '../components/ContentUploadForm';
import VisibilityBadge from '../components/VisibilityBadge';
import '../styles/content-management.css';

const ContentManagementPage = () => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, visible, hidden, material, question
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPackages();
  }, [filter]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const res = await packageService.getAll();
      let filtered = res.data || [];

      // Apply visibility filter
      if (filter === 'visible') {
        filtered = filtered.filter(p => p.visibility === 'visible');
      } else if (filter === 'hidden') {
        filtered = filtered.filter(p => p.visibility === 'hidden');
      }

      // Apply content type filter
      if (filter === 'material') {
        filtered = filtered.filter(p => p.content_type === 'material');
      } else if (filter === 'question') {
        filtered = filtered.filter(p => p.content_type === 'question');
      }

      // Apply search
      if (searchTerm) {
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setPackages(filtered);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityToggle = async (packageId, currentVisibility) => {
    try {
      const newVisibility = currentVisibility === 'visible' ? 'hidden' : 'visible';
      await contentService.updateVisibility(packageId, newVisibility);
      
      // Update local state
      setPackages(prevPackages =>
        prevPackages.map(p =>
          p.id === packageId ? { ...p, visibility: newVisibility } : p
        )
      );
    } catch (error) {
      alert('Error updating visibility: ' + error.message);
    }
  };

  const handleUploadSuccess = (result) => {
    // Reload packages after upload
    loadPackages();
    setSelectedPackage(null);
  };

  const getContentTypeIcon = (contentType) => {
    return contentType === 'material' ? '📄' : '📝';
  };

  const getContentTypeLabel = (contentType) => {
    return contentType === 'material' ? 'Materi' : 'Soal';
  };

  return (
    <div className="content-management-page">
      <div className="container">
        <div className="page-header">
          <h1>📦 Manajemen Konten</h1>
          <p className="subtitle">Upload dan kelola materi dan soal paket</p>
        </div>

        {/* Upload Form */}
        {selectedPackage && (
          <div className="upload-section">
            <button
              className="btn-close-upload"
              onClick={() => setSelectedPackage(null)}
              title="Tutup form upload"
            >
              ✕
            </button>
            <ContentUploadForm
              packageId={selectedPackage.id}
              packageName={selectedPackage.name}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
        )}

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Filter:</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Semua ({packages.filter(p => p.visibility !== 'hidden').length})
              </button>
              <button
                className={`filter-btn ${filter === 'visible' ? 'active' : ''}`}
                onClick={() => setFilter('visible')}
              >
                🟢 Tampilkan
              </button>
              <button
                className={`filter-btn ${filter === 'hidden' ? 'active' : ''}`}
                onClick={() => setFilter('hidden')}
              >
                ⚙️ Arsip
              </button>
              <button
                className={`filter-btn ${filter === 'material' ? 'active' : ''}`}
                onClick={() => setFilter('material')}
              >
                📄 Materi
              </button>
              <button
                className={`filter-btn ${filter === 'question' ? 'active' : ''}`}
                onClick={() => setFilter('question')}
              >
                📝 Soal
              </button>
            </div>
          </div>

          <div className="search-group">
            <input
              type="text"
              className="search-input"
              placeholder="Cari paket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Packages Table */}
        <div className="packages-section">
          {loading ? (
            <div className="loading">Loading packages...</div>
          ) : packages.length === 0 ? (
            <div className="empty-state">
              <p>Tidak ada paket yang sesuai filter</p>
            </div>
          ) : (
            <div className="packages-table-wrapper">
              <table className="packages-table">
                <thead>
                  <tr>
                    <th>Nama Paket</th>
                    <th>Tipe Konten</th>
                    <th>Status</th>
                    <th>Deskripsi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className={`row-${pkg.visibility}`}>
                      <td className="col-name">
                        <strong>{pkg.name}</strong>
                        {pkg.id && <span className="pkg-id">ID: {pkg.id}</span>}
                      </td>
                      <td className="col-type">
                        <span className="content-type">
                          {getContentTypeIcon(pkg.content_type || 'question')}
                          {getContentTypeLabel(pkg.content_type || 'question')}
                        </span>
                      </td>
                      <td className="col-status">
                        <VisibilityBadge visibility={pkg.visibility || 'visible'} />
                      </td>
                      <td className="col-desc">
                        <span title={pkg.description}>
                          {pkg.description ? pkg.description.substring(0, 40) + '...' : '-'}
                        </span>
                      </td>
                      <td className="col-actions">
                        <button
                          className="btn-action btn-upload"
                          onClick={() => setSelectedPackage(pkg)}
                          title="Upload konten untuk paket ini"
                        >
                          📤 Upload
                        </button>
                        <button
                          className={`btn-action btn-toggle ${pkg.visibility === 'hidden' ? 'btn-show' : 'btn-hide'}`}
                          onClick={() => handleVisibilityToggle(pkg.id, pkg.visibility)}
                          title={`${pkg.visibility === 'visible' ? 'Sembunyikan' : 'Tampilkan'}`}
                        >
                          {pkg.visibility === 'visible' ? '🙈 Sembunyikan' : '👁️ Tampilkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-label">Total Paket</div>
            <div className="stat-value">{packages.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Visible</div>
            <div className="stat-value">
              {packages.filter(p => p.visibility === 'visible').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hidden</div>
            <div className="stat-value">
              {packages.filter(p => p.visibility === 'hidden').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentManagementPage;
