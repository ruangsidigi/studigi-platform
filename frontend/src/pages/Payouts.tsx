import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchaseService } from '../services/api';

const COMPLETED_STATUSES = ['paid', 'completed', 'success', 'settlement'];

export default function Payouts() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const response = await purchaseService.getAll();
        const items = Array.isArray(response.data) ? response.data : [];
        setTransactions(items);
        window.dispatchEvent(new CustomEvent('studigi:notifications-refresh'));
        setError('');
      } catch (loadErr) {
        setError('Gagal memuat riwayat transaksi.');
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []);

  const summary = useMemo(() => {
    const paid = transactions.filter((item) => COMPLETED_STATUSES.includes(String(item.payment_status || '').toLowerCase())).length;
    const pending = Math.max(transactions.length - paid, 0);
    return { total: transactions.length, paid, pending };
  }, [transactions]);

  const getStatusBadge = (statusRaw: string) => {
    const status = String(statusRaw || '').toLowerCase();
    if (COMPLETED_STATUSES.includes(status)) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Payouts</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">Riwayat transaksi (terbayar & belum terbayar).</p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-[var(--secondary-color,#69655e)]">Total Transaksi</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-[var(--secondary-color,#69655e)]">Sudah Terbayar</p>
          <p className="text-2xl font-semibold text-emerald-700">{summary.paid}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-[var(--secondary-color,#69655e)]">Belum Terbayar</p>
          <p className="text-2xl font-semibold text-amber-700">{summary.pending}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Riwayat Transaksi</h3>
          <button
            type="button"
            onClick={() => navigate('/payment')}
            className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white"
          >
            Halaman Pembayaran
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading riwayat transaksi...</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-slate-600">Belum ada transaksi.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const statusText = String(tx.payment_status || tx.status || 'pending').toUpperCase();
              return (
                <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tx.package_name || tx.packageName || `Paket #${tx.package_id || '-'}`}</p>
                    <p className="text-xs text-[var(--secondary-color,#69655e)]">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '-'}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--header-color,#103c21)]">
                      Rp {Number(tx.total_price || tx.totalPrice || 0).toLocaleString('id-ID')}
                    </p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(statusText)}`}>
                      {statusText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
