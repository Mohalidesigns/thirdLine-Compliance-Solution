import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, CircularProgress, Alert, Chip, Tooltip,
  TableSortLabel, IconButton, Button, Collapse,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, StatusBadge,
  ArrowPathIcon, ScaleIcon, CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, BanknotesIcon, ChevronDownIcon,
} from 'shared';
import api from '../../../services/api';

const MONO_CHIP_SX = {
  fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem',
};

function formatNaira(amount) {
  if (amount == null) return '-';
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const COLUMNS = [
  { id: 'actName', label: 'Act & Section', minWidth: 280, sortField: 'regulationId' },
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
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{b.label}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{b.text}</Typography>
        </Box>
      ))}
    </>
  );
}

function SanctionRow({ item, index, open, onToggle, onOpen }) {
  const hasDetail = !!(item.description || item.penaltyDetails || item.riskExplanation);
  const roles = Array.isArray(item.liableRoles) ? item.liableRoles : [];

  return (
    <>
      <TableRow hover onClick={onOpen} sx={{ cursor: 'pointer' }}>
        <TableCell sx={{ width: 72, p: 0.5, whiteSpace: 'nowrap' }}>
          {hasDetail ? (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title={open ? 'Hide detail' : 'Show violation, penalty and impact'}>
              <ChevronDownIcon size={16} sx={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          ) : (
            <Box sx={{ display: 'inline-block', width: 30 }} />
          )}
          <Typography variant="caption" color="text.secondary">{index}</Typography>
        </TableCell>
        <TableCell>
          <Tooltip title={item.actName || '-'}>
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, maxWidth: 280,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.actName || '-'}
            </Typography>
          </Tooltip>
          {item.sourceSectionReference && (
            <Chip size="small" variant="outlined" label={item.sourceSectionReference.slice(0, 24)}
              sx={{ ...MONO_CHIP_SX, mt: 0.5 }} />
          )}
        </TableCell>
        <TableCell>
          {item.sanctionType
            ? <StatusBadge label={item.sanctionType} tone="red" sx={{ textTransform: 'capitalize' }} />
            : <Typography variant="body2" color="text.secondary">-</Typography>}
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'Roboto Mono, monospace', fontSize: '0.8125rem' }}>
            {formatNaira(item.sanctionAmountNaira)}{item.sanctionAmountPerDay ? ' /day' : ''}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.severityScore != null ? (
              <StatusBadge label={`Sev ${item.severityScore}`}
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
            <Box onClick={(e) => e.stopPropagation()} sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
              <SanctionDetail item={item} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function SanctionExplorerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [enforcedFilter, setEnforcedFilter] = useState('All');
  const [sortField, setSortField] = useState('severityScore');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);

  const mounted = useRef(true);
  const requestId = useRef(0);

  // Re-arm on setup: under StrictMode the simulated unmount would otherwise leave it false forever.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const hasFilters = search || typeFilter !== 'All' || enforcedFilter !== 'All';

  const loadStats = useCallback(async () => {
    try {
      const data = await api.platform.sanctions.stats();
      if (mounted.current) setStats(data);
    } catch { /* optional */ }
  }, []);

  const loadRows = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, size: rowsPerPage, sort: `${sortField},${sortDir}` });
      if (search) params.set('q', search);
      if (typeFilter !== 'All') params.set('sanctionType', typeFilter);
      if (enforcedFilter !== 'All') params.set('hasBeenEnforced', enforcedFilter === 'Yes');
      const data = await api.platform.sanctions.list(params.toString());
      if (!mounted.current || id !== requestId.current) return;
      setRows(data.content || []);
      setTotal(data.totalElements || 0);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      setError(err.message);
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [page, rowsPerPage, search, typeFilter, enforcedFilter, sortField, sortDir]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadStats(); }, [loadStats]);

  function clearFilters() {
    setSearch(''); setTypeFilter('All'); setEnforcedFilter('All');
    setPage(0); setExpandedRow(null);
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
    setExpandedRow(null);
  }

  const kpis = [
    { key: 'total', label: 'Total Sanctions', value: stats?.total ?? 0, tone: 'blue', icon: <ScaleIcon /> },
    { key: 'highSeverity', label: 'High Severity', value: stats?.highSeverity ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'enforced', label: 'Enforced', value: stats?.enforced ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
    { key: 'notEnforced', label: 'Not Enforced', value: stats?.notEnforced ?? 0, tone: 'gray', icon: <ClockIcon /> },
    { key: 'exposure', label: 'Total Exposure', value: formatNaira(stats?.totalExposure), tone: 'orange', icon: <BanknotesIcon /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Sanction Explorer"
        subtitle={`${total} sanction${total !== 1 ? 's' : ''} — penalties, enforcement and monetary exposure`}
        actions={
          <Button variant="outlined" startIcon={<ArrowPathIcon size={16} />} onClick={() => { loadRows(); loadStats(); }}>
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <KpiCards items={kpis} columns={5} />

      <FilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); setPage(0); setExpandedRow(null); },
          placeholder: 'Search description, penalty or type...',
        }}
        filters={[
          {
            key: 'type', label: 'Sanction Type', value: typeFilter, allLabel: 'All types',
            onChange: (v) => { setTypeFilter(v); setPage(0); setExpandedRow(null); },
            options: (stats?.sanctionTypes || []).map(t => ({ value: t, label: t })),
          },
          {
            key: 'enforced', label: 'Enforced', value: enforcedFilter, allLabel: 'All', minWidth: 130,
            onChange: (v) => { setEnforcedFilter(v); setPage(0); setExpandedRow(null); },
            options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }],
          },
        ]}
        showClear={!!hasFilters}
        onClear={clearFilters}
      />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
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
                        onClick={c.sortField ? () => handleSort(c.sortField) : undefined}>
                        {c.sortField
                          ? <TableSortLabel active={active} direction={active ? sortDir : 'asc'}
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
                {rows.map((item, idx) => (
                  <SanctionRow key={item.sanctionId} item={item}
                    index={page * rowsPerPage + idx + 1}
                    open={expandedRow === item.sanctionId}
                    onToggle={() => setExpandedRow(expandedRow === item.sanctionId ? null : item.sanctionId)}
                    onOpen={() => navigate(`/admin/sanctions/${item.sanctionId}`)} />
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
    </Box>
  );
}
