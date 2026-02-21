import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionService, tryoutService, bundleService, packageService } from '../services/api';
import Timer from '../components/Timer';
import '../styles/quiz.css';

const Quiz = () => {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState({});
  const [isBundling, setIsBundling] = useState(false);
  const [bundleDetail, setBundleDetail] = useState(null);
  const [questionStartAt, setQuestionStartAt] = useState(Date.now());

  // Convert Google Drive sharing link to direct image URL
  const convertGoogleDriveUrl = (url) => {
    if (!url) return null;
    
    // If already a direct image URL (ends with common image extensions)
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
      return url;
    }
    
    // Handle Google Drive share link format
    // Extract FILE ID from various Google Drive URL formats
    let fileId = null;
    
    // Format 1: https://drive.google.com/file/d/FILE_ID/view?usp=...
    const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match1) {
      fileId = match1[1];
    }
    
    // Format 2: https://drive.google.com/open?id=FILE_ID
    const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (!fileId && match2) {
      fileId = match2[1];
    }
    
    if (fileId) {
      // Return direct view URL for Google Drive images
      // This works better than /uc?export=view for some files
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    // If it's already a direct Google Drive URL
    if (url.includes('drive.google.com/uc')) {
      return url;
    }
    
    return url;
  };

  const startSession = useCallback(async () => {
    try {
      // Load package info first
      const pkgRes = await packageService.getById(parseInt(packageId));
      const pkg = pkgRes.data;

      // Check if it's a bundling
      if (pkg.type === 'bundling' || pkg.type === 'bundle' || (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0)) {
        setIsBundling(true);
        const bundleRes = await bundleService.getById(parseInt(packageId));
        setBundleDetail(bundleRes.data);
        setLoading(false);
        return;
      }

      // Normal package - load questions
      const sessionRes = await tryoutService.start(parseInt(packageId));
      setSessionId(sessionRes.data.session.id);

      const questionsRes = await questionService.getByPackage(parseInt(packageId));
      setQuestions(questionsRes.data);
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

  const handleSelectAnswer = async (option) => {
    const newAnswers = { ...answers, [questions[currentQuestion].id]: option };
    setAnswers(newAnswers);

    const elapsed = Math.max(1000, Date.now() - questionStartAt);

    // Auto-submit answer
    try {
      await tryoutService.submitAnswer(sessionId, questions[currentQuestion].id, option, {
        timeSpentMs: elapsed,
        difficulty: 'medium',
      });
    } catch (err) {
      console.error('Error submitting answer:', err);
    }

    // Move to next question
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleFinish = async () => {
    if (!window.confirm('Are you sure you want to finish the tryout?')) return;

    try {
      await tryoutService.finish(sessionId);
      navigate(`/review/${sessionId}`);
    } catch (err) {
      alert('Error finishing tryout: ' + err.response?.data?.error);
    }
  };

  const handleTimeUp = () => {
    handleFinish();
  };

  const handleImageError = (questionId) => {
    setImageErrors({ ...imageErrors, [questionId]: true });
    console.error(`Failed to load image for question ${questionId}`);
  };

  const handleImageLoad = (questionId) => {
    setImageErrors({ ...imageErrors, [questionId]: false });
  };

  if (loading) return <div className="quiz-container">Loading...</div>;
  if (error) return <div className="quiz-container alert alert-danger">{error}</div>;

  // Show bundle selection if it's a bundling
  if (isBundling && bundleDetail) {
    const bundle = bundleDetail.bundle;
    const packages = bundleDetail.packages || [];

    return (
      <div className="bundle-quiz-container" style={{ padding: '20px' }}>
        <div className="container">
          <div className="dashboard-header">
            <h1>Pilih Paket dari Bundling</h1>
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              ← Kembali
            </button>
          </div>

          <div className="bundle-hero" style={{ marginBottom: '30px' }}>
            <div>
              <h2>{bundle.name}</h2>
              <p className="text-muted">{bundle.description || 'Paket bundling pilihan.'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Total paket</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1d7a7a', marginBottom: '10px' }}>
                {packages.length} Paket
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Paket dalam Bundling</div>
            <div className="bundle-package-grid">
              {packages.length === 0 ? (
                <p className="text-muted">Belum ada paket di bundling ini.</p>
              ) : (
                packages.map((pkg) => (
                  <div key={pkg.id} className="bundle-package-card">
                    <div className="bundle-package-header">
                      <h3>{pkg.name}</h3>
                      <span className="bundle-package-type">
                        {pkg.type === 'tryout' ? '📝 Tryout' : pkg.type === 'latihan' ? '📚 Latihan' : '📦 Bundle'}
                      </span>
                    </div>
                    <p className="package-desc">{pkg.description || 'Deskripsi paket.'}</p>
                    <div className="package-info" style={{ marginBottom: '15px' }}>
                      <span>{pkg.question_count || 0} soal</span>
                      <span className="package-price">Rp {(pkg.price || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <button
                      className="btn btn-success"
                      onClick={() => navigate(`/quiz/${pkg.id}`)}
                      style={{ width: '100%' }}
                    >
                      Mulai Mengerjakan
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return <div className="quiz-container">No questions found</div>;

  const question = questions[currentQuestion];
  const currentAnswer = answers[question.id];

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div className="quiz-nav">
          <span className="quiz-title">Studigi</span>
          <Timer initialMinutes={100} onTimeUp={handleTimeUp} />
        </div>
      </div>

      <div className="quiz-content">
        <div className="question-section">
          <div className="question-number">Soal Nomor {question.number}</div>
          <div className="question-text">{question.question_text}</div>

          {question.image_url && !imageErrors[question.id] && (
            <div className="question-image">
              <img 
                src={convertGoogleDriveUrl(question.image_url)} 
                alt="Question" 
                onLoad={() => handleImageLoad(question.id)}
                onError={() => handleImageError(question.id)}
                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                crossOrigin="anonymous"
              />
            </div>
          )}

          {question.image_url && imageErrors[question.id] && (
            <div className="question-image" style={{ padding: '20px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '20px', border: '1px solid #ffc107' }}>
              <p>⚠️ Gambar tidak bisa ditampilkan</p>
              <details style={{ marginTop: '10px', fontSize: '12px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Detail teknis</summary>
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontFamily: 'monospace' }}>
                  <div><strong>URL original:</strong></div>
                  <div style={{ wordBreak: 'break-all' }}>{question.image_url}</div>
                  <div style={{ marginTop: '10px' }}><strong>URL dikonversi:</strong></div>
                  <div style={{ wordBreak: 'break-all' }}>{convertGoogleDriveUrl(question.image_url)}</div>
                  <div style={{ marginTop: '10px' }}>
                    <strong>Solusi:</strong>
                    <ul>
                      <li>Pastikan file di Google Drive bisa diakses publik</li>
                      <li>Atau coba upload gambar ke ImgBB (https://imgbb.com) atau Imgur</li>
                      <li>Cek akses sharing: "Anyone with the link" atau "Public"</li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}

          <div className="options">
            {['A', 'B', 'C', 'D', 'E'].map((option) => (
              <button
                key={option}
                className={`option-btn ${currentAnswer === option ? 'selected' : ''}`}
                onClick={() => handleSelectAnswer(option)}
              >
                <span className="option-label">{option}</span>
                <span>{question[`option_${option.toLowerCase()}`]}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="question-navigator">
          <h4>Navigasi Soal</h4>
          <div className="question-grid">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                className={`question-btn ${
                  idx === currentQuestion ? 'current' : answers[q.id] ? 'answered' : ''
                }`}
                onClick={() => setCurrentQuestion(idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="legend">
            <div><span className="legend-current">■</span> Current</div>
            <div><span className="legend-answered">■</span> Answered</div>
          </div>
        </aside>
      </div>

      <div className="quiz-footer">
        <button
          disabled={currentQuestion === 0}
          onClick={() => setCurrentQuestion(currentQuestion - 1)}
          className="btn btn-primary"
        >
          ← Previous
        </button>
        <button onClick={handleFinish} className="btn btn-danger">
          Finish Tryout
        </button>
        <button
          disabled={currentQuestion === questions.length - 1}
          onClick={() => setCurrentQuestion(currentQuestion + 1)}
          className="btn btn-primary"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default Quiz;
