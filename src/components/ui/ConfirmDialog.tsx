import { useEffect } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColor = variant === 'danger' ? '#e53935' : '#1db954';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20000,
        padding: '1rem',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{ color: '#bbb', margin: '0 0 1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: confirmColor,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Info-only dialog (no cancel button) — for "feature not available" messages
 */
type InfoDialogProps = {
  open: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
  linkUrl?: string;
  linkText?: string;
};

export const InfoDialog = ({
  open,
  title,
  message,
  buttonText = 'OK',
  onClose,
  linkUrl,
  linkText,
}: InfoDialogProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20000,
        padding: '1rem',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '320px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📲</div>

        {/* Title */}
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{ color: '#bbb', margin: '0 0 1rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </p>

        {/* Link */}
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              borderRadius: '6px',
              padding: '0.6rem 1.2rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            {linkText || 'Download App'}
          </a>
        )}

        {/* Close Button */}
        <div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};
