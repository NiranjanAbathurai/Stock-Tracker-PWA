import { useVoiceAssistant, type VoiceState } from '../hooks/useVoiceAssistant';
import type { HomeItem, CatalogCategory, Product } from '../types';

type VoiceAssistantFABProps = {
  homes: HomeItem[];
  catalog: CatalogCategory[];
  onAddProduct: (homeId: number, data?: Partial<Omit<Product, 'id' | 'isExpired'>>) => Promise<unknown>;
  onDeleteProduct: (homeId: number, productId: number) => Promise<void>;
  onUpdateProduct: (homeId: number, productId: number, fields: Partial<Product>) => Promise<void>;
};

export const VoiceAssistantFAB = ({
  homes,
  catalog,
  onAddProduct,
  onDeleteProduct,
  onUpdateProduct,
}: VoiceAssistantFABProps) => {
  const {
    state,
    error,
    lastResponse,
    isSupported,
    toggleRecording,
  } = useVoiceAssistant({
    homes,
    catalog,
    onAddProduct,
    onDeleteProduct,
    onUpdateProduct,
  });

  if (!isSupported) return null;

  return (
    <>
      <style>{`
        @keyframes voicePulse {
          0% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(229, 57, 53, 0); }
          100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0); }
        }
        @keyframes voiceSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes voiceWave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
      `}</style>

      {/* Status label above the FAB */}
      {state !== 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '16px',
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '220px',
            textAlign: 'center',
            zIndex: 10001,
            backdropFilter: 'blur(4px)',
          }}
        >
          {state === 'recording' && '🎤 Listening...'}
          {state === 'processing' && '🤔 Processing...'}
          {state === 'speaking' && '🔊 Speaking...'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '16px',
            background: 'rgba(229, 57, 53, 0.9)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            maxWidth: '220px',
            textAlign: 'center',
            zIndex: 10001,
          }}
        >
          {error}
        </div>
      )}

      {/* Last AI response (shown briefly) */}
      {lastResponse && state === 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '16px',
            background: 'rgba(29, 185, 84, 0.9)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            maxWidth: '240px',
            textAlign: 'center',
            zIndex: 10001,
          }}
        >
          {lastResponse}
        </div>
      )}

      {/* The FAB button */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={state === 'processing'}
        aria-label={getAriaLabel(state)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '24px',
          width: '60px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          cursor: state === 'processing' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          transition: 'background-color 0.3s ease, transform 0.2s ease',
          transform: state === 'recording' ? 'scale(1.1)' : 'scale(1)',
          ...getButtonStyle(state),
        }}
      >
        {getButtonContent(state)}
      </button>
    </>
  );
};

function getAriaLabel(state: VoiceState): string {
  switch (state) {
    case 'idle': return 'Start voice command';
    case 'recording': return 'Stop recording';
    case 'processing': return 'Processing voice command';
    case 'speaking': return 'Stop speaking';
  }
}

function getButtonStyle(state: VoiceState): React.CSSProperties {
  switch (state) {
    case 'idle':
      return {
        backgroundColor: '#1db954',
        boxShadow: '0 4px 12px rgba(29, 185, 84, 0.4)',
      };
    case 'recording':
      return {
        backgroundColor: '#e53935',
        animation: 'voicePulse 1.5s infinite',
      };
    case 'processing':
      return {
        backgroundColor: '#555',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      };
    case 'speaking':
      return {
        backgroundColor: '#1db954',
        boxShadow: '0 4px 12px rgba(29, 185, 84, 0.4)',
      };
  }
}

function getButtonContent(state: VoiceState): React.ReactNode {
  switch (state) {
    case 'idle':
      return <MicIcon />;
    case 'recording':
      return <StopIcon />;
    case 'processing':
      return <SpinnerIcon />;
    case 'speaking':
      return <SpeakingIcon />;
  }
}

// ============================================================
// SVG Icons
// ============================================================

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'voiceSpin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function SpeakingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="4" y="10" width="3" height="4" rx="1" style={{ animation: 'voiceWave 0.6s ease-in-out infinite', transformOrigin: 'bottom' }} />
      <rect x="9" y="7" width="3" height="10" rx="1" style={{ animation: 'voiceWave 0.6s ease-in-out infinite 0.1s', transformOrigin: 'bottom' }} />
      <rect x="14" y="9" width="3" height="6" rx="1" style={{ animation: 'voiceWave 0.6s ease-in-out infinite 0.2s', transformOrigin: 'bottom' }} />
      <rect x="19" y="8" width="3" height="8" rx="1" style={{ animation: 'voiceWave 0.6s ease-in-out infinite 0.3s', transformOrigin: 'bottom' }} />
    </svg>
  );
}
