import React from 'react';
import { Clock3, FileText, Play } from 'lucide-react';

const packageTypeLabel = {
  tryout: 'Tryout',
  latihan: 'Latihan',
  bundle: 'Bundle',
};

const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const TryoutPackageCard = ({ item, status = 'owned', onStart }) => {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base">{item.name}</h3>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-1 text-[11px] font-medium',
            status === 'owned'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700',
          ].join(' ')}
        >
          {status === 'owned' ? 'Aktif' : 'Pending'}
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-500">{packageTypeLabel[item.type] || 'Paket'}</p>
      <p className="mb-4 line-clamp-2 text-sm text-slate-600">{item.description || 'Paket latihan siap dikerjakan.'}</p>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <FileText size={13} />
          <span>{item.question_count || 0} soal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 size={13} />
          <span>{item.duration || '-'} menit</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-sm font-semibold text-[var(--header-color,#103c21)]">{formatRupiah(item.price)}</p>
        {status === 'owned' ? (
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--header-color,#103c21)] px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
          >
            <Play size={13} />
            Mulai
          </button>
        ) : (
          <span className="text-xs font-medium text-amber-700">Menunggu Pembayaran</span>
        )}
      </div>
    </div>
  );
};

export default TryoutPackageCard;
