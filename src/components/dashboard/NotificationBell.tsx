import React from 'react';
import { usePushNotification } from '../../hooks/usePushNotification';

const NotificationBell: React.FC = () => {
  const { isSupported, isSubscribed, isLoading, toggle } = usePushNotification();

  if (!isSupported) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      style={{
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isLoading ? 'wait' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
      aria-label={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* Badge dot */}
      {isSubscribed && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent-green)',
            border: '2px solid var(--bg-card)',
          }}
        />
      )}
    </button>
  );
};

export default NotificationBell;
