/**
 * Content Upload Form Component
 * Allows admin to upload materials (PDF) or questions (Excel)
 */

import React, { useState, useEffect } from 'react';
import { contentService } from '../services/api';
import '../styles/content-upload.css';

const ContentUploadForm = ({ packageId, packageName, onUploadSuccess }) => {
  const [contentType, setContentType] = useState('question'); // 'question' or 'material'
  const [visibility, setVisibility] = useState('visible'); // 'visible' or 'hidden'
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);

  // Reset form when package changes
  useEffect(() => {
    setFile(null);
    setFileName('');
    setError('');
    setSuccess('');
    setUploadProgress(0);
    setFileInfo(null);
  }, [packageId]);

  const getAcceptedFileType = () => {
    return contentType === 'material' ? '.pdf' : '.xlsx,.xls,.csv';
  };

  const getFileTypeLabel = () => {
    return contentType === 'material' ? 'PDF (max 50MB)' : 'Excel (max 10MB)';
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setFileName('');
      setFileInfo(null);
      return;
    }

    // Validate file type
    const lowerName = (selectedFile.name || '').toLowerCase();
    const isValidType = 
      (contentType === 'material' && (selectedFile.type === 'application/pdf' || lowerName.endsWith('.pdf'))) ||
      (contentType === 'question' && 
        ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel',
         'text/csv'].includes(selectedFile.type) || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv'));

    if (!isValidType) {
      setError(`Invalid file type. Expected ${getFileTypeLabel()}`);
      setFile(null);
      return;
    }

    // Validate file size
    const maxSize = contentType === 'material' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileInfo({
      name: selectedFile.name,
      size: (selectedFile.size / 1024 / 1024).toFixed(2),
      type: selectedFile.type,
    });
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!packageId) {
      setError('Package ID is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('packageId', packageId);
      formData.append('contentType', contentType);
      formData.append('visibility', visibility);
      formData.append('packageName', packageName);

      const response = await contentService.upload(formData, {
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(progress);
        },
      });

      setSuccess(`✅ Content uploaded successfully! ${response.data?.message || ''}`);
      setFile(null);
      setFileName('');
      setFileInfo(null);
      setUploadProgress(0);
      
      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
      setLoading(false);

    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Upload failed';
      setError(`Upload failed: ${errMsg}`);
      setLoading(false);
    }
  };

  return (
    <div className="content-upload-form">
      <div className="form-header">
        <h3>📤 Upload Konten</h3>
        <p className="form-subtitle">Paket: {packageName}</p>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible">
          <span>{error}</span>
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setError('')}
          >×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible">
          <span>{success}</span>
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => setSuccess('')}
          >×</button>
        </div>
      )}

      <form onSubmit={handleUpload}>
        {/* Content Type Selection */}
        <div className="form-group">
          <label className="form-label">
            📚 Tipe Konten
            <span className="required">*</span>
          </label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="contentType"
                value="question"
                checked={contentType === 'question'}
                onChange={(e) => {
                  setContentType(e.target.value);
                  setFile(null);
                  setFileInfo(null);
                }}
              />
              <span className="radio-label">
                <span className="radio-title">📝 Soal</span>
                <span className="radio-desc">Upload file Excel dengan soal</span>
              </span>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                name="contentType"
                value="material"
                checked={contentType === 'material'}
                onChange={(e) => {
                  setContentType(e.target.value);
                  setFile(null);
                  setFileInfo(null);
                }}
              />
              <span className="radio-label">
                <span className="radio-title">📄 Materi</span>
                <span className="radio-desc">Upload file PDF untuk materi belajar</span>
              </span>
            </label>
          </div>
        </div>

        {/* Visibility Selection */}
        <div className="form-group">
          <label className="form-label">
            👁️ Visibilitas
            <span className="required">*</span>
          </label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="visibility"
                value="visible"
                checked={visibility === 'visible'}
                onChange={(e) => setVisibility(e.target.value)}
              />
              <span className="radio-label">
                <span className="radio-title">🟢 Tampilkan di Dashboard</span>
                <span className="radio-desc">Paket terlihat di dashboard peserta</span>
              </span>
            </label>

            <label className="radio-option">
              <input
                type="radio"
                name="visibility"
                value="hidden"
                checked={visibility === 'hidden'}
                onChange={(e) => setVisibility(e.target.value)}
              />
              <span className="radio-label">
                <span className="radio-title">⚙️ Arsip Admin</span>
                <span className="radio-desc">Tersembunyi dari dashboard peserta</span>
              </span>
            </label>
          </div>
        </div>

        {/* File Upload */}
        <div className="form-group">
          <label className="form-label">
            📎 Upload File
            <span className="required">*</span>
          </label>
          <p className="file-type-info">
            Format: {getFileTypeLabel()}
          </p>

          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-input"
              accept={getAcceptedFileType()}
              onChange={handleFileChange}
              disabled={loading}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-input-label">
              <span className="upload-icon">📁</span>
              <span className="upload-text">
                {fileName ? `✓ ${fileName}` : 'Klik atau drag file ke sini'}
              </span>
            </label>
          </div>

          {fileInfo && (
            <div className="file-info">
              <p><strong>Nama:</strong> {fileInfo.name}</p>
              <p><strong>Ukuran:</strong> {fileInfo.size} MB</p>
              <p><strong>Tipe:</strong> {fileInfo.type}</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={!file || loading}
            className={`btn btn-primary btn-lg ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Sedang upload...
              </>
            ) : (
              <>
                🚀 Upload Sekarang
              </>
            )}
          </button>
          
          {file && !loading && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setFileName('');
                setFileInfo(null);
              }}
              className="btn btn-secondary"
            >
              ✕ Bersihkan
            </button>
          )}
        </div>
      </form>

      {/* Help Section */}
      <div className="help-section">
        <h4>❓ Bantuan</h4>
        {contentType === 'question' ? (
          <div>
            <p><strong>Format Excel untuk Soal:</strong></p>
            <ul>
              <li><code>number</code> - Nomor soal (1, 2, 3, ...)</li>
              <li><code>category</code> - Kategori (TWK, TIU, TKP)</li>
              <li><code>question_text</code> - Teks soal</li>
              <li><code>option_a, option_b, option_c, option_d, option_e</code> - Pilihan jawaban</li>
              <li><code>correct_answer</code> - Jawaban benar (A, B, C, D, E)</li>
              <li><code>explanation</code> - Penjelasan (opsional)</li>
            </ul>
          </div>
        ) : (
          <div>
            <p><strong>Format Materi PDF:</strong></p>
            <ul>
              <li>File harus berformat PDF yang valid</li>
              <li>Ukuran maksimal 50MB</li>
              <li>Pastikan PDF dapat dibaca dan tidak terenkripsi</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentUploadForm;
