import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './navbar.css';

const Navbar = ({ branding }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [branding?.logoUrl]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          {branding?.logoUrl && !logoFailed ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              onError={() => setLogoFailed(true)}
              className="navbar-logo-img"
            />
          ) : (
            'Studigi'
          )}
        </Link>
        <div className="navbar-menu">
          {user ? (
            <>
              <span className="navbar-user">Hi, {user.name}</span>
              {user.role === 'admin' && (
                <Link to="/admin" className="navbar-link">
                  Admin Dashboard
                </Link>
              )}
              <Link to="/dashboard" className="navbar-link">
                Dashboard
              </Link>
              <Link to="/reports" className="navbar-link">
                Report
              </Link>
              <button onClick={handleLogout} className="navbar-logout">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                Login
              </Link>
              <Link to="/register" className="navbar-link">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
