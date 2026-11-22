import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, MenuItem, TextField, Button, CircularProgress, Alert, Snackbar,
} from '@mui/material';
import { TL, UserCircleIcon } from 'shared';
import { api } from '../../services/api';
import BulkImportStakeholdersDialog from './BulkImportStakeholdersDialog';

export default function StakeholdersPanel() {
  const [departmentId, setDepartmentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [q, setQ] = useState('');
  const [snack, setSnack] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const deptsQuery = useQuery({ queryKey: ['org', 'departments', false], queryFn: () => api.org.departments(false) });
  const teamsQuery = useQuery({ queryKey: ['org', 'teams'], queryFn: () => api.org.teams() });
  const listQuery = useQuery({
    queryKey: ['stakeholders', departmentId, teamId, q],
    queryFn: () => api.stakeholders.list({ departmentId, teamId, q }),
  });

  const departments = deptsQuery.data || [];
  const teams = (teamsQuery.data || []).filter((t) => !departmentId || t.departmentId === Number(departmentId));
  const rows = listQuery.data || [];

  const sendLink = async (row) => {
    try {
      const res = await api.stakeholders.accessLink(row.stakeholderId);
      const url = `${window.location.origin}${res.path}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setSnack({ severity: 'success', message: `Access link copied for ${row.fullName}` });
    } catch (e) {
      setSnack({ severity: 'error', message: e.message });
    }
  };

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800 }}>Stakeholders</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>
            Everyone placed in a department and unit, and what they are responsible for
          </Typography>
        </Box>
        <TextField select size="small" label="Department" value={departmentId}
          onChange={(e) => { setDepartmentId(e.target.value); setTeamId(''); }} sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          {departments.map((d) => <MenuItem key={d.departmentId} value={String(d.departmentId)}>{d.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Unit" value={teamId}
          onChange={(e) => setTeamId(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All</MenuItem>
          {teams.map((t) => <MenuItem key={t.teamId} value={String(t.teamId)}>{t.name}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 180 }} />
        <Button variant="outlined" size="small" onClick={() => setBulkOpen(true)}
          startIcon={<UserCircleIcon size={16} />}>
          Bulk import
        </Button>
      </Box>

      {listQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : listQuery.isError ? (
        <Box sx={{ p: 2 }}><Alert severity="error">{listQuery.error.message}</Alert></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Person</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell align="right">Access</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.stakeholderId} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <UserCircleIcon size={16} sx={{ color: TL.gray400 }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: TL.gray800 }}>{s.fullName}</Typography>
                        <Typography variant="caption" sx={{ color: TL.gray500 }}>
                          {[s.jobTitle, s.email].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{s.departmentName || '—'}</TableCell>
                  <TableCell>{s.teamName || '—'}</TableCell>
                  <TableCell>
                    {(s.roles || []).length === 0
                      ? <Typography variant="caption" sx={{ color: TL.gray400 }}>No assignments</Typography>
                      : (s.roles || []).map((r) => (
                        <Chip key={r.code} size="small" variant="outlined" sx={{ mr: 0.5 }}
                          label={`${r.name} ×${r.count}`} />
                      ))}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => sendLink(s)}>Send link</Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5}>
                  <Typography variant="caption" sx={{ color: TL.gray500 }}>
                    No stakeholders yet. Add members from the org chart above.
                  </Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">{snack.message}</Alert> : undefined}
      </Snackbar>

      <BulkImportStakeholdersDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </Card>
  );
}
