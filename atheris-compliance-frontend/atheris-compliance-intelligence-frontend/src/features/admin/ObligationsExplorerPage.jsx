import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Table, TableHead, TableRow, TableCell, TableBody, TablePagination, TableSortLabel,
  Button, Stack, CircularProgress, Paper, Tooltip,
} from '@mui/material';
import api from '../../services/api';

const RISK_COLOR = {
  Critical: 'error',
  High: 'error',
  Moderate: 'warning',
  Medium: 'warning',
  Low: 'success',
};

function riskChip(risk) {
  if (!risk) return <Chip size="small" label="Unrated" sx={{ height: 22, borderRadius: '4px' }} />;
  const c = RISK_COLOR[risk] || 'default';
  return <Chip size="small" label={risk} color={c} sx={{ height: 22, borderRadius: '4px' }} />;
}

export default function ObligationsExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [risk, setRisk] = useState(searchParams.get('risk') || 'All');
  const [regulator, setRegulator] = useState(searchParams.get('regulatorId') || 'All');
  const [area, setArea] = useState(searchParams.get('areaOfFocus') || 'All');
  const [act, setAct] = useState(searchParams.get('actId') || 'All');
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
    if (regulator !== 'All') p.regulatorId = regulator;
    if (area !== 'All') p.areaOfFocus = area;
    if (act !== 'All') p.actId = act;
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
    regulatorId: regulator !== 'All' ? regulator : undefined,
    areaOfFocus: area !== 'All' ? area : undefined,
    actId: act !== 'All' ? act : undefined,
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

  const kpis = [
    { key: 'total', label: 'Total', value: stats?.total ?? 0, color: '#1976d2' },
    { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#d32f2f' },
    { key: 'withPoints', label: 'With Points', value: stats?.withPoints ?? 0, color: '#2e7d32' },
    { key: 'withoutPoints', label: 'Without Points', value: stats?.withoutPoints ?? 0, color: '#ed6c02' },
  ];

  const riskOptions = stats?.risks?.length ? stats.risks : ['Critical', 'High', 'Moderate', 'Low'];
  const regulatorOptions = stats?.regulators || [];
  const areaOptions = stats?.areas || [];
  const actOptions = stats?.acts || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Obligations Explorer</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{total} obligations — read-only catalogue</Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpis.map((k) => (
          <Grid key={k.key} size={{ xs: 6, md: 3 }}>
            <Card variant="outlined" onClick={() => applyKpi(k.key)} sx={{ cursor: 'pointer', borderLeft: `4px solid ${k.color}`, '&:hover': { boxShadow: 1 } }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search obligation, title or regulator..." value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(0); }} sx={{ minWidth: 220 }} />
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Risk</InputLabel>
          <Select value={risk} label="Risk" onChange={(e) => { setRisk(e.target.value); setPage(0); }}>
            <MenuItem value="All">All</MenuItem>
            {riskOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Regulator</InputLabel>
          <Select value={regulator} label="Regulator" onChange={(e) => { setRegulator(e.target.value); setPage(0); }}>
            <MenuItem value="All">All</MenuItem>
            {regulatorOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Area of Focus</InputLabel>
          <Select value={area} label="Area of Focus" onChange={(e) => { setArea(e.target.value); setPage(0); }}>
            <MenuItem value="All">All</MenuItem>
            {areaOptions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Act</InputLabel>
          <Select value={act} label="Act" onChange={(e) => { setAct(e.target.value); setPage(0); }}>
            <MenuItem value="All">All</MenuItem>
            {actOptions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Points</InputLabel>
          <Select value={hasPoints} label="Points" onChange={(e) => { setHasPoints(e.target.value); setPage(0); }}>
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="With">With</MenuItem>
            <MenuItem value="Without">Without</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" onClick={clearAll}>Clear</Button>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}><Typography>No obligations found</Typography></Paper>
      ) : (
        <Paper>
          <Box sx={{ overflowX: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', width: 50 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC', minWidth: 280 }}>
                    <TableSortLabel active={sortField === 'title'} direction={sortDir} onClick={() => handleSort('title')}>Obligation</TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Regulator</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>
                    <TableSortLabel active={sortField === 'risk'} direction={sortDir} onClick={() => handleSort('risk')}>Risk</TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Points</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#F7FAFC' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row, idx) => (
                  <TableRow key={row.obligationId} hover sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F7FAFC' } }} onClick={() => navigate(`/admin/obligations/${row.obligationId}`)}>
                    <TableCell sx={{ color: 'text.secondary' }}>{page * size + idx + 1}</TableCell>
                    <TableCell>
                      <Tooltip title={row.title || row.plainEnglishStatement || ''}>
                        <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 360 }}>
                          {row.title || row.plainEnglishStatement || 'Untitled obligation'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{row.regulatorAbbreviation ? <Chip size="small" label={row.regulatorAbbreviation} sx={{ height: 22, borderRadius: '4px', fontWeight: 600 }} /> : <Typography variant="body2" color="text.secondary">-</Typography>}</TableCell>
                    <TableCell>{riskChip(row.riskRating)}</TableCell>
                    <TableCell>
                      {row.hasPoints ? <Chip size="small" label="With" color="success" sx={{ height: 22, borderRadius: '4px' }} /> : <Chip size="small" label="Without" sx={{ height: 22, borderRadius: '4px' }} />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button size="small" variant="text" onClick={() => navigate(`/admin/obligations/${row.obligationId}`)}>View</Button>
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
