import React from 'react';
import type { HomeItem } from '../types';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  homes: HomeItem[];
  selectedHomeId: number | null;
  onSelectHome: (homeId: number) => void;
}

const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  homes,
  selectedHomeId,
  onSelectHome,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 900,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '80vw',
          background: 'var(--bg-card)',
          zIndex: 950,
          animation: 'slideIn 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--accent-green)',
            }}
          >
            🏠 My Homes
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-secondary)',
              fontSize: '1.4rem',
              lineHeight: 1,
            }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Home List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0',
          }}
        >
          {homes.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                textAlign: 'center',
              }}
            >
              No homes added yet.
            </div>
          ) : (
            homes.map((home) => {
              const isSelected = home.id === selectedHomeId;
              return (
                <button
                  key={home.id}
                  onClick={() => {
                    onSelectHome(home.id);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '14px 16px',
                    background: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    border: 'none',
                    borderLeft: isSelected ? '3px solid var(--accent-green)' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: isSelected ? 'var(--accent-green)' : 'var(--bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}
                  >
                    🏠
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)',
                      }}
                    >
                      {home.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {home.products?.length || 0} items
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default SideDrawer;
