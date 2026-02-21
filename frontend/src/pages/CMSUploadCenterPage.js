import React, { useEffect, useState } from 'react';
import { cmsService } from '../services/api';
import '../styles/cms-admin.css';

const CMSUploadCenterPage = () => {
  const [categories, setCategories] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [modules, setModules] = useState([]);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    categoryId: '',
    programId: '',
    moduleId: '',
    contentId: '',
    title: '',
    description: '',
    contentType: 'pdf_material',
    status: 'draft',
    isHidden: false,
    changeNote: '',
  });
  const [file, setFile] = useState(null);

  const loadInitial = async () => {
    try {
      const catRes = await cmsService.getCategories();
      setCategories(catRes.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!form.categoryId) return;
    cmsService.getPrograms({ categoryId: form.categoryId }).then((res) => setPrograms(res.data || [])).catch(() => setPrograms([]));
  }, [form.categoryId]);

  useEffect(() => {
    if (!form.programId) return;
    cmsService.getModules({ programId: form.programId }).then((res) => setModules(res.data || [])).catch(() => setModules([]));
  }, [form.programId]);

  const submitUpload = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const formData = new FormData();
      if (form.contentId) formData.append('contentId', form.contentId);
      if (form.moduleId) formData.append('moduleId', form.moduleId);
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('contentType', form.contentType);
      formData.append('status', form.status);
      formData.append('isHidden', String(form.isHidden));
      formData.append('changeNote', form.changeNote);
      if (file) formData.append('file', file);

      await cmsService.uploadContent(formData);
      setMessage('Upload berhasil, version baru tersimpan.');
      setFile(null);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  return (
    <div className="cms-page">
      <h1>Upload Center</h1>
      <p className="subtitle">Upload konten baru atau upload sebagai version baru (tanpa overwrite).</p>

      <form className="cms-card" onSubmit={submitUpload}>
        <div className="cms-grid two">
          <select className="cms-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, programId: '', moduleId: '' })}>
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="cms-select" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value, moduleId: '' })}>
            <option value="">Select Program</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="cms-select" value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}>
            <option value="">Select Module</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="cms-input" placeholder="Existing Content ID (optional for new version)" value={form.contentId} onChange={(e) => setForm({ ...form, contentId: e.target.value })} />
          <input className="cms-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="cms-select" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}>
            <option value="pdf_material">PDF Material</option>
            <option value="quiz">Quiz</option>
            <option value="tryout">Tryout</option>
          </select>
          <select className="cms-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <input type="file" className="cms-input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <textarea className="cms-textarea" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <textarea className="cms-textarea" placeholder="Change note (for version history)" value={form.changeNote} onChange={(e) => setForm({ ...form, changeNote: e.target.value })} />

        <label>
          <input type="checkbox" checked={form.isHidden} onChange={(e) => setForm({ ...form, isHidden: e.target.checked })} /> Hidden content
        </label>

        <div className="cms-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" type="submit">Upload</button>
        </div>

        {message && <div style={{ marginTop: 10 }}>{message}</div>}
      </form>
    </div>
  );
};

export default CMSUploadCenterPage;
