import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useHomes } from '../../hooks/useHomes';
import type { Product } from '../../types';
import HomeSelector from '../dashboard/HomeSelector';
import OverviewChart from '../dashboard/OverviewChart';
import ExpiringSoon from '../dashboard/ExpiringSoon';
import AddItemSheet from '../dashboard/AddItemSheet';
import EditProductModal from '../inventory/EditProductModal';

interface DashboardScreenProps {
  selectedHomeId: number | null;
  onSelectHome: (homeId: number) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ selectedHomeId, onSelectHome }) => {
  const { homes, isLoading, error, reload, updateProduct, deleteProduct, addHome } = useHomes();
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [newHomeName, setNewHomeName] = useState('');
  const [isAddingHome, setIsAddingHome] = useState(false);
  const [addHomeError, setAddHomeError] = useState<string | null>(null);

  // Fetch user name from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        setUserName(name);
      }
    };
    fetchUser();
  }, []);

  const selectedHome = homes.find((h) => h.id === selectedHomeId);
  const products = selectedHome?.products || [];

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const firstName = userName.split(' ')[0];

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--bg-input)',
            borderTopColor: 'var(--accent-green)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: '12px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <p style={{ color: 'var(--accent-red)', fontSize: '0.9rem' }}>{error}</p>
        <button
          onClick={reload}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--accent-green)',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Empty State: No Homes ───
  if (homes.length === 0) {
    const handleAddHome = async () => {
      const name = newHomeName.trim();
      if (!name) return;
      setAddHomeError(null);
      setIsAddingHome(true);
      try {
        const newHome = await addHome(name);
        setNewHomeName('');
        onSelectHome(newHome.id);
      } catch (err) {
        setAddHomeError(err instanceof Error ? err.message : 'Failed to add home');
      } finally {
        setIsAddingHome(false);
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Greeting */}
        <div>
          <h1
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {getGreeting()}, {firstName}
          </h1>
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              margin: '4px 0 0 0',
            }}
          >
            Let's get you started!
          </p>
        </div>

        {/* Add Home Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '2px solid var(--accent-green)',
            padding: '28px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginTop: '20px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            🏠
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Add Your First Home
          </h2>

          {/* Description */}
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Create a home to start tracking your stock — kitchen, bedroom, office, or anywhere you store things.
          </p>

          {/* Input + Button */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
            <input
              type="text"
              value={newHomeName}
              onChange={(e) => setNewHomeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddHome()}
              placeholder="e.g., Kitchen, My Home"
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddHome}
              disabled={isAddingHome || !newHomeName.trim()}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: newHomeName.trim() ? 'var(--accent-green)' : 'var(--bg-input)',
                color: newHomeName.trim() ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: newHomeName.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
                opacity: isAddingHome ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isAddingHome ? '...' : '+ Add'}
            </button>
          </div>

          {/* Error */}
          {addHomeError && (
            <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', margin: 0 }}>
              {addHomeError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Greeting */}
      <div>
        <h1
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {getGreeting()}, {firstName}
        </h1>
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            margin: '4px 0 0 0',
          }}
        >
          Here's your stock overview
        </p>
      </div>

      {/* Home Selector */}
      <HomeSelector
        homes={homes}
        selectedHomeId={selectedHomeId}
        onSelect={onSelectHome}
      />

      {/* Overview Chart */}
      <OverviewChart products={products} />

      {/* Expiring Soon */}
      <div data-tour-id="tour-product-list">
      <ExpiringSoon
        products={products}
        onEdit={(product) => setEditingProduct(product)}
        onStatusChange={async (productId, status) => {
          if (!selectedHomeId) return;
          try {
            if (status === 'available') {
              // Open edit popup so user can add quantity/expiry — only saves on confirm
              const product = products.find(p => p.id === productId);
              if (product) {
                setEditingProduct({ ...product, availability: 'Yes', availability_status: 'available' });
              }
            } else if (status === 'out_of_stock') {
              await updateProduct(selectedHomeId, productId, { availability: 'No', availability_status: status, expiryDate: '' });
            } else {
              await updateProduct(selectedHomeId, productId, { availability: 'Yes', availability_status: status });
            }
          } catch { /* handled silently */ }
        }}
        onDelete={async (productId) => {
          if (!selectedHomeId) return;
          try {
            await deleteProduct(selectedHomeId, productId);
          } catch { /* handled silently */ }
        }}
      />
      </div>

      {/* Full-width Add Item Button */}
      <button
        data-tour-id="tour-add-item"
        onClick={() => setIsAddSheetOpen(true)}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          border: '2px solid var(--accent-green)',
          background: 'rgba(34, 197, 94, 0.12)',
          color: 'var(--accent-green)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '8px',
          marginBottom: '70px', /* Space for the mic FAB */
        }}
      >
        <span style={{ fontSize: '1.2rem', fontWeight: 300 }}>+</span>
        Add Item
      </button>

      {/* Add Item Sheet */}
      {selectedHomeId && (
        <AddItemSheet
          isOpen={isAddSheetOpen}
          onClose={() => setIsAddSheetOpen(false)}
          homeId={selectedHomeId}
          onItemAdded={reload}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && selectedHomeId && (
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
    </div>
  );
};

export default DashboardScreen;
