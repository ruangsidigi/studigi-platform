import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '../services/api';
import { CartItem } from '../components/CartWidget.tsx';

export default function Payment() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('studigi:cart') || '[]');
      setCartItems(Array.isArray(stored) ? stored : []);
    } catch (readErr) {
      setCartItems([]);
    }
  }, []);

  const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

  const handlePayMidtrans = async () => {
    if (cartItems.length === 0) {
      setError('Cart masih kosong.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const packageIds = cartItems.map((item) => item.id);
      const response = await paymentService.checkout(packageIds, 'midtrans', {
        reason: 'checkout',
        totalPrice,
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

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-sm text-[var(--secondary-color,#69655e)]">Total Harga</span>
              <span className="text-lg font-semibold text-[var(--header-color,#103c21)]">
                Rp {totalPrice.toLocaleString('id-ID')}
              </span>
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <button
              type="button"
              onClick={handlePayMidtrans}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Memproses pembayaran...' : 'Bayar dengan Midtrans'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
