import React from 'react';
import { usePushNotification } from '../../hooks/usePushNotification';

const NotificationToggle: React.FC = () => {
  const { isSupported, isSubscribed, isLoading, error, toggle } = usePushNotification();

  // Don't render if push notifications aren't supported
  if (!isSupported) return null;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <div>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Notifications
            </span>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              {isSubscribed ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={toggle}
          disabled={isLoading}
          style={{
            width: '48px',
            height: '26px',
            borderRadius: '13px',
            border: 'none',
            background: isSubscribed ? 'var(--accent-green)' : 'var(--bg-input)',
            position: 'relative',
            cursor: isLoading ? 'default' : 'pointer',
            transition: 'background 0.2s',
            opacity: isLoading ? 0.6 : 1,
          }}
          aria-label={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: '3px',
              left: isSubscribed ? '25px' : '3px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>

      {/* Error */}
      {error && (
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-red)' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default NotificationToggle;
