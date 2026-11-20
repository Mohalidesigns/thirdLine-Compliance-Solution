import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppSidebar, Squares2x2Icon, InboxArrowDownIcon, DocumentTextIcon,
  ScaleIcon, BuildingLibraryIcon, ShieldCheckIcon, ExclamationTriangleIcon, CalendarIcon,
  BanknotesIcon, FolderOpenIcon, Cog6ToothIcon, BookOpenIcon, ChartBarIcon, ClipboardDocumentCheckIcon,
  QueueListIcon,
} from 'shared';
import verityLogoDark from '../../atheris-verity/verity-logo-on-black.svg';
import verityMark from '../../atheris-verity/verity-mark-on-black.svg';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const BRAND = { name: 'Verity Compliance', tagline: 'Compliance Portal', logo: verityLogoDark, mark: verityMark };

export default function Sidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  const { data: taskStats } = useQuery({
    queryKey: ['tasks', 'centerStats'],
    queryFn: ({ signal }) => api.tasks.centerStats({}, { signal }),
    refetchInterval: 60000,
  });
  const openTasks = taskStats?.backlog ?? taskStats?.total ?? 0;

  useEffect(() => {
    let cancelled = false;
    const load = () => api.review.stats()
      .then(s => { if (!cancelled) setPendingCount(s?.total || 0); })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const isAnalyst = user?.role === 'ANALYST';

  const sections = [
    { key: 'overview', items: [
      { text: 'Dashboard', path: '/dashboard', icon: <Squares2x2Icon />, exact: true },
      ...(isAnalyst ? [] : [{ text: 'Reports', path: '/reports', icon: <ChartBarIcon /> }]),
      { text: 'Settings', path: '/settings', icon: <Cog6ToothIcon /> },
    ] },
    { key: 'actionables', items: [
      { text: 'Compliance Intelligence', path: '/review', icon: <InboxArrowDownIcon />, badge: pendingCount },
      { text: 'Runbooks', path: '/runbooks', icon: <ClipboardDocumentCheckIcon /> },
      { text: 'Tasks', path: '/tasks', icon: <QueueListIcon />, badge: openTasks },
      { text: 'Findings', path: '/findings', icon: <ExclamationTriangleIcon /> },
    ] },
    { key: 'compendium', items: [
      { text: 'Acts', path: '/acts', icon: <BookOpenIcon /> },
      { text: 'Obligations', path: '/obligations', icon: <ScaleIcon /> },
      { text: 'Instruments', path: '/instruments', icon: <DocumentTextIcon /> },
      { text: 'Regulators', path: '/regulators', icon: <BuildingLibraryIcon /> },
      { text: 'Returns', path: '/returns', icon: <CalendarIcon /> },
      { text: 'Controls', path: '/controls', icon: <ShieldCheckIcon /> },
      { text: 'Sanctions', path: '/sanctions', icon: <BanknotesIcon /> },
      { text: 'Evidence', path: '/evidence', icon: <FolderOpenIcon /> },
    ] },
  ];

  // IT Ops executes runbooks and captures evidence only — show just what it can use.
  const itOps = user?.role === 'IT_OPS';
  const visibleSections = itOps
    ? [{ key: 'ops', items: [
        { text: 'Runbooks', path: '/runbooks', icon: <ClipboardDocumentCheckIcon /> },
        { text: 'Evidence', path: '/evidence', icon: <FolderOpenIcon /> },
      ] }]
    : sections;

  return (
    <AppSidebar
      brand={BRAND}
      sections={visibleSections}
      footerItems={[]}
      activePath={location.pathname}
      onNavigate={(path) => { navigate(path); props.onClose?.(); }}
      {...props}
    />
  );
}
