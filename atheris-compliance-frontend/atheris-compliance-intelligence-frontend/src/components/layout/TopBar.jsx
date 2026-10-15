import { useNavigate } from 'react-router-dom';
import { AppTopBar, ArrowRightOnRectangleIcon } from 'shared';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../../utils/constants';

const ROLE_LABEL = { PLATFORM_ADMIN: 'Platform Admin' };

export default function TopBar({ offset, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'PLATFORM_ADMIN';
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';

  return (
    <AppTopBar
      offset={offset}
      onMenuClick={onMenuClick}
      searchPlaceholder="Search instruments, regulators..."
      onSearch={isAdmin
        ? (q) => { if (q.trim()) navigate(`${ROUTES.ADMIN_INSTRUMENTS}?q=${encodeURIComponent(q.trim())}`); }
        : undefined}
      user={{ name, role: ROLE_LABEL[user?.role] || user?.role?.replace(/_/g, ' ') }}
      menuItems={[
        { label: 'Logout', icon: <ArrowRightOnRectangleIcon />, onClick: logout, danger: true },
      ]}
    />
  );
}
