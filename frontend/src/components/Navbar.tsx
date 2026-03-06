import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, ShoppingCart, Search, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

interface NavbarProps {
  title: string;
  onMenuClick: () => void;
}

export default function Navbar({ title, onMenuClick }: NavbarProps) {
  const { user, logout } = useContext(AuthContext as any);
  const navigate = useNavigate();

  const cartCount = (() => {
    try {
      const raw = localStorage.getItem('studigi:cart');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (error) {
      return 0;
    }
  })();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 md:w-auto lg:w-[220px]">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
      </div>

      <div className="hidden flex-1 md:block">
        <div className="relative mx-auto max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari tryout..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--header-color,#103c21)] focus:outline-none"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Cart"
          onClick={() => navigate('/home')}
        >
          <ShoppingCart size={18} />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--header-color,#103c21)] px-1 text-[10px] font-semibold text-white">
              {cartCount}
            </span>
          )}
        </button>

        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-2xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Masuk
          </button>
        )}
      </div>
    </header>
  );
}
