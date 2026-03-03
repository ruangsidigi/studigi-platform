import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignService, packageService, purchaseService } from '../services/api';
import SmartCampaignBanner from '../components/SmartCampaignBanner';
import DashboardSubmenu from '../components/DashboardSubmenu';
import '../styles/dashboard.css';

const Dashboard = () => {
  const [ownedPackages, setOwnedPackages] = useState([]);
  const [pendingPackages, setPendingPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOwnedPackages();
    fetchPersonalizedCampaigns();
  }, []);

  const fetchOwnedPackages = async () => {
    try {
      const [purchasesRes, allPackagesRes] = await Promise.all([
        purchaseService.getAll(),
        packageService.getAll(),
      ]);

      const allPackages = Array.isArray(allPackagesRes.data) ? allPackagesRes.data : [];
      const packageMap = new Map(allPackages.map((item) => [String(item.id), item]));
      const purchases = Array.isArray(purchasesRes.data) ? purchasesRes.data : [];

      const completedStatuses = ['completed', 'paid', 'success'];
      const pendingStatuses = ['pending'];

      const owned = [];
      const pending = [];

      purchases.forEach((purchase) => {
        const normalizedStatus = String(purchase.payment_status || '').toLowerCase();
        const pkg = packageMap.get(String(purchase.package_id));
        if (!pkg) return;

        if (completedStatuses.includes(normalizedStatus)) {
          owned.push(pkg);
        } else if (pendingStatuses.includes(normalizedStatus)) {
          pending.push(pkg);
        }
      });

      const dedupeById = (list) => {
        const used = new Set();
        return list.filter((item) => {
          if (used.has(item.id)) return false;
          used.add(item.id);
          return true;
        });
      };

      setOwnedPackages(dedupeById(owned));
      setPendingPackages(dedupeById(pending));
    } catch (err) {
      setError('Gagal memuat paket yang sudah dibeli');
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
        <h1>Dashboard</h1>
        <p className="text-muted">Kelola paket yang sudah dibeli, adaptive learning, dan report hasil belajar.</p>
        <DashboardSubmenu />
      </div>

      <SmartCampaignBanner campaigns={campaigns} onClickCampaign={handleCampaignClick} />

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-title">Paket yang Sudah Dibeli</div>
        {ownedPackages.length === 0 ? (
          <p className="text-muted">Belum ada paket aktif. Silakan beli paket dari menu Home.</p>
        ) : (
          <div className="packages-grid">
            {ownedPackages.map((pkg) => (
              <div key={pkg.id} className="package-card">
                <h3>{pkg.name}</h3>
                <p className="package-type">
                  {pkg.type === 'tryout' ? '📝 Tryout' : pkg.type === 'latihan' ? '📚 Latihan' : '📦 Bundle'}
                </p>
                <p className="package-desc">{pkg.description || 'Paket latihan siap dikerjakan.'}</p>
                <div className="package-info">
                  <span>{pkg.question_count || 0} soal</span>
                  <span className="package-price">Rp {(pkg.price || 0).toLocaleString('id-ID')}</span>
                </div>
                <button className="btn btn-success participant-start-btn" onClick={() => navigate(`/quiz/${pkg.id}`)}>
                  Mulai
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingPackages.length > 0 && (
        <div className="card">
          <div className="card-title">Menunggu Pembayaran</div>
          <div className="packages-grid">
            {pendingPackages.map((pkg) => (
              <div key={pkg.id} className="package-card">
                <h3>{pkg.name}</h3>
                <p className="package-desc">Pembayaran paket ini masih diproses.</p>
                <button className="btn btn-secondary" disabled>
                  Menunggu Pembayaran
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
