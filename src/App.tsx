import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { SplashScreen } from './components/SplashScreen';
import { SignInForm } from './components/SignInForm';
import { SignUpForm } from './components/SignUpForm';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { HomesProvider } from './contexts/HomesContext';
import { InstallPage } from './components/InstallPage';

export const App = () => {
  const { authState, error, login, logout, clearError } = useAuth();
  const [formMode, setFormMode] = useState<'signin' | 'signup'>('signin');

  // Check if user came from portfolio with ?install=true
  const [showInstall, setShowInstall] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('install') === 'true';
  });

  // Show install page if ?install=true
  if (showInstall) {
    return (
      <InstallPage
        onSkip={() => {
          window.history.replaceState({}, '', '/');
          setShowInstall(false);
        }}
      />
    );
  }

  // Show splash while checking stored credentials
  if (authState === 'loading') {
    return <SplashScreen />;
  }

  // Show dashboard when authenticated
  if (authState === 'authenticated') {
    return (
      <ErrorBoundary>
        <HomesProvider>
          <AppShell onLogout={logout} />
          <InstallFooter />
        </HomesProvider>
      </ErrorBoundary>
    );
  }

  // Show auth forms
  return (
    <>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'clamp(1rem, 3vw, 2rem)',
        paddingBottom: '4rem',
        background: '#000000',
        gap: '1.5rem',
      }}>
        {/* Sign In / Sign Up Form */}
        <div style={{
          width: '100%',
          maxWidth: '420px',
          border: '2px solid #1db954',
          borderRadius: '12px',
          background: '#111111',
          color: '#ffffff',
          padding: 'clamp(1rem, 3vw, 1.5rem)',
          margin: '0 0.75rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {formMode === 'signin' ? (
            <SignInForm
              onSubmit={login}
              onSwitchToSignUp={() => {
                clearError();
                setFormMode('signup');
              }}
              error={error}
            />
          ) : (
            <SignUpForm
              onSwitchToSignIn={() => {
                clearError();
                setFormMode('signin');
              }}
              onSuccess={() => setFormMode('signin')}
            />
          )}
        </div>

        {/* App Intro Section */}
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: '#111111',
          borderRadius: '12px',
          padding: '1.25rem',
          margin: '0 0.75rem',
          color: '#ccc',
          fontSize: '0.85rem',
          lineHeight: 1.6,
        }}>
          <h3 style={{ color: '#1db954', margin: '0 0 0.75rem', fontSize: '1.1rem', textAlign: 'center' }}>
            📦 What is Stock Tracker?
          </h3>
          <p style={{ margin: '0 0 0.5rem' }}>
            Stock Tracker helps you manage your <strong style={{ color: '#fff' }}>home inventory</strong> — track groceries, medicines, cleaning supplies, and more across multiple homes.
          </p>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
            <li>🏠 Organize stock by homes</li>
            <li>📅 Track expiry dates</li>
            <li>🔔 Get notified when products expire</li>
            <li>📷 Add items by scanning bills</li>
            <li>📱 Works offline as an installed app</li>
          </ul>
          <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.8rem', textAlign: 'center' }}>
            Sign up free and start tracking your stock today!
          </p>
        </div>
      </div>
      <InstallFooter />
    </>
  );
};

/* ============ Fixed Footer Install Banner ============ */
const InstallFooter = () => {
  const [isStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    if (isStandalone) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  // Don't show if already standalone
  if (isStandalone) return null;

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
    <div style={{
      position: 'fixed',
      bottom: '68px',
      left: 0,
      right: 0,
      padding: '0.6rem 1rem',
      background: '#111',
      borderTop: '1px solid #1db954',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.5rem',
      zIndex: 900,
    }}>
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
