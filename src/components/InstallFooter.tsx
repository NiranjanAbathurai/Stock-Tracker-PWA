import React, { useEffect, useState } from 'react';

/** True when the app is running as an installed PWA rather than a browser tab. */
export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** The install banner is only relevant in a browser tab. */
export function useShowInstallBanner(): boolean {
  const [show] = useState(() => !isStandaloneDisplay());
  return show;
}

interface InstallFooterProps {
  /** Add the iOS home-indicator inset — set when this is the bottom-most bar. */
  safeAreaBottom?: boolean;
}

/**
 * Install prompt bar. Layout-agnostic: it renders as a plain block, so the
 * caller decides where it sits (fixed at the bottom of the viewport, or stacked
 * underneath the bottom nav).
 */
const InstallFooter: React.FC<InstallFooterProps> = ({ safeAreaBottom = true }) => {
  const show = useShowInstallBanner();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    if (!show) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [show]);

  if (!show) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      promptEvent.prompt();
      await promptEvent.userChoice;
      setDeferredPrompt(null);
    } else {
      alert('To install: Open browser menu (⋮) → "Install app" or "Add to Home Screen"');
    }
  };

  return (
    <div
      style={{
        padding: '0.6rem 1rem',
        paddingBottom: safeAreaBottom
          ? 'calc(0.6rem + env(safe-area-inset-bottom, 0px))'
          : '0.6rem',
        background: '#111',
        borderTop: '1px solid #1db954',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}
    >
      <span style={{ color: '#ccc', fontSize: '0.8rem' }}>📱 Install as app</span>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          background: '#1db954',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '0.4rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
    </div>
  );
};

export default InstallFooter;
