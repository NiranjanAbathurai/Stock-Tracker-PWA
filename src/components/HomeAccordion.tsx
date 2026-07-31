import { useState, useRef } from 'react';
import type { HomeItem, CatalogCategory, Product } from '../types';

type HomeAccordionProps = {
  home: HomeItem;
  catalog: CatalogCategory[];
  catalogLoading: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateName: (id: number, name: string) => void;
  onAddProduct: (homeId: number) => void;
  onDeleteProduct: (homeId: number, productId: number) => void;
  onUpdateProduct: (homeId: number, productId: number, fields: Partial<Product>) => void;
  onUpdateFilters: (homeId: number, filters: Partial<HomeItem['filters']>) => void;
  onBillUpload?: (homeId: number, file: File) => void;
};

export const HomeAccordion = ({
  home,
  catalog,
  catalogLoading,
  onToggle,
  onDelete,
  onUpdateName,
  onAddProduct,
  onDeleteProduct,
  onUpdateProduct,
  onUpdateFilters,
  onBillUpload,
}: HomeAccordionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(home.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onBillUpload) {
      onBillUpload(home.id, file);
    }
    if (e.target) e.target.value = '';
  };

  const headerGreen = '#1db954';
  const stockTypes = catalogLoading ? [] : catalog.map((cat) => cat.name);

  const filteredProducts = home.products.filter((p) => {
    if (home.filters.availability === 'unavailable' && p.availability !== 'No') return false;
    if (home.filters.stockType !== 'all' && p.stockType !== home.filters.stockType) return false;
    return true;
  });

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== home.name) {
      onUpdateName(home.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div style={{ border: `1px solid ${headerGreen}`, borderRadius: '8px', marginBottom: '0.75rem', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.75rem',
          background: '#1a1a1a',
          cursor: 'pointer',
        }}
        onClick={() => !isEditing && onToggle(home.id)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ color: headerGreen, fontSize: '1rem' }}>
            {home.expanded ? '▼' : '▶'}
          </span>
          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                background: '#222',
                border: `1px solid ${headerGreen}`,
                borderRadius: '4px',
                color: '#fff',
                padding: '0.2rem 0.4rem',
                fontSize: '0.9rem',
                flex: 1,
              }}
            />
          ) : (
            <span
              style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setEditName(home.name);
              }}
            >
              {home.name}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this home and all its products?')) {
              onDelete(home.id);
            }
          }}
          style={{ background: 'none', border: 'none', color: '#e53935', cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.25rem' }}
          title="Delete home"
        >
          🗑️
        </button>
      </div>

      {/* Body */}
      {home.expanded && (
        <div style={{ padding: '0.75rem', background: '#111' }}>
          {/* Hidden file inputs */}
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
          <input type="file" ref={cameraInputRef} style={{ display: 'none' }} accept="image/*" capture="environment" onChange={handleFileChange} />

          {/* Stock Type Filter — full width */}
          <select
            value={home.filters.stockType}
            onChange={(e) => onUpdateFilters(home.id, { stockType: e.target.value })}
            style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%', marginBottom: '0.5rem' }}
          >
            <option value="all">All Stock Types</option>
            {stockTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {/* 3 Buttons Row: Show Unavailable | Camera | Upload */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => onUpdateFilters(home.id, { availability: home.filters.availability === 'all' ? 'unavailable' : 'all' })}
              style={{ flex: 1, background: '#f0ad4e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {home.filters.availability === 'all' ? 'Show Unavailable' : 'Show All'}
            </button>
            {onBillUpload && (
              <>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ flex: 1, background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  📷 Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: 1, background: '#00b894', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  🖼️ Upload
                </button>
              </>
            )}
          </div>

          {/* Table */}
          {filteredProducts.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', fontSize: '0.85rem' }}>No products found.</p>
          ) : (
            <div>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 40px',
                gap: '0.5rem',
                padding: '0.5rem 0.5rem',
                borderBottom: '2px solid rgba(255,255,255,0.3)',
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>Product</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>Availability</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'center' }}>Action</span>
              </div>

              {/* Table Rows */}
              {filteredProducts.map((product, index) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  homeId={home.id}
                  catalog={catalog}
                  catalogLoading={catalogLoading}
                  onUpdate={onUpdateProduct}
                  onDelete={onDeleteProduct}
                  showSeparator={index < filteredProducts.length - 1}
                />
              ))}
            </div>
          )}

          {/* Add Product Button */}
          <button
            type="button"
            onClick={() => onAddProduct(home.id)}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              background: 'transparent',
              border: `1px dashed ${headerGreen}`,
              borderRadius: '6px',
              color: headerGreen,
              padding: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            + Add Product
          </button>
        </div>
      )}
    </div>
  );
};

/* ============ Product Row ============ */

type ProductRowProps = {
  product: Product;
  homeId: number;
  catalog: CatalogCategory[];
  catalogLoading: boolean;
  onUpdate: (homeId: number, productId: number, fields: Partial<Product>) => void;
  onDelete: (homeId: number, productId: number) => void;
  showSeparator: boolean;
};

const fieldInput = {
  background: '#2a2a2a',
  color: '#fff',
  border: '1px solid #666',
  borderRadius: '4px',
  padding: '0.4rem 0.5rem',
  fontSize: '0.85rem',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const ProductRow = ({ product, homeId, catalog, catalogLoading, onUpdate, onDelete, showSeparator }: ProductRowProps) => {
  const isExpired = product.isExpired;
  const selectedCategory = catalog.find((cat) => cat.name === product.stockType);
  const productOptions = selectedCategory ? selectedCategory.items : [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 90px 40px',
      gap: '0.5rem',
      padding: '0.6rem 0.5rem',
      borderBottom: showSeparator ? '1px solid rgba(255,255,255,0.15)' : 'none',
      background: isExpired ? 'rgba(229, 57, 53, 0.08)' : 'transparent',
      alignItems: 'start',
    }}>
      {/* Product Column — stacked fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {/* Type of Stock — select dropdown */}
        <select
          value={product.stockType}
          onChange={(e) => onUpdate(homeId, product.id, { stockType: e.target.value, product: '' })}
          disabled={catalogLoading}
          style={fieldInput}
        >
          <option value="">{catalogLoading ? 'Loading...' : 'Type of Stock...'}</option>
          {catalog.map((cat) => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>

        {/* Product Name — input with datalist */}
        <input
          value={product.product}
          onChange={(e) => onUpdate(homeId, product.id, { product: e.target.value })}
          disabled={!product.stockType}
          placeholder={!product.stockType ? 'Select type first...' : 'Product...'}
          list={`product-list-${product.id}`}
          autoComplete="off"
          style={fieldInput}
        />
        <datalist id={`product-list-${product.id}`}>
          {productOptions.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>

        {/* Quantity + Expiry Date on same row */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <input
            type="text"
            value={product.quantity}
            onChange={(e) => onUpdate(homeId, product.id, { quantity: e.target.value })}
            placeholder="Qty"
            style={{ ...fieldInput, width: '60px', flex: '0 0 60px' }}
          />
          <input
            type="date"
            value={product.expiryDate}
            onChange={(e) => onUpdate(homeId, product.id, { expiryDate: e.target.value })}
            style={{ ...fieldInput, flex: 1 }}
          />
        </div>

        {isExpired && (
          <p style={{ color: '#e53935', fontSize: '0.7rem', fontWeight: 600, margin: 0 }}>⚠️ Expired</p>
        )}
      </div>

      {/* Availability Column — Yes/No radio */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingTop: '0.3rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`avail-${product.id}`}
            checked={product.availability === 'Yes'}
            onChange={() => onUpdate(homeId, product.id, { availability: 'Yes' })}
            style={{ accentColor: '#1db954', width: '14px', height: '14px' }}
          />
          Yes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`avail-${product.id}`}
            checked={product.availability === 'No'}
            onChange={() => onUpdate(homeId, product.id, { availability: 'No' })}
            style={{ accentColor: '#1db954', width: '14px', height: '14px' }}
          />
          No
        </label>
      </div>

      {/* Action Column — Delete */}
      <div style={{ paddingTop: '0.3rem', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this product?')) {
              onDelete(homeId, product.id);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#e53935',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '0.2rem',
          }}
          title="Delete product"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
