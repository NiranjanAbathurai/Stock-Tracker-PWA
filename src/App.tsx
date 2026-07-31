import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { SplashScreen } from './components/SplashScreen';
import { SignInForm } from './components/SignInForm';
import { SignUpForm } from './components/SignUpForm';
import { Dashboard } from './components/Dashboard';
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
          // Remove the ?install=true from URL without reload
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
    return <Dashboard onLogout={logout} />;
  }

  // Show auth forms
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 'clamp(1rem, 3vw, 2rem)',
      background: '#000000',
    }}>
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
    </div>
  );
};
