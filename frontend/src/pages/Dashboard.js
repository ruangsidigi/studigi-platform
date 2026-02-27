import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoryService } from '../services/api';
import '../styles/dashboard.css';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
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

  if (loading) return <div className="container">Loading...</div>;

  const defaultCategoryNames = ['CPNS', 'BUMN', 'TOEFL', 'LAINNYA'];
  const normalized = (value) => String(value || '').trim().toLowerCase();
  const dashboardCategoryButtons = defaultCategoryNames.map((name) => {
    const found = categories.find((category) => normalized(category.name) === normalized(name));
    return {
      name,
      id: found?.id || null,
      enabled: Boolean(found?.id),
    };
  });

  const handleCategoryClick = (item) => {
    if (!item.enabled) return;
    navigate(`/dashboard/categories/${item.id}`);
  };

  return (
    <div className="participant-dashboard-page">
      <h1 className="participant-dashboard-title">Dashboard</h1>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="participant-dashboard-layout">
        <aside className="participant-dashboard-sidebar">
          <button className="participant-side-btn" onClick={() => navigate('/adaptive-dashboard')}>
            Adaptive Learning
          </button>
          <button className="participant-side-btn" onClick={() => navigate('/reports')}>
            Report
          </button>

          <div className="participant-side-section-title">Kategori</div>

          {dashboardCategoryButtons.map((item) => (
            <button
              key={item.name}
              className={`participant-side-btn ${item.enabled ? '' : 'disabled'}`}
              onClick={() => handleCategoryClick(item)}
              disabled={!item.enabled}
            >
              {item.name}
            </button>
          ))}
        </aside>

        <section className="participant-dashboard-content" />
      </div>
    </div>
  );
};

export default Dashboard;
