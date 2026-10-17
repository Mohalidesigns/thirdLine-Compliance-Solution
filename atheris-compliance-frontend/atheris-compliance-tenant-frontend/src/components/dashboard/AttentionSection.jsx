import { useNavigate } from 'react-router-dom';
import {
  KpiCards, ClockIcon, ShieldCheckIcon, LinkIcon, ExclamationTriangleIcon,
} from 'shared';

const ITEMS = [
  { key: 'overdue_returns', label: 'Overdue Returns', icon: ClockIcon, tone: 'red', route: '/returns' },
  { key: 'controls_failing', label: 'Controls Failing', icon: ShieldCheckIcon, tone: 'orange', route: '/controls' },
  { key: 'obligations_no_control', label: 'Obligations Without Controls', icon: LinkIcon, tone: 'purple', route: '/obligations?hasGap=true' },
  { key: 'high_risk_findings', label: 'High-Risk Findings', icon: ExclamationTriangleIcon, tone: 'red', route: '/findings' },
];

/** "Needs attention" stat row — Thirdline stat cards; clicking a card opens its register. */
export default function AttentionSection({ items = {} }) {
  const navigate = useNavigate();

  const kpis = ITEMS.map(({ key, label, icon: Icon, tone }) => {
    const count = items[key] || 0;
    return {
      key,
      label,
      value: count,
      tone: count > 0 ? tone : 'gray',
      icon: <Icon />,
      caption: count > 0 ? 'Action needed' : 'All clear',
    };
  });

  return (
    <KpiCards
      items={kpis}
      columns={4}
      onSelect={(key) => {
        const item = ITEMS.find((i) => i.key === key);
        if (item) navigate(item.route);
      }}
    />
  );
}
