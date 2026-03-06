import React from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';

export interface CartItem {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface CartWidgetProps {
  items: CartItem[];
  onRemove: (id: number) => void;
  onCheckout: () => void;
}

export default function CartWidget({ items, onRemove, onCheckout }: CartWidgetProps) {
  const totalPrice = items.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return (
    <aside id="cart-widget" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--header-color,#103c21)] text-white">
          <ShoppingCart size={16} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Cart</h3>
          <p className="text-xs text-[var(--secondary-color,#69655e)]">Paket yang akan dibeli</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Keranjang masih kosong.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                    aria-label={`Hapus ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--secondary-color,#69655e)]">{item.category}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--header-color,#103c21)]">
                  Rp {Number(item.price || 0).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-[var(--secondary-color,#69655e)]">Total Harga</span>
              <span className="font-semibold text-[var(--header-color,#103c21)]">
                Rp {totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Checkout
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
