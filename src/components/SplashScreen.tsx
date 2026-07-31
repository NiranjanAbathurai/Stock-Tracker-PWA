import type { CSSProperties } from 'react';

const containerStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  background: '#000000',
  gap: '1.5rem',
};

const titleStyle: CSSProperties = {
  color: '#1db954',
  fontSize: '1.75rem',
  fontWeight: 700,
};

const spinnerStyle: CSSProperties = {
  border: '4px solid rgba(255, 255, 255, 0.2)',
  borderTop: '4px solid #1db954',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  animation: 'spin 1s linear infinite',
};

export const SplashScreen = () => {
  return (
    <div style={containerStyle}>
      <style>
        {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
      </style>
      <h1 style={titleStyle}>Stock Tracker</h1>
      <div style={spinnerStyle}></div>
      <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading...</p>
    </div>
  );
};
