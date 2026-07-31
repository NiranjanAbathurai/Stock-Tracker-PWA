import { usePushNotification } from '../hooks/usePushNotification';
import type { CSSProperties } from 'react';

const buttonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.4rem',
  padding: '0.25rem 0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
};

export const PushToggle = () => {
  const { isSupported, isSubscribed, isLoading, error, toggle } = usePushNotification();

  if (!isSupported) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={toggle}
        disabled={isLoading}
        style={{
          ...buttonStyle,
          opacity: isLoading ? 0.5 : 1,
        }}
        title={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
      >
        {isSubscribed ? '🔔' : '🔕'}
      </button>
      {error && <span style={{ color: '#ff4d4d', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  );
};
