import React from 'react';

const SmartCampaignBanner = ({ campaigns = [], onClickCampaign }) => {
  if (!campaigns.length) return null;

  return (
    <div className="smart-campaign-stack">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="smart-campaign-card">
          {campaign.bannerUrl && (
            <img
              src={campaign.bannerUrl}
              alt={campaign.title}
              className="smart-campaign-image"
            />
          )}
          <div className="smart-campaign-content">
            <div className="smart-campaign-title">{campaign.title}</div>
            {campaign.description && <div className="smart-campaign-desc">{campaign.description}</div>}
            <button
              className="btn btn-primary"
              onClick={() => onClickCampaign?.(campaign)}
            >
              {campaign.cta_text || 'Lihat Penawaran'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SmartCampaignBanner;
