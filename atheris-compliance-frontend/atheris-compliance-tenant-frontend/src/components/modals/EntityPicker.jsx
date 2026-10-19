import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Radio,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, TextField, Box, Typography, CircularProgress, InputAdornment, Chip,
} from '@mui/material';
import { MagnifyingGlassIcon } from 'shared';

export default function EntityPicker({
  open, onClose, title, fetchRows, columns, getKey, label, initialId = null,
  onSave, searchPlaceholder = 'Search…', emptyText = 'Nothing found.',
}) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(initialId ?? null);
    setSearch('');
  }, [open, initialId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetchRows(search)
        .then((d) => { if (active) setRows(Array.isArray(d) ? d : (d.content || [])); })
        .catch(() => { if (active) setRows([]); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [open, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField fullWidth size="small" placeholder={searchPlaceholder} value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><MagnifyingGlassIcon size={16} /></InputAdornment> }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{emptyText}</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  {columns.map((c) => <TableCell key={c.label}>{c.label}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const id = getKey(r);
                  const isSel = selected === id;
                  return (
                    <TableRow key={id} hover selected={isSel} sx={{ cursor: 'pointer' }}
                      onClick={() => setSelected(id)}>
                      <TableCell padding="checkbox">
                        <Radio size="small" checked={isSel} onChange={() => setSelected(id)} />
                      </TableCell>
                      {columns.map((c) => <TableCell key={c.label}>{c.render(r)}</TableCell>)}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        {selected != null && <Chip size="small" label={label ? label(rows.find((r) => getKey(r) === selected)) : '1 selected'} sx={{ mr: 'auto' }} />}
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={selected == null} onClick={() => onSave(selected, rows.find((r) => getKey(r) === selected))}>Select</Button>
      </DialogActions>
    </Dialog>
  );
}