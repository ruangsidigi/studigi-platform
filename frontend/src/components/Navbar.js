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
    navigate('/home');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/home" className="navbar-logo">
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
          <Link to="/home" className="navbar-link">
            Home
          </Link>
          <Link to="/dashboard/packages" className="navbar-link">
            Dashboard
          </Link>

          {user ? (
            <>
              <span className="navbar-user">Hi, {user.name}</span>
              {user.role === 'admin' && (
                <Link to="/admin" className="navbar-link">
                  Admin Dashboard
                </Link>
              )}
              <button onClick={handleLogout} className="navbar-logout">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="navbar-link">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
