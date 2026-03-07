import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, FolderOpen, PlayCircle } from 'lucide-react';
import { materialService } from '../services/api';
import DashboardStatCard from '../components/dashboard/DashboardStatCard';

const UserMaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await materialService.listMyMaterials();
      setMaterials(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat materi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const handleOpenMaterial = async (materialId) => {
    try {
      const response = await materialService.downloadFile(materialId);
      const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60 * 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Tidak bisa membuka materi.');
    }
  };

  const stats = useMemo(() => {
    const materialsWithDescription = materials.filter((item) => item.description).length;
    const packageCoverage = new Set(
      materials.flatMap((item) => (item.attached_packages || []).map((pkg) => String(pkg.package_id)))
    ).size;

    return [
      {
        title: 'Total Materi',
        value: materials.length,
        helper: 'Materi yang dapat diakses',
        icon: BookOpen,
      },
      {
        title: 'Punya Deskripsi',
        value: materialsWithDescription,
        helper: 'Materi dengan info lengkap',
        icon: FileText,
      },
      {
        title: 'Cakupan Paket',
        value: packageCoverage,
        helper: 'Jumlah paket terkait',
        icon: FolderOpen,
      },
    ];
  }, [materials]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading library...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Tryout Library</h2>
        <p className="mt-1 text-sm text-slate-600">Semua materi belajar dari paket tryout yang sudah kamu miliki.</p>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Daftar Materi</h3>
          <p className="text-xs text-slate-500 sm:text-sm">{materials.length} item</p>
        </div>

        {materials.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Belum ada materi untuk paket yang kamu beli.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {materials.map((material) => {
              const packageLabels = (material.attached_packages || []).map(
                (item) => item.package?.name || `#${item.package_id}`
              );

              return (
                <article key={material.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--header-color,#103c21)]">
                    Materi
                  </p>
                  <h4 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900 sm:text-base">{material.title}</h4>
                  <p className="mb-3 line-clamp-3 text-sm text-slate-600">{material.description || 'Tanpa deskripsi materi.'}</p>

                  <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="mb-1 font-medium text-slate-700">Paket Terkait</p>
                    <p className="line-clamp-2">{packageLabels.join(', ') || '-'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenMaterial(material.id)}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--header-color,#103c21)] px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                  >
                    <PlayCircle size={14} />
                    Buka PDF
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default UserMaterialsPage;
