import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, BrainCircuit, LineChart } from 'lucide-react';

const navItems = [
  { to: '/dashboard/packages', label: 'Home', icon: LayoutDashboard },
  { to: '/my-materials', label: 'Library', icon: BookOpen },
  { to: '/dashboard/adaptive', label: 'Adaptive', icon: BrainCircuit },
  { to: '/dashboard/report', label: 'Reports', icon: LineChart },
];

const BottomNav = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white lg:hidden">
      <div className="grid grid-cols-4">
        {navItems.map(({ to, label, icon: Icon }) => (
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
  );
};

export default BottomNav;
