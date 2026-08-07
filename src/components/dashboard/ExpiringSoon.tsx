import React, { useState } from 'react';
import type { Product } from '../../types';

interface ExpiringSoonProps {
  products: Product[];
}

const ExpiringSoon: React.FC<ExpiringSoonProps> = ({ products }) => {
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
              <ExpiryItem key={item.id} item={item} />
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
              <OutOfStockItem key={item.id} item={item} />
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

// ─── Expiry Item Row ───
interface ExpiryItemProps {
  item: Product & { daysLeft: number };
}

const ExpiryItem: React.FC<ExpiryItemProps> = ({ item }) => {
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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-input)',
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
    </div>
  );
};

// ─── Out of Stock Item Row ───
interface OutOfStockItemProps {
  item: Product;
}

const OutOfStockItem: React.FC<OutOfStockItemProps> = ({ item }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--bg-input)',
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
          background: 'var(--accent-orange)15',
          color: 'var(--accent-orange)',
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Needs restock
      </div>
    </div>
  );
};

export default ExpiringSoon;
