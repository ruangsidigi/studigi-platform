import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js';
import { materialService } from '../services/api';

GlobalWorkerOptions.workerSrc = pdfWorker;

const clampZoom = (value) => Math.max(0.6, Math.min(2.2, Number(value) || 1));

const MaterialViewerPage = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [pdfData, setPdfData] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [zoom, setZoom] = useState(1.25);
  const [mode, setMode] = useState('scroll'); // scroll | book
  const [bookStartPage, setBookStartPage] = useState(1);

  const backTo = useMemo(() => {
    const stateBackTo = location?.state?.backTo;
    return typeof stateBackTo === 'string' && stateBackTo.trim() ? stateBackTo : null;
  }, [location]);

  const totalPages = pdfDoc?.numPages || 0;

  useEffect(() => {
    let active = true;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await materialService.downloadFile(materialId);
        const blob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/pdf' });
        const arrayBuffer = await blob.arrayBuffer();

        if (active) {
          setPdfData(new Uint8Array(arrayBuffer));
          setBookStartPage(1);
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
    };
  }, [materialId]);

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      if (!pdfData) return;

      try {
        setRendering(true);
        const loadingTask = getDocument({ data: pdfData });
        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError('PDF gagal diproses. File mungkin rusak atau tidak didukung.');
        }
      } finally {
        if (active) {
          setRendering(false);
        }
      }
    };

    loadDocument();

    return () => {
      active = false;
    };
  }, [pdfData]);

  useEffect(() => {
    let active = true;

    const renderAllPages = async () => {
      if (!pdfDoc) return;

      try {
        setRendering(true);
        const nextPages = [];

        for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
          const page = await pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: clampZoom(zoom) });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          await page.render({
            canvasContext: context,
            viewport,
          }).promise;

          if (!active) return;

          nextPages.push({
            pageNumber,
            src: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (active) {
          setPages(nextPages);
        }
      } catch (_) {
        if (active) {
          setError('Gagal merender halaman PDF.');
        }
      } finally {
        if (active) {
          setRendering(false);
        }
      }
    };

    renderAllPages();

    return () => {
      active = false;
    };
  }, [pdfDoc, zoom]);

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  const bookLeft = pages.find((item) => item.pageNumber === bookStartPage) || null;
  const bookRight = pages.find((item) => item.pageNumber === bookStartPage + 1) || null;
  const canBookPrev = bookStartPage > 1;
  const canBookNext = bookStartPage + 2 <= totalPages;

  const goBookPrev = () => {
    setBookStartPage((prev) => Math.max(1, prev - 2));
  };

  const goBookNext = () => {
    setBookStartPage((prev) => {
      const candidate = prev + 2;
      if (candidate > totalPages) return prev;
      return candidate;
    });
  };

  const handleZoomOut = () => setZoom((prev) => clampZoom(prev - 0.1));
  const handleZoomIn = () => setZoom((prev) => clampZoom(prev + 0.1));
  const handleFitWidth = () => setZoom(1.25);

  return (
    <div className="w-full max-w-none space-y-4 pb-4">
      <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Viewer PDF</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Materi #{materialId}{totalPages ? ` • ${totalPages} halaman` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${mode === 'scroll' ? 'bg-[var(--header-color,#103c21)] text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setMode('scroll')}
          >
            Mode Scroll
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${mode === 'book' ? 'bg-[var(--header-color,#103c21)] text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            onClick={() => setMode('book')}
          >
            Mode Buku
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={handleBack}
          >
            Kembali
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <button type="button" onClick={handleZoomOut} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">-</button>
        <span className="min-w-[70px] text-center text-sm font-medium text-slate-700">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={handleZoomIn} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">+</button>
        <button type="button" onClick={handleFitWidth} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Fit Layar</button>

        {mode === 'book' && (
          <>
            <div className="mx-1 h-6 w-px bg-slate-200" />
            <button type="button" onClick={goBookPrev} disabled={!canBookPrev} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
            <span className="text-sm text-slate-600">Hal. {bookStartPage}{bookRight ? `-${bookStartPage + 1}` : ''}</span>
            <button type="button" onClick={goBookNext} disabled={!canBookNext} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
        {loading || rendering ? (
          <div className="p-6 text-sm text-slate-600">Membuka PDF...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : (
          <div className="h-[calc(100vh-260px)] min-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-4">
            {mode === 'scroll' ? (
              <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center gap-4">
                {pages.map((page) => (
                  <img
                    key={page.pageNumber}
                    src={page.src}
                    alt={`Halaman ${page.pageNumber}`}
                    className="h-auto w-full rounded-md border border-slate-300 bg-white shadow-sm"
                    style={{ maxWidth: `${Math.max(720, page.width)}px` }}
                  />
                ))}
              </div>
            ) : (
              <div className="mx-auto grid h-full w-full max-w-[1800px] grid-cols-1 gap-4 lg:grid-cols-2">
                {[bookLeft, bookRight].map((page, index) => (
                  <div key={`book-slot-${index}`} className="flex items-center justify-center rounded-md border border-slate-300 bg-white p-2">
                    {page ? (
                      <img
                        src={page.src}
                        alt={`Halaman ${page.pageNumber}`}
                        className="h-auto w-full rounded-sm"
                        style={{ maxWidth: `${Math.max(640, page.width)}px` }}
                      />
                    ) : (
                      <div className="py-20 text-sm text-slate-400">Tidak ada halaman</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default MaterialViewerPage;
