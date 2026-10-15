import React from 'react';
import type { HomeItem } from '../../types';

interface HomeSelectorProps {
  homes: HomeItem[];
  selectedHomeId: number | null;
  onSelect: (homeId: number) => void;
}

const HomeSelector: React.FC<HomeSelectorProps> = ({ homes, selectedHomeId, onSelect }) => {
  if (homes.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
      {homes.map((home) => {
        const isActive = home.id === selectedHomeId;
        return (
          <button
            key={home.id}
            onClick={() => onSelect(home.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            🏠 {home.name}
          </button>
        );
      })}
    </div>
  );
};

export default HomeSelector;
