import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionService, tryoutService, bundleService, packageService } from '../services/api';
import { GraduationCap, Clock3, Flag, ChevronLeft, ChevronRight } from 'lucide-react';

const Quiz = () => {
  const { packageId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [isBundling, setIsBundling] = useState(false);
  const [bundleDetail, setBundleDetail] = useState(null);
  const [packageInfo, setPackageInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(100 * 60);
  const [questionStartAt, setQuestionStartAt] = useState(Date.now());
  const [isFinishing, setIsFinishing] = useState(false);

  const convertGoogleDriveUrl = (url) => {
    if (!url) return null;
    if (String(url).startsWith('data:image/')) return url;
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return url;

    let fileId = null;

    const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match1) fileId = match1[1];

    const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (!fileId && match2) fileId = match2[1];

    if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}=s0`;
    if (url.includes('drive.google.com/uc')) return url;
    return url;
  };

  const startSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const pkgRes = await packageService.getById(parseInt(packageId, 10));
      const pkg = pkgRes.data;
      setPackageInfo(pkg);
      setTimeLeft((Number(pkg?.duration) || 100) * 60);

      const isBundleType =
        pkg.type === 'bundling' ||
        pkg.type === 'bundle' ||
        (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0);

      if (isBundleType) {
        setIsBundling(true);
        const bundleRes = await bundleService.getById(parseInt(packageId, 10));
        setBundleDetail(bundleRes.data);
        setLoading(false);
        return;
      }

      setIsBundling(false);
      const sessionRes = await tryoutService.start(parseInt(packageId, 10));
      setSessionId(sessionRes.data.session.id);

      const questionsRes = await questionService.getByPackage(parseInt(packageId, 10));
      setQuestions(Array.isArray(questionsRes.data) ? questionsRes.data : []);
      setLoading(false);
    } catch (err) {
      setError('Failed to start tryout');
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  useEffect(() => {
    setQuestionStartAt(Date.now());
  }, [currentQuestion]);

  const finishTryout = useCallback(
    async ({ force = false } = {}) => {
      if (!sessionId || isFinishing) return;
      if (!force && !window.confirm('Yakin ingin menyelesaikan tryout sekarang?')) return;

      try {
        setIsFinishing(true);
        await tryoutService.finish(sessionId);
        navigate(`/review/${sessionId}`);
      } catch (err) {
        alert('Error finishing tryout: ' + (err.response?.data?.error || err.message));
      } finally {
        setIsFinishing(false);
      }
    },
    [sessionId, isFinishing, navigate]
  );

  useEffect(() => {
    if (!sessionId || loading || isBundling || questions.length === 0) return undefined;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishTryout({ force: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, loading, isBundling, questions.length, finishTryout]);

  const handleSelectAnswer = async (option) => {
    const current = questions[currentQuestion];
    if (!current) return;

    const updatedAnswers = { ...answers, [current.id]: option };
    setAnswers(updatedAnswers);

    const elapsed = Math.max(1000, Date.now() - questionStartAt);

    try {
      await tryoutService.submitAnswer(sessionId, current.id, option, {
        timeSpentMs: elapsed,
        difficulty: 'medium',
      });
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const toggleMarkQuestion = () => {
    const currentId = questions[currentQuestion]?.id;
    if (!currentId) return;

    setMarkedQuestions((prev) => ({
      ...prev,
      [currentId]: !prev[currentId],
    }));
  };

  const handleImageError = (questionId) => {
    setImageErrors((prev) => ({ ...prev, [questionId]: true }));
  };

  const handleImageLoad = (questionId) => {
    setImageErrors((prev) => ({ ...prev, [questionId]: false }));
  };

  if (loading) return <div className="mx-auto max-w-7xl p-6 text-sm text-slate-600">Loading...</div>;
  if (error) return <div className="mx-auto max-w-7xl p-6 text-sm text-red-600">{error}</div>;

  if (isBundling && bundleDetail) {
    const bundle = bundleDetail.bundle;
    const packages = bundleDetail.packages || [];

    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Pilih Paket dari Bundling</h1>
            <p className="mt-1 text-sm text-slate-600">Pilih salah satu paket untuk mulai sesi.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(-1)}
          >
            Kembali
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{bundle.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{bundle.description || 'Paket bundling pilihan.'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total paket</p>
              <p className="text-xl font-semibold text-[var(--header-color,#0f5132)]">{packages.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {packages.length === 0 ? (
              <p className="text-sm text-slate-600">Belum ada paket di bundling ini.</p>
            ) : (
              packages.map((pkg) => (
                <article key={pkg.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{pkg.name}</h3>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                      {pkg.type === 'tryout' ? 'Tryout' : pkg.type === 'latihan' ? 'Latihan' : 'Bundle'}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-slate-600">{pkg.description || 'Deskripsi paket.'}</p>
                  <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{pkg.question_count || 0} soal</span>
                    <span>Rp {(pkg.price || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-xl bg-[var(--header-color,#0f5132)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    onClick={() => navigate(`/quiz/${pkg.id}`)}
                  >
                    Mulai Mengerjakan
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="mx-auto max-w-7xl p-6 text-sm text-slate-600">No questions found</div>;
  }

  const question = questions[currentQuestion];
  const currentAnswer = answers[question.id];
  const currentQuestionNumber = currentQuestion + 1;
  const answeredCount = Object.keys(answers).length;
  const markedCount = Object.values(markedQuestions).filter(Boolean).length;
  const unansweredCount = Math.max(questions.length - answeredCount, 0);
  const progressPercent = Math.round((answeredCount / questions.length) * 100);
  const isCurrentMarked = Boolean(markedQuestions[question.id]);

  const optionEntries = ['A', 'B', 'C', 'D', 'E']
    .map((label) => ({
      label,
      text: question[`option_${label.toLowerCase()}`],
    }))
    .filter((item) => String(item.text || '').trim().length > 0);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const timerText =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;

  const getQuestionStatusClass = (questionId, index) => {
    if (index === currentQuestion) return 'bg-[var(--header-color,#0f5132)] text-white';
    if (answers[questionId]) return 'bg-emerald-500 text-white';
    if (markedQuestions[questionId]) return 'bg-amber-500 text-white';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--header-color,#0f5132)] text-white">
                <GraduationCap size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">
                  {packageInfo?.name || 'Tryout Session'}
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Soal {currentQuestionNumber} dari {questions.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-[var(--header-color,#0f5132)]">
              <Clock3 size={16} />
              <span>{timerText}</span>
            </div>
            <button
              type="button"
              disabled={isFinishing}
              onClick={() => finishTryout()}
              className="rounded-full bg-[var(--header-color,#0f5132)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {isFinishing ? 'Memproses...' : 'Selesai'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_292px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
                <span>Progress: {answeredCount}/{questions.length} dijawab</span>
                <span className="font-semibold text-slate-700">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[var(--header-color,#0f5132)] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-[var(--header-color,#0f5132)]">
                  {(question.category || 'SOAL').toUpperCase()}
                </span>
                <span className="text-sm font-medium text-slate-600">Soal {question.number || currentQuestionNumber}</span>
              </div>

              <p className="mb-5 text-base leading-relaxed text-slate-900">{question.question_text}</p>

              {question.image_url && !imageErrors[question.id] && (
                <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                  <img
                    src={convertGoogleDriveUrl(question.image_url)}
                    alt="Question"
                    onLoad={() => handleImageLoad(question.id)}
                    onError={() => handleImageError(question.id)}
                    className="mx-auto h-auto max-w-full"
                    crossOrigin="anonymous"
                  />
                </div>
              )}

              {question.image_url && imageErrors[question.id] && (
                <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  Gambar tidak bisa ditampilkan untuk soal ini.
                </div>
              )}

              <div className="space-y-3">
                {optionEntries.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={[
                      'flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors',
                      currentAnswer === option.label
                        ? 'border-[var(--header-color,#0f5132)] bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
                    ].join(' ')}
                    onClick={() => handleSelectAnswer(option.label)}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-600">
                      {option.label}
                    </span>
                    <span className="text-base text-slate-800">{option.text}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex items-center justify-between gap-3 rounded-2xl bg-transparent py-1">
              <button
                type="button"
                disabled={currentQuestion === 0}
                onClick={() => setCurrentQuestion((prev) => Math.max(prev - 1, 0))}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-400 enabled:text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ChevronLeft size={18} />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={toggleMarkQuestion}
                className={[
                  'inline-flex items-center gap-2 rounded-2xl border px-6 py-3 text-base font-semibold',
                  isCurrentMarked
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                <Flag size={17} />
                Tandai
              </button>

              <button
                type="button"
                disabled={currentQuestion === questions.length - 1}
                onClick={() => setCurrentQuestion((prev) => Math.min(prev + 1, questions.length - 1))}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--header-color,#0f5132)] px-6 py-3 text-base font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Berikutnya
                <ChevronRight size={18} />
              </button>
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-900">Navigator Soal</h3>

            <div className="mb-5 grid grid-cols-7 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestion(idx)}
                  className={`h-10 rounded-full text-sm font-semibold transition-colors ${getQuestionStatusClass(q.id, idx)}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 text-[15px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-[var(--header-color,#0f5132)]" />
                <span>Soal Aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-emerald-500" />
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-amber-500" />
                <span>Ditandai</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-slate-200" />
                <span>Belum Dijawab</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between py-0.5 text-slate-700">
                <span>Dijawab</span>
                <span className="font-semibold text-emerald-600">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between py-0.5 text-slate-700">
                <span>Ditandai</span>
                <span className="font-semibold text-amber-600">{markedCount}</span>
              </div>
              <div className="flex items-center justify-between py-0.5 text-slate-700">
                <span>Belum Dijawab</span>
                <span className="font-semibold text-slate-600">{unansweredCount}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
