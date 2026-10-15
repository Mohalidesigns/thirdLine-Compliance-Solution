import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, TablePagination, TableSortLabel,
  CircularProgress, Paper, Tooltip, IconButton,
} from '@mui/material';
import {
  PageHeader, KpiCards, FilterBar, obligationColumns,
  ScaleIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, EyeIcon,
} from 'shared';
import api from '../../services/api';

const COLUMNS = obligationColumns();

export default function ObligationsExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [risk, setRisk] = useState(searchParams.get('risk') || 'All');
  const [regulator, setRegulator] = useState(searchParams.get('regulator') || 'All');
  const [area, setArea] = useState(searchParams.get('areaOfFocus') || 'All');
  const [act, setAct] = useState(searchParams.get('act') || 'All');
  const [hasPoints, setHasPoints] = useState(searchParams.get('hasPoints') || 'All');
  const [page, setPage] = useState(Number(searchParams.get('page') || 0));
  const [size, setSize] = useState(Number(searchParams.get('size') || 10));
  const [sortField, setSortField] = useState(searchParams.get('sortField') || '');
  const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'asc');

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const p = {};
    if (q) p.q = q;
    if (risk !== 'All') p.risk = risk;
    if (regulator !== 'All') p.regulator = regulator;
    if (area !== 'All') p.areaOfFocus = area;
    if (act !== 'All') p.act = act;
    if (hasPoints !== 'All') p.hasPoints = hasPoints;
    if (page) p.page = String(page);
    if (size !== 10) p.size = String(size);
    if (sortField) { p.sortField = sortField; p.sortDir = sortDir; }
    setSearchParams(p, { replace: true });
  }, [q, risk, regulator, area, act, hasPoints, page, size, sortField, sortDir, setSearchParams]);

  const obligationsApi = api.platform?.obligations ?? api.obligations;

  const { data: stats } = useQuery({
    queryKey: ['obligations-stats'],
    queryFn: ({ signal }) => obligationsApi.stats(signal),
  });

  const queryParams = {
    q: q || undefined,
    risk: risk !== 'All' ? risk : undefined,
    // option lists hold the regulator abbreviation / act name, so filter by those
    regulator: regulator !== 'All' ? regulator : undefined,
    areaOfFocus: area !== 'All' ? area : undefined,
    act: act !== 'All' ? act : undefined,
    hasPoints: hasPoints === 'With' ? true : hasPoints === 'Without' ? false : undefined,
    page,
    size,
    sort: sortField ? `${sortField},${sortDir}` : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['obligations', q, risk, regulator, area, act, hasPoints, page, size, sortField, sortDir],
    queryFn: ({ signal }) => obligationsApi.list(queryParams, signal),
  });

  const items = data?.content || [];
  const total = data?.totalElements ?? 0;

  function clearAll() {
    setSearchInput(''); setQ(''); setRisk('All'); setRegulator('All');
    setArea('All'); setAct('All'); setHasPoints('All'); setPage(0); setSize(10);
    setSortField(''); setSortDir('asc');
  }

  function applyKpi(key) {
    setPage(0);
    if (key === 'highRisk') { setRisk('High'); setHasPoints('All'); }
    else if (key === 'withPoints') { setHasPoints('With'); setRisk('All'); }
    else if (key === 'withoutPoints') { setHasPoints('Without'); setRisk('All'); }
    else { setRisk('All'); setHasPoints('All'); }
  }

  function handleSort(field) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  const activeKpi = risk === 'High' ? 'highRisk'
    : hasPoints === 'With' ? 'withPoints' : hasPoints === 'Without' ? 'withoutPoints' : null;
  const kpis = [
    { key: 'total', label: 'Total Obligations', value: stats?.total ?? 0, tone: 'blue', icon: <ScaleIcon /> },
    { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, tone: 'red', icon: <ExclamationTriangleIcon /> },
    { key: 'withPoints', label: 'With Points', value: stats?.withPoints ?? 0, tone: 'green', icon: <CheckCircleIcon /> },
    { key: 'withoutPoints', label: 'Without Points', value: stats?.withoutPoints ?? 0, tone: 'orange', icon: <ClockIcon /> },
  ].map((k) => ({ ...k, active: k.key === activeKpi }));

  const riskOptions = stats?.risks?.length ? stats.risks : ['Critical', 'High', 'Moderate', 'Low'];
  const regulatorOptions = stats?.regulators || [];
  const areaOptions = stats?.areas || [];
  const actOptions = stats?.acts || [];

  const opts = (list) => list.map((v) => ({ value: v, label: v }));
  const dirty = !!(searchInput || risk !== 'All' || regulator !== 'All' || area !== 'All' || act !== 'All' || hasPoints !== 'All');

  return (
    <Box>
      <PageHeader title="Obligations Explorer" subtitle={`${total.toLocaleString()} obligations — read-only catalogue`} />

      <KpiCards items={kpis} onSelect={applyKpi} columns={4} />

      <FilterBar
        search={{ value: searchInput, onChange: (v) => { setSearchInput(v); setPage(0); }, placeholder: 'Search obligation, title or regulator...' }}
        filters={[
          { key: 'risk', label: 'Risk', value: risk, onChange: (v) => { setRisk(v); setPage(0); }, options: opts(riskOptions), allLabel: 'All Ratings', minWidth: 150 },
          { key: 'regulator', label: 'Regulator', value: regulator, onChange: (v) => { setRegulator(v); setPage(0); }, options: opts(regulatorOptions), allLabel: 'All Regulators', minWidth: 160 },
          { key: 'area', label: 'Area of Focus', value: area, onChange: (v) => { setArea(v); setPage(0); }, options: opts(areaOptions), allLabel: 'All Areas' },
          { key: 'act', label: 'Act', value: act, onChange: (v) => { setAct(v); setPage(0); }, options: opts(actOptions), allLabel: 'All Acts' },
          { key: 'points', label: 'Points', value: hasPoints, onChange: (v) => { setHasPoints(v); setPage(0); }, options: opts(['With', 'Without']), allLabel: 'All', minWidth: 130 },
        ]}
        showClear={dirty}
        onClear={clearAll}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8 }}><Typography color="text.secondary">No obligations found</Typography></Paper>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.id} sx={{ minWidth: c.minWidth }}>
                      {c.sortable
                        ? <TableSortLabel active={sortField === c.sortField} direction={sortField === c.sortField ? sortDir : 'asc'} onClick={() => handleSort(c.sortField)}>{c.label}</TableSortLabel>
                        : c.label}
                    </TableCell>
                  ))}
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row, idx) => (
                  <TableRow key={row.obligationId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/obligations/${row.obligationId}`)}>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: '"Roboto Mono", monospace', fontSize: '0.75rem' }}>{page * size + idx + 1}</TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.id}>{c.render ? c.render(row) : (row[c.id] ?? '—')}</TableCell>
                    ))}
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => navigate(`/admin/obligations/${row.obligationId}`)}><EyeIcon size={16} /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={size} onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} />
        </Paper>
      )}
    </Box>
  );
}
