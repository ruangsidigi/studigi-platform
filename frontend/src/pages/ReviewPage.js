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
import { useParams, useNavigate } from 'react-router-dom';
import { reviewService } from '../services/api';
import QuestionSidebar from '../components/QuestionSidebar';
import QuestionViewer from '../components/QuestionViewer';
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

  // UI State
  const [showExplanation, setShowExplanation] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, correct, incorrect, unanswered, bookmarked
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());

  // Initialize - Load review data
  useEffect(() => {
    initLoad();
  }, [attemptId]);

  const initLoad = async () => {
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
        loadQuestion(res.data.review[0].questionNumber);
      }
    } catch (err) {
      console.error('Error loading review:', err.response?.data || err.message || err);
      setError(err.response?.data?.error || 'Gagal memuat review');
    } finally {
      setLoading(false);
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

  return (
    <div className="review-container">
      {/* Header */}
      <div className="review-header">
        <div className="review-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              className="btn-icon-back"
              onClick={() => navigate(-1)}
              title="Kembali ke halaman sebelumnya"
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
                    {questionDetail.explanation}
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
