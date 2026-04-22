import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, ShoppingCart, Search, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { purchaseService, reportService, voucherService } from '../services/api';

interface NavbarProps {
  title: string;
  onMenuClick: () => void;
}

type NotificationItem = {
  id: string;
  type: 'payment_success' | 'tryout_completed' | 'voucher_reward';
  title: string;
  message: string;
  createdAt: number;
  purchaseId?: number;
  attemptId?: number;
  voucherCode?: string;
};

const COMPLETED_PAYMENT_STATUSES = ['paid', 'completed', 'success', 'settlement'];

export default function Navbar({ title, onMenuClick }: NavbarProps) {
  const { user, logout } = useContext(AuthContext as any);
  const navigate = useNavigate();
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const getCartCount = () => {
    try {
      const raw = localStorage.getItem('studigi:cart');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (error) {
      return 0;
    }
  };

  useEffect(() => {
    setCartCount(getCartCount());

    const onCartUpdated = () => {
      setCartCount(getCartCount());
    };

    window.addEventListener('studigi:cart-updated', onCartUpdated);
    window.addEventListener('storage', onCartUpdated);
    return () => {
      window.removeEventListener('studigi:cart-updated', onCartUpdated);
      window.removeEventListener('storage', onCartUpdated);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchInput(params.get('q') || '');
  }, [location.pathname, location.search]);

  const hasToken = Boolean(localStorage.getItem('token'));

  const loadNotifications = useCallback(async () => {
    if (!hasToken) {
      setNotifications([]);
      return;
    }

    try {
      setNotifLoading(true);
      const [purchasesRes, historyRes, vouchersRes] = await Promise.all([
        purchaseService.getAll().catch(() => ({ data: [] })),
        reportService.getHistory(1, 8).catch(() => ({ data: { items: [] } })),
        voucherService.getMine().catch(() => ({ data: [] })),
      ]);

      const purchases = Array.isArray((purchasesRes as any)?.data) ? (purchasesRes as any).data : [];
      const historyItems = Array.isArray((historyRes as any)?.data?.items) ? (historyRes as any).data.items : [];
      const myVouchers = Array.isArray((vouchersRes as any)?.data) ? (vouchersRes as any).data : [];

      const paymentNotifications: NotificationItem[] = purchases
        .filter((purchase: any) => {
          const status = String(purchase?.payment_status || purchase?.status || '').toLowerCase();
          return COMPLETED_PAYMENT_STATUSES.includes(status);
        })
        .map((purchase: any) => {
          const packageName = purchase?.package_name || purchase?.packageName || `Paket #${purchase?.package_id || '-'}`;
          const createdAt = new Date(purchase?.created_at || Date.now()).getTime();
          return {
            id: `payment-${purchase.id}`,
            type: 'payment_success',
            title: 'Pembayaran Berhasil',
            message: `${packageName} sudah berhasil dibayar.`,
            createdAt,
            purchaseId: Number(purchase?.id || 0),
          };
        });

      const tryoutNotifications: NotificationItem[] = historyItems.map((attempt: any) => {
        const attemptId = Number(attempt?.attemptId || attempt?.id || 0);
        const packageName = attempt?.packageName || attempt?.package_name || 'Paket Tryout';
        const createdAt = new Date(attempt?.date || attempt?.finishedAt || Date.now()).getTime();
        return {
          id: `tryout-${attemptId}`,
          type: 'tryout_completed',
          title: 'Tryout Selesai',
          message: `${packageName} telah selesai dikerjakan.`,
          createdAt,
          attemptId,
        };
      });

      const voucherNotifications: NotificationItem[] = myVouchers
        .filter((voucher: any) => String(voucher?.reward_source || '') === 'review_reward')
        .map((voucher: any) => {
          const createdAt = new Date(voucher?.created_at || Date.now()).getTime();
          const packageName = voucher?.package_name || 'paket tryout';
          return {
            id: `voucher-${voucher.id}`,
            type: 'voucher_reward',
            title: 'Voucher Reward Review',
            message: `Kode ${voucher.code} untuk ${packageName} sudah aktif dan hanya bisa dipakai akun Anda.`,
            createdAt,
            voucherCode: voucher.code,
          };
        });

      const merged = [...paymentNotifications, ...tryoutNotifications, ...voucherNotifications]
        .filter((item) => Number.isFinite(item.createdAt))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);

      setNotifications(merged);
    } finally {
      setNotifLoading(false);
    }
  }, [hasToken]);

  useEffect(() => {
    if (!hasToken) return;
    loadNotifications();
    const refresh = () => loadNotifications();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('studigi:notifications-refresh', refresh as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('studigi:notifications-refresh', refresh as EventListener);
    };
  }, [hasToken, loadNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [notifOpen]);

  const applySearchToHome = (keyword: string, forceToHome = false) => {
    const params = new URLSearchParams(forceToHome ? '' : location.search);
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword) {
      params.set('q', trimmedKeyword);
    } else {
      params.delete('q');
    }

    const nextSearch = params.toString();
    const nextPath = '/home';
    const target = nextSearch ? `${nextPath}?${nextSearch}` : nextPath;

    if (forceToHome || location.pathname !== '/home') {
      navigate(target);
      return;
    }

    navigate(target, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const onClickNotification = (item: NotificationItem) => {
    setNotifOpen(false);
    if (item.type === 'payment_success') {
      navigate('/payouts');
      return;
    }

    if (item.type === 'voucher_reward') {
      const query = item.voucherCode ? `?code=${encodeURIComponent(item.voucherCode)}` : '';
      navigate(`/my-vouchers${query}`);
      return;
    }

    if (item.type === 'tryout_completed' && item.attemptId) {
      navigate(`/dashboard/report?attemptId=${item.attemptId}`);
    }
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
            value={searchInput}
            onChange={(event) => {
              const value = event.target.value;
              setSearchInput(value);
              if (location.pathname === '/home') {
                applySearchToHome(value);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applySearchToHome(searchInput, true);
              }
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--header-color,#103c21)] focus:outline-none"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Notifications"
            onClick={() => {
              const nextOpen = !notifOpen;
              setNotifOpen(nextOpen);
              if (nextOpen) {
                loadNotifications();
              }
            }}
          >
            <Bell size={18} />
            {notifications.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-30 mt-2 w-[320px] max-w-[85vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Notifikasi</p>
                <p className="text-xs text-slate-500">Pembayaran dan hasil tryout terbaru</p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <p className="px-4 py-3 text-sm text-slate-600">Memuat notifikasi...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-600">Belum ada notifikasi.</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onClickNotification(item)}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--header-color,#103c21)]">
                        {item.type === 'payment_success' ? 'Pembayaran' : item.type === 'voucher_reward' ? 'Voucher' : 'Tryout'}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{item.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString('id-ID')}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Cart"
          onClick={() => navigate('/home#cart-widget')}
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
