import React, { useEffect, useState } from 'react';
import { brandingService } from '../services/api';

const BRANDING_LOGO_CACHE_KEY = 'brandingLogoUrl';

const getApiOrigin = () => {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (configured) {
    try {
      const parsed = new URL(configured, window.location.origin);
      return parsed.origin;
    } catch (_) {
    }
  }
  return window.location.origin;
};

const normalizeLogoUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/api\//i.test(raw)) return `${window.location.origin}${raw}?t=${Date.now()}`;
  if (raw.startsWith('/')) return `${getApiOrigin()}${raw}`;
  return raw;
};

export default function AuthBrandMark({ className = '' }) {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const cachedLogo = normalizeLogoUrl(localStorage.getItem(BRANDING_LOGO_CACHE_KEY));
    if (cachedLogo) setLogoUrl(cachedLogo);

    const loadBranding = async () => {
      try {
        const response = await brandingService.getSettings();
        const data = response?.data || {};
        const nextLogo = normalizeLogoUrl(data.logoUrl || data.logo_url || data.logo || '');
        if (!nextLogo) return;
        setLogoUrl(nextLogo);
        localStorage.setItem(BRANDING_LOGO_CACHE_KEY, nextLogo);
      } catch (error) {
      }
    };

    loadBranding();
  }, []);

  return (
    <div className={`auth-brand-mark ${className}`.trim()}>
      {logoUrl ? <img src={logoUrl} alt="Studigi" className="auth-brand-mark__image" /> : <div className="auth-brand-mark__fallback" />}
    </div>
  );
}
