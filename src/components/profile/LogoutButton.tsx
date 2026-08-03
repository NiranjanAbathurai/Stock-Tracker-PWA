import React, { useState } from 'react';

interface LogoutButtonProps {
  onLogout: () => void;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: '0 0 16px 0',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          Are you sure you want to logout?
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => setShowConfirm(false)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent-red)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      style={{
        width: '100%',
        padding: '16px',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'rgba(239, 68, 68, 0.08)',
        color: 'var(--accent-red)',
        fontSize: '0.95rem',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.2s',
      }}
    >
      Logout
    </button>
  );
};

export default LogoutButton;
