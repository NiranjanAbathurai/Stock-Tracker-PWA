import React from 'react';
import type { Tab } from '../types';

interface HeaderProps {
  activeTab: Tab;
  onHamburgerClick: () => void;
  onRightIconClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onHamburgerClick, onRightIconClick }) => {
  const getTitle = (): string => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'inventory': return 'Inventory';
      case 'profile': return 'Profile';
    }
  };

  const getRightIcon = () => {
    // Bell icon on all pages
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
      }}
    >
      {/* Hamburger */}
      <button
        onClick={onHamburgerClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Open menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Title */}
      <h1
        style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'var(--accent-green)',
          margin: 0,
          letterSpacing: '0.3px',
        }}
      >
        {getTitle()}
      </h1>

      {/* Right icon */}
      <button
        onClick={onRightIconClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Notifications"
      >
        {getRightIcon()}
      </button>
    </header>
  );
};

export default Header;
