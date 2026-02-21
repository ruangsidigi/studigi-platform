import React, { useEffect, useState } from 'react';
import { materialService } from '../services/api';

const UserMaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await materialService.listMyMaterials();
      setMaterials(response.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat materi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleOpenMaterial = async (materialId) => {
    try {
      const response = await materialService.getAccessUrl(materialId);
      const url = response.data?.access_url;
      if (!url) {
        setError('URL material tidak tersedia');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.response?.data?.error || 'Tidak bisa membuka materi');
    }
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>Materi Belajar Saya</h1>
        <p className="text-muted">Hanya materi dari paket yang sudah kamu beli.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-title">Daftar Materi</div>

        {materials.length === 0 ? (
          <p className="text-muted">Belum ada materi untuk paket yang kamu beli.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Deskripsi</th>
                <th>Paket</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id}>
                  <td>{material.title}</td>
                  <td>{material.description || '-'}</td>
                  <td>
                    {(material.attached_packages || []).map((item) => item.package?.name || `#${item.package_id}`).join(', ') || '-'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => handleOpenMaterial(material.id)}>
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

export default UserMaterialsPage;
