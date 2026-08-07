import React, { useState, useMemo } from 'react';
import { useHomes } from '../../hooks/useHomes';
import type { Product, AvailabilityStatus } from '../../types';
import SearchBar from '../inventory/SearchBar';
import CategoryTabs from '../inventory/CategoryTabs';
import ProductCard from '../inventory/ProductCard';
import EditProductModal from '../inventory/EditProductModal';
import SwipeableRow from '../ui/SwipeableRow';

interface InventoryScreenProps {
  selectedHomeId: number | null;
}

type FilterMode = 'all' | 'out_of_stock';

const InventoryScreen: React.FC<InventoryScreenProps> = ({ selectedHomeId }) => {
  const { homes, isLoading, error, updateProduct, deleteProduct, reload } = useHomes();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Get products for selected home
  const selectedHome = homes.find((h) => h.id === selectedHomeId);
  const products = selectedHome?.products || [];

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.stockType && p.stockType.trim()) {
        cats.add(p.stockType.trim());
      }
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filter products by search, category, and toggle filter
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = searchQuery === '' ||
        p.product.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' ||
        p.stockType.trim() === activeCategory;

      // Toggle filter
      let matchesFilter = true;
      if (filterMode === 'out_of_stock') {
        const status = p.availability_status || (p.availability === 'Yes' ? 'available' : 'out_of_stock');
        matchesFilter = status === 'out_of_stock' || status === 'low';
      }

      return matchesSearch && matchesCategory && matchesFilter;
    });
  }, [products, searchQuery, activeCategory, filterMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStatusChange = async (productId: number, status: AvailabilityStatus) => {
    if (!selectedHomeId) return;

    try { 
      if (status === 'out_of_stock') {
        // Mark as out of stock — reset expiry date, no popup
        const updates: Partial<Product> = { availability: 'No', availability_status: status, expiryDate: '' };
        await updateProduct(selectedHomeId, productId, updates);
      } else {
        // Mark as available or low stock — just update status directly, no popup
        await updateProduct(selectedHomeId, productId, { availability: 'Yes', availability_status: status });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update product.');
    }
  };

  const handleDelete = (productId: number) => {
    setDeleteConfirmId(productId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null && selectedHomeId !== null) {
      deleteProduct(selectedHomeId, deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
      }}>
        Loading inventory...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        gap: '12px',
      }}>
        <div style={{ color: 'var(--accent-red)', fontSize: '0.9rem' }}>{error}</div>
        <button
          onClick={reload}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--accent-green)',
            color: '#fff',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-red)',
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '0.85rem',
            color: 'var(--accent-red)',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Search Bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Toggle Filters: All Products / Out of Stock */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setFilterMode('all')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '10px',
            border: filterMode === 'all' ? '1.5px solid var(--accent-green)' : '1.5px solid var(--border-color)',
            background: filterMode === 'all' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
            color: filterMode === 'all' ? 'var(--accent-green)' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          All Products
        </button>
        <button
          onClick={() => setFilterMode('out_of_stock')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '10px',
            border: filterMode === 'out_of_stock' ? '1.5px solid var(--accent-red)' : '1.5px solid var(--border-color)',
            background: filterMode === 'out_of_stock' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
            color: filterMode === 'out_of_stock' ? 'var(--accent-red)' : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          Out of Stock
        </button>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      )}

      {/* Products List */}
      {homes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 16px',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
        }}>
          No homes found. Add a home from the Dashboard to get started.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 16px',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
        }}>
          {searchQuery || activeCategory !== 'All' || filterMode !== 'all'
            ? 'No products match your filters.'
            : 'No products in this home yet.'}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {filteredProducts.map((product) => (
            <SwipeableRow
              key={product.id}
              currentStatus={product.availability_status || (product.availability === 'Yes' ? 'available' : 'out_of_stock')}
              onStatusChange={(status) => handleStatusChange(product.id, status)}
            >
              <ProductCard
                product={product}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            </SwipeableRow>
          ))}
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && selectedHomeId !== null && (
        <EditProductModal
          isOpen={true}
          onClose={() => setEditingProduct(null)}
          product={editingProduct}
          homeId={selectedHomeId}
          onProductUpdated={() => {
            setEditingProduct(null);
            reload();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
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
            maxWidth: '320px',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              color: 'var(--text-primary)',
              fontSize: '1rem',
            }}>
              Delete Product?
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
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
                onClick={confirmDelete}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent-red)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryScreen;
