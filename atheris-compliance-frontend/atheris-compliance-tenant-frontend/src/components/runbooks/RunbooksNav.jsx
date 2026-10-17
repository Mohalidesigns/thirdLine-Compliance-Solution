import { useLocation, useNavigate } from 'react-router-dom';
import { SectionTabs } from 'shared';

// Sub-navigation shared by every Compliance Runbooks page (one sidebar entry, five views).
const TABS = [
  { key: '/runbooks', label: 'Library' },
  { key: '/runbooks/executions', label: 'Executions' },
  { key: '/runbooks/approvals', label: 'Approvals' },
  { key: '/runbooks/templates', label: 'Templates' },
  { key: '/runbooks/coverage', label: 'Coverage' },
];

export default function RunbooksNav({ counts = {} }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = TABS.slice().reverse().find((t) => pathname === t.key || pathname.startsWith(`${t.key}/`))?.key
    ?? '/runbooks';
  return (
    <SectionTabs
      tabs={TABS.map((t) => ({ ...t, count: counts[t.key] }))}
      value={active}
      onChange={(path) => navigate(path)}
      sx={{ mb: 3 }}
    />
  );
}
