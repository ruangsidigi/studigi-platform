/**
 * Question Viewer - Main Question Display
 * Shows full question with options and highlighting
 * Highlights user answer vs correct answer with colors
 */

import React from 'react';
import '../styles/question-viewer.css';

const QuestionViewer = ({
  question,
  isBookmarked,
  onToggleBookmark,
  showExplanation,
}) => {
  if (!question) {
    return <div className="question-viewer">Memuat soal...</div>;
  }

  const renderOption = (option) => {
    const isUserAnswer = option.label === question.user_answer;
    const isCorrectAnswer = option.label === question.correct_answer;

    let optionClass = 'option-item';

    if (isUserAnswer && isCorrectAnswer) {
      // User answered correctly
      optionClass += ' option-user-correct';
    } else if (isUserAnswer && !isCorrectAnswer) {
      // User answered incorrectly
      optionClass += ' option-user-incorrect';
    } else if (isCorrectAnswer && question.user_answer) {
      // Correct answer (when user answered wrong)
      optionClass += ' option-correct-highlight';
    }

    return (
      <div key={option.label} className={optionClass}>
        <div className="option-label-box">
          <span className="option-label">{option.label}</span>
        </div>
        <div className="option-text-box">
          <span className="option-text">{option.text}</span>
          {isUserAnswer && (
            <span className="option-user-badge">Jawaban Anda</span>
          )}
          {isCorrectAnswer && (
            <span className="option-correct-badge">Kunci Jawaban</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="question-viewer">
      {/* Header */}
      <div className="viewer-header">
        <div className="header-left">
          <h2 className="question-number-title">Soal #{question.questionNumber}</h2>
          <span className="question-category-badge">{question.category}</span>
        </div>
        <div className="header-right">
          <button
            className={`bookmark-button ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={onToggleBookmark}
            title={isBookmarked ? 'Hapus bookmark' : 'Tandai bookmark'}
          >
            🔖
          </button>
        </div>
      </div>

      {/* Status Indicator */}
      {question.isCorrect !== null && (
        <div className={`status-indicator ${question.isCorrect ? 'correct' : 'incorrect'}`}>
          {question.isCorrect ? (
            <>
              <span className="status-icon">✓</span>
              <span className="status-text">Jawaban Benar</span>
            </>
          ) : (
            <>
              <span className="status-icon">✗</span>
              <span className="status-text">Jawaban Salah</span>
            </>
          )}
        </div>
      )}

      {/* Question Text */}
      <div className="question-section">
        <h3 className="section-title">Soal</h3>
        <div className="question-text-content">
          {question.questionText}
        </div>

        {/* Question Image if exists */}
        {question.imageUrl && (
          <div className="question-image-container">
            <img
              src={question.imageUrl}
              alt="Question illustration"
              className="question-image"
            />
          </div>
        )}
      </div>

      {/* Answer Options */}
      <div className="options-section">
        <h3 className="section-title">Pilihan Jawaban</h3>
        <div className="options-grid">
          {question.options?.map((option) => renderOption(option))}
        </div>
      </div>

      {/* Answer Summary */}
      <div className="answer-summary">
        <h3 className="section-title">Ringkasan Jawaban</h3>
        <div className="answer-summary-grid">
          <div className="summary-card">
            <span className="summary-label">Jawaban Anda:</span>
            <span className="summary-value user-answer">
              {question.user_answer || <em>Tidak dijawab</em>}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Kunci Jawaban:</span>
            <span className="summary-value correct-answer">
              {question.correctAnswer || <em>N/A</em>}
            </span>
          </div>
          {question.isCorrect !== null && (
            <div className="summary-card">
              <span className="summary-label">Hasil:</span>
              <span className={`summary-value ${question.isCorrect ? 'result-correct' : 'result-incorrect'}`}>
                {question.isCorrect ? '✓ Benar' : '✗ Salah'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="viewer-legend">
        <div className="legend-title">Keterangan Warna</div>
        <div className="legend-items">
          {(question.user_answer && question.isCorrect) && (
            <div className="legend-item legend-correct">
              <span className="legend-color"></span>
              <span>Jawaban Anda Benar</span>
            </div>
          )}
          {(question.user_answer && !question.isCorrect) && (
            <>
              <div className="legend-item legend-user-incorrect">
                <span className="legend-color"></span>
                <span>Jawaban Anda (Salah)</span>
              </div>
              <div className="legend-item legend-correct-highlight">
                <span className="legend-color"></span>
                <span>Kunci Jawaban</span>
              </div>
            </>
          )}
          {!question.user_answer && (
            <div className="legend-item legend-correct-highlight">
              <span className="legend-color"></span>
              <span>Kunci Jawaban</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionViewer;
