import React, { useEffect, useState } from 'react';
import { cmsService } from '../services/api';
import '../styles/cms-admin.css';

const CMSWorkflowApprovalPage = () => {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');

  const loadQueue = async () => {
    try {
      const res = await cmsService.getWorkflowQueue();
      setItems(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const runAction = async (contentId, action) => {
    setMessage('');
    try {
      if (action === 'approve') await cmsService.approveContent(contentId);
      if (action === 'publish') await cmsService.publishContent(contentId);
      if (action === 'archive') await cmsService.archiveContent(contentId);
      setMessage(`Action ${action} berhasil untuk content ${contentId}`);
      await loadQueue();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  return (
    <div className="cms-page">
      <h1>Workflow Approval</h1>
      <p className="subtitle">Review lifecycle: Draft → Review → Published → Archived.</p>

      <div className="cms-card">
        <table className="cms-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.content_type}</td>
                <td><span className="cms-badge">{item.status}</span></td>
                <td>
                  <div className="cms-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => runAction(item.id, 'approve')}>Approve</button>
                    <button className="btn btn-sm btn-success" onClick={() => runAction(item.id, 'publish')}>Publish</button>
                    <button className="btn btn-sm btn-danger" onClick={() => runAction(item.id, 'archive')}>Archive</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {message && <div style={{ marginTop: 12 }}>{message}</div>}
      </div>
    </div>
  );
};

export default CMSWorkflowApprovalPage;
