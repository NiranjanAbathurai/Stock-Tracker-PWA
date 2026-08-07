import React, { useRef, useState, useCallback } from 'react';
import type { AvailabilityStatus } from '../../types';

interface SwipeAction {
  label: string;
  color: string;
  status: AvailabilityStatus;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  currentStatus: AvailabilityStatus;
  onStatusChange: (status: AvailabilityStatus) => void;
  disabled?: boolean;
}

/**
 * Determines swipe actions based on current status:
 * - Available: left → Low Stock, right → Out of Stock
 * - Low Stock: left → Available, right → Out of Stock
 * - Out of Stock: left → Available, right → Low Stock
 */
function getSwipeActions(currentStatus: AvailabilityStatus): { left: SwipeAction; right: SwipeAction } {
  switch (currentStatus) {
    case 'available':
      return {
        left: { label: '⚠️ Low Stock', color: 'var(--accent-orange, #F97316)', status: 'low' },
        right: { label: '❌ Out of Stock', color: 'var(--accent-red, #EF4444)', status: 'out_of_stock' },
      };
    case 'low':
      return {
        left: { label: '✅ Available', color: 'var(--accent-green, #22C55E)', status: 'available' },
        right: { label: '❌ Out of Stock', color: 'var(--accent-red, #EF4444)', status: 'out_of_stock' },
      };
    case 'out_of_stock':
      return {
        left: { label: '✅ Available', color: 'var(--accent-green, #22C55E)', status: 'available' },
        right: { label: '⚠️ Low Stock', color: 'var(--accent-orange, #F97316)', status: 'low' },
      };
  }
}

const SWIPE_THRESHOLD = 70; // px needed to trigger action
const MAX_SWIPE = 120; // max visual displacement

const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, currentStatus, onStatusChange, disabled }) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const actions = getSwipeActions(currentStatus);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = touch.clientX;
    isHorizontalRef.current = null;
    setIsSwiping(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || disabled) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    // Determine direction on first significant move
    if (isHorizontalRef.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    // If vertical scroll, don't interfere
    if (!isHorizontalRef.current) return;

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();

    currentXRef.current = touch.clientX;
    const clampedDx = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
    setOffsetX(clampedDx);
  }, [isSwiping, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || disabled) {
      setIsSwiping(false);
      return;
    }

    const dx = currentXRef.current - startXRef.current;

    // Check if swipe exceeded threshold
    if (dx < -SWIPE_THRESHOLD) {
      // Swiped left → left action
      onStatusChange(actions.left.status);
    } else if (dx > SWIPE_THRESHOLD) {
      // Swiped right → right action
      onStatusChange(actions.right.status);
    }

    // Reset
    setOffsetX(0);
    setIsSwiping(false);
    isHorizontalRef.current = null;
  }, [isSwiping, disabled, actions, onStatusChange]);

  // Calculate opacity of action indicators based on swipe distance
  const leftOpacity = offsetX < 0 ? Math.min(1, Math.abs(offsetX) / SWIPE_THRESHOLD) : 0;
  const rightOpacity = offsetX > 0 ? Math.min(1, offsetX / SWIPE_THRESHOLD) : 0;
  const leftTriggered = offsetX < -SWIPE_THRESHOLD;
  const rightTriggered = offsetX > SWIPE_THRESHOLD;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '14px',
      }}
    >
      {/* Left action indicator (revealed when swiping left) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '16px',
          background: actions.left.color,
          opacity: leftOpacity,
          transition: isSwiping ? 'none' : 'opacity 0.2s',
          borderRadius: '14px',
        }}
      >
        <span style={{
          color: '#fff',
          fontSize: leftTriggered ? '0.8rem' : '0.7rem',
          fontWeight: 600,
          transition: 'font-size 0.1s',
        }}>
          {actions.left.label}
        </span>
      </div>

      {/* Right action indicator (revealed when swiping right) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '16px',
          background: actions.right.color,
          opacity: rightOpacity,
          transition: isSwiping ? 'none' : 'opacity 0.2s',
          borderRadius: '14px',
        }}
      >
        <span style={{
          color: '#fff',
          fontSize: rightTriggered ? '0.8rem' : '0.7rem',
          fontWeight: 600,
          transition: 'font-size 0.1s',
        }}>
          {actions.right.label}
        </span>
      </div>

      {/* Swipeable content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s ease-out',
          zIndex: 1,
          touchAction: isHorizontalRef.current ? 'none' : 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableRow;
