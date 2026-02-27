import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tryoutService } from '../services/api';
import '../styles/results.css';

const Results = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const loadResults = useCallback(async () => {
    try {
      const res = await tryoutService.getResults(sessionId);
      setResults(res.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load results');
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  if (loading) return <div className="container">Loading...</div>;
  if (error) return <div className="container alert alert-danger">{error}</div>;
  if (!results) return <div className="container">No results found</div>;

  const { sessionData, results: questionResults } = results;

  return (
    <div className="container results-page">
      <div className="results-header">
        <h1>Hasil Tryout Anda</h1>
        <button 
          className="btn btn-primary results-review-btn" 
          onClick={() => navigate(`/review/${sessionId}`)}
        >
          📖 Lihat Review Sistem Edtech
        </button>
      </div>

      <div className="score-summary">
        <div className={`status-badge ${sessionData.isPassed ? 'passed' : 'failed'}`}>
          {sessionData.status}
        </div>

        <div className="scores-grid">
          <div className="score-card">
            <div className="score-value">{sessionData.twkScore}</div>
            <div className="score-label">TWK</div>
            <div className="score-requirement">(Target: > 65)</div>
          </div>
          <div className="score-card">
            <div className="score-value">{sessionData.tiuScore}</div>
            <div className="score-label">TIU</div>
            <div className="score-requirement">(Target: > 85)</div>
          </div>
          <div className="score-card">
            <div className="score-value">{sessionData.tkpScore}</div>
            <div className="score-label">TKP</div>
            <div className="score-requirement">(Target: > 166)</div>
          </div>
          <div className="score-card total">
            <div className="score-value">{sessionData.totalScore}</div>
            <div className="score-label">Total Score</div>
          </div>
        </div>

        <div className="time-info">
          <p>Started: {new Date(sessionData.startedAt).toLocaleString('id-ID')}</p>
          <p>Finished: {new Date(sessionData.finishedAt).toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="explanations">
        <h2>Pembahasan Soal</h2>
        <p className="explanation-note">Klik nomor soal yang salah untuk melihat pembahasan</p>

        <div className="questions-list">
          {questionResults.map((result, idx) => {
            const isTKP = result.forceGreen === true;
            const isCorrectClass = isTKP ? 'correct' : (result.isCorrect ? 'correct' : 'incorrect');
            return (
              <div
                key={result.questionId}
                className={`question-item ${isCorrectClass}`}
              >
              <div
                className="question-header"
                onClick={() =>
                  setExpandedQuestion(expandedQuestion === result.questionId ? null : result.questionId)
                }
              >
                <div className={`question-number-badge ${isCorrectClass}`}>
                  {result.questionNumber}
                </div>
                <div className="question-header-info">
                  <span className="question-category">{result.category}</span>
                  {isTKP ? (
                    <span className="status-blank"></span>
                  ) : result.isCorrect ? (
                    <span className="status-correct">✓ Benar</span>
                  ) : (
                    <span className="status-incorrect">✗ Salah</span>
                  )}
                </div>
              </div>

              {expandedQuestion === result.questionId && !result.isCorrect && (
                <div className="question-explanation">
                  <div className="explanation-content">
                    <h4>Soal:</h4>
                    <p>{result.questionText}</p>

                    {result.imageUrl && (
                      <div className="explanation-image">
                        <img src={result.imageUrl} alt="Question" />
                      </div>
                    )}

                    <div className="answer-info">
                      <div className="answer-item incorrect">
                        <strong>Jawaban Anda:</strong>
                        <p className="answer-letter">{result.userAnswer}</p>
                      </div>
                      <div className="answer-item correct">
                        <strong>Jawaban Benar:</strong>
                        <p className="answer-letter">{result.correctAnswer}</p>
                      </div>
                    </div>

                    {result.explanation && (
                      <div className="explanation-box">
                        <h4>Pembahasan:</h4>
                        <p>{result.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default Results;
