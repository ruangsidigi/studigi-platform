import React from 'react';
import { NavLink } from 'react-router-dom';
import './dashboard-submenu.css';

const DashboardSubmenu = () => {
  return (
    <div className="dashboard-submenu" role="tablist" aria-label="Dashboard submenu">
      <NavLink
        to="/dashboard/packages"
        className={({ isActive }) => `dashboard-submenu-link ${isActive ? 'active' : ''}`}
      >
        Paket Saya
      </NavLink>
      <NavLink
        to="/dashboard/adaptive"
        className={({ isActive }) => `dashboard-submenu-link ${isActive ? 'active' : ''}`}
      >
        Adaptive Learning
      </NavLink>
      <NavLink
        to="/dashboard/report"
        className={({ isActive }) => `dashboard-submenu-link ${isActive ? 'active' : ''}`}
      >
        Report
      </NavLink>
    </div>
  );
};

export default DashboardSubmenu;
