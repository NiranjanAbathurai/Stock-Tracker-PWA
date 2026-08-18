import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AvailabilityStatus } from '../../types';

interface ThreeDotMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: AvailabilityStatus) => void;
  currentStatus: AvailabilityStatus;
  /** Trigger button the menu is positioned against. */
  anchorEl?: HTMLElement | null;
}

const MENU_WIDTH = 180;
const GAP = 6; // space between trigger and menu
const EDGE = 8; // min distance from viewport edges

/**
 * Shared row action menu. Rendered into <body> because the rows it belongs to
 * live inside containers with `overflow: hidden` and `transform` (SwipeableRow,
 * dashboard accordions) — either of which would clip the menu or trap its
 * z-index in a local stacking context.
 */
const ThreeDotMenu: React.FC<ThreeDotMenuProps> = ({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  currentStatus,
  anchorEl,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  // Position against the trigger in viewport coordinates.
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) {
      setPos((p) => (p.ready ? { ...p, ready: false } : p));
      return;
    }

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const menu = menuRef.current;
      const width = menu?.offsetWidth || MENU_WIDTH;
      const height = menu?.offsetHeight || 0;

      // Prefer below the trigger; flip above when there isn't room.
      let top = rect.bottom + GAP;
      if (height && top + height > window.innerHeight - EDGE) {
        const above = rect.top - GAP - height;
        top = above >= EDGE ? above : Math.max(EDGE, window.innerHeight - EDGE - height);
      }

      // Right-align with the trigger, clamped to the viewport.
      const left = Math.min(
        Math.max(EDGE, rect.right - width),
        Math.max(EDGE, window.innerWidth - width - EDGE)
      );

      setPos({ top, left, ready: true });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, anchorEl, currentStatus]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Ignore the trigger itself so it can toggle the menu closed.
      if (anchorEl && anchorEl.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    // Delay adding the listener to avoid immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen) return null;

  const menuItems: { label: string; onClick: () => void; color?: string; hidden?: boolean }[] = [
    { label: '✏️ Edit', onClick: onEdit },
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
    { label: '🗑️ Delete', onClick: onDelete, color: 'var(--accent-red)' },
  ];

  return createPortal(
    <div
      ref={menuRef}
      data-menu-dropdown="true"
      style={{
        position: 'fixed',
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        visibility: pos.ready ? 'visible' : 'hidden',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '4px 0',
        minWidth: `${MENU_WIDTH}px`,
        zIndex: 11000,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {menuItems
        .filter((item) => !item.hidden)
        .map((item, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
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
    </div>,
    document.body
  );
};

export default ThreeDotMenu;
