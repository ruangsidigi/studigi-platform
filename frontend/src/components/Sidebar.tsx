import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Activity,
  CreditCard,
  Settings,
  GraduationCap,
  LogIn,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { brandingService } from '../services/api';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/payouts', label: 'Payouts', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext as any);
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string>('');
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const sidebarItems = isAdmin
    ? [{ to: '/admin', label: 'Dashboard Admin', icon: GraduationCap }, ...navItems]
    : navItems;

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await brandingService.getSettings();
        const settings = response?.data || {};
        setLogoUrl(String(settings.logoUrl || '').trim());
      } catch (error) {
        setLogoUrl('');
      }
    };

    loadBranding();

    const handleBrandingUpdated = () => {
      loadBranding();
    };

    window.addEventListener('branding-updated', handleBrandingUpdated);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdated);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden shrink-0 border-r border-slate-200 bg-white md:block md:w-20 lg:w-64">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center border-b border-slate-200 px-3 py-4 lg:justify-start lg:px-5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Studigi logo"
              className="h-9 w-9 rounded-lg object-cover"
              onError={() => setLogoUrl('')}
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--header-color,#103c21)] text-white">
              <GraduationCap size={18} />
            </div>
          )}
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900">Studigi</p>
            <p className="text-xs text-[var(--secondary-color,#69655e)]">Tryout Platform</p>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          <p className="hidden px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-[var(--secondary-color,#69655e)] lg:block">Menu</p>
          {sidebarItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start',
                  isActive
                    ? 'bg-[var(--header-color,#103c21)] text-white'
                    : 'text-[var(--secondary-color,#69655e)] hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <Icon size={17} />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-200 p-3">
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 lg:justify-start"
            >
              <LogOut size={17} />
              <span className="hidden lg:inline">Logout</span>
            </button>
          ) : (
            <>
              <NavLink
                to="/login"
                className="mb-1 flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--secondary-color,#69655e)] transition-colors hover:bg-slate-100 hover:text-slate-900 lg:justify-start"
              >
                <LogIn size={17} />
                <span className="hidden lg:inline">Login</span>
              </NavLink>
              <NavLink
                to="/register"
                className="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--secondary-color,#69655e)] transition-colors hover:bg-slate-100 hover:text-slate-900 lg:justify-start"
              >
                <UserPlus size={17} />
                <span className="hidden lg:inline">Sign Up</span>
              </NavLink>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
