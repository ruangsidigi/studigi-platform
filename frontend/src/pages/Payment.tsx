import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService, voucherService } from '../services/api';
import { CartItem } from '../components/CartWidget.tsx';

export default function Payment() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [modalTermsAccepted, setModalTermsAccepted] = useState(false);

  // Voucher state
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    description: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('studigi:cart') || '[]');
      setCartItems(Array.isArray(stored) ? stored : []);
    } catch (readErr) {
      setCartItems([]);
    }
  }, []);

  const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const finalPrice = appliedVoucher ? appliedVoucher.finalAmount : totalPrice;

  const applyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherError('Masukkan kode voucher terlebih dahulu.');
      return;
    }
    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await voucherService.validate(code, totalPrice);
      const data = res.data || {};
      setAppliedVoucher({
        code: data.code,
        description: data.description || '',
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
      });
      setVoucherInput('');
    } catch (vErr: any) {
      setVoucherError(vErr?.response?.data?.error || 'Kode voucher tidak valid.');
      setAppliedVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError('');
    setVoucherInput('');
  };

  const processPayment = async (options?: { forceTermsAccepted?: boolean }) => {
    if (cartItems.length === 0) {
      setError('Cart masih kosong.');
      return;
    }

    if (!(options?.forceTermsAccepted || termsAccepted)) {
      setError('Syarat & ketentuan harus disetujui sebelum checkout.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const packageIds = cartItems.map((item) => item.id);
      const response = await paymentService.checkout(packageIds, 'midtrans', {
        reason: 'checkout',
        totalPrice: finalPrice,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: 'v1',
        ...(appliedVoucher ? { voucherCode: appliedVoucher.code } : {}),
      });

      const payload = response.data || {};
      const payment = payload.payment || payload.purchase || payload;
      const paymentUrl = payment?.payment_url || payment?.redirect_url || payload?.payment_url || payload?.redirect_url;

      if (!paymentUrl) {
        throw new Error('URL Midtrans tidak tersedia.');
      }

      localStorage.removeItem('studigi:cart');
      window.dispatchEvent(new CustomEvent('studigi:cart-updated', { detail: { count: 0 } }));
      window.location.href = paymentUrl;
    } catch (payErr: any) {
      setError(payErr?.response?.data?.error || payErr?.message || 'Gagal membuat pembayaran Midtrans.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayMidtrans = () => {
    if (cartItems.length === 0) {
      setError('Cart masih kosong.');
      return;
    }

    if (!termsAccepted) {
      setError('');
      setModalTermsAccepted(false);
      setShowTermsModal(true);
      return;
    }

    processPayment();
  };

  const handleConfirmTerms = async () => {
    if (!modalTermsAccepted) return;
    setTermsAccepted(true);
    setError('');
    setShowTermsModal(false);
    setModalTermsAccepted(false);
    await processPayment({ forceTermsAccepted: true });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Halaman Pembayaran</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
          Metode pembayaran menggunakan Midtrans.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {cartItems.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Keranjang kosong. Silakan pilih paket dari menu Home.</p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white"
            >
              Kembali ke Home
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-[var(--secondary-color,#69655e)]">{item.category}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--header-color,#103c21)]">
                    Rp {Number(item.price || 0).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>

            {/* Voucher input */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Kode Voucher</p>
              {appliedVoucher ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{appliedVoucher.code}</p>
                    {appliedVoucher.description && (
                      <p className="text-xs text-emerald-700">{appliedVoucher.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeVoucher}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                    placeholder="Masukkan kode voucher"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[var(--header-color,#103c21)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyVoucher}
                    disabled={voucherLoading}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    {voucherLoading ? '...' : 'Terapkan'}
                  </button>
                </div>
              )}
              {voucherError && <p className="mt-1 text-xs text-red-600">{voucherError}</p>}
            </div>

            {/* Price summary */}
            <div className="mt-4 space-y-1 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--secondary-color,#69655e)]">Subtotal</span>
                <span className="text-sm text-slate-700">Rp {totalPrice.toLocaleString('id-ID')}</span>
              </div>
              {appliedVoucher && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-sm">Diskon Voucher ({appliedVoucher.code})</span>
                  <span className="text-sm font-semibold">
                    − Rp {appliedVoucher.discountAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                <span className="text-sm font-semibold text-slate-800">Total Bayar</span>
                <span className="text-lg font-semibold text-[var(--header-color,#103c21)]">
                  Rp {finalPrice.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="mt-3 text-sm font-medium text-[var(--header-color,#103c21)] underline"
            >
              Lihat syarat & ketentuan pembelian paket
            </button>

            {termsAccepted && (
              <p className="mt-2 text-sm text-emerald-700">Syarat & ketentuan sudah disetujui.</p>
            )}

            <button
              type="button"
              onClick={handlePayMidtrans}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Memproses pembayaran...' : 'Bayar sekarang'}
            </button>
          </>
        )}
      </section>

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Syarat & Ketentuan Pembelian Paket</h3>
                <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
                  Baca dan setujui ketentuan berikut sebelum melanjutkan pembayaran.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <p>1. Paket yang sudah dibeli tidak dapat dibatalkan atau diuangkan kembali.</p>
              <p>2. Akses paket aktif otomatis setelah pembayaran dikonfirmasi oleh sistem Midtrans.</p>
              <p>3. Akun dan akses paket tidak boleh dipindahkan atau dibagikan ke pihak lain.</p>
              <p>4. Jika terjadi kendala teknis pembayaran, pengguna wajib menyimpan bukti transaksi.</p>
              <p>5. Dengan melanjutkan pembayaran, pengguna dianggap menyetujui seluruh ketentuan yang berlaku.</p>
              <p>
                Dokumen lengkap dapat dilihat di{' '}
                <a
                  href="/terms-and-conditions.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--header-color,#103c21)] underline"
                >
                  Terms & Conditions (PDF)
                </a>
                .
              </p>
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm text-[var(--secondary-color,#69655e)]">
              <input
                type="checkbox"
                checked={modalTermsAccepted}
                onChange={(event) => setModalTermsAccepted(event.target.checked)}
                className="mt-1"
              />
              <span>Saya sudah membaca dan menyetujui syarat & ketentuan pembelian paket.</span>
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmTerms}
                disabled={!modalTermsAccepted || loading}
                className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Setuju & Lanjutkan Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
