/**
 * Package Visibility Badge Component
 * Shows visibility status of packages
 */

import React from 'react';

const VisibilityBadge = ({ visibility }) => {
  if (visibility === 'hidden') {
    return (
      <span className="badge badge-hidden" title="Tersembunyi dari dashboard peserta">
        ⚙️ Arsip Admin
      </span>
    );
  }

  return (
    <span className="badge badge-visible" title="Terlihat di dashboard peserta">
      🟢 Tampilkan
    </span>
  );
};

export default VisibilityBadge;
