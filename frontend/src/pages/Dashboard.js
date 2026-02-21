import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryService, campaignService } from '../services/api';
import SmartCampaignBanner from '../components/SmartCampaignBanner';
import '../styles/dashboard.css';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
    fetchPersonalizedCampaigns();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoryService.getWithPackages();
      setCategories(response.data || []);
    } catch (err) {
      setError('Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalizedCampaigns = async () => {
    try {
      const response = await campaignService.getPersonalized('dashboard');
      setCampaigns(response.data?.campaigns || []);
      await campaignService.trackEvent('dashboard_load', { campaignCount: (response.data?.campaigns || []).length }, 'dashboard');
    } catch (err) {
      setCampaigns([]);
    }
  };

  const handleCampaignClick = async (campaign) => {
    try {
      await campaignService.logClick(campaign.id, {
        triggerSource: 'dashboard',
        destination: campaign.target_url || null,
      });
    } catch (err) {
    }

    if (campaign.target_url) {
      window.open(campaign.target_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="dashboard-header">
        <h1>Pilih Kategori Tes</h1>
        <p className="text-muted">Kategori akan otomatis muncul sesuai data yang dibuat admin.</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => navigate('/adaptive-dashboard')}>
            Buka Adaptive Learning Dashboard
          </button>
          <button className="btn btn-info" style={{ marginLeft: 8 }} onClick={() => navigate('/my-materials')}>
            Buka Materi Saya
          </button>
        </div>
      </div>

      <SmartCampaignBanner campaigns={campaigns} onClickCampaign={handleCampaignClick} />

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-title">Kategori Dinamis</div>
        {categories.length === 0 ? (
          <p className="text-muted">Belum ada kategori dengan paket aktif.</p>
        ) : (
          <div className="categories-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                className="category-card"
                onClick={() => navigate(`/dashboard/categories/${category.id}`)}
              >
                <h3>{category.name}</h3>
                <p className="package-desc">{category.description || 'Kategori tes'}</p>
                <div className="category-meta">
                  <span>{category.package_count} paket</span>
                  <span>{category.bundle_count} bundling</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
