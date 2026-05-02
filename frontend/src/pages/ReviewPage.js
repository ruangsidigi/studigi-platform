/**
 * Review Page - EdTech Style Review System
 * Features:
 * - Sidebar navigation grid with status indicators
 * - Question viewer with highlight support
 * - Explanation panel with toggle
 * - Bookmark functionality
 * - Category filtering
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { reviewService, ratingService } from '../services/api';
import QuestionSidebar from '../components/QuestionSidebar';
import QuestionViewer from '../components/QuestionViewer';
import MathText from '../components/MathText';
import '../styles/review.css';

const ReviewPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  // State Management
  const [reviewData, setReviewData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionDetail, setQuestionDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [error, setError] = useState('');
  const [gateLoading, setGateLoading] = useState(true);
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [sessionRating, setSessionRating] = useState(0);
  const [sessionComment, setSessionComment] = useState('');
  const [rewardVoucher, setRewardVoucher] = useState(null);

  // UI State
  const [showExplanation, setShowExplanation] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, correct, incorrect, unanswered, bookmarked
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());

  const loadGateStatus = useCallback(async () => {
    try {
      setGateLoading(true);
      const response = await ratingService.getSessionStatus(attemptId);
      const payload = response?.data || {};

      if (!payload?.isCompleted) {
        setGateUnlocked(true);
        return;
      }

      if (payload?.isSubmitted) {
        setGateUnlocked(true);
        return;
      }

      setGateUnlocked(false);
    } catch (_) {
      // If endpoint not available, avoid blocking review access.
      setGateUnlocked(true);
    } finally {
      setGateLoading(false);
    }
  }, [attemptId]);

  const initLoad = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch attempt review
      const res = await reviewService.getAttemptReview(attemptId);
      
      if (!res.data || !res.data.review) {
        throw new Error('Data review tidak valid');
      }

      setReviewData(res.data);

      // Build bookmarked set
      const bookmarked = new Set(
        res.data.review
          .filter((q) => q.isBookmarked)
          .map((q) => q.questionId)
      );
      setBookmarkedQuestions(bookmarked);

      // Load first question automatically
      if (res.data.review.length > 0) {
        const firstQuestionNumber = res.data.review[0].questionNumber;
        setCurrentQuestion(firstQuestionNumber);
        setLoadingQuestion(true);
        try {
          const detailRes = await reviewService.getQuestionDetail(attemptId, firstQuestionNumber);
          setQuestionDetail(detailRes.data);
        } catch (detailErr) {
          console.error('Error loading question:', detailErr.response?.data || detailErr.message || detailErr);
          setError(detailErr.response?.data?.error || 'Gagal memuat soal');
        } finally {
          setLoadingQuestion(false);
        }
      }
    } catch (err) {
      console.error('Error loading review:', err.response?.data || err.message || err);
      setError(err.response?.data?.error || 'Gagal memuat review');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  // Initialize - Load review data
  useEffect(() => {
    loadGateStatus();
  }, [loadGateStatus]);

  useEffect(() => {
    if (!gateUnlocked) return;
    initLoad();
  }, [initLoad, gateUnlocked]);

  const submitSessionReview = async () => {
    if (gateSubmitting) return;
    if (!Number.isInteger(sessionRating) || sessionRating < 1 || sessionRating > 5) {
      setError('Pilih bintang terlebih dahulu, atau tekan Lewati.');
      return;
    }

    try {
      setGateSubmitting(true);
      setError('');
      const response = await ratingService.submitSessionReview(attemptId, {
        rating: sessionRating,
        comment: sessionComment,
        skip: false,
      });
      const reward = response?.data?.reward;
      if (reward?.rewardGranted && reward?.voucher) {
        setRewardVoucher(reward.voucher);
        window.dispatchEvent(new CustomEvent('studigi:notifications-refresh'));
      }
      setGateUnlocked(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Gagal menyimpan review.');
    } finally {
      setGateSubmitting(false);
    }
  };

  const skipSessionReview = async () => {
    if (gateSubmitting) return;

    try {
      setGateSubmitting(true);
      setError('');
      await ratingService.submitSessionReview(attemptId, {
        skip: true,
      });
      setGateUnlocked(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Gagal melewati review.');
    } finally {
      setGateSubmitting(false);
    }
  };

  const loadQuestion = useCallback(
    async (questionNumber) => {
      try {
        setLoadingQuestion(true);
        setError('');

        const res = await reviewService.getQuestionDetail(
          attemptId,
          questionNumber
        );
        setQuestionDetail(res.data);
        setCurrentQuestion(questionNumber);
      } catch (err) {
        console.error('Error loading question:', err.response?.data || err.message || err);
        setError(err.response?.data?.error || 'Gagal memuat soal');
      } finally {
        setLoadingQuestion(false);
      }
    },
    [attemptId]
  );

  const handleSelectQuestion = (questionNumber) => {
    loadQuestion(questionNumber);
  };

  const handleToggleBookmark = async (questionId, questionNumber) => {
    try {
      const isCurrentlyBookmarked = bookmarkedQuestions.has(questionId);

      // Optimistic update
      const newBookmarked = new Set(bookmarkedQuestions);
      if (isCurrentlyBookmarked) {
        newBookmarked.delete(questionId);
      } else {
        newBookmarked.add(questionId);
      }
      setBookmarkedQuestions(newBookmarked);

      // API call
      await reviewService.toggleBookmark(attemptId, questionId);

      // Update review data
      setReviewData((prev) => ({
        ...prev,
        review: prev.review.map((q) =>
          q.questionId === questionId
            ? { ...q, isBookmarked: !isCurrentlyBookmarked }
            : q
        ),
        stats: {
          ...prev.stats,
          bookmarked: isCurrentlyBookmarked
            ? prev.stats.bookmarked - 1
            : prev.stats.bookmarked + 1,
        },
      }));

      // Update question detail if current
      if (questionDetail?.options && questionDetail.options.some(o => o.label)) {
        // Recalculate if needed or can skip since bookmark toggle is just UI
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      // Revert optimistic update
      setBookmarkedQuestions(
        bookmarkedQuestions.has(questionId)
          ? new Set(bookmarkedQuestions)
          : new Set([...bookmarkedQuestions, questionId])
      );
      setError('Gagal menyimpan bookmark');
    }
  };

  // Filter questions based on selected filter
  const getFilteredQuestions = useCallback(() => {
    if (!reviewData?.review) return [];

    const questions = reviewData.review;

    switch (selectedFilter) {
      case 'correct':
        return questions.filter((q) => q.status === 'correct');
      case 'incorrect':
        return questions.filter((q) => q.status === 'incorrect');
      case 'unanswered':
        return questions.filter((q) => q.status === 'unanswered');
      case 'bookmarked':
        return questions.filter((q) => q.isBookmarked);
      default:
        return questions;
    }
  }, [reviewData, selectedFilter]);

  if (gateLoading) {
    return (
      <div className="review-container loading">
        <div className="review-spinner">Memuat status review...</div>
      </div>
    );
  }

  if (!gateUnlocked) {
    return (
      <div className="review-container loading" style={{ alignItems: 'stretch', justifyContent: 'flex-start', padding: 24 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Rate Tryout Anda</h1>
          <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>
            Sebelum melihat hasil tes dan pembahasan, Anda bisa memberikan rating dan testimoni. Ini opsional dan bisa dilewati.
          </p>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Rating</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((value) => {
                const active = value <= sessionRating;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSessionRating(value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: active ? '#f59e0b' : '#cbd5e1',
                    }}
                    aria-label={`Beri ${value} bintang`}
                  >
                    <Star size={28} fill={active ? '#fbbf24' : 'none'} />
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Testimoni (opsional)</p>
            <p style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700, marginBottom: 8 }}>
              Isi bintang + testimoni untuk klaim voucher 10% (min. pembelian Rp 15.000).
            </p>
            <textarea
              value={sessionComment}
              onChange={(event) => setSessionComment(event.target.value)}
              placeholder="Tulis pengalaman Anda mengerjakan tryout ini..."
              rows={4}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                padding: '10px 12px',
                fontSize: 14,
                color: '#0f172a',
                resize: 'vertical',
              }}
            />
          </div>

          {error ? (
            <div style={{ marginBottom: 12, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: '8px 10px', fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={submitSessionReview}
              disabled={gateSubmitting}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '10px 14px',
                background: 'var(--header-color,#103c21)',
                color: '#fff',
                fontWeight: 600,
                cursor: gateSubmitting ? 'not-allowed' : 'pointer',
                opacity: gateSubmitting ? 0.6 : 1,
              }}
            >
              {gateSubmitting ? 'Menyimpan...' : 'Kirim Review'}
            </button>

            <button
              type="button"
              onClick={skipSessionReview}
              disabled={gateSubmitting}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '10px 14px',
                background: '#fff',
                color: '#334155',
                fontWeight: 600,
                cursor: gateSubmitting ? 'not-allowed' : 'pointer',
                opacity: gateSubmitting ? 0.6 : 1,
              }}
            >
              Lewati
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="review-container loading">
        <div className="review-spinner">Loading review...</div>
      </div>
    );
  }

  if (error && !reviewData) {
    return (
      <div className="review-container error">
        <div className="review-error">{error}</div>
      </div>
    );
  }

  const filteredQuestions = getFilteredQuestions();
  const showSectionScores = reviewData?.attempt?.showSectionScores !== false;

  return (
    <div className="review-container">
      {rewardVoucher && (
        <div style={{ margin: '16px 24px 0', borderRadius: 16, border: '1px solid #bbf7d0', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#166534', marginBottom: 6 }}>
            Voucher Reward Berhasil Dibuat
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#14532d', marginBottom: 8 }}>
            {rewardVoucher.code}
          </p>
          <p style={{ fontSize: 14, color: '#166534', marginBottom: 6 }}>
            {rewardVoucher.discountType === 'percentage'
              ? `Diskon ${rewardVoucher.discountValue}%${rewardVoucher.maxDiscount ? ` hingga Rp ${Number(rewardVoucher.maxDiscount).toLocaleString('id-ID')}` : ''}`
              : `Diskon Rp ${Number(rewardVoucher.discountValue).toLocaleString('id-ID')}`}
          </p>
          <p style={{ fontSize: 13, color: '#166534', marginBottom: 0 }}>
            Berlaku sampai {rewardVoucher.validUntil ? new Date(rewardVoucher.validUntil).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
            {rewardVoucher.minPurchase ? `, minimal pembelian Rp ${Number(rewardVoucher.minPurchase).toLocaleString('id-ID')}` : ''}.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="review-header">
        <div className="review-header-left">
          <div className="review-title-row">
            <button 
              className="btn-icon-back"
              onClick={() => navigate('/activity')}
              title="Kembali ke halaman Activity"
            >
              ← Kembali
            </button>
            <div>
              <h1>Review Soal</h1>
              <p className="review-subtitle">Paket #{attemptId}</p>
            </div>
          </div>
        </div>
        <div className="review-header-stats">
          {showSectionScores && (
            <>
              <div className="score-chip">
                <span className="score-chip-label">TWK</span>
                <span className="score-chip-value">{reviewData?.attempt?.twkScore ?? 0}</span>
              </div>
              <div className="score-chip">
                <span className="score-chip-label">TIU</span>
                <span className="score-chip-value">{reviewData?.attempt?.tiuScore ?? 0}</span>
              </div>
              <div className="score-chip">
                <span className="score-chip-label">TKP</span>
                <span className="score-chip-value">{reviewData?.attempt?.tkpScore ?? 0}</span>
              </div>
            </>
          )}
          <div className="score-chip total">
            <span className="score-chip-label">Total</span>
            <span className="score-chip-value">{reviewData?.attempt?.totalScore ?? 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Status</span>
            <span className={`stat-badge ${reviewData?.attempt.isPassed ? 'passed' : 'failed'}`}>
              {reviewData?.attempt?.status || (reviewData?.attempt?.isPassed ? 'Lulus' : 'Tidak Lulus')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="review-content">
        {/* Left Sidebar - Question Navigation Grid */}
        <aside className="review-sidebar">
          <QuestionSidebar
            questions={filteredQuestions}
            currentQuestion={currentQuestion}
            selectedFilter={selectedFilter}
            onSelectQuestion={handleSelectQuestion}
            onFilterChange={setSelectedFilter}
            stats={reviewData?.stats}
            bookmarkedQuestions={bookmarkedQuestions}
          />
        </aside>

        {/* Main Content - Question Viewer & Explanation */}
        <main className="review-main">
          {loadingQuestion ? (
            <div className="question-viewer-loading">
              <div className="spinner">Loading question...</div>
            </div>
          ) : questionDetail ? (
            <>
              {/* Question Viewer Section */}
              <section className="viewer-section">
                <QuestionViewer
                  question={questionDetail}
                  isBookmarked={bookmarkedQuestions.has(
                    questionDetail.questionNumber
                  )}
                  onToggleBookmark={() =>
                    handleToggleBookmark(
                      questionDetail.questionNumber,
                      questionDetail.questionNumber
                    )
                  }
                  showExplanation={showExplanation}
                />
              </section>

              {/* Explanation Toggle & Panel */}
              <section className="explanation-section">
                <div className="explanation-header">
                  <h3>Pembahasan</h3>
                  <button
                    className={`toggle-explanation ${showExplanation ? 'open' : 'closed'}`}
                    onClick={() => setShowExplanation(!showExplanation)}
                    title={showExplanation ? 'Sembunyikan pembahasan' : 'Tampilkan pembahasan'}
                  >
                    {showExplanation ? '−' : '+'}
                  </button>
                </div>

                {showExplanation && (
                  <div className="explanation-content">
                    <MathText text={questionDetail.explanation} display />
                  </div>
                )}
              </section>

              {/* Navigation Buttons */}
              <div className="question-navigation">
                {currentQuestion > 1 && (
                  <button
                    className="nav-button prev"
                    onClick={() => loadQuestion(currentQuestion - 1)}
                  >
                    ← Soal Sebelumnya
                  </button>
                )}
                {currentQuestion < reviewData?.stats.total && (
                  <button
                    className="nav-button next"
                    onClick={() => loadQuestion(currentQuestion + 1)}
                  >
                    Soal Berikutnya →
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="no-question">
              <p>Pilih soal dari sidebar untuk melihat detail</p>
            </div>
          )}

          {error && (
            <div className="alert alert-danger" style={{ marginTop: '12px' }}>
              {error}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReviewPage;
