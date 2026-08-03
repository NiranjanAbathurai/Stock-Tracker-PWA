import React, { useState } from 'react';
import { useHomes } from '../../hooks/useHomes';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: number;
  onItemAdded: () => void;
}

type SheetView = 'options' | 'manual';

const AddItemSheet: React.FC<AddItemSheetProps> = ({ isOpen, onClose, homeId, onItemAdded }) => {
  const [view, setView] = useState<SheetView>('options');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [availability, setAvailability] = useState<'Yes' | 'No'>('Yes');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addProduct } = useHomes();

  const resetForm = () => {
    setName('');
    setCategory('');
    setQuantity('');
    setExpiryDate('');
    setAvailability('Yes');
    setError(null);
    setView('options');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addProduct(homeId, {
        product: name.trim(),
        stockType: category.trim(),
        quantity: quantity.trim(),
        expiryDate: expiryDate,
        availability: availability,
      });
      resetForm();
      onItemAdded();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add item';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          paddingBottom: '32px',
          zIndex: 1001,
          maxHeight: '85vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Handle + Close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ width: '24px' }} />
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: 'var(--bg-input)',
            }}
          />
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 20px 0',
            textAlign: 'center',
          }}
        >
          Add Item
        </h2>

        {view === 'options' && (
          /* Three option cards: Camera, Upload, Manual Entry */
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {/* Camera */}
            <button
              onClick={() => {
                // Placeholder for camera functionality
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                background: 'var(--bg-input)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                minWidth: '80px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>Camera</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Take photo</span>
            </button>

            {/* Upload */}
            <button
              onClick={() => {
                // Placeholder for upload functionality
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                background: 'var(--bg-input)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                minWidth: '80px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>Upload</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Upload bill / image</span>
            </button>

            {/* Manual Entry */}
            <button
              onClick={() => setView('manual')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                background: 'var(--bg-input)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                minWidth: '80px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>Manual Entry</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Enter manually</span>
            </button>
          </div>
        )}

        {view === 'manual' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Back button */}
            <button
              type="button"
              onClick={() => setView('options')}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                color: 'var(--accent-green)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '4px 0',
                fontFamily: 'inherit',
                marginBottom: '4px',
              }}
            >
              ← Back
            </button>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--accent-red)',
                  fontSize: '0.8rem',
                }}
              >
                {error}
              </div>
            )}

            <InputField
              label="Product Name *"
              value={name}
              onChange={setName}
              placeholder="e.g., Milk, Rice, Soap"
            />
            <InputField
              label="Category"
              value={category}
              onChange={setCategory}
              placeholder="e.g., Grocery, Medicine, Cleaning"
            />
            <InputField
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              placeholder="e.g., 2 liters, 1 kg, 3 packs"
            />
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="expiry-date-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Availability
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['Yes', 'No'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAvailability(opt)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border:
                        availability === opt
                          ? `1.5px solid ${opt === 'Yes' ? 'var(--accent-green)' : 'var(--accent-red)'}`
                          : '1.5px solid var(--border-color)',
                      background:
                        availability === opt
                          ? opt === 'Yes'
                            ? 'rgba(34, 197, 94, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)'
                          : 'var(--bg-input)',
                      color:
                        availability === opt
                          ? opt === 'Yes'
                            ? 'var(--accent-green)'
                            : 'var(--accent-red)'
                          : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {opt === 'Yes' ? '✓ Available' : '✗ Out of Stock'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--accent-green)',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                fontFamily: 'inherit',
                transition: 'opacity 0.2s',
              }}
            >
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </button>
          </form>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label
      style={{
        display: 'block',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-input)',
        color: 'var(--text-primary)',
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  </div>
);

export default AddItemSheet;
