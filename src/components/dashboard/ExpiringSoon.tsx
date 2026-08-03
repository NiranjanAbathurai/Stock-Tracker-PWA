import React from 'react';
import type { Product } from '../../types';

interface ExpiringSoonProps {
  products: Product[];
}

const ExpiringSoon: React.FC<ExpiringSoonProps> = ({ products }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Filter products expiring within 7 days
  const expiringSoon = products
    .filter((p) => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      return expiry >= today && expiry <= sevenDaysFromNow;
    })
    .map((p) => {
      const expiry = new Date(p.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const diffTime = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div style={{ marginTop: '20px' }}>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 12px 0',
        }}
      >
        ⏰ Expiring Soon
      </h3>

      {expiringSoon.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            All good! No items expiring in the next 7 days.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expiringSoon.map((item) => (
            <ExpiryItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

interface ExpiryItemProps {
  item: Product & { daysLeft: number };
}

const ExpiryItem: React.FC<ExpiryItemProps> = ({ item }) => {
  const getIndicatorColor = (days: number) => {
    if (days <= 1) return 'var(--accent-red)';
    if (days <= 3) return 'var(--accent-orange)';
    return 'var(--accent-green)';
  };

  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '12px 16px',
      }}
    >
      {/* Color indicator */}
      <div
        style={{
          width: '4px',
          height: '36px',
          borderRadius: '2px',
          background: getIndicatorColor(item.daysLeft),
          flexShrink: 0,
        }}
      />

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.product}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {item.stockType || 'General'}
        </div>
      </div>

      {/* Days badge */}
      <div
        style={{
          padding: '4px 10px',
          borderRadius: '12px',
          background: `${getIndicatorColor(item.daysLeft)}20`,
          color: getIndicatorColor(item.daysLeft),
          fontSize: '0.75rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {getDaysLabel(item.daysLeft)}
      </div>
    </div>
  );
};

export default ExpiringSoon;
