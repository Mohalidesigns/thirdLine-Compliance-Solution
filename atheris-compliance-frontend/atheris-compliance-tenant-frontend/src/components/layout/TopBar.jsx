import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppTopBar, UserCircleIcon, KeyIcon, ArrowRightOnRectangleIcon } from 'shared';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import NotificationsPanel from '../notifications/NotificationsPanel';

const ROLE_LABEL = {
  TENANT_ADMIN: 'Tenant Admin', CCO: 'Chief Compliance Officer', ANALYST: 'Compliance Analyst', AUDITOR: 'Auditor', IT_OPS: 'IT Operations',
};

export default function TopBar({ offset, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCount = () => {
    api.notifications.count().then(c => setUnreadCount(c?.unread ?? 0)).catch(() => {});
  };

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <>
      <AppTopBar
        offset={offset}
        onMenuClick={onMenuClick}
        searchPlaceholder="Search obligations, controls, returns..."
        onSearch={(q) => { if (q.trim()) navigate(`/obligations?q=${encodeURIComponent(q.trim())}`); }}
        notificationCount={unreadCount}
        onNotificationsClick={() => setNotifOpen(true)}
        user={{ name: user?.fullName || 'User', role: ROLE_LABEL[user?.role] || user?.role }}
        menuItems={[
          { label: 'Profile', icon: <UserCircleIcon />, onClick: () => navigate('/settings') },
          { label: 'Change password', icon: <KeyIcon />, onClick: () => navigate('/settings') },
          { label: 'Logout', icon: <ArrowRightOnRectangleIcon />, onClick: logout, divider: true, danger: true },
        ]}
      />
      <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); fetchCount(); }} />
    </>
  );
}
