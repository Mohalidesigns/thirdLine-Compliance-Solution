import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppSidebar, Squares2x2Icon, GlobeAltIcon, PresentationChartBarIcon, InboxArrowDownIcon, DocumentTextIcon,
  ScaleIcon, BuildingLibraryIcon, ShieldCheckIcon, ExclamationTriangleIcon, CalendarIcon,
  BanknotesIcon, FingerPrintIcon, FolderOpenIcon, Cog6ToothIcon, BookOpenIcon, ChartBarIcon, ClipboardDocumentCheckIcon,
  QueueListIcon,
} from 'shared';
import verityLogoDark from '../../Verity/verity-logo-dark.png';
import verityMark from '../../Verity/verity-mark.png';
import { api } from '../../services/api';

const BRAND = { name: 'Verity Compliance', tagline: 'Compliance Portal', logo: verityLogoDark, mark: verityMark };

export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.tasks.centerStats({ assignee: 'all' })
      .then(s => { if (!cancelled) setOpenTasks(s?.total || 0); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.review.stats()
      .then(s => { if (!cancelled) setPendingCount(s?.total || 0); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const sections = [
    { key: 'main', items: [
      { text: 'Dashboard', path: '/dashboard', icon: <Squares2x2Icon />, exact: true },
      { text: 'Tasks', path: '/tasks', icon: <QueueListIcon />, badge: openTasks },
      { text: 'Rendition & Coverage', path: '/dashboard/v2', icon: <PresentationChartBarIcon /> },
      { text: 'Review Inbox', path: '/review', icon: <InboxArrowDownIcon />, badge: pendingCount },
    ] },
    { key: 'registers', items: [
      { text: 'Compliance Universe', path: '/universe', icon: <GlobeAltIcon /> },
      { text: 'Instruments', path: '/instruments', icon: <DocumentTextIcon /> },
      { text: 'Acts', path: '/acts', icon: <BookOpenIcon /> },
      { text: 'Obligations', path: '/obligations', icon: <ScaleIcon /> },
      { text: 'Regulators', path: '/regulators', icon: <BuildingLibraryIcon /> },
      { text: 'Controls', path: '/controls', icon: <ShieldCheckIcon /> },
      { text: 'Runbooks', path: '/runbooks', icon: <ClipboardDocumentCheckIcon /> },
      { text: 'Findings', path: '/findings', icon: <ExclamationTriangleIcon /> },
      { text: 'Returns', path: '/returns', icon: <CalendarIcon /> },
      { text: 'Sanctions', path: '/sanctions', icon: <BanknotesIcon /> },
    ] },
    { key: 'assurance', items: [
      { text: 'Reports', path: '/reports', icon: <ChartBarIcon /> },
      { text: 'Audit Trail', path: '/audit', icon: <FingerPrintIcon /> },
      { text: 'Evidence Vault', path: '/evidence', icon: <FolderOpenIcon /> },
    ] },
  ];

  return (
    <AppSidebar
      brand={BRAND}
      sections={sections}
      footerItems={[{ text: 'Settings', path: '/settings', icon: <Cog6ToothIcon /> }]}
      activePath={location.pathname}
      onNavigate={(path) => { navigate(path); props.onClose?.(); }}
      {...props}
    />
  );
}
