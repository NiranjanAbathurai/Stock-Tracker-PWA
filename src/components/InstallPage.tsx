import { useState, useEffect } from 'react';

// Store the deferred prompt globally
let deferredPrompt: Event | null = null;

// Listen for the beforeinstallprompt event as early as possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

type InstallPageProps = {
  onSkip: () => void;
};

export const InstallPage = ({ onSkip }: InstallPageProps) => {
  const [installReady, setInstallReady] = useState(deferredPrompt !== null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      setTimeout(() => onSkip(), 1500);
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for the install prompt if not already captured
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setInstallReady(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if prompt was already captured
    if (deferredPrompt) {
      setInstallReady(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [onSkip]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promptEvent = deferredPrompt as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    promptEvent.prompt();

    // Wait for the user's response
    const result = await promptEvent.userChoice;

    if (result.outcome === 'accepted') {
      setInstalled(true);
      setTimeout(() => onSkip(), 1500);
    }

    deferredPrompt = null;
    setInstallReady(false);
  };

  if (installed) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ color: '#1db954', margin: '0.5rem 0' }}>App Installed!</h2>
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Opening Stock Tracker...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* App Icon */}
      <div style={{
        width: '100px',
        height: '100px',
        borderRadius: '20px',
        background: '#1db954',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(29, 185, 84, 0.3)',
      }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>ST</span>
      </div>

      <h1 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>Stock Tracker</h1>
      <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', maxWidth: '280px', marginBottom: '2rem' }}>
        Track your home inventory, get expiry notifications, and manage stock on the go.
      </p>

      {/* Install Button */}
      {installReady && !isIOS && (
        <button
          type="button"
          onClick={handleInstall}
          style={{
            background: '#1db954',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.85rem 2rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '1rem',
            boxShadow: '0 2px 10px rgba(29, 185, 84, 0.4)',
          }}
        >
          📲 Install App
        </button>
      )}

      {/* iOS Instructions */}
      {isIOS && (
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1rem',
          maxWidth: '300px',
          textAlign: 'center',
          marginBottom: '1rem',
        }}>
          <p style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            To install on iOS:
          </p>
          <p style={{ color: '#aaa', fontSize: '0.8rem', margin: 0 }}>
            Tap <strong style={{ color: '#fff' }}>Share</strong> (↑) → then <strong style={{ color: '#fff' }}>Add to Home Screen</strong>
          </p>
        </div>
      )}

      {/* Waiting for prompt */}
      {!installReady && !isIOS && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #1db954',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 0.75rem',
          }}></div>
          <p style={{ color: '#aaa', fontSize: '0.8rem' }}>Preparing install...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Skip link */}
      <button
        type="button"
        onClick={onSkip}
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: '0.85rem',
          textDecoration: 'underline',
          marginTop: '1rem',
        }}
      >
        Skip, use in browser
      </button>
    </div>
  );
};

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  alignItems: 'center',
  background: '#000',
  padding: '2rem',
};
