import React from 'react';
import '../styles/question-modal.css';

const QuestionDetailModal = ({ question, onClose, loading, error }) => {
  if (!question) return null;

  const renderOption = (option, isUserAnswer, isCorrectAnswer) => {
    let className = 'option-item';
    if (isUserAnswer && isCorrectAnswer) {
      className += ' option-correct'; // Both: benar
    } else if (isUserAnswer && !isCorrectAnswer) {
      className += ' option-incorrect'; // User salah
    } else if (isCorrectAnswer) {
      className += ' option-answer-key'; // Kunci jawaban
    }

    return (
      <div key={option.label} className={className}>
        <span className="option-label">[{option.label}]</span>
        <span className="option-text">{option.text}</span>
      </div>
    );
  };

  return (
    <div className="question-modal-overlay" onClick={onClose}>
      <div
        className="question-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="question-modal-header">
          <div>
            <h2>Soal #{question.question_number}</h2>
            <p className="question-category">{question.category}</p>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Loading / Error */}
        {loading && <div className="loading-spinner">Loading detail...</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && (
          <div className="question-modal-body">
            {/* Question Text */}
            <div className="question-section">
              <h3>Soal</h3>
              <div className="question-text-box">
                {question.question_text}
              </div>
              {question.image_url && (
                <div className="question-image">
                  <img src={question.image_url} alt="Soal" />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="options-section">
              <h3>Pilihan Jawaban</h3>
              <div className="options-list">
                {question.options?.map((option) => renderOption(
                  option,
                  option.label === question.user_answer,
                  option.label === question.correct_answer
                ))}
              </div>

              {/* Legend */}
              <div className="options-legend">
                {question.is_correct !== null && (
                  <>
                    <div className="legend-item">
                      <span className="legend-color legend-correct"></span>
                      {question.is_correct && 'Jawaban Benar'}
                      {!question.is_correct && 'Jawaban Salah'}
                    </div>
                    <div className="legend-item">
                      <span className="legend-color legend-answer-key"></span>
                      Kunci Jawaban
                    </div>
                  </>
                )}
                {question.is_correct === null && (
                  <div className="legend-item text-muted">
                    (Kategori {question.category} tidak memiliki jawaban benar/salah)
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="status-section">
              <h3>Status</h3>
              <div className="status-grid">
                <div className="status-item">
                  <span className="status-label">Jawaban Anda:</span>
                  <span className="status-value">
                    {question.user_answer || <em>Kosong</em>}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Kunci Jawaban:</span>
                  <span className="status-value">
                    {question.correct_answer || <em>N/A</em>}
                  </span>
                </div>
                {question.is_correct !== null && (
                  <div className="status-item">
                    <span className="status-label">Hasil:</span>
                    <span
                      className={
                        question.is_correct
                          ? 'status-value status-correct'
                          : 'status-value status-incorrect'
                      }
                    >
                      {question.is_correct ? '✓ Benar' : '✗ Salah'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Explanation */}
            <div className="explanation-section">
              <h3>Pembahasan</h3>
              <div className="explanation-box">
                {question.explanation}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="question-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionDetailModal;
