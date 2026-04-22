import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Copy, TicketPercent } from 'lucide-react';
import { voucherService } from '../services/api';

type VoucherItem = {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  valid_until: string | null;
  is_active: boolean;
  reward_source: string | null;
  package_name?: string | null;
};

const formatRp = (value: number | null | undefined) =>
  `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const formatValidUntil = (raw: string | null) => {
  if (!raw) return '-';
  try {
    return new Date(raw).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return raw;
  }
};

export default function MyVouchers() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [copiedCode, setCopiedCode] = useState('');

  const selectedCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('code') || '').trim().toUpperCase();
  }, [location.search]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await voucherService.getMine();
        const rows = Array.isArray(response?.data) ? response.data : [];
        setVouchers(rows.filter((item: VoucherItem) => String(item?.reward_source || '') === 'review_reward'));
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Gagal memuat voucher Anda.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? '' : prev));
      }, 1400);
    } catch (_) {
      setError('Tidak bisa menyalin kode voucher dari browser ini.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <TicketPercent size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Voucher Saya</h2>
            <p className="mt-1 text-sm text-slate-600">
              Buka detail voucher reward dari notifikasi, lalu klik tombol copy untuk langsung pakai di checkout.
            </p>
          </div>
        </div>
      </div>

      {selectedCode && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Voucher dari notifikasi: <span className="font-semibold tracking-wide">{selectedCode}</span>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">Memuat voucher...</div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">Belum ada voucher reward.</div>
      ) : (
        <div className="space-y-3">
          {vouchers.map((voucher) => {
            const isSelected = selectedCode && selectedCode === String(voucher.code || '').toUpperCase();
            return (
              <div
                key={voucher.id}
                className={[
                  'rounded-2xl border bg-white p-4 sm:p-5',
                  isSelected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Kode Voucher</p>
                    <p className="mt-1 text-xl font-bold tracking-wide text-slate-900">{voucher.code}</p>
                    {voucher.package_name ? (
                      <p className="mt-1 text-xs text-slate-500">Reward untuk {voucher.package_name}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyCode(voucher.code)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedCode === voucher.code ? <Check size={15} /> : <Copy size={15} />}
                    {copiedCode === voucher.code ? 'Tersalin' : 'Copy Kode'}
                  </button>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <p>
                    Diskon:{' '}
                    <span className="font-semibold">
                      {voucher.discount_type === 'percentage'
                        ? `${voucher.discount_value}%${voucher.max_discount ? ` (maks ${formatRp(voucher.max_discount)})` : ''}`
                        : formatRp(voucher.discount_value)}
                    </span>
                  </p>
                  <p>
                    Min. Pembelian: <span className="font-semibold">{formatRp(voucher.min_purchase)}</span>
                  </p>
                  <p>
                    Berlaku Hingga: <span className="font-semibold">{formatValidUntil(voucher.valid_until)}</span>
                  </p>
                  <p>
                    Status:{' '}
                    <span className={`font-semibold ${voucher.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {voucher.is_active ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </p>
                </div>

                {voucher.description ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{voucher.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
