import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import {
  Search, FilterList, Visibility, GetApp, BookmarkBorder, Bookmark,
  History, OpenInNew, Warning, Security, Balance,
} from '@mui/icons-material';
import api from '../../../services/api';

const riskConfig = {
  High: { color: '#C53030', bg: '#FEE2E2', icon: <Warning sx={{ fontSize: 14 }} /> },
  Medium: { color: '#DD6B20', bg: '#FEF3E2', icon: <Security sx={{ fontSize: 14 }} /> },
  Low: { color: '#2D7D46', bg: '#E6F4EA', icon: <Security sx={{ fontSize: 14 }} /> },
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LibraryPage() {
  const [loading, setLoading] = useState(false);
  const [obligations, setObligations] = useState([]);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    q: '',
    regulator: 'all',
    riskRating: 'all',
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.regulator !== 'all') params.set('regulatorId', filters.regulator);
    if (filters.riskRating !== 'all') params.set('riskRating', filters.riskRating);

    api.intelligence.search(params.toString())
      .then((data) => setObligations(data.content || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Obligation Library</Typography>
          <Typography variant="body2" color="text.secondary">Global repository of regulatory instruments and mandatory obligations</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<History />}>Recent Updates</Button>
          <Button variant="contained" size="small" startIcon={<GetApp />}>Export Library</Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Instruments', value: obligations.length, color: '#1A365D', icon: <Balance sx={{ color: '#1A365D' }} /> },
          { label: 'High Risk', value: obligations.filter(o => o.riskRating === 'High').length, color: '#C53030', icon: <Warning sx={{ color: '#C53030' }} /> },
          { label: 'Watching', value: obligations.filter(o => o.isWatching).length, color: '#D4AF37', icon: <Bookmark sx={{ color: '#D4AF37' }} /> },
          { label: 'New This Month', value: obligations.filter(o => {
            if (!o.discoveredAt) return false;
            const d = new Date(o.discoveredAt);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length, color: '#2D7D46', icon: <OpenInNew sx={{ color: '#2D7D46' }} /> },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card sx={{ borderLeft: `4px solid ${s.color}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
                  </Box>
                  {s.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Search & Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by title or keywords..."
              value={filters.q}
              onChange={(e) => setFilters(f => ({ ...f, q: e.target.value }))}
              InputProps={{ startAdornment: <Search sx={{ color: '#718096', mr: 1, fontSize: 18 }} /> }}
              sx={{ width: 350 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Risk Rating</InputLabel>
              <Select label="Risk Rating" value={filters.riskRating} onChange={(e) => setFilters(f => ({ ...f, riskRating: e.target.value }))}>
                <MenuItem value="all">All Risks</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Library Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}></TableCell>
                  <TableCell>Instrument Title</TableCell>
                  <TableCell>Regulator</TableCell>
                  <TableCell>Area of Focus</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell>Effective</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {obligations.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#718096' }}>No obligations found</TableCell></TableRow>
                ) : obligations.map((ob) => (
                  <TableRow key={ob.instrumentId} hover sx={{ '&:hover': { bgcolor: '#F7FAFC' } }}>
                    <TableCell>
                      <IconButton size="small">
                        {ob.isWatching ? <Bookmark sx={{ fontSize: 18, color: '#D4AF37' }} /> : <BookmarkBorder sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{ob.sourceTitle}</TableCell>
                    <TableCell>
                      <Chip label={ob.regulatorAbbreviation || '—'} size="small" sx={{ fontWeight: 700, bgcolor: '#EDF2F7' }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{ob.areaOfFocus || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={riskConfig[ob.riskRating]?.icon}
                        label={ob.riskRating || '—'}
                        sx={{ bgcolor: riskConfig[ob.riskRating]?.bg, color: riskConfig[ob.riskRating]?.color, fontWeight: 600, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#718096' }}>{formatDate(ob.dateIssued)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#718096' }}>{formatDate(ob.dateCommencement)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small"><Visibility sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="View PDF">
                        <IconButton size="small"><OpenInNew sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}

// Placeholder for missing icon in import
function LibraryBooks(props) {
  return <Balance {...props} />;
}
