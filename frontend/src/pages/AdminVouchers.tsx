import React, { useCallback, useEffect, useState } from 'react';
import { voucherService } from '../services/api';

type DiscountType = 'percentage' | 'fixed';

interface Voucher {
  id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_by_name: string | null;
  created_at: string;
}

interface RewardConfig {
  id: number;
  title: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  expires_in_days: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  code: '',
  description: '',
  discount_type: 'percentage' as DiscountType,
  discount_value: '',
  min_purchase: '',
  max_discount: '',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
};

const EMPTY_REWARD_FORM = {
  title: 'Reward Review & Testimoni',
  description: 'Voucher reward otomatis setelah peserta mengirim rating dan testimoni.',
  discount_type: 'percentage' as DiscountType,
  discount_value: '10',
  min_purchase: '15000',
  max_discount: '10000',
  expires_in_days: '7',
  is_active: true,
};

const formatRp = (n: number | null | undefined) =>
  n == null ? '-' : `Rp ${Number(n).toLocaleString('id-ID')}`;

const formatDate = (raw: string | null) => {
  if (!raw) return '-';
  try {
    return new Date(raw).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return raw;
  }
};

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [rewardConfig, setRewardConfig] = useState<RewardConfig | null>(null);
  const [rewardForm, setRewardForm] = useState({ ...EMPTY_REWARD_FORM });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [rewardSaving, setRewardSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [voucherRes, rewardRes] = await Promise.all([
        voucherService.getAll(),
        voucherService.getReviewRewardConfig().catch(() => ({ data: null })),
      ]);
      setVouchers(Array.isArray(voucherRes.data) ? voucherRes.data : []);
      const nextReward = rewardRes?.data || null;
      setRewardConfig(nextReward);
      if (nextReward) {
        setRewardForm({
          title: nextReward.title || EMPTY_REWARD_FORM.title,
          description: nextReward.description || '',
          discount_type: nextReward.discount_type || 'percentage',
          discount_value: String(nextReward.discount_value ?? EMPTY_REWARD_FORM.discount_value),
          min_purchase: String(nextReward.min_purchase ?? 0),
          max_discount: nextReward.max_discount != null ? String(nextReward.max_discount) : '',
          expires_in_days: String(nextReward.expires_in_days ?? 7),
          is_active: Boolean(nextReward.is_active),
        });
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal memuat daftar voucher');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setMessage('');
  };

  const openEdit = (v: Voucher) => {
    setForm({
      code: v.code,
      description: v.description || '',
      discount_type: v.discount_type,
      discount_value: String(v.discount_value),
      min_purchase: v.min_purchase ? String(v.min_purchase) : '',
      max_discount: v.max_discount ? String(v.max_discount) : '',
      max_uses: v.max_uses ? String(v.max_uses) : '',
      valid_from: v.valid_from ? v.valid_from.substring(0, 10) : '',
      valid_until: v.valid_until ? v.valid_until.substring(0, 10) : '',
      is_active: v.is_active,
    });
    setEditingId(v.id);
    setShowForm(true);
    setMessage('');
  };

  const handleSave = async () => {
    if (!form.code.trim()) { setMessage('Kode voucher wajib diisi.'); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      setMessage('Nilai diskon harus > 0.');
      return;
    }
    if (form.discount_type === 'percentage' && Number(form.discount_value) > 100) {
      setMessage('Diskon persentase tidak boleh melebihi 100.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_purchase: form.min_purchase ? Number(form.min_purchase) : 0,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
      };
      if (editingId) {
        await voucherService.update(editingId, payload);
        setMessage('Voucher berhasil diperbarui.');
      } else {
        await voucherService.create(payload);
        setMessage('Voucher berhasil dibuat.');
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal menyimpan voucher.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (v: Voucher) => {
    if (!window.confirm(`Nonaktifkan voucher "${v.code}"?`)) return;
    try {
      await voucherService.remove(v.id);
      setMessage(`Voucher "${v.code}" dinonaktifkan.`);
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal menonaktifkan voucher.');
    }
  };

  const handleSaveRewardConfig = async () => {
    if (!rewardForm.discount_value || Number(rewardForm.discount_value) <= 0) {
      setMessage('Nilai diskon reward harus lebih dari 0.');
      return;
    }
    if (rewardForm.discount_type === 'percentage' && Number(rewardForm.discount_value) > 100) {
      setMessage('Diskon reward persentase tidak boleh melebihi 100.');
      return;
    }
    if (!rewardForm.expires_in_days || Number(rewardForm.expires_in_days) <= 0) {
      setMessage('Masa berlaku reward harus minimal 1 hari.');
      return;
    }

    setRewardSaving(true);
    setMessage('');
    try {
      await voucherService.updateReviewRewardConfig({
        title: rewardForm.title.trim() || EMPTY_REWARD_FORM.title,
        description: rewardForm.description.trim() || null,
        discount_type: rewardForm.discount_type,
        discount_value: Number(rewardForm.discount_value),
        min_purchase: Number(rewardForm.min_purchase || 0),
        max_discount: rewardForm.max_discount ? Number(rewardForm.max_discount) : null,
        expires_in_days: Number(rewardForm.expires_in_days),
        is_active: rewardForm.is_active,
      });
      setMessage('Konfigurasi reward review berhasil disimpan.');
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || 'Gagal menyimpan konfigurasi reward review.');
    } finally {
      setRewardSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Kelola Voucher</h2>
          <p className="mt-0.5 text-sm text-slate-500">Buat dan kelola kode voucher potongan harga untuk pengguna.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Buat Voucher
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.includes('Gagal') || message.includes('tidak')
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-emerald-300 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Reward setelah Rate + Testimoni</h3>
            <p className="mt-1 text-sm text-slate-600">
              Atur diskon reward di sini. Saat aktif, peserta yang mengirim bintang dan testimoni akan menerima kode voucher unik dengan diskon 10% (min. pembelian Rp 15.000), hanya bisa dipakai oleh akun tersebut, dan otomatis punya masa berlaku.
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${rewardConfig?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
            {rewardConfig?.is_active ? 'Reward aktif' : 'Reward nonaktif'}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Judul Reward</label>
            <input
              type="text"
              value={rewardForm.title}
              onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--header-color,#103c21)]"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="reward_is_active"
              checked={rewardForm.is_active}
              onChange={(e) => setRewardForm({ ...rewardForm, is_active: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="reward_is_active" className="text-sm text-slate-700">Aktifkan reward review</label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Deskripsi</label>
            <textarea
              value={rewardForm.description}
              onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[var(--header-color,#103c21)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Tipe Diskon</label>
            <select
              value={rewardForm.discount_type}
              onChange={(e) => setRewardForm({ ...rewardForm, discount_type: e.target.value as DiscountType })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
            >
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Nilai Diskon</label>
            <input
              type="number"
              min="0"
              max={rewardForm.discount_type === 'percentage' ? 100 : undefined}
              value={rewardForm.discount_value}
              onChange={(e) => setRewardForm({ ...rewardForm, discount_value: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Min. Pembelian (Rp)</label>
            <input
              type="number"
              min="0"
              value={rewardForm.min_purchase}
              onChange={(e) => setRewardForm({ ...rewardForm, min_purchase: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Masa Berlaku (hari)</label>
            <input
              type="number"
              min="1"
              value={rewardForm.expires_in_days}
              onChange={(e) => setRewardForm({ ...rewardForm, expires_in_days: e.target.value })}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          {rewardForm.discount_type === 'percentage' && (
            <div>
              <label className="block text-xs font-medium text-slate-600">Maks. Diskon (Rp)</label>
              <input
                type="number"
                min="0"
                value={rewardForm.max_discount}
                onChange={(e) => setRewardForm({ ...rewardForm, max_discount: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveRewardConfig}
            disabled={rewardSaving}
            className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {rewardSaving ? 'Menyimpan...' : 'Simpan Reward Review'}
          </button>
          <p className="text-xs text-slate-500">
            Voucher reward selalu dibuat unik, kuota 1 kali, dan terkunci ke akun penerima.
          </p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Voucher' : 'Buat Voucher Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600">Kode Voucher *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: DISKON50"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--header-color,#103c21)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Deskripsi</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Contoh: Diskon spesial hari kemerdekaan"
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--header-color,#103c21)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Tipe Diskon *</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="percentage">Persentase (%)</option>
                    <option value="fixed">Nominal (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    Nilai Diskon * {form.discount_type === 'percentage' ? '(0–100)' : '(Rp)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.discount_type === 'percentage' ? 100 : undefined}
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Min. Pembelian (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_purchase}
                    onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                    placeholder="0"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                {form.discount_type === 'percentage' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600">Maks. Diskon (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.max_discount}
                      onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                      placeholder="Kosong = tidak ada batas"
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Maks. Penggunaan</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    placeholder="Kosong = tidak terbatas"
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-700">Aktif</label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Berlaku Dari</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Berlaku Hingga</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {message && (
                <p className="text-sm text-red-600">{message}</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Buat Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Memuat voucher...</p>
        ) : vouchers.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Belum ada voucher. Klik "Buat Voucher" untuk memulai.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Diskon</th>
                <th className="px-4 py-3">Min. Beli</th>
                <th className="px-4 py-3">Kuota</th>
                <th className="px-4 py-3">Berlaku</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{v.code}</p>
                    {v.description && (
                      <p className="text-xs text-slate-500">{v.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.discount_type === 'percentage'
                      ? `${v.discount_value}%${v.max_discount ? ` (maks. ${formatRp(v.max_discount)})` : ''}`
                      : formatRp(v.discount_value)}
                  </td>
                  <td className="px-4 py-3">{formatRp(v.min_purchase)}</td>
                  <td className="px-4 py-3">
                    {v.max_uses != null ? `${v.used_count}/${v.max_uses}` : `${v.used_count}/∞`}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {v.valid_from || v.valid_until
                      ? `${formatDate(v.valid_from)} – ${formatDate(v.valid_until)}`
                      : 'Selalu berlaku'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {v.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        className="text-xs font-medium text-[var(--header-color,#103c21)] hover:underline"
                      >
                        Edit
                      </button>
                      {v.is_active && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(v)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
