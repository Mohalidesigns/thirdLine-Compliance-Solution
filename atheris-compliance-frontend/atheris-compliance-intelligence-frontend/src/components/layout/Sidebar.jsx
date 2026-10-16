import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppSidebar, Squares2x2Icon, InboxArrowDownIcon, EyeIcon, BuildingLibraryIcon, BuildingOffice2Icon,
  KeyIcon, QueueListIcon, DocumentTextIcon, BookOpenIcon, ScaleIcon, BanknotesIcon, CalendarIcon,
  ShieldCheckIcon, GlobeAltIcon, Cog6ToothIcon, ClipboardDocumentCheckIcon,
} from 'shared';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ROUTES, NAV_SECTIONS } from '../../utils/constants';

const ICONS = {
  Squares2x2: Squares2x2Icon, InboxArrowDown: InboxArrowDownIcon, Eye: EyeIcon,
  BuildingLibrary: BuildingLibraryIcon, BuildingOffice2: BuildingOffice2Icon, Key: KeyIcon,
  QueueList: QueueListIcon, DocumentText: DocumentTextIcon, BookOpen: BookOpenIcon, Scale: ScaleIcon,
  Banknotes: BanknotesIcon, Calendar: CalendarIcon, ShieldCheck: ShieldCheckIcon, GlobeAlt: GlobeAltIcon,
  ClipboardDocumentCheck: ClipboardDocumentCheckIcon,
};

const BRAND = { name: 'atheris', tagline: 'Compliance Intelligence' };

export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'PLATFORM_ADMIN';

  // Platform admins manage compliance + operations + tenants; intelligence users get the inbox views.
  const sections = NAV_SECTIONS
    .filter((s) => (isAdmin ? s.label !== 'INTELLIGENCE' : !['OPERATIONS', 'TENANTS'].includes(s.label)))
    .map((s) => ({
      key: s.label,
      items: s.items.map((item) => {
        const Icon = ICONS[item.icon] || DocumentTextIcon;
        return { text: item.text, path: item.path, icon: <Icon /> };
      }),
    }));

  const footerItems = isAdmin
    ? []
    : [{ text: 'Settings', path: ROUTES.SETTINGS_API, icon: <Cog6ToothIcon /> }];

  return (
    <AppSidebar
      brand={BRAND}
      sections={sections}
      footerItems={footerItems}
      activePath={location.pathname}
      onNavigate={(path) => { navigate(path); props.onClose?.(); }}
      {...props}
    />
  );
}
