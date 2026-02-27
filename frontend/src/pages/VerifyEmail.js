import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';
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
    <div className="auth-container">
      <div className="auth-card">
        <h2>Verifikasi Email</h2>

        {loading && <div className="alert alert-info">Memproses verifikasi...</div>}
        {!loading && success && <div className="alert alert-success">{success}</div>}
        {!loading && error && <div className="alert alert-danger">{error}</div>}

        <p className="auth-link">
          <Link to="/login">Lanjut ke Login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
