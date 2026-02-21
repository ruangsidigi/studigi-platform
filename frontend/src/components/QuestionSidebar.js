/**
 * Question Sidebar - Navigation Grid
 * Shows all questions with status indicators
 * Allows filtering by status and category
 */

import React, { useMemo } from 'react';
import '../styles/question-sidebar.css';

const QuestionSidebar = ({
  questions,
  currentQuestion,
  selectedFilter,
  onSelectQuestion,
  onFilterChange,
  stats,
  bookmarkedQuestions,
}) => {
  // Group questions by category
  const groupedByCategory = useMemo(() => {
    const groups = {};
    questions.forEach((q) => {
      if (!groups[q.category]) {
        groups[q.category] = [];
      }
      groups[q.category].push(q);
    });
    return groups;
  }, [questions]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'correct':
        return 'status-correct';
      case 'incorrect':
        return 'status-incorrect';
      case 'unanswered':
        return 'status-unanswered';
      case 'partial':
        return 'status-partial';
      default:
        return '';
    }
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'correct':
        return '✓';
      case 'incorrect':
        return '✗';
      case 'unanswered':
        return '○';
      case 'partial':
        return '~';
      default:
        return '?';
    }
  };

  return (
    <div className="question-sidebar">
      {/* Filter Tabs */}
      <div className="sidebar-filters">
        <button
          className={`filter-tab ${selectedFilter === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange('all')}
          title={`Semua: ${stats?.total || 0}`}
        >
          <span className="filter-label">Semua</span>
          <span className="filter-count">{stats?.total || 0}</span>
        </button>

        <button
          className={`filter-tab ${selectedFilter === 'correct' ? 'active' : ''}`}
          onClick={() => onFilterChange('correct')}
          title={`Benar: ${stats?.correct || 0}`}
        >
          <span className="filter-label filter-correct">✓ Benar</span>
          <span className="filter-count">{stats?.correct || 0}</span>
        </button>

        <button
          className={`filter-tab ${selectedFilter === 'incorrect' ? 'active' : ''}`}
          onClick={() => onFilterChange('incorrect')}
          title={`Salah: ${stats?.incorrect || 0}`}
        >
          <span className="filter-label filter-incorrect">✗ Salah</span>
          <span className="filter-count">{stats?.incorrect || 0}</span>
        </button>

        <button
          className={`filter-tab ${selectedFilter === 'unanswered' ? 'active' : ''}`}
          onClick={() => onFilterChange('unanswered')}
          title={`Kosong: ${stats?.unanswered || 0}`}
        >
          <span className="filter-label filter-unanswered">○ Kosong</span>
          <span className="filter-count">{stats?.unanswered || 0}</span>
        </button>

        <button
          className={`filter-tab ${selectedFilter === 'bookmarked' ? 'active' : ''}`}
          onClick={() => onFilterChange('bookmarked')}
          title={`Bookmark: ${stats?.bookmarked || 0}`}
        >
          <span className="filter-label filter-bookmarked">🔖 Bookmark</span>
          <span className="filter-count">{stats?.bookmarked || 0}</span>
        </button>
      </div>

      {/* Question Grid */}
      <div className="sidebar-grid">
        {Object.entries(groupedByCategory).length === 0 ? (
          <div className="sidebar-empty">
            <p>Tidak ada soal</p>
          </div>
        ) : (
          Object.entries(groupedByCategory).map(([category, categoryQuestions]) => (
            <div key={category} className="category-group">
              <div className="category-header">{category}</div>

              <div className="question-buttons-grid">
                {categoryQuestions.map((q) => (
                  <button
                    key={q.questionId}
                    className={`question-button ${getStatusClass(q.status)} ${
                      currentQuestion === q.questionNumber ? 'active' : ''
                    } ${q.isBookmarked ? 'bookmarked' : ''}`}
                    onClick={() => onSelectQuestion(q.questionNumber)}
                    title={`Soal ${q.questionNumber} - ${q.status}${q.isBookmarked ? ' (Bookmark)' : ''}`}
                  >
                    <span className="question-number">{q.questionNumber}</span>
                    <span className="question-status">
                      {getStatusEmoji(q.status)}
                    </span>
                    {q.isBookmarked && (
                      <span className="bookmark-indicator">🔖</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Summary */}
      <div className="sidebar-summary">
        <div className="summary-title">Ringkasan</div>
        <div className="summary-grid">
          <div className="summary-item correct">
            <span className="summary-emoji">✓</span>
            <span className="summary-text">Benar: {stats?.correct || 0}</span>
          </div>
          <div className="summary-item incorrect">
            <span className="summary-emoji">✗</span>
            <span className="summary-text">Salah: {stats?.incorrect || 0}</span>
          </div>
          <div className="summary-item unanswered">
            <span className="summary-emoji">○</span>
            <span className="summary-text">Kosong: {stats?.unanswered || 0}</span>
          </div>
          <div className="summary-item bookmarked">
            <span className="summary-emoji">🔖</span>
            <span className="summary-text">Bookmark: {stats?.bookmarked || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionSidebar;
