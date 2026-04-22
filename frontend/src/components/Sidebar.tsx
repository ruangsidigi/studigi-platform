import React, { useContext, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Activity,
  CreditCard,
  Settings,
  GraduationCap,
  MessageCircle,
  Star,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { brandingService } from '../services/api';

const BRANDING_LOGO_CACHE_KEY = 'brandingLogoUrl';

const extractBrandingPayload = (response: any) => {
  const raw = response?.data ?? response ?? {};
  if (raw?.settings && typeof raw.settings === 'object') return raw.settings;
  if (raw?.data && typeof raw.data === 'object') return raw.data;
  return raw;
};

const getApiOrigin = () => {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (configured) {
    try {
      const parsed = new URL(configured, window.location.origin);
      return parsed.origin;
    } catch (_) {}
  }
  return window.location.origin;
};

const normalizeLogoUrl = (value: any) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/api\//i.test(raw)) return `${window.location.origin}${raw}?t=${Date.now()}`;
  if (raw.startsWith('/')) return `${getApiOrigin()}${raw}`;
  return raw;
};

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/payouts', label: 'Transaction', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { user } = useContext(AuthContext as any) as any;
  const [logoUrl, setLogoUrl] = useState<string>('');
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const sidebarItems = isAdmin
    ? [{ to: '/admin', label: 'Dashboard Admin', icon: GraduationCap }, ...navItems]
    : navItems;

  useEffect(() => {
    const cachedLogo = normalizeLogoUrl(localStorage.getItem(BRANDING_LOGO_CACHE_KEY));
    if (cachedLogo) {
      setLogoUrl(cachedLogo);
    }

    const loadBranding = async () => {
      try {
        const response = await brandingService.getSettings();
        const settings = extractBrandingPayload(response);
        const nextLogo = normalizeLogoUrl(settings?.logoUrl || settings?.logo_url || settings?.logo || '');
        setLogoUrl(nextLogo);
        if (nextLogo) {
          localStorage.setItem(BRANDING_LOGO_CACHE_KEY, nextLogo);
        } else {
          localStorage.removeItem(BRANDING_LOGO_CACHE_KEY);
        }
      } catch (error) {
        const fallbackLogo = normalizeLogoUrl(localStorage.getItem(BRANDING_LOGO_CACHE_KEY));
        setLogoUrl(fallbackLogo);
      }
    };

    loadBranding();

    const handleBrandingUpdated = (event: any) => {
      const eventLogo = normalizeLogoUrl(event?.detail?.logoUrl);
      if (eventLogo) {
        setLogoUrl(eventLogo);
        localStorage.setItem(BRANDING_LOGO_CACHE_KEY, eventLogo);
        return;
      }
      loadBranding();
    };

    window.addEventListener('branding-updated', handleBrandingUpdated);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdated);
  }, []);

  return (
    <aside className="hidden shrink-0 border-r border-slate-200 bg-white md:block md:w-20 lg:w-64">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center border-b border-slate-200 px-3 py-4 lg:justify-start lg:px-5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Studigi logo"
              className="h-9 w-9 rounded-lg bg-white object-contain p-0.5"
              onError={() => {
                localStorage.removeItem(BRANDING_LOGO_CACHE_KEY);
                setLogoUrl('');
              }}
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
          <NavLink
            to="/rate"
            className={({ isActive }) =>
              [
                'mb-1 flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start',
                isActive
                  ? 'bg-[var(--header-color,#103c21)] text-white'
                  : 'text-[var(--secondary-color,#69655e)] hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <Star size={17} />
            <span className="hidden lg:inline">Rate</span>
          </NavLink>
          <NavLink
            to="/contact-us"
            className={({ isActive }) =>
              [
                'flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start',
                isActive
                  ? 'bg-[var(--header-color,#103c21)] text-white'
                  : 'text-[var(--secondary-color,#69655e)] hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <MessageCircle size={17} />
            <span className="hidden lg:inline">Contact Us</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
