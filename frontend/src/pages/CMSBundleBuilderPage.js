import React, { useEffect, useState } from 'react';
import { cmsService } from '../services/api';
import '../styles/cms-admin.css';

const CMSBundleBuilderPage = () => {
  const [bundles, setBundles] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [bundleDetail, setBundleDetail] = useState(null);
  const [newBundleName, setNewBundleName] = useState('');
  const [message, setMessage] = useState('');

  const [itemForm, setItemForm] = useState({ contentId: '', sortOrder: 0, isHidden: false });

  const loadBaseData = async () => {
    try {
      const [bundleRes, contentRes] = await Promise.all([
        cmsService.listBundles(),
        cmsService.getContents({ includeHidden: true }),
      ]);
      setBundles(bundleRes.data || []);
      setContents(contentRes.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadBundleDetail = async (bundleId) => {
    if (!bundleId) {
      setBundleDetail(null);
      return;
    }
    const res = await cmsService.getBundleDetail(bundleId);
    setBundleDetail(res.data);
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadBundleDetail(selectedBundleId);
  }, [selectedBundleId]);

  const createBundle = async () => {
    try {
      if (!newBundleName) return;
      await cmsService.createBundle({ name: newBundleName });
      setNewBundleName('');
      setMessage('Bundle created');
      await loadBaseData();
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  const addItem = async () => {
    try {
      if (!selectedBundleId || !itemForm.contentId) return;
      await cmsService.addBundleItem(selectedBundleId, itemForm);
      setMessage('Item added to bundle');
      await loadBundleDetail(selectedBundleId);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await cmsService.removeBundleItem(selectedBundleId, itemId);
      setMessage('Item removed');
      await loadBundleDetail(selectedBundleId);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  };

  return (
    <div className="cms-page">
      <h1>Bundle Builder</h1>
      <p className="subtitle">Bundle dapat berisi multiple contents termasuk hidden contents.</p>

      <div className="cms-card">
        <div className="cms-grid two">
          <input className="cms-input" placeholder="New bundle name" value={newBundleName} onChange={(e) => setNewBundleName(e.target.value)} />
          <button className="btn btn-primary" onClick={createBundle}>Create Bundle</button>

          <select className="cms-select" value={selectedBundleId} onChange={(e) => setSelectedBundleId(e.target.value)}>
            <option value="">Select Bundle</option>
            {bundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select className="cms-select" value={itemForm.contentId} onChange={(e) => setItemForm({ ...itemForm, contentId: e.target.value })}>
            <option value="">Select Content</option>
            {contents.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
          </select>

          <input type="number" className="cms-input" value={itemForm.sortOrder} onChange={(e) => setItemForm({ ...itemForm, sortOrder: Number(e.target.value) })} />
          <label>
            <input type="checkbox" checked={itemForm.isHidden} onChange={(e) => setItemForm({ ...itemForm, isHidden: e.target.checked })} /> Hidden in bundle
          </label>
        </div>
        <div className="cms-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-success" onClick={addItem}>Add Item</button>
        </div>
      </div>

      {bundleDetail && (
        <div className="cms-card">
          <h3>{bundleDetail.bundle?.name}</h3>
          <table className="cms-table">
            <thead>
              <tr>
                <th>Content</th>
                <th>Status</th>
                <th>Hidden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(bundleDetail.items || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.contents?.title || item.content_id}</td>
                  <td>{item.contents?.status || '-'}</td>
                  <td>{item.is_hidden ? 'Yes' : 'No'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && <div className="cms-card">{message}</div>}
    </div>
  );
};

export default CMSBundleBuilderPage;
