import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { StatusBadge, RiskBadge, InformationCircleIcon } from 'shared';

const ellipsis = (maxWidth) => ({
  maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});

export const STATE_TONE = { COMPLIANT: 'green', PARTIAL: 'amber', NON_COMPLIANT: 'red', GAP: 'red', NOT_ASSESSED: 'gray', NO_REQUIREMENTS: 'gray' };
export const STATE_LABEL = {
  COMPLIANT: 'Compliant', PARTIAL: 'Partial', NON_COMPLIANT: 'Non-compliant',
  GAP: 'Coverage gap', NOT_ASSESSED: 'Not assessed', NO_REQUIREMENTS: 'No requirements',
};

export const OBLIGATION_COLUMNS = [
  { id: 'title', label: 'Obligation', minWidth: 360, sortable: true, sortField: 'name',
    render: (item) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={item.name || ''}>
          <Typography variant="body2" sx={{ ...ellipsis(420), color: 'primary.main', fontWeight: 500 }}>
            {item.name || 'Untitled obligation'}
          </Typography>
        </Tooltip>
        {item.description && (
          <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Box>}>
            <Box component="span" sx={{ display: 'inline-flex', color: '#A0AEC0', flexShrink: 0 }}><InformationCircleIcon size={14} /></Box>
          </Tooltip>
        )}
      </Box>
    ) },
  { id: 'regulatorAbbreviation', label: 'Regulator', minWidth: 130, sortable: true,
    render: (item) => (item.regulatorAbbreviation
      ? <Chip size="small" label={item.regulatorAbbreviation} />
      : <Typography variant="body2" color="text.secondary">—</Typography>) },
  { id: 'complianceState', label: 'Compliance', minWidth: 150,
    render: (item) => (
      <Tooltip title={item.requirementCount
        ? `${item.coveredRequirementCount ?? 0} of ${item.requirementCount} requirements covered`
          + (item.gapRequirementCount ? ` · ${item.gapRequirementCount} with no control` : '')
        : 'No requirements'}>
        <span>
          <StatusBadge tone={STATE_TONE[item.complianceState] || 'gray'}
            label={STATE_LABEL[item.complianceState] || item.complianceState || '—'}
            dot={item.complianceState === 'NON_COMPLIANT' || item.complianceState === 'GAP'} />
        </span>
      </Tooltip>
    ) },
  { id: 'controlCount', label: 'Controls', minWidth: 110,
    render: (item) => {
      const count = item.controlCount ?? 0;
      return <Typography variant="body2"
        sx={count === 0 ? { color: 'text.secondary' } : { color: '#2D7D46' }}>{count}</Typography>;
    } },
  { id: 'residualRiskRating', label: 'Residual risk', minWidth: 130,
    render: (item) => (
      <Tooltip title={item.residualReason || ''}>
        <span><RiskBadge value={item.residualRiskRating} emptyLabel="Unrated" /></span>
      </Tooltip>
    ) },
];