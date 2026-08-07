import React, { useState, useEffect, useRef } from 'react';
import type { Product, AvailabilityStatus } from '../../types';

interface ExpiringSoonProps {
  products: Product[];
  onEdit?: (product: Product) => void;
  onStatusChange?: (productId: number, status: AvailabilityStatus) => void;
  onDelete?: (productId: number) => void;
}

const ExpiringSoon: React.FC<ExpiringSoonProps> = ({ products, onEdit, onStatusChange, onDelete }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Expiring/Expired items (only available products with expiry dates)
  const expiryItems = products
    .filter((p) => {
      if (!p.expiryDate) return false;
      if (p.availability === 'No') return false;
      const expiry = new Date(p.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      return expiry <= sevenDaysFromNow;
    })
    .map((p) => {
      const expiry = new Date(p.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const diffTime = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Out of stock items
  const outOfStock = products.filter((p) => p.availability === 'No');

  // Determine which accordion opens by default
  const hasExpiryIssues = expiryItems.length > 0;
  const hasOutOfStock = outOfStock.length > 0;

  // If nothing to show, display success message
  if (!hasExpiryIssues && !hasOutOfStock) {
    return (
      <div style={{ marginTop: '20px' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '14px',
            padding: '28px 20px',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🎉</div>
          <p style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600 }}>
            All good!
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem' }}>
            No items expiring soon and everything is in stock.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Section 1: Expiring / Expired */}
      <AccordionSection
        title={`⏰ Expiring & Expired (${expiryItems.length})`}
        titleColor={hasExpiryIssues ? 'var(--accent-red)' : 'var(--text-primary)'}
        defaultOpen={hasExpiryIssues}
        storageKey="accordion-expiring"
      >
        {expiryItems.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem', padding: '8px 0' }}>
            ✅ No items expiring in the next 7 days.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {expiryItems.map((item) => (
              <ExpiryItem
                key={item.id}
                item={item}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </AccordionSection>

      {/* Section 2: Out of Stock */}
      <AccordionSection
        title={`🛒 Out of Stock (${outOfStock.length})`}
        titleColor={hasOutOfStock ? 'var(--accent-orange)' : 'var(--text-primary)'}
        defaultOpen={!hasExpiryIssues && hasOutOfStock}
        storageKey="accordion-out-of-stock"
      >
        {outOfStock.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem', padding: '8px 0' }}>
            ✅ Everything is in stock.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {outOfStock.map((item) => (
              <OutOfStockItem
                key={item.id}
                item={item}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </AccordionSection>
    </div>
  );
};

// ─── Accordion Section Component ───
interface AccordionSectionProps {
  title: string;
  titleColor: string;
  defaultOpen: boolean;
  storageKey: string;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  titleColor,
  defaultOpen,
  storageKey,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) return saved === 'true';
    return defaultOpen;
  });

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    sessionStorage.setItem(storageKey, String(newState));
  };

  return (
    <div
      style={{
        background: 'rgba(30, 35, 50, 0.7)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Accordion Header */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: titleColor,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{title}</span>
        <span
          style={{
            fontSize: '0.85rem',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div style={{ padding: '0 16px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Inline Three-Dot Menu for Dashboard Items ───
interface ItemMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: AvailabilityStatus) => void;
  currentStatus: AvailabilityStatus;
}

const ItemMenu: React.FC<ItemMenuProps> = ({ isOpen, onClose, onEdit, onDelete, onStatusChange, currentStatus }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
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
    { label: '✏️ Edit', onClick: onEdit },
    {
      label: '✅ Mark Available',
      onClick: () => onStatusChange('available'),
      hidden: currentStatus === 'available',
    },
    {
      label: '⚠️ Mark Low Stock',
      onClick: () => onStatusChange('low'),
      hidden: currentStatus === 'low',
    },
    {
      label: '❌ Mark Out of Stock',
      onClick: () => onStatusChange('out_of_stock'),
      hidden: currentStatus === 'out_of_stock',
    },
    { label: '🗑️ Delete', onClick: onDelete, color: 'var(--accent-red)' },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: '0',
        marginTop: '4px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '4px 0',
        minWidth: '170px',
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
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: item.color || 'var(--text-primary)',
              fontSize: '0.8rem',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {item.label}
          </button>
        ))}
    </div>
  );
};

// ─── Expiry Item Row ───
interface ExpiryItemProps {
  item: Product & { daysLeft: number };
  onEdit?: (product: Product) => void;
  onStatusChange?: (productId: number, status: AvailabilityStatus) => void;
  onDelete?: (productId: number) => void;
}

const ExpiryItem: React.FC<ExpiryItemProps> = ({ item, onEdit, onStatusChange, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const getIndicatorColor = (days: number) => {
    if (days < 0) return 'var(--accent-red)';
    if (days <= 1) return 'var(--accent-red)';
    if (days <= 3) return 'var(--accent-orange)';
    return 'var(--accent-green)';
  };

  const getDaysLabel = (days: number) => {
    if (days < 0) {
      const absDays = Math.abs(days);
      return absDays === 1 ? 'Expired 1d ago' : `Expired ${absDays}d ago`;
    }
    if (days === 0) return 'Expires today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  const currentStatus: AvailabilityStatus = item.availability_status || (item.availability === 'Yes' ? 'available' : 'out_of_stock');

  return (
    <div
      onClick={() => onEdit?.(item)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-input)',
        cursor: onEdit ? 'pointer' : 'default',
      }}
    >
      {/* Color indicator */}
      <div
        style={{
          width: '4px',
          height: '32px',
          borderRadius: '2px',
          background: getIndicatorColor(item.daysLeft),
          flexShrink: 0,
        }}
      />

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.product}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
          {item.stockType || 'General'}
        </div>
      </div>

      {/* Days badge */}
      <div
        style={{
          padding: '3px 8px',
          borderRadius: '10px',
          background: `${getIndicatorColor(item.daysLeft)}15`,
          color: getIndicatorColor(item.daysLeft),
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {getDaysLabel(item.daysLeft)}
      </div>

      {/* Three-dot menu button */}
      {(onStatusChange || onDelete) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '1.1rem',
            lineHeight: 1,
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
          aria-label="Options"
        >
          ⋮
        </button>
      )}

      {/* Menu dropdown */}
      {menuOpen && (
        <ItemMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEdit={() => onEdit?.(item)}
          onDelete={() => onDelete?.(item.id)}
          onStatusChange={(status) => onStatusChange?.(item.id, status)}
          currentStatus={currentStatus}
        />
      )}
    </div>
  );
};

// ─── Out of Stock Item Row ───
interface OutOfStockItemProps {
  item: Product;
  onEdit?: (product: Product) => void;
  onStatusChange?: (productId: number, status: AvailabilityStatus) => void;
  onDelete?: (productId: number) => void;
}

const OutOfStockItem: React.FC<OutOfStockItemProps> = ({ item, onEdit, onStatusChange, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const currentStatus: AvailabilityStatus = item.availability_status || 'out_of_stock';

  return (
    <div
      onClick={() => onEdit?.(item)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-input)',
        cursor: onEdit ? 'pointer' : 'default',
      }}
    >
      {/* Red dot indicator */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--accent-orange)',
          flexShrink: 0,
        }}
      />

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.product}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
          {item.stockType || 'General'}
        </div>
      </div>

      {/* Out of stock badge */}
      <div
        style={{
          padding: '3px 8px',
          borderRadius: '10px',
          background: 'rgba(249, 115, 22, 0.15)',
          color: 'var(--accent-orange)',
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Needs restock
      </div>

      {/* Three-dot menu button */}
      {(onStatusChange || onDelete) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '1.1rem',
            lineHeight: 1,
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
          aria-label="Options"
        >
          ⋮
        </button>
      )}

      {/* Menu dropdown */}
      {menuOpen && (
        <ItemMenu
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onEdit={() => onEdit?.(item)}
          onDelete={() => onDelete?.(item.id)}
          onStatusChange={(status) => onStatusChange?.(item.id, status)}
          currentStatus={currentStatus}
        />
      )}
    </div>
  );
};

export default ExpiringSoon;
