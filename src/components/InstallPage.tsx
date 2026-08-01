import { useState, useEffect } from 'react';

// Store the deferred prompt globally
let deferredPrompt: Event | null = null;

// Capture the beforeinstallprompt event as early as possible
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
  const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent));

  useEffect(() => {
    // Already installed — go straight to app
    if (window.matchMedia('(display-mode: standalone)').matches) {
      onSkip();
      return;
    }

    // Listen for the prompt if not already captured
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setInstallReady(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [onSkip]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt as unknown as {
      prompt: () => void;
      userChoice: Promise<{ outcome: string }>;
    };
    promptEvent.prompt();
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
      <div style={iconStyle}>
        <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>ST</span>
      </div>

      <h1 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 0.25rem' }}>Stock Tracker</h1>
      <p style={{ color: '#aaa', fontSize: '0.85rem', textAlign: 'center', maxWidth: '280px', marginBottom: '2rem' }}>
        Track your home inventory with expiry notifications.
      </p>

      {/* Install Button — Android/Chrome */}
      {installReady && !isIOS && (
        <button type="button" onClick={handleInstall} style={installBtnStyle}>
          📲 Install App
        </button>
      )}

      {/* Waiting for prompt — show button anyway */}
      {!installReady && !isIOS && (
        <button type="button" onClick={() => alert('Please use your browser menu → "Install app" or "Add to Home Screen"')} style={installBtnStyle}>
          📲 Install App
        </button>
      )}

      {/* iOS Instructions */}
      {isIOS && (
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '1rem', maxWidth: '300px', textAlign: 'center', marginBottom: '1rem' }}>
          <p style={{ color: '#f0ad4e', fontSize: '0.75rem', margin: '0 0 0.5rem', fontWeight: 600 }}>
            ⚠️ Recommended: Use Safari browser
          </p>
          <p style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.5rem', fontWeight: 600 }}>To install on iOS:</p>
          <p style={{ color: '#ccc', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
            Tap <strong style={{ color: '#fff' }}>Share</strong> (↑) → <strong style={{ color: '#fff' }}>Add to Home Screen</strong>
          </p>
          <p style={{ color: '#999', fontSize: '0.7rem', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
            PWA installation on iOS is only supported in Safari.
          </p>
        </div>
      )}

      {/* Skip */}
      <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', marginTop: '1.5rem' }}>
        Skip, open in browser
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

const iconStyle = {
  width: '90px',
  height: '90px',
  borderRadius: '20px',
  background: '#1db954',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '1.5rem',
  boxShadow: '0 4px 20px rgba(29, 185, 84, 0.3)',
};

const installBtnStyle = {
  background: '#1db954',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '0.85rem 2.5rem',
  fontSize: '1.1rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(29, 185, 84, 0.4)',
};
