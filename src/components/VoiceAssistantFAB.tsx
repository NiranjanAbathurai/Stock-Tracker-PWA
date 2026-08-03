import { useState, useRef, useEffect } from 'react';
import { useVoiceAssistant, type VoiceState, type ChatMessage } from '../hooks/useVoiceAssistant';
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
    chatMessages,
    isSupported,
    toggleRecording,
    clearConversation,
  } = useVoiceAssistant({
    homes,
    catalog,
    onAddProduct,
    onDeleteProduct,
    onUpdateProduct,
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current && isChatOpen) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Auto-open chat when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setIsChatOpen(true);
    }
  }, [chatMessages.length]);

  if (!isSupported) return null;

  return (
    <>
      <style>{`
        @keyframes voicePulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes voiceSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes voiceWave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes messageFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Chat Popup */}
      {isChatOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '186px',
            right: '16px',
            width: 'min(320px, calc(100vw - 32px))',
            maxHeight: '400px',
            background: 'var(--bg-card, #1E293B)',
            borderRadius: '16px',
            border: '1px solid var(--border-color, #334155)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'chatSlideUp 0.3s ease-out',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-primary, #0F172A)',
              borderBottom: '1px solid var(--border-color, #334155)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <span style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600, fontSize: '14px' }}>
                Voice Assistant
              </span>
              {state !== 'idle' && (
                <span
                  style={{
                    fontSize: '11px',
                    color: state === 'recording' ? 'var(--accent-red, #EF4444)' : 'var(--accent-green, #22C55E)',
                    fontWeight: 500,
                  }}
                >
                  {state === 'recording' && '● Listening'}
                  {state === 'processing' && '⏳ Thinking...'}
                  {state === 'speaking' && '🔊 Speaking'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary, #94A3B8)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Clear chat"
                >
                  🗑️
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #94A3B8)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '0 4px',
                }}
                title="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              minHeight: '120px',
              maxHeight: '300px',
            }}
          >
            {chatMessages.length === 0 ? (
              <div
                style={{
                  color: 'var(--text-secondary, #94A3B8)',
                  textAlign: 'center',
                  fontSize: '13px',
                  padding: '24px 0',
                }}
              >
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🎤</span>
                Tap the mic button and speak a command.
                <br />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94A3B8)', opacity: 0.7 }}>
                  e.g. "Add 2 kg rice" or "Eggs are finished"
                </span>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}

            {/* Processing indicator */}
            {state === 'processing' && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: 'var(--bg-input, #334155)',
                  borderRadius: '12px 12px 12px 4px',
                  padding: '10px 14px',
                  animation: 'messageFadeIn 0.3s ease-out',
                }}
              >
                <TypingIndicator />
              </div>
            )}

            {/* Error message in chat */}
            {error && (
              <div
                style={{
                  alignSelf: 'center',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--accent-red, #EF4444)',
                  fontSize: '12px',
                  textAlign: 'center',
                  animation: 'messageFadeIn 0.3s ease-out',
                }}
              >
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
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
          bottom: '120px',
          right: '20px',
          width: '56px',
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

      {/* Chat toggle badge (when chat is closed and has messages) */}
      {!isChatOpen && chatMessages.length > 0 && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: '178px',
            right: '24px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--accent-green, #22C55E)',
            border: 'none',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)',
          }}
          title="Open chat"
        >
          💬
        </button>
      )}
    </>
  );
};

// ============================================================
// Chat Bubble Component
// ============================================================

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        animation: 'messageFadeIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: isUser ? 'var(--accent-green, #22C55E)' : 'var(--bg-input, #334155)',
          color: 'var(--text-primary, #F8FAFC)',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding: '10px 14px',
          fontSize: '13px',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {!isUser && <span style={{ fontSize: '10px', color: 'var(--text-secondary, #94A3B8)', display: 'block', marginBottom: '4px' }}>🤖 Assistant</span>}
        {isUser && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: '4px' }}>🎤 You said</span>}
        {message.text}
      </div>
    </div>
  );
}

// ============================================================
// Typing Indicator
// ============================================================

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--text-secondary, #94A3B8)',
            animation: `voiceWave 1s ease-in-out infinite ${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// Helper Functions
// ============================================================

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
        backgroundColor: 'var(--accent-green, #22C55E)',
        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
      };
    case 'recording':
      return {
        backgroundColor: 'var(--accent-red, #EF4444)',
        animation: 'voicePulse 1.5s infinite',
      };
    case 'processing':
      return {
        backgroundColor: 'var(--bg-input, #334155)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      };
    case 'speaking':
      return {
        backgroundColor: 'var(--accent-green, #22C55E)',
        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
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
