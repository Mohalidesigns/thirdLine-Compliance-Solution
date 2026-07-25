import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Button, CircularProgress, Alert, IconButton,
  Divider, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar,
} from '@mui/material';
import { ArrowBack, Visibility, CheckCircle, Cancel, Info } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';

const RISK_STYLES = {
  High: { bg: '#FFF5F5', border: '#FC8181', label: 'error', text: '#C53030' },
  Medium: { bg: '#FFFAF0', border: '#F6AD55', label: 'warning', text: '#C05621' },
  Low: { bg: '#F0FFF4', border: '#68D391', label: 'success', text: '#276749' },
};

const FILTERS = ['All', 'High risk', 'New this week'];

export default function InboxPage() {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [detail, setDetail] = useState(null);
  const [classifyOpen, setClassifyOpen] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [snack, setSnack] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.inbox.list();
      setItems(data.content || []);
    } catch { setError('Failed to load inbox.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => {
    if (filter === 'All') return true;
    if (filter === 'High risk') return i.platformRiskRating === 'High';
    return true;
  });

  async function handleClassify(id, applicability) {
    setClassifying(true);
    try {
      await api.obligations.classify(id, { applicability });
      setSnack({ severity: 'success', message: `Marked as ${applicability}` });
      setClassifyOpen(null);
      load();
    } catch (e) {
      setSnack({ severity: 'error', message: e.message });
    } finally { setClassifying(false); }
  }

  const riskColor = useCallback((rating) => {
    return RISK_STYLES[rating] || { bg: '#F7FAFC', border: '#CBD5E0', label: 'default', text: '#4A5568' };
  }, []);

  // --- Detail view ---
  if (detail) {
    const d = detail;
    const rc = riskColor(d.platformRiskRating);
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => setDetail(null)}><ArrowBack /></IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Obligation Detail</Typography>
        </Box>

        <Card sx={{ borderLeft: `4px solid ${rc.border}`, mb: 3 }}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Chip size="small" label={d.platformRiskRating || 'Unrated'}
                color={rc.label} sx={{ fontWeight: 600, minWidth: 60 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {d.regulatorAbbreviation || d.regulatorName}
              </Typography>
              <Chip size="small" label={d.documentType || 'Document'} variant="outlined" />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>{d.sourceTitle}</Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Risk Rating (Platform)</Typography>
                <Box sx={{ mt: 0.5 }}><Chip size="small" label={d.platformRiskRating || 'unrated'} color={rc.label} /></Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Regulator</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>{d.regulatorAbbreviation || d.regulatorName || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Document Type</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{d.documentType || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Obligations</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{d.obligationCount || 0}</Typography>
              </Grid>
              {d.effectiveDate && (
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Effective Date</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{new Date(d.effectiveDate).toLocaleDateString()}</Typography>
                </Grid>
              )}
              {d.publishedAt && (
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">Published</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{new Date(d.publishedAt).toLocaleDateString()}</Typography>
                </Grid>
              )}
            </Grid>

            {d.aiSummary && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>AI Summary</Typography>
                <Box sx={{ p: 2, bgcolor: '#F7FAFC', borderRadius: 1 }}>
                  <Typography variant="body2" fontStyle="italic">{d.aiSummary}</Typography>
                </Box>
              </Box>
            )}

            {d.penaltySummary && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Penalties</Typography>
                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>{d.penaltySummary}</Typography>
              </Box>
            )}

            {d.pdfUrl && (
              <Button variant="outlined" href={d.pdfUrl} target="_blank"
                startIcon={<Visibility />} sx={{ mt: 3 }}>
                View PDF
              </Button>
            )}
          </Box>
        </Card>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="contained" color="success" size="large"
            startIcon={<CheckCircle />}
            onClick={() => { setClassifyOpen(d); }}>
            Mark Applicable
          </Button>
          <Button variant="outlined" color="error" size="large"
            startIcon={<Cancel />}
            onClick={() => handleClassify(d.instrumentId, 'not_applicable')}>
            Not Applicable
          </Button>
        </Box>
      </Box>
    );
  }

  // --- List view ---
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Inbox</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {items.length} obligation{items.length !== 1 ? 's' : ''} awaiting your review
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {FILTERS.map(f => (
          <Chip key={f} label={f} onClick={() => setFilter(f)}
            color={filter === f ? 'primary' : 'default'}
            variant={filter === f ? 'filled' : 'outlined'} size="small" />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8, color: 'text.secondary' }}>
          <Info sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
          <Typography variant="body1">All caught up — no obligations waiting for review.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map(item => {
            const rc = riskColor(item.platformRiskRating);
            return (
              <Card key={item.instrumentId} sx={{
                borderLeft: `4px solid ${rc.border}`, bgcolor: rc.bg,
                '&:hover': { boxShadow: 3 },
              }}>
                <Box sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Chip size="small" label={item.platformRiskRating || 'Unrated'}
                      color={rc.label} sx={{ fontWeight: 600, minWidth: 60 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                      {item.regulatorAbbreviation || item.regulatorName}
                    </Typography>
                    <Chip size="small" label={item.documentType || 'Document'}
                      variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                  </Box>

                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {item.sourceTitle}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Detected {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'recently'}
                    </Typography>
                    {item.effectiveDate && (
                      <Typography variant="caption" color="text.secondary">
                        Effective {new Date(item.effectiveDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>

                  {item.aiSummary && (
                    <Typography variant="body2" color="text.secondary" sx={{
                      mb: 1.5, fontStyle: 'italic',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      "{item.aiSummary}"
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {item.obligationCount > 0 && (
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {item.obligationCount} specific obligation{item.obligationCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                    {item.penaltySummary && (
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 500 }}>
                        {item.penaltySummary}
                      </Typography>
                    )}
                  </Box>

                  <Divider sx={{ mb: 1.5 }} />

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<Visibility />}
                      onClick={() => setDetail(item)}>
                      View full detail
                    </Button>
                    <Button size="small" variant="contained" color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => setClassifyOpen(item)}>
                      Mark applicable
                    </Button>
                    <Button size="small" variant="outlined" color="error"
                      startIcon={<Cancel />}
                      onClick={() => handleClassify(item.instrumentId, 'not_applicable')}>
                      Not applicable
                    </Button>
                  </Box>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={!!classifyOpen} onClose={() => setClassifyOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark as Applicable</DialogTitle>
        <DialogContent>
          {classifyOpen && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Confirm that <strong>{classifyOpen.sourceTitle}</strong> is applicable to your institution. You can set detailed risk ratings later from the Obligations Register.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassifyOpen(null)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={() => handleClassify(classifyOpen?.instrumentId, 'applicable')}
            disabled={classifying}>
            {classifying ? <CircularProgress size={20} /> : 'Confirm Applicable'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
