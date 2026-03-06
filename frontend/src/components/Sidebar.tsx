import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Activity, CreditCard, Settings, GraduationCap } from 'lucide-react';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/payouts', label: 'Payouts', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="hidden shrink-0 border-r border-slate-200 bg-white md:block md:w-20 lg:w-64">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center border-b border-slate-200 px-3 py-4 lg:justify-start lg:px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--header-color,#103c21)] text-white">
            <GraduationCap size={18} />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900">Studigi</p>
            <p className="text-xs text-slate-500">Tryout Platform</p>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start',
                  isActive
                    ? 'bg-[var(--header-color,#103c21)] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <Icon size={17} />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
