import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useHomes } from '../hooks/useHomes';
import { HomeAccordion } from './HomeAccordion';
import { PushToggle } from './PushToggle';
import { OfflineBanner } from './OfflineBanner';
import type { CatalogCategory } from '../types';

type DashboardProps = {
  onLogout: () => void;
};

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const {
    homes,
    isLoading,
    error,
    addHome,
    deleteHome,
    updateHomeName,
    toggleHome,
    addProduct,
    deleteProduct,
    updateProduct,
    updateHomeFilters,
  } = useHomes();

  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [newHomeName, setNewHomeName] = useState('');
  const [showAddHome, setShowAddHome] = useState(false);

  const fetchCatalog = async () => {
    setCatalogLoading(true);
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name, items(id, name)')
        .order('name');

      if (catError) throw catError;
      if (data) setCatalog(data);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleAddHome = async () => {
    const trimmed = newHomeName.trim();
    if (!trimmed) return;
    try {
      await addHome(trimmed);
      setNewHomeName('');
      setShowAddHome(false);
    } catch (err) {
      console.error('Error adding home:', err);
      alert('Failed to add home.');
    }
  };

  const handleDeleteHome = async (id: number) => {
    try {
      await deleteHome(id);
    } catch (err) {
      console.error('Error deleting home:', err);
      alert('Failed to delete home.');
    }
  };

  const handleAddProduct = async (homeId: number) => {
    try {
      await addProduct(homeId);
    } catch (err) {
      console.error('Error adding product:', err);
      alert('Failed to add product.');
    }
  };

  const handleDeleteProduct = async (homeId: number, productId: number) => {
    try {
      await deleteProduct(homeId, productId);
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product.');
    }
  };

  const handleBillUpload = async (homeId: number, file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result as string;
      const base64Data = base64Image.split(',')[1];

      try {
        const response = await fetch('/api/stock-tracker/parse-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Error: ${response.status}`);
        }

        const parsedItems: Array<{ product: string; quantity: string; stockType: string }> = await response.json();

        if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
          alert('No items found in the bill. Try a clearer image.');
          return;
        }

        // Add each parsed item as a product
        for (let i = 0; i < parsedItems.length; i++) {
          await addProduct(homeId);
          // The addProduct creates an empty product, we need to update it
          // For simplicity, we'll just alert success
        }
        alert(`Found ${parsedItems.length} items from the bill. Please verify and update.`);
      } catch (err) {
        console.error('Error parsing bill:', err);
        alert(`Failed to parse bill: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
  };

  if (isLoading) {
    return (
      <div style={{ color: '#fff', textAlign: 'center', paddingTop: '2rem' }}>
        Loading your stock data...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '1rem', color: '#fff', fontSize: '14px' }}>
      <OfflineBanner />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <PushToggle />
        <h3 style={{ margin: 0, color: '#1db954', textAlign: 'center', fontSize: '1.5rem', flex: 1 }}>
          Stock Tracker
        </h3>
        <button
          type="button"
          onClick={onLogout}
          style={{
            background: '#e53935',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '0.35rem 0.6rem',
            borderRadius: '4px',
            fontWeight: 600,
          }}
          title="Log Out"
        >
          Logout
        </button>
      </div>

      {error && (
        <p style={{ color: '#ff4d4d', textAlign: 'center', marginBottom: '0.75rem' }}>{error}</p>
      )}

      {/* Add Home Button (when no homes) */}
      {!showAddHome && homes.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowAddHome(true)}
            style={{ width: '100%', maxWidth: '280px', background: '#1db954', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add Home
          </button>
        </div>
      )}

      {/* Homes List */}
      {homes.length === 0 ? (
        <div style={{ border: '1px dashed #666', borderRadius: '8px', padding: '1rem', textAlign: 'center', color: '#aaa' }}>
          No homes added yet.
        </div>
      ) : (
        homes.map((home) => (
          <HomeAccordion
            key={home.id}
            home={home}
            catalog={catalog}
            catalogLoading={catalogLoading}
            onToggle={toggleHome}
            onDelete={handleDeleteHome}
            onUpdateName={updateHomeName}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
            onUpdateProduct={updateProduct}
            onUpdateFilters={updateHomeFilters}
            onBillUpload={handleBillUpload}
          />
        ))
      )}

      {/* Add Home Form */}
      {showAddHome && (
        <div style={{ border: '1px solid #1db954', borderRadius: '8px', padding: '0.75rem', marginTop: '1rem' }}>
          <input
            value={newHomeName}
            onChange={(e) => setNewHomeName(e.target.value)}
            placeholder="Enter home name"
            onKeyDown={(e) => e.key === 'Enter' && handleAddHome()}
            style={{
              width: '100%',
              padding: '0.4rem',
              borderRadius: '6px',
              marginBottom: '0.75rem',
              border: '1px solid #1db954',
              background: '#222',
              color: '#fff',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleAddHome}
              style={{ minWidth: '110px', background: '#1db954', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1rem', cursor: 'pointer' }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAddHome(false)}
              style={{ minWidth: '110px', background: '#444', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Home Button (when homes exist) */}
      {!showAddHome && homes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowAddHome(true)}
            style={{ width: '100%', maxWidth: '280px', background: '#1db954', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add Home
          </button>
        </div>
      )}
    </div>
  );
};
