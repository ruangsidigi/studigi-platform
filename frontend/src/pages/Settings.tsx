import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { authService, userService } from '../services/api';

const initialForm = {
  name: '',
  location: '',
  email: '',
  bio: '',
};

export default function Settings() {
  const { user } = useContext(AuthContext as any);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setForm(initialForm);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await userService.getProfile();
        const profile = response.data || {};
        setForm({
          name: String(profile.name || ''),
          location: String(profile.location || ''),
          email: String(profile.email || ''),
          bio: String(profile.bio || ''),
        });
      } catch (loadErr) {
        setError('Gagal memuat data akun.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await userService.updateProfile(form);
      setMessage('Profil berhasil diperbarui.');
    } catch (saveErr) {
      setError('Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!form.email) {
      setError('Email belum tersedia.');
      return;
    }

    try {
      setSendingReset(true);
      setError('');
      setMessage('');
      await authService.forgotPassword(form.email);
      setMessage('Link reset password telah dikirim ke email Anda.');
    } catch (resetErr) {
      setError('Gagal mengirim reset password.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
          Pengaturan akun peserta: nama, lokasi, email, bio, dan reset password.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {loading ? (
          <p className="text-sm text-slate-600">Loading profile...</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nama</label>
                <input
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lokasi</label>
                <input
                  value={form.location}
                  onChange={(event) => handleChange('location', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Bio</label>
              <textarea
                rows={4}
                value={form.bio}
                onChange={(event) => handleChange('bio', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--header-color,#103c21)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>

              <button
                type="button"
                disabled={sendingReset}
                onClick={handleResetPassword}
                className="rounded-xl border border-[var(--secondary-color,#69655e)] px-4 py-2 text-sm font-semibold text-[var(--secondary-color,#69655e)] disabled:opacity-60"
              >
                {sendingReset ? 'Mengirim...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
