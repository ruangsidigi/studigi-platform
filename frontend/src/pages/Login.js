import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authService, campaignService } from '../services/api';
import '../styles/auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const response = await authService.login(email, password);
      login(response.data.user, response.data.token);

      try {
        await campaignService.evaluate('login');
        await campaignService.trackEvent('login_success', { userId: response.data?.user?.id || null }, 'login');
      } catch (campaignErr) {
      }

      navigate(response.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Isi email terlebih dahulu');
      return;
    }

    setError('');
    setInfo('');
    setResendLoading(true);
    try {
      const response = await authService.resendVerification(email);
      setInfo(response.data?.message || 'Email verifikasi dikirim ulang.');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengirim ulang verifikasi');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        {info && <div className="alert alert-info">{info}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="auth-link">
          Don't have account? <a href="/register">Register here</a>
        </p>
        <p className="auth-link">
          <a href="/forgot-password">Forgot password?</a>
        </p>
        <p className="auth-link">
          <button type="button" className="btn btn-primary" onClick={handleResendVerification} disabled={resendLoading}>
            {resendLoading ? 'Mengirim ulang...' : 'Kirim Ulang Verifikasi Email'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
