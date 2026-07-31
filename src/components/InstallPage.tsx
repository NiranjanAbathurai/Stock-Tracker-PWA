import { useState, useEffect, useCallback } from 'react';

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
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [promptFailed, setPromptFailed] = useState(false);

  const triggerInstall = useCallback(async () => {
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
    } else {
      // User dismissed the install prompt
      setPromptFailed(true);
    }

    deferredPrompt = null;
  }, [onSkip]);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      setTimeout(() => onSkip(), 1000);
      return;
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
    if (isIOSDevice) return; // iOS can't auto-install

    // If prompt is already available, trigger immediately
    if (deferredPrompt) {
      triggerInstall();
      return;
    }

    // Wait for the prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      // Auto-trigger install immediately
      triggerInstall();
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Timeout — if prompt doesn't fire within 5 seconds, show manual options
    const timeout = setTimeout(() => {
      if (!deferredPrompt) {
        setPromptFailed(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
  }, [onSkip, triggerInstall]);

  // Already installed
  if (installed) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ color: '#1db954', margin: '0.5rem 0' }}>App Installed!</h2>
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Opening Stock Tracker...</p>
      </div>
    );
  }

  // iOS — show manual instructions
  if (isIOS) {
    return (
      <div style={containerStyle}>
        <div style={iconStyle}><span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>ST</span></div>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>Stock Tracker</h1>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1.25rem',
          maxWidth: '300px',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <p style={{ color: '#fff', fontSize: '0.9rem', margin: '0 0 0.75rem', fontWeight: 600 }}>
            Install on iOS:
          </p>
          <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            1. Tap the <strong style={{ color: '#fff' }}>Share</strong> button (↑)<br />
            2. Scroll down and tap<br /><strong style={{ color: '#fff' }}>Add to Home Screen</strong>
          </p>
        </div>
        <button type="button" onClick={onSkip} style={skipStyle}>Use in browser instead</button>
      </div>
    );
  }

  // Prompt failed or timed out — show manual install button
  if (promptFailed) {
    return (
      <div style={containerStyle}>
        <div style={iconStyle}><span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>ST</span></div>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>Stock Tracker</h1>
        <p style={{ color: '#aaa', fontSize: '0.85rem', textAlign: 'center', maxWidth: '280px', marginBottom: '1.5rem' }}>
          Use your browser menu to install this app, or continue using it in the browser.
        </p>
        <button type="button" onClick={onSkip} style={{
          background: '#1db954',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Continue to App
        </button>
      </div>
    );
  }

  // Loading — waiting for install prompt to fire
  return (
    <div style={containerStyle}>
      <div style={iconStyle}><span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff' }}>ST</span></div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 1rem' }}>Stock Tracker</h1>
      <div style={{
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #1db954',
        borderRadius: '50%',
        width: '35px',
        height: '35px',
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem',
      }}></div>
      <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Preparing install...</p>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <button type="button" onClick={onSkip} style={{ ...skipStyle, marginTop: '2rem' }}>Skip, use in browser</button>
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

const skipStyle = {
  background: 'none',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  fontSize: '0.85rem',
  textDecoration: 'underline' as const,
};
