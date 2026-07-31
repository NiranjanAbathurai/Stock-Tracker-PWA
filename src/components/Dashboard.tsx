import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useHomes } from '../hooks/useHomes';
import { HomeAccordion } from './HomeAccordion';
import { PushToggle } from './PushToggle';
import { OfflineBanner } from './OfflineBanner';
import { VoiceAssistantFAB } from './VoiceAssistantFAB';
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
  const [isParsingBill, setIsParsingBill] = useState<number | null>(null);

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
    setIsParsingBill(homeId);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result as string;
      const base64Data = base64Image.split(',')[1];

      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${apiBase}/api/stock-tracker/parse-bill`, {
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

        // Add each parsed item — try to match against catalog for accurate stockType/product
        for (const item of parsedItems) {
          let matchedStockType = '';
          let matchedProduct = item.product || '';

          // Try to find the product in the catalog (case-insensitive, partial match)
          const productLower = (item.product || '').toLowerCase();
          let foundInCatalog = false;

          for (const cat of catalog) {
            const matchedItem = cat.items.find(catItem =>
              catItem.name.toLowerCase() === productLower ||
              catItem.name.toLowerCase().includes(productLower) ||
              productLower.includes(catItem.name.toLowerCase())
            );
            if (matchedItem) {
              matchedStockType = cat.name;
              matchedProduct = matchedItem.name;
              foundInCatalog = true;
              break;
            }
          }

          // If product didn't match, try matching the stockType from AI
          if (!foundInCatalog && item.stockType) {
            const stockTypeLower = item.stockType.toLowerCase();
            const matchedCat = catalog.find(cat =>
              cat.name.toLowerCase() === stockTypeLower ||
              cat.name.toLowerCase().includes(stockTypeLower) ||
              stockTypeLower.includes(cat.name.toLowerCase())
            );
            if (matchedCat) {
              matchedStockType = matchedCat.name;
            } else {
              matchedStockType = 'Others';
            }
          } else if (!foundInCatalog) {
            matchedStockType = 'Others';
          }

          await addProduct(homeId, {
            product: matchedProduct,
            quantity: String(item.quantity || '1'),
            stockType: matchedStockType,
            expiryDate: '',
            availability: 'Yes',
          });
        }
      } catch (err) {
        console.error('Error parsing bill:', err);
        alert(`Failed to parse bill: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsParsingBill(null);
      }
    };
    reader.onerror = () => {
      alert('Failed to read the image file.');
      setIsParsingBill(null);
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
    <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '1rem', color: '#fff', fontSize: '14px', position: 'relative' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {isParsingBill !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ border: '4px solid rgba(255, 255, 255, 0.2)', borderTop: '4px solid #1db954', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>Parsing your bill, please wait...</p>
        </div>
      )}
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

      {/* Voice Assistant FAB */}
      <VoiceAssistantFAB
        homes={homes}
        catalog={catalog}
        onAddProduct={addProduct}
        onDeleteProduct={deleteProduct}
        onUpdateProduct={updateProduct}
      />

    </div>
  );
};
