import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

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

      const redirectTo = location.state?.redirectTo;
      if (response.data.user.role === 'admin') {
        navigate('/admin');
      } else if (typeof redirectTo === 'string' && redirectTo.length > 0) {
        navigate(redirectTo);
      } else {
        navigate('/dashboard');
      }
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
    <div className="login-page">
      <div className="login-page__container">
        <div className="login-page__avatar" />
        <div className="login-card">
          <h2 className="login-card__title">Sign in</h2>

          {error && <div className="alert alert-danger">{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group login-card__field">
              <label>Email or mobile phone number</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group login-card__field">
              <div className="login-card__label-row">
                <label>Your password</label>
                <button
                  type="button"
                  className="login-card__show-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-card__submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <p className="login-card__terms">
              By continuing, you agree to the <a href="/terms-and-conditions.txt" target="_blank" rel="noreferrer">Terms of use</a> and <a href="/terms-and-conditions.txt" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </p>

            <div className="login-card__links-row">
              <button
                type="button"
                className="login-card__text-link"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? 'Sending...' : 'Other issue with sign in'}
              </button>
              <Link to="/forgot-password" className="login-card__text-link">Forget your password</Link>
            </div>
          </form>

          <div className="login-card__divider"><span>New to our community</span></div>

          <Link to="/register" className="login-card__register-btn">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
