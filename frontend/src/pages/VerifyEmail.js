import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
import AuthBrandMark from '../components/AuthBrandMark';
import '../styles/auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Token verifikasi tidak ditemukan');
        setLoading(false);
        return;
      }

      try {
        const response = await authService.verifyEmail(token);
        setSuccess(response.data?.message || 'Email berhasil diverifikasi. Silakan login.');
      } catch (err) {
        setError(err.response?.data?.error || 'Verifikasi email gagal');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="verify-page">
      <AuthBrandMark className="auth-brand-mark--medium" />

      <div className="verify-card">
        <h2 className="verify-card__title">Verifikasi Email</h2>

        {loading && <div className="alert alert-info">Memproses verifikasi...</div>}
        {!loading && success && <div className="alert alert-success">{success}</div>}
        {!loading && error && <div className="alert alert-danger">{error}</div>}

        <Link to="/login" className="verify-card__login-btn">Lanjut ke Login</Link>
      </div>
    </div>
  );
};

export default VerifyEmail;
