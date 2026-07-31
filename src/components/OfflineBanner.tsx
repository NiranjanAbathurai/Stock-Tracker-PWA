import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

const bannerStyle: CSSProperties = {
  background: '#ff9800',
  color: '#000',
  textAlign: 'center',
  padding: '0.5rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  position: 'sticky',
  top: 0,
  zIndex: 9999,
};

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={bannerStyle}>
      ⚠️ You are offline. Showing cached data. Changes will not be saved.
    </div>
  );
};
