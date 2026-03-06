import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';

const titleMap = {
  '/dashboard/packages': 'Dashboard',
  '/my-materials': 'Tryout Library',
  '/dashboard/adaptive': 'Adaptive Learning',
  '/dashboard/report': 'Laporan Belajar',
};

const Navbar = ({ onOpenSidebar }) => {
  const location = useLocation();

  const pageTitle = useMemo(() => {
    if (titleMap[location.pathname]) return titleMap[location.pathname];
    if (location.pathname.startsWith('/quiz/')) return 'Tryout Session';
    if (location.pathname.startsWith('/results/')) return 'Hasil Tryout';
    return 'Studigi';
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{pageTitle}</h1>
      </div>

      <button
        type="button"
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
      </button>
    </header>
  );
};

export default Navbar;
