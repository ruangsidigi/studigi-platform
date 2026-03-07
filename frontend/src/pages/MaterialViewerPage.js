import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { materialService } from '../services/api';

const MaterialViewerPage = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const backTo = useMemo(() => {
    const stateBackTo = location?.state?.backTo;
    return typeof stateBackTo === 'string' && stateBackTo.trim() ? stateBackTo : null;
  }, [location]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await materialService.downloadFile(materialId);
        const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/pdf' });
        objectUrl = window.URL.createObjectURL(blob);

        if (active) {
          setPdfUrl(objectUrl);
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.error || 'Materi tidak dapat dibuka saat ini.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [materialId]);

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-4">
      <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Viewer PDF</h2>
          <p className="text-xs text-slate-500 sm:text-sm">Materi #{materialId}</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={handleBack}
        >
          Kembali
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Membuka PDF...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : (
          <iframe
            title={`material-${materialId}`}
            src={pdfUrl}
            className="h-[72vh] w-full rounded-xl border border-slate-200"
          />
        )}
      </section>
    </div>
  );
};

export default MaterialViewerPage;
