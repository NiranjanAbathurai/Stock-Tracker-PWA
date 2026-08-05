import React, { useState } from 'react';
import type { Product, AvailabilityStatus } from '../../types';
import ThreeDotMenu from './ThreeDotMenu';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (productId: number) => void;
  onStatusChange: (productId: number, status: AvailabilityStatus) => void;
}

function getAvailabilityStatus(product: Product): AvailabilityStatus {
  if (product.availability_status) return product.availability_status;
  if (product.availability === 'Yes') return 'available';
  if (product.availability === 'No') return 'out_of_stock';
  return 'available';
}

function getStatusColor(status: AvailabilityStatus): string {
  switch (status) {
    case 'available': return 'var(--accent-green)';
    case 'low': return 'var(--accent-orange)';
    case 'out_of_stock': return 'var(--accent-red)';
  }
}

function getStatusLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'available': return 'In Stock';
    case 'low': return 'Low Stock';
    case 'out_of_stock': return 'Out of Stock';
  }
}

function getCategoryEmoji(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('kitchen') || lower.includes('grocery') || lower.includes('food')) return '🍚';
  if (lower.includes('medicine') || lower.includes('health')) return '💊';
  if (lower.includes('cleaning') || lower.includes('detergent')) return '🧹';
  if (lower.includes('dairy') || lower.includes('milk')) return '🥛';
  if (lower.includes('oil') || lower.includes('cooking')) return '🫒';
  if (lower.includes('spice')) return '🌶️';
  return '📦';
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete, onStatusChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getAvailabilityStatus(product);
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);
  const emoji = getCategoryEmoji(product.stockType || '');

  return (
    <div
      onClick={(e) => {
        // Don't trigger if clicking the menu button or menu itself
        const target = e.target as HTMLElement;
        if (target.closest('[data-menu-trigger]') || target.closest('[data-menu-dropdown]')) return;
        onEdit(product);
      }}
      style={{
        position: 'relative',
        background: 'var(--bg-card)',
        borderRadius: '14px',
        padding: '14px 16px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Category icon */}
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '10px',
        background: 'var(--bg-input)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.3rem',
        flexShrink: 0,
      }}>
        {emoji}
      </div>

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {product.product || 'Unnamed Product'}
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginTop: '2px',
        }}>
          {product.quantity || '—'}
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        padding: '4px 10px',
        borderRadius: '8px',
        background: `${statusColor}20`,
        border: `1px solid ${statusColor}40`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.7rem',
          color: statusColor,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Three-dot menu button */}
      <button
        data-menu-trigger="true"
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
          fontSize: '1.2rem',
          lineHeight: 1,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
        aria-label="Product options"
      >
        ⋮
      </button>

      {/* ThreeDotMenu dropdown */}
      <ThreeDotMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={() => onEdit(product)}
        onDelete={() => onDelete(product.id)}
        onStatusChange={(newStatus) => onStatusChange(product.id, newStatus)}
        currentStatus={status}
      />
    </div>
  );
};

export default ProductCard;
