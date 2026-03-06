import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/auth.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setLoading(true);
    try {
      const response = await authService.register(email, password, name);
      setSuccess(response.data?.message || 'Registrasi berhasil. Silakan cek email untuk verifikasi akun.');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-page__dot" />

      <div className="register-page__container">
        <h2 className="register-page__title">Create an account</h2>
        <p className="register-page__subtitle">
          Already have an acount? <Link to="/login">Log in</Link>
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="form-group register-form__field">
            <label>What should we call you?</label>
            <input
              type="text"
              placeholder="Enter your profile name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group register-form__field">
            <label>What's your email?</label>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group register-form__field">
            <div className="register-form__label-row">
              <label>Create a password</label>
              <button
                type="button"
                className="register-form__show-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <small className="register-form__hint">Use 8 or more characters with a mix of letters, numbers &amp; symbols</small>
          </div>

          <p className="register-form__terms">
            By creating an account, you agree to the <a href="/terms-and-conditions.txt" target="_blank" rel="noreferrer">Terms of use</a> and <a href="/terms-and-conditions.txt" target="_blank" rel="noreferrer">Privacy Policy</a>.
          </p>

          <button type="submit" className="register-form__submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create an account'}
          </button>
        </form>

        <button type="button" className="register-page__back-login" onClick={() => navigate('/login')}>
          Back to login
        </button>
      </div>
    </div>
  );
};

export default Register;
