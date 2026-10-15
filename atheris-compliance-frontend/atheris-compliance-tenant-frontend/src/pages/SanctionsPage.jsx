import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tooltip, TablePagination, TableSortLabel, Collapse,
  Snackbar, Alert as MuiAlert,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge,
  ArrowPathIcon, ScaleIcon, CheckCircleIcon, ChevronDownIcon, ExclamationTriangleIcon, BanknotesIcon,
} from 'shared';
import { api } from '../services/api';

const MONO_CHIP_SX = {
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatNaira(amount) {
  if (amount == null) return '-';
  try {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
  } catch { return String(amount); }
}

const COLUMNS = [
  { id: 'actName', label: 'Act & Section', minWidth: 280, sortField: 'actName' },
  { id: 'sanctionType', label: 'Type', minWidth: 150, sortField: 'sanctionType' },
  { id: 'amount', label: 'Amount', minWidth: 150, sortField: 'sanctionAmountNaira' },
  { id: 'severity', label: 'Severity & Enforcement', minWidth: 200, sortField: 'severityScore' },
  { id: 'liableRoles', label: 'Liable Roles', minWidth: 200 },
];

function SanctionDetail({ item }) {
  const blocks = [
    { key: 'violation', label: 'Violation', text: item.description },
    { key: 'penalty', label: 'Penalty', text: item.penaltyDetails },
    { key: 'impact', label: 'Impact', text: item.riskExplanation },
  ].filter(b => b.text);

  if (blocks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No violation, penalty or impact detail recorded for this sanction.
      </Typography>
    );
  }

  return (
    <>
      {blocks.map((b, i) => (
        <Box key={b.key} sx={{ mb: i === blocks.length - 1 ? 0 : 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>{b.label}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{b.text}</Typography>
        </Box>
      ))}
    </>
  );
}

function SanctionRow({ item, index, open, onToggle }) {
  const hasDetail = !!(item.description || item.penaltyDetails || item.riskExplanation);
  const roles = Array.isArray(item.liableRoles) ? item.liableRoles : [];

  return (
    <>
      <TableRow hover
        onClick={hasDetail ? onToggle : undefined}
        sx={{ cursor: hasDetail ? 'pointer' : 'default' }}>
        <TableCell sx={{ width: 72, p: 0.5, whiteSpace: 'nowrap' }}>
          {hasDetail ? (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title={open ? 'Hide detail' : 'Show violation, penalty and impact'}>
              <ChevronDownIcon size={16} sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          ) : (
            <Box sx={{ display: 'inline-block', width: 30 }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"Roboto Mono", monospace' }}>{index}</Typography>
        </TableCell>
        <TableCell>
          <Tooltip title={item.actName || '-'}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main', maxWidth: 280,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || '-'}
            </Typography>
          </Tooltip>
          {item.sourceSectionReference && (
            <Box sx={{ mt: 0.5 }}>
              <Chip size="small" variant="outlined" label={item.sourceSectionReference.slice(0, 24)}
                sx={MONO_CHIP_SX} />
            </Box>
          )}
        </TableCell>
        <TableCell>
          {item.sanctionType
            ? <StatusBadge label={item.sanctionType} tone="red" sx={{ textTransform: 'capitalize' }} />
            : <Typography variant="body2" color="text.secondary">-</Typography>}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'Roboto Mono, monospace', fontSize: '0.8125rem' }}>
            {formatNaira(item.sanctionAmountNaira)}{item.sanctionAmountPerDay ? ' /day' : ''}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.severityScore != null ? (
              <StatusBadge label={`Sev ${item.severityScore}`} dot
                tone={item.severityScore > 7 ? 'red' : item.severityScore > 4 ? 'orange' : 'gray'} />
            ) : (
              <Typography variant="body2" color="text.secondary">-</Typography>
            )}
            {item.hasBeenEnforced
              ? <StatusBadge label="Enforced" tone="green" />
              : <StatusBadge label="Not enforced" tone="gray" />}
          </Box>
        </TableCell>
        <TableCell>
          {roles.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {roles.map(r => (
                <Chip key={r} size="small" label={r} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={COLUMNS.length + 1} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box onClick={(e) => e.stopPropagation()} sx={{ p: 2, bgcolor: '#F9FAFB' }}>
              <Paper sx={{ p: 2 }}>
                <SanctionDetail item={item} />
              </Paper>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function SanctionsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [actFilter, setActFilter] = useState('All');
  const [enforcedFilter, setEnforcedFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedRow, setExpandedRow] = useState(null);

  const [snackbar, setSnackbar] = useState('');

  const hasFilters = search || typeFilter !== 'All' || actFilter !== 'All' || enforcedFilter !== 'All';

  const params = useMemo(() => {
    const p = { page, size: rowsPerPage };
    if (search) p.q = search;
    if (typeFilter !== 'All') p.sanctionType = typeFilter;
    if (actFilter !== 'All') p.actName = actFilter;
    if (enforcedFilter !== 'All') p.enforced = enforcedFilter === 'Yes';
    if (sortField) p.sort = `${sortField},${sortDir}`;
    return p;
  }, [page, rowsPerPage, search, typeFilter, actFilter, enforcedFilter, sortField, sortDir]);

  const listQuery = useQuery({
    queryKey: ['sanctions', 'list', params],
    queryFn: ({ signal }) => api.sanctions.list(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['sanctions', 'stats'],
    queryFn: ({ signal }) => api.sanctions.stats({ signal }),
    staleTime: 5 * 60 * 1000,
  });

  const stats = statsQuery.data;
  const items = useMemo(() => listQuery.data?.content || [], [listQuery.data]);
  const total = listQuery.data?.totalElements ?? 0;

  function clearFilters() {
    setSearch(''); setTypeFilter('All'); setActFilter('All'); setEnforcedFilter('All');
    setPage(0);
  }

  function applyKpiFilter(type) {
    setPage(0);
    if (type === 'highSeverity') { /* filter by severity >= 4 — client side */ }
    else if (type === 'enforced') setEnforcedFilter('Yes');
    else setEnforcedFilter('All');
  }

  const kpis = [
    { key: 'total', label: 'Total Sanctions', value: stats?.total ?? 0, tone: 'blue', icon: <ScaleIcon /> },
    { key: 'highSeverity', label: 'High Severity', value: stats?.highSeverity ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'enforced', label: 'Enforced', value: stats?.enforced ?? 0, tone: 'green', icon: <CheckCircleIcon />, active: enforcedFilter === 'Yes' },
    { key: 'exposure', label: 'Total Exposure', value: formatNaira(stats?.totalExposure), tone: 'orange', icon: <BanknotesIcon /> },
  ];
  const opts = (list) => (list || []).map((v) => ({ value: v, label: v }));

  return (
    <Box>
      <PageHeader
        title="Sanctions Register"
        subtitle={`${total} sanction${total !== 1 ? 's' : ''} — penalties, enforcement and exposure tracking`}
        actions={(
          <Tooltip title="Refresh">
            <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><ArrowPathIcon size={18} /></IconButton>
          </Tooltip>
        )}
      />

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={<Button size="small" onClick={() => listQuery.refetch()}>Retry</Button>}>
          {listQuery.error?.message || 'Failed to load sanctions.'}
        </Alert>
      )}

      <KpiCards items={kpis} onSelect={applyKpiFilter} columns={4} />

      <FilterBar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(0); }, placeholder: 'Search act, type or description...' }}
        filters={[
          { key: 'type', label: 'Sanction Type', value: typeFilter, onChange: (v) => { setTypeFilter(v); setPage(0); },
            options: opts(stats?.sanctionTypes), allLabel: 'All', minWidth: 160 },
          { key: 'act', label: 'Act', value: actFilter, onChange: (v) => { setActFilter(v); setPage(0); },
            options: opts(stats?.actNames), allLabel: 'All', minWidth: 200 },
          { key: 'enforced', label: 'Enforced', value: enforcedFilter, onChange: (v) => { setEnforcedFilter(v); setPage(0); },
            options: opts(['Yes', 'No']), allLabel: 'All', minWidth: 130 },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
      {listQuery.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <ScaleIcon size={48} sx={{ mb: 1, opacity: 0.3 }} />
          <Typography variant="body1">No sanctions found.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 72 }}>#</TableCell>
                  {COLUMNS.map(c => {
                    const active = sortField === c.sortField;
                    return (
                      <TableCell key={c.id} sx={{ minWidth: c.minWidth,
                        cursor: c.sortField ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={c.sortField ? () => {
                          if (sortField === c.sortField) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else { setSortField(c.sortField); setSortDir('asc'); }
                          setPage(0);
                          setExpandedRow(null);
                        } : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={sortDir}
                              sx={{ '& .MuiTableSortLabel-icon': { opacity: active ? 1 : 0.4 } }}>
                              {c.label}
                            </TableSortLabel>
                          : c.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <SanctionRow key={item.sanctionId} item={item}
                    index={page * rowsPerPage + idx + 1}
                    open={expandedRow === item.sanctionId}
                    onToggle={() => setExpandedRow(expandedRow === item.sanctionId ? null : item.sanctionId)} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => { setPage(p); setExpandedRow(null); }}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); setExpandedRow(null); }}
            rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <MuiAlert severity="success" variant="filled" onClose={() => setSnackbar('')}>{snackbar}</MuiAlert>
      </Snackbar>
    </Box>
  );
}
