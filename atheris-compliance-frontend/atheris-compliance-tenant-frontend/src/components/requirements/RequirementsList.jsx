import { useMemo, useState } from 'react';
import { Box, Typography, Tooltip, Button } from '@mui/material';
import { SectionTable, StateBadge, TL, ShieldCheckIcon } from 'shared';

const STATE_LABEL = {
  COMPLIANT: 'Compliant',
  PARTIAL: 'Partial',
  NON_COMPLIANT: 'Non-compliant',
  NO_CONTROL: 'No control',
  NO_REQUIREMENTS: 'No requirements',
};

const STATE_TONE = { COMPLIANT: 'green', PARTIAL: 'amber', NON_COMPLIANT: 'red', NO_CONTROL: 'red', NO_REQUIREMENTS: 'gray' };

const STATE_HINT = {
  COMPLIANT: 'Every linked control passed its latest test.',
  PARTIAL: 'At least one linked control has not been proven effective yet.',
  NON_COMPLIANT: 'A linked control failed its latest test and none are effective.',
  NO_CONTROL: 'No control covers this requirement — this is a gap.',
};

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function lastTested(controls) {
  const dates = controls.map((c) => c.latestTestDate).filter(Boolean);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

function StateChip({ state, gap }) {
  return (
    <Tooltip title={STATE_HINT[state] || ''}>
      <span>
        <StateBadge tone={STATE_TONE[state] || 'gray'} label={STATE_LABEL[state] || state} dot={gap} />
      </span>
    </Tooltip>
  );
}

const COLUMNS = [
  { id: 'text', label: 'Obligation text', minWidth: 380,
    render: (r) => (
      <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap', maxWidth: 560 }}>{r.text}</Box>} placement="top-start">
        <Typography variant="body2" sx={{ ...ellipsis(500), color: 'primary.main', fontWeight: 500 }}>
          {r.text}
        </Typography>
      </Tooltip>
    ) },
  { id: 'state', label: 'Compliance', minWidth: 150,
    render: (r) => <StateChip state={r.state} gap={r.gap} /> },
  { id: 'coverage', label: 'Controls', minWidth: 140,
    render: (r) => {
      const controls = r.controls || [];
      if (!controls.length) {
        return <Typography variant="body2" color="text.secondary">None</Typography>;
      }
      const effective = controls.filter((c) => c.effective).length;
      const allEffective = effective === controls.length;
      return (
        <Tooltip title={controls.map((c) => c.name || c.controlNumber).filter(Boolean).join(', ')}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="body2" sx={{ color: allEffective ? '#2D7D46' : TL.gray600, fontWeight: 500 }}>
              {effective}/{controls.length}
            </Typography>
            {allEffective && <Box sx={{ color: 'success.main', display: 'flex' }}><ShieldCheckIcon size={15} /></Box>}
          </Box>
        </Tooltip>
      );
    } },
  { id: 'lastTested', label: 'Last Tested', minWidth: 150,
    render: (r) => {
      const controls = r.controls || [];
      if (!controls.length) return <Typography variant="body2" color="text.secondary">—</Typography>;
      const last = lastTested(controls);
      return last
        ? <Typography variant="body2">{formatDate(last)}</Typography>
        : <Typography variant="body2" color="text.secondary">Never</Typography>;
    } },
];

export default function RequirementsList({ requirements = [], onOpen, onAdd }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requirements;
    return requirements.filter((r) => [
      r.text, r.state, r.riskName, r.actName,
    ].some((v) => (v || '').toLowerCase().includes(q)));
  }, [requirements, search]);

  if (!requirements.length) {
    return (
      <Box sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: onAdd ? 2 : 0 }}>
          No requirements recorded for this obligation.
        </Typography>
        {onAdd && <Button size="small" variant="outlined" onClick={onAdd}>Add requirement</Button>}
      </Box>
    );
  }

  return (
    <SectionTable
      columns={COLUMNS}
      rows={filtered}
      total={filtered.length}
      page={0}
      size={filtered.length}
      onPage={() => {}}
      rowsPerPageOptions={[Math.max(filtered.length, 1)]}
      search={{ value: search, onChange: setSearch, placeholder: 'Search requirement, risk or state…' }}
      onRowClick={onOpen ? (r) => onOpen(r) : undefined}
      rowKey={(r) => r.requirementId}
      emptyMessage="No requirements match the current search."
    />
  );
}