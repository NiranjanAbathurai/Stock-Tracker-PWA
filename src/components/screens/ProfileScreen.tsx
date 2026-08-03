import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import MyHomes from '../profile/MyHomes';
import ChangePassword from '../profile/ChangePassword';
import NotificationToggle from '../profile/NotificationToggle';
import HelpSupport from '../profile/HelpSupport';
import LogoutButton from '../profile/LogoutButton';

interface ProfileScreenProps {
  onLogout: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        setUserName(name);
        setUserEmail(user.email || '');
      }
    };
    fetchUser();
  }, []);

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Avatar + User Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '20px 0',
      }}>
        {/* Avatar */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(34, 197, 94, 0.2)',
          border: '3px solid var(--accent-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--accent-green)',
        }}>
          {initials}
        </div>

        {/* Name */}
        <h2 style={{
          margin: 0,
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}>
          {userName}
        </h2>

        {/* Email */}
        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          {userEmail}
        </p>
      </div>

      {/* Menu Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        background: 'var(--bg-card)',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
      }}>
        <MyHomes />
        <ChangePassword />
        <NotificationToggle />
        <HelpSupport />
      </div>

      {/* Logout */}
      <LogoutButton onLogout={onLogout} />
    </div>
  );
};

export default ProfileScreen;
