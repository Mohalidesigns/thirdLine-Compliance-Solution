import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  Alert, CircularProgress, Collapse, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Checkbox,
  IconButton,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp, ArrowBack, CheckCircle } from '@mui/icons-material';
import { api } from '../services/api';

const OBLIGATION_TYPES = [
  'reporting', 'disclosure', 'compliance', 'record_keeping',
  'notification', 'approval', 'audit', 'other',
];

const DEADLINE_TYPES = [
  'monthly', 'quarterly', 'semi_annually', 'annually',
  'one_time', 'ongoing', 'ad_hoc',
];

function ObligationRow({ item, index, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow hover>
        <TableCell sx={{ p: 0.5, width: 32 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ p: 0.5, width: 40 }}><Typography variant="body2">{item.obligationNumber}</Typography></TableCell>
        <TableCell sx={{ p: 0.5 }}>
          <TextField fullWidth size="small" value={item.plainEnglishStatement}
            onChange={e => onChange(index, 'plainEnglishStatement', e.target.value)}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' } }} />
        </TableCell>
        <TableCell sx={{ p: 0.5, width: 120 }}>
          <TextField fullWidth size="small" value={item.specificSectionReference}
            onChange={e => onChange(index, 'specificSectionReference', e.target.value)}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' } }} />
        </TableCell>
        <TableCell sx={{ p: 0.5, width: 110 }}>
          <FormControl fullWidth size="small">
            <Select value={item.obligationType}
              onChange={e => onChange(index, 'obligationType', e.target.value)}
              sx={{ fontSize: '0.75rem' }}>
              {OBLIGATION_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
            </Select>
          </FormControl>
        </TableCell>
        <TableCell sx={{ p: 0.5, width: 100 }}>
          <FormControl fullWidth size="small">
            <Select value={item.recurringDeadlineType}
              onChange={e => onChange(index, 'recurringDeadlineType', e.target.value)}
              sx={{ fontSize: '0.75rem' }}>
              {DEADLINE_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
            </Select>
          </FormControl>
        </TableCell>
        <TableCell sx={{ p: 0.5, width: 50, textAlign: 'center' }}>
          <Checkbox checked={item.applicable !== false}
            onChange={e => onChange(index, 'applicable', e.target.checked)} size="small" />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: '#F7FAFC' }}>
              <TextField fullWidth multiline rows={2} size="small" label="Description"
                value={item.plainEnglishStatement}
                onChange={e => onChange(index, 'plainEnglishStatement', e.target.value)}
                sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' } }} />
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <TextField size="small" label="Section Reference"
                  value={item.specificSectionReference}
                  onChange={e => onChange(index, 'specificSectionReference', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' }, flex: 1 }} />
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function UploadReviewPage() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ocrOpen, setOcrOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.uploads.review(uploadId)
      .then(res => {
        setData(res);
        setObligations((res.obligations || []).map(o => ({ ...o, applicable: true })));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [uploadId]);

  function handleChange(idx, field, value) {
    setObligations(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function handleConfirm() {
    setConfirming(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        obligations: obligations.map(o => ({
          obligationNumber: o.obligationNumber,
          description: o.plainEnglishStatement,
          sectionReference: o.specificSectionReference,
          obligationType: o.obligationType,
          recurringDeadlineType: o.recurringDeadlineType,
          applicable: o.applicable !== false,
        })),
      };
      await api.uploads.confirm(uploadId, payload);
      setSuccess('Obligations confirmed and saved.');
      setTimeout(() => navigate('/uploads'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to confirm');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!data) return <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Not found'}</Alert></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/uploads')}><ArrowBack /></IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Review Upload</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {data.regulatorName || 'Unknown regulator'} — {data.status}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }}>{success}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Paper sx={{ flex: 1, p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>AI Summary</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {data.aiSummary || 'No AI summary available.'}
          </Typography>
        </Paper>
      </Box>

      <Paper sx={{ mb: 2 }}>
        <Button fullWidth onClick={() => setOcrOpen(!ocrOpen)}
          sx={{ justifyContent: 'space-between', textTransform: 'none', color: 'text.primary', px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>OCR Text ({data.pdfOcrText ? `${data.pdfOcrText.length} chars` : 'none'})</Typography>
          {ocrOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
        </Button>
        <Collapse in={ocrOpen}>
          <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto', bgcolor: '#F7FAFC' }}>
            <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.65rem' }}>
              {data.pdfOcrText || 'No text extracted.'}
            </Typography>
          </Box>
        </Collapse>
      </Paper>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Extracted Obligations ({obligations.length})
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 32 }} />
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 40 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Obligation Description</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 120 }}>Section</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 110 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 100 }}>Deadline</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 50 }}>Apply</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {obligations.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: '#A0AEC0' }}>No obligations extracted.</TableCell></TableRow>
            ) : (
              obligations.map((o, i) => (
                <ObligationRow key={o.obligationNumber || i} item={o} index={i} onChange={handleChange} />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
        <Button variant="outlined" onClick={() => navigate('/uploads')}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={confirming}
          startIcon={confirming ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckCircle />}>
          {confirming ? 'Confirming...' : 'Confirm & Save'}
        </Button>
      </Box>
    </Box>
  );
}