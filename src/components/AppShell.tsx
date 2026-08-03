import React, { useState, useEffect } from 'react';
import { Tab } from '../types';
import { useHomes } from '../hooks/useHomes';
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
  const { homes, addProduct, deleteProduct, updateProduct } = useHomes();

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Header
        activeTab={activeTab}
        onHamburgerClick={() => setDrawerOpen(true)}
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
        catalog={[]}
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
