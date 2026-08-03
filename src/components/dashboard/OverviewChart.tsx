import React from 'react';
import type { Product } from '../../types';

interface OverviewChartProps {
  products: Product[];
}

const OverviewChart: React.FC<OverviewChartProps> = ({ products }) => {
  const total = products.length;

  // Count by availability status
  // The existing Product type uses availability: 'Yes' | 'No' | ''
  // and availability_status?: AvailabilityStatus
  // We'll use availability_status if present, otherwise derive from availability field
  const available = products.filter((p) => {
    if (p.availability_status) return p.availability_status === 'available';
    return p.availability === 'Yes' && !p.isExpired;
  }).length;

  const lowStock = products.filter((p) => {
    if (p.availability_status) return p.availability_status === 'low';
    return false; // Legacy products don't have low stock concept
  }).length;

  const outOfStock = products.filter((p) => {
    if (p.availability_status) return p.availability_status === 'out_of_stock';
    return p.availability === 'No' || p.isExpired;
  }).length;

  const percentage = total > 0 ? Math.round((available / total) * 100) : 0;

  // SVG circular progress
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        {/* Circular Progress */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--bg-input)"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--accent-green)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {percentage}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>stocked</div>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <StatCard label="Available" count={available} color="var(--accent-green)" />
          <StatCard label="Low Stock" count={lowStock} color="var(--accent-orange)" />
          <StatCard label="Out of Stock" count={outOfStock} color="var(--accent-red)" />
        </div>
      </div>

      {total === 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '12px', fontSize: '0.85rem' }}>
          No items yet. Add your first item!
        </p>
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  count: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, count, color }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      borderRadius: '10px',
      background: 'var(--bg-primary)',
    }}
  >
    <div
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{count}</div>
  </div>
);

export default OverviewChart;
