import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

const titleMap = {
  '/admin': 'Dashboard Admin',
  '/admin/cms/library': 'Content Library',
  '/admin/cms/upload': 'Upload Center',
  '/admin/cms/workflow': 'Workflow Approval',
  '/admin/cms/bundles': 'Bundle Builder',
};

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => titleMap[location.pathname] || 'Admin', [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open admin sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{pageTitle}</h1>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
