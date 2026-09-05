# frontend-register-page

Reusable skill for building MUI register/details pages following the Atheris tenant portal pattern.

## Page Architecture

Every register page follows this structure:

```
Stats Cards (4 KPIs, clickable → set filter)
  ↓
Filters Bar (search + dropdowns + clear button)
  ↓
Sortable Table (max 5 columns)
  ↓
Detail Drawer (right-side, full metadata)
```

## File Structure

```
src/pages/
  {Entity}Page.jsx          — main page (stats + filters + table)
  Create{Entity}Dialog.jsx  — create/edit dialog (optional)
```

## Component Pattern

### 1. Imports

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Button, TextField, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Snackbar, Alert, Tooltip, TablePagination, TableSortLabel,
  CircularProgress, Drawer, Divider,
} from '@mui/material';
import { Search, Refresh, Close, Add } from '@mui/icons-material';
import { api } from '../services/api';
```

### 2. Constants

```jsx
const RISK_CONFIG = {
  Critical: { color: 'error', bg: '#FFF5F5' },
  High: { color: 'error', bg: '#FFF5F5' },
  Moderate: { color: 'warning', bg: '#FFFAF0' },
  Low: { color: 'success', bg: '#F0FFF4' },
};

const COLUMNS = [
  { id: 'name', label: 'Name', minWidth: 200, sortField: 'name' },
  { id: 'status', label: 'Status', minWidth: 100, sortField: 'status' },
  { id: 'risk', label: 'Risk', minWidth: 90, sortField: 'riskRating' },
  { id: 'owner', label: 'Owner', minWidth: 120, sortField: 'ownerName' },
  { id: 'actions', label: 'Actions', minWidth: 100 },
];
// Max 5 columns. Always.
```

### 3. Stats Cards (4 KPIs)

```jsx
const kpis = [
  { key: 'total', label: 'Total', value: stats?.total ?? 0, color: '#2B6CB0', bg: '#EBF8FF' },
  { key: 'highRisk', label: 'High Risk', value: stats?.highRisk ?? 0, color: '#E53E3E', bg: '#FFF5F5' },
  { key: 'gaps', label: 'Gaps', value: stats?.gaps ?? 0, color: '#DD6B20', bg: '#FFFAF0' },
  { key: 'underReview', label: 'Under Review', value: stats?.underReview ?? 0, color: '#805AD5', bg: '#FAF5FF' },
];

<Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
  {kpis.map(k => (
    <Paper key={k.key} elevation={0} variant="outlined"
      onClick={() => applyKpiFilter(k.key)}
      sx={{ p: 2, cursor: 'pointer', borderLeft: `3px solid ${k.color}`,
        transition: 'box-shadow .2s', '&:hover': { boxShadow: 1 } }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{k.label}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: k.color }}>{k.value}</Typography>
    </Paper>
  ))}
</Box>
```

### 4. Filters Bar

```jsx
<Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
  <TextField size="small" placeholder="Search..." value={search}
    onChange={e => { setSearch(e.target.value); setPage(0); }}
    slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> } }}
    sx={{ minWidth: 240 }} />
  <TextField select size="small" value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(0); }}
    label="Risk" sx={{ minWidth: 110 }}>
    <MenuItem value="All">All</MenuItem>
    {['Critical', 'High', 'Moderate', 'Low'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
  </TextField>
  {hasFilters && <Button size="small" startIcon={<Close />} onClick={clearFilters}>Clear</Button>}
</Paper>
```

### 5. Sortable Table (5 cols max)

```jsx
<Table stickyHeader size="small">
  <TableHead>
    <TableRow>
      {COLUMNS.map(c => (
        <TableCell key={c.id} sx={{ minWidth: c.minWidth, fontWeight: 700, bgcolor: '#F7FAFC' }}>
          {c.sortField ? (
            <TableSortLabel active={sortField === c.sortField}
              direction={sortField === c.sortField ? sortDir : 'asc'}
              onClick={() => handleSort(c.sortField)}>
              {c.label}
            </TableSortLabel>
          ) : c.label}
        </TableCell>
      ))}
    </TableRow>
  </TableHead>
  <TableBody>
    {items.map(row => (
      <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
        <TableCell>{row.name}</TableCell>
        <TableCell><Chip size="small" label={row.status} ... /></TableCell>
        <TableCell><Chip size="small" label={row.risk} color={RISK_CONFIG[row.risk]?.color} ... /></TableCell>
        <TableCell>{row.ownerName || '-'}</TableCell>
        <TableCell><IconButton onClick={e => { e.stopPropagation(); ... }}><Delete fontSize="small" /></IconButton></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 6. Detail Drawer

```jsx
<Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 480 } }}>
  {selected && (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{selected.name}</Typography>
        <IconButton onClick={() => setSelected(null)}><Close /></IconButton>
      </Box>
      {/* Metadata grid, linked entities, edit actions */}
    </Box>
  )}
</Drawer>
```

### 7. Data Fetching

```jsx
// List with filters + pagination
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const params = { page, size: rowsPerPage };
    if (search) params.q = search;
    if (riskFilter !== 'All') params.risk = riskFilter;
    if (sortField) params.sort = `${sortField},${sortDir}`;
    const data = await api.{entity}.list(params);
    setItems(data.content || []);
    setTotal(data.totalElements || 0);
  } catch (e) { setError(e.message); }
  finally { setLoading(false); }
}, [page, rowsPerPage, search, riskFilter, sortField, sortDir]);

// Stats
const loadStats = useCallback(async () => {
  try { setStats(await api.{entity}.stats()); } catch { /* optional */ }
}, []);
```

## API Conventions

- List: `api.{entity}.list(params)` → `GET /api/v1/{entity}?page=&size=&q=&risk=&sort=`
- Stats: `api.{entity}.stats()` → `GET /api/v1/{entity}/stats`
- Detail: `api.{entity}.detail(id)` → `GET /api/v1/{entity}/{id}`
- Create: `api.{entity}.create(data)` → `POST /api/v1/{entity}`
- Update: `api.{entity}.update(id, data)` → `PUT /api/v1/{entity}/{id}`
- Delete: `api.{entity}.remove(id)` → `DELETE /api/v1/{entity}/{id}`

## Styling Rules

- `Paper` with `variant="outlined"` for cards and filter bars
- `#F7FAFC` background for table headers
- `Chip` with `height: 22, borderRadius: '4px'` for status/risk badges
- `Typography variant="caption" color="text.secondary"` for labels
- `Typography variant="h4" sx={{ fontWeight: 700 }}` for KPI values
- Table rows: `hover` + `cursor: 'pointer'` for clickable rows
- Drawer: `anchor="right"`, `PaperProps={{ sx: { width: 480 } }}`
