import React, { useState, useMemo, useRef } from 'react';
import type { Product, AvailabilityStatus } from '../../types';
import * as api from '../../services/homeApi';
import { useHomes } from '../../hooks/useHomes';
import { DEFAULT_CATEGORIES } from '../../config/categories';
import { deriveAvailability } from '../../utils/deriveStatus';
import ExpiryDatePicker from '../ui/ExpiryDatePicker';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  homeId: number;
  onProductUpdated: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  homeId,
  onProductUpdated,
}) => {
  const [name, setName] = useState(product.product);
  const [nameSearch, setNameSearch] = useState(product.product);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [category, setCategory] = useState(product.stockType);
  const [quantity, setQuantity] = useState(product.quantity);
  const [expiryDate, setExpiryDate] = useState(product.expiryDate);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>(
    product.availability_status || (product.availability === 'Yes' ? 'available' : 'out_of_stock')
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState(product.stockType);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  const { homes } = useHomes();

  // Build unique product name suggestions from ALL homes
  const allProductNames = useMemo(() => {
    const nameSet = new Set<string>();
    for (const home of homes) {
      for (const p of home.products) {
        if (p.product && p.product.trim()) {
          nameSet.add(p.product.trim());
        }
      }
    }
    return Array.from(nameSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [homes]);

  // Filtered product name suggestions
  const filteredProductNames = useMemo(() => {
    if (!nameSearch.trim()) return allProductNames.slice(0, 10);
    const search = nameSearch.toLowerCase();
    return allProductNames.filter((n) => n.toLowerCase().includes(search)).slice(0, 10);
  }, [allProductNames, nameSearch]);

  // Merge default categories with any custom categories from existing products
  const categoryOptions = useMemo(() => {
    const customCats = new Set<string>();
    const selectedHome = homes.find((h) => h.id === homeId);
    if (selectedHome) {
      selectedHome.products.forEach((p) => {
        if (p.stockType && p.stockType.trim() && !DEFAULT_CATEGORIES.includes(p.stockType.trim())) {
          customCats.add(p.stockType.trim());
        }
      });
    }
    // Also include the current product's category if it's not in the list
    if (product.stockType && product.stockType.trim() && !DEFAULT_CATEGORIES.includes(product.stockType.trim())) {
      customCats.add(product.stockType.trim());
    }
    return [...DEFAULT_CATEGORIES, ...Array.from(customCats).sort()];
  }, [homes, homeId, product.stockType]);

  // Filtered categories based on search input
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoryOptions;
    return categoryOptions.filter((cat) =>
      cat.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categoryOptions, categorySearch]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const availability: Product['availability'] = deriveAvailability(availabilityStatus);
      await api.updateProduct(product.id, {
        product: name,
        stockType: category,
        quantity,
        expiryDate,
        availability,
        availability_status: availabilityStatus,
      });
      onProductUpdated();
      onClose();
    } catch (err) {
      console.error('Error updating product:', err);
      setError('Failed to update product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
    display: 'block',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          color: 'var(--text-primary)',
          fontSize: '1.1rem',
        }}>
          Edit Product
        </h3>

        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--accent-red)',
            fontSize: '0.8rem',
            marginBottom: '12px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Name with autocomplete */}
          <div ref={nameRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Product Name</label>
            <input
              type="text"
              value={showNameDropdown ? nameSearch : name}
              onChange={(e) => {
                setNameSearch(e.target.value);
                setName(e.target.value);
                setShowNameDropdown(true);
              }}
              onFocus={() => {
                setNameSearch(name);
                setShowNameDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowNameDropdown(false), 150);
              }}
              placeholder="Type to search existing products..."
              style={inputStyle}
            />
            {showNameDropdown && filteredProductNames.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '150px',
                  overflowY: 'auto',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  marginTop: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                {filteredProductNames.map((productName) => (
                  <div
                    key={productName}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setName(productName);
                      setNameSearch(productName);
                      setShowNameDropdown(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      color: productName.toLowerCase() === name.toLowerCase() ? 'var(--accent-green)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      background: productName.toLowerCase() === name.toLowerCase() ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    }}
                  >
                    {productName}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category */}
          <div ref={categoryRef} style={{ position: 'relative' }}>
            <label style={labelStyle}>Category</label>
            <input
              type="text"
              value={showCategoryDropdown ? categorySearch : category}
              onChange={(e) => {
                setCategorySearch(e.target.value);
                setCategory(e.target.value);
                setShowCategoryDropdown(true);
              }}
              onFocus={() => {
                setCategorySearch(category);
                setShowCategoryDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowCategoryDropdown(false), 150);
              }}
              placeholder="Type to search or select..."
              style={inputStyle}
            />
            {showCategoryDropdown && filteredCategories.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '150px',
                  overflowY: 'auto',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  marginTop: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                {filteredCategories.map((cat) => (
                  <div
                    key={cat}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCategory(cat);
                      setCategorySearch(cat);
                      setShowCategoryDropdown(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      color: cat === category ? 'var(--accent-green)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      background: cat === category ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label style={labelStyle}>Quantity</label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Expiry Date */}
          <ExpiryDatePicker
            value={expiryDate}
            onChange={setExpiryDate}
            label="Expiry Date"
          />

          {/* Availability Status */}
          <div>
            <label style={labelStyle}>Availability Status</label>
            <select
              value={availabilityStatus}
              onChange={(e) => setAvailabilityStatus(e.target.value as AvailabilityStatus)}
              style={inputStyle}
            >
              <option value="available">Available</option>
              <option value="low">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginTop: '20px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent-green)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
