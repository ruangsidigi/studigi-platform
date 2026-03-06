import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  LineChart,
  BrainCircuit,
  LogOut,
  GraduationCap,
  X,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';

const menuItems = [
  { to: '/dashboard/packages', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-materials', label: 'Tryout Library', icon: BookOpen },
  { to: '/dashboard/adaptive', label: 'Adaptive', icon: BrainCircuit },
  { to: '/dashboard/report', label: 'Reports', icon: LineChart },
];

const baseLinkClass =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar backdrop"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--header-color,#103c21)] text-white">
                <GraduationCap size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Studigi</p>
                <p className="text-xs text-slate-500">Learning Portal</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {menuItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    baseLinkClass,
                    isActive
                      ? 'bg-[var(--header-color,#103c21)] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
                onClick={onClose}
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-3">
            {user && (
              <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="truncate font-medium text-slate-900">{user.name}</p>
                <p className="truncate">{user.email}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
