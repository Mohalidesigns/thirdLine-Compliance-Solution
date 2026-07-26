import { useState, useEffect } from 'react';
import { Drawer, Box, Typography, IconButton, List, ListItem, ListItemText, Chip, Button, Divider, CircularProgress } from '@mui/material';
import { Close, Notifications as BellIcon, CheckCircle, Visibility } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { api } from '../../services/api';

export default function NotificationsPanel({ open, onClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ unread: 0 });
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.notifications.list().catch(() => []),
      api.notifications.count().catch(() => ({ unread: 0 })),
    ]).then(([list, c]) => {
      setNotifications(Array.isArray(list) ? list : []);
      setCounts(c);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const handleAcknowledge = async (id) => {
    await api.notifications.acknowledge(id).catch(() => {});
    load();
  };

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead().catch(() => {});
    load();
  };

  const handleReview = async (n) => {
    await api.notifications.markRead(n.notificationId).catch(() => {});
    onClose();
  };

  const severityColor = (s) => {
    if (s === 'high') return 'error';
    if (s === 'medium') return 'warning';
    return 'success';
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420, maxWidth: '100vw' } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BellIcon fontSize="small" />
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            Notifications {counts.unread > 0 && `(${counts.unread} unread)`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {counts.unread > 0 && (
            <Button size="small" onClick={handleMarkAllRead}>Mark all read</Button>
          )}
          <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Divider />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">No notifications</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {notifications.map((n) => (
            <Box key={n.notificationId}>
              <ListItem alignItems="flex-start" sx={{ py: 1.5, px: 2, bgcolor: n.status === 'unread' ? theme.palette.action.hover : 'transparent' }}>
                <ListItemText
                  disableTypography
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip size="small" label={n.changeSeverity?.toUpperCase() || 'INFO'} color={severityColor(n.changeSeverity)} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{n.changeType}</Typography>
                      {n.status === 'unread' && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.error.main }} />}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: n.status === 'unread' ? 500 : 400 }}>
                        {n.changeSummary || 'No summary'}
                      </Typography>
                      {n.changedFields && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
                          {n.changedFields}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        {n.status === 'unread' && (
                          <>
                            <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => handleReview(n)}>
                              Review
                            </Button>
                            <Button size="small" startIcon={<CheckCircle />} onClick={() => handleAcknowledge(n.notificationId)}>
                              Confirm
                            </Button>
                          </>
                        )}
                        {n.status === 'read' && (
                          <Button size="small" startIcon={<CheckCircle />} onClick={() => handleAcknowledge(n.notificationId)}>
                            Confirm — no change needed
                          </Button>
                        )}
                      </Box>
                    </>
                  }
                />
              </ListItem>
              <Divider component="li" />
            </Box>
          ))}
        </List>
      )}
    </Drawer>
  );
}
