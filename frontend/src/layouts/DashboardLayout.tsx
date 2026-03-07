import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, Home, BookOpen, Activity, CreditCard, Settings } from 'lucide-react';
import Sidebar from '../components/Sidebar.tsx';
import Navbar from '../components/Navbar.tsx';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const mobileItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/payouts', label: 'Payouts', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const titles: Record<string, string> = {
  '/home': 'Marketplace Tryout',
  '/library': 'Tryout Library',
  '/activity': 'Activity',
  '/payouts': 'Payouts',
  '/settings': 'Settings',
  '/payment': 'Payment',
  '/contact-us': 'Contact Us',
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useContext(AuthContext as any);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const drawerItems = isAdmin
    ? [{ to: '/admin', label: 'Dashboard Admin', icon: Home }, ...mobileItems]
    : mobileItems;

  const pageTitle = useMemo(() => titles[location.pathname] || 'Dashboard', [location.pathname]);
  const resolvedTitle = useMemo(() => {
    if (/^\/materials\/\d+\/view$/i.test(location.pathname)) return 'PDF Viewer';
    return pageTitle;
  }, [location.pathname, pageTitle]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />

        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="h-full w-64 bg-white p-3" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between px-1 py-2">
                <p className="text-sm font-semibold text-slate-900">Navigation</p>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={16} />
                </button>
              </div>
              <nav className="space-y-1">
                {drawerItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[var(--header-color,#103c21)] text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    <Icon size={17} />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar title={resolvedTitle} onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-5 sm:px-5 md:px-6 md:py-6 lg:px-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden">
        <div className="grid grid-cols-5">
          {mobileItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-[var(--header-color,#103c21)]' : 'text-slate-500',
                ].join(' ')
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
