import React, { useEffect, useState } from 'react';
import { cmsService } from '../services/api';
import '../styles/cms-admin.css';

const CMSContentLibraryPage = () => {
  const [contents, setContents] = useState([]);
  const [analytics, setAnalytics] = useState({ views: 0, progress: 0, completionRate: 0 });
  const [status, setStatus] = useState('');
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contentRes, analyticsRes] = await Promise.all([
        cmsService.getContents({ status, contentType, includeHidden: true }),
        cmsService.getAnalyticsOverview(),
      ]);
      setContents(contentRes.data || []);
      setAnalytics(analyticsRes.data || { views: 0, progress: 0, completionRate: 0 });
    } catch (error) {
      console.error('Failed loading CMS library', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status, contentType]);

  return (
    <div className="cms-page">
      <h1>Content Library</h1>
      <p className="subtitle">Kelola konten berdasarkan lifecycle dan type.</p>

      <div className="cms-toolbar">
        <select className="cms-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className="cms-select" value={contentType} onChange={(e) => setContentType(e.target.value)}>
          <option value="">All Types</option>
          <option value="pdf_material">PDF Material</option>
          <option value="quiz">Quiz</option>
          <option value="tryout">Tryout</option>
        </select>
      </div>

      <div className="cms-grid three">
        <div className="cms-card"><strong>Views</strong><div>{analytics.views}</div></div>
        <div className="cms-card"><strong>Avg Progress</strong><div>{analytics.progress}%</div></div>
        <div className="cms-card"><strong>Completion Rate</strong><div>{analytics.completionRate}%</div></div>
      </div>

      <div className="cms-card">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <table className="cms-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Version</th>
                <th>Hidden</th>
              </tr>
            </thead>
            <tbody>
              {contents.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.content_type}</td>
                  <td><span className="cms-badge">{item.status}</span></td>
                  <td>v{item.current_version}</td>
                  <td>{item.is_hidden ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CMSContentLibraryPage;
