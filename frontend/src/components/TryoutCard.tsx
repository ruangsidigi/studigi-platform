import React from 'react';
import { Clock3, FileText, Star } from 'lucide-react';

interface TryoutCardProps {
  title: string;
  description: string;
  questions: number;
  duration: number;
  rating?: number;
  category?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function TryoutCard({
  title,
  description,
  questions,
  duration,
  rating = 4.8,
  category = 'CPNS',
  actionLabel = 'Lihat Detail',
  onAction,
}: TryoutCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{category}</span>
        <div className="flex items-center gap-1 text-xs text-amber-500">
          <Star size={13} className="fill-amber-400" />
          <span className="font-medium">{rating}</span>
        </div>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <FileText size={13} />
          <span>{questions} soal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 size={13} />
          <span>{duration} menit</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="mt-auto inline-flex items-center justify-center rounded-xl bg-[var(--header-color,#103c21)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        {actionLabel}
      </button>
    </article>
  );
}
