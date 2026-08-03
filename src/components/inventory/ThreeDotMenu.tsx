import React, { useEffect, useRef } from 'react';
import type { AvailabilityStatus } from '../../types';

interface ThreeDotMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: AvailabilityStatus) => void;
  currentStatus: AvailabilityStatus;
}

const ThreeDotMenu: React.FC<ThreeDotMenuProps> = ({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  currentStatus,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay adding the listener to avoid immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems: { label: string; onClick: () => void; color?: string; hidden?: boolean }[] = [
    { label: 'Edit', onClick: onEdit },
    {
      label: '✅ Mark as Available',
      onClick: () => onStatusChange('available'),
      hidden: currentStatus === 'available',
    },
    {
      label: '⚠️ Mark as Low Stock',
      onClick: () => onStatusChange('low'),
      hidden: currentStatus === 'low',
    },
    {
      label: '❌ Mark as Out of Stock',
      onClick: () => onStatusChange('out_of_stock'),
      hidden: currentStatus === 'out_of_stock',
    },
    { label: 'Delete', onClick: onDelete, color: 'var(--accent-red)' },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: '36px',
        right: '8px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '4px 0',
        minWidth: '180px',
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {menuItems
        .filter((item) => !item.hidden)
        .map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              color: item.color || 'var(--text-primary)',
              fontSize: '0.85rem',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </button>
        ))}
    </div>
  );
};

export default ThreeDotMenu;
