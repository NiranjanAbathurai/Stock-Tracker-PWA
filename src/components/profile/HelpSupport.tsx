import React, { useState } from 'react';

const APP_VERSION = '1.0.0';

const HelpSupport: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) return;

    // Construct mailto link
    const mailtoLink = `mailto:support@stocktracker.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.open(mailtoLink, '_blank');

    // Also log to console as fallback
    console.log('[Help & Support] Feedback submitted:', { subject, message });

    setSent(true);
    setSubject('');
    setMessage('');

    // Reset sent state after 3 seconds
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem' }}>💬</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Help & Support
          </span>
        </div>
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div style={{ padding: '0 20px 16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sent ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, color: 'var(--accent-green)', fontSize: '0.9rem', fontWeight: 500 }}>
                ✓ Feedback sent! Thank you.
              </p>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or feedback..."
                rows={4}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '80px',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim()}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: subject.trim() && message.trim() ? 'var(--accent-green)' : 'var(--bg-input)',
                  color: subject.trim() && message.trim() ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: subject.trim() && message.trim() ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Send Feedback
              </button>
            </>
          )}

          {/* App Version */}
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}
          >
            Stock Tracker v{APP_VERSION}
          </p>
        </div>
      )}
    </div>
  );
};

export default HelpSupport;
