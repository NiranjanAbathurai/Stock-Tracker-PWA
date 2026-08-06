import React, { useState, useEffect } from 'react';
import { Tab } from '../types';
import { useHomes } from '../hooks/useHomes';
import { usePushNotification } from '../hooks/usePushNotification';
import { DEFAULT_CATEGORIES } from '../config/categories';
import Header from './Header';
import SideDrawer from './SideDrawer';
import BottomNav from './BottomNav';
import { VoiceAssistantFAB } from './VoiceAssistantFAB';
import DashboardScreen from './screens/DashboardScreen';
import InventoryScreen from './screens/InventoryScreen';
import ProfileScreen from './screens/ProfileScreen';

interface AppShellProps {
  children?: React.ReactNode;
  onLogout?: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { homes, addProduct, deleteProduct, updateProduct } = useHomes();
  const { isSupported: pushSupported, isSubscribed, toggle: toggleNotifications } = usePushNotification();

  // Auto-select first home when homes load
  useEffect(() => {
    if (homes.length > 0 && selectedHomeId === null) {
      setSelectedHomeId(homes[0].id);
    }
  }, [homes, selectedHomeId]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const handleBellClick = async () => {
    if (!pushSupported) {
      setToastMessage('📱 Install the app first to enable notifications');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    try {
      await toggleNotifications();
      const newState = !isSubscribed;
      setToastMessage(newState ? '🔔 Notifications ON' : '🔕 Notifications OFF');
    } catch (err) {
      setToastMessage('❌ Failed to toggle notifications. Check browser permissions.');
    }
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toast notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-green)',
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'messageFadeIn 0.3s ease-out',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        onHamburgerClick={() => setDrawerOpen(true)}
        onRightIconClick={handleBellClick}
      />

      {/* Side Drawer */}
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        homes={homes}
        selectedHomeId={selectedHomeId}
        onSelectHome={setSelectedHomeId}
      />

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '80px' }}>
        {activeTab === 'dashboard' && (
          <DashboardScreen selectedHomeId={selectedHomeId} onSelectHome={setSelectedHomeId} />
        )}
        {activeTab === 'inventory' && (
          <InventoryScreen selectedHomeId={selectedHomeId} />
        )}
        {activeTab === 'profile' && <ProfileScreen onLogout={handleLogout} />}
      </main>

      {/* Voice FAB */}
      <VoiceAssistantFAB
        homes={homes}
        catalog={DEFAULT_CATEGORIES.map((name, idx) => ({ id: idx + 1, name, items: [] }))}
        onAddProduct={addProduct}
        onDeleteProduct={deleteProduct}
        onUpdateProduct={updateProduct}
      />

      {/* Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default AppShell;
