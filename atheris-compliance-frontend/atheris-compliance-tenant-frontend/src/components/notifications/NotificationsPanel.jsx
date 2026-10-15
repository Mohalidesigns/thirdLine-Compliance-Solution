import { useState, useEffect } from 'react';
import { Drawer, Box, Typography, IconButton, List, ListItem, ListItemText, Button, Divider, CircularProgress } from '@mui/material';
import {
  StatusBadge, TL, XMarkIcon, BellIcon, CheckCircleIcon, EyeIcon,
} from 'shared';
import { api } from '../../services/api';

export default function NotificationsPanel({ open, onClose }) {
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

  const severityTone = (s) => {
    if (s === 'high') return 'red';
    if (s === 'medium') return 'orange';
    return 'green';
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420, maxWidth: '100vw' } }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${TL.gray100}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: '#EFF6FF', color: TL.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BellIcon size={16} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: TL.gray800, lineHeight: 1.3 }}>Notifications</Typography>
            {counts.unread > 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{counts.unread} unread</Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {counts.unread > 0 && (
            <Button size="small" onClick={handleMarkAllRead}>Mark all read</Button>
          )}
          <IconButton size="small" onClick={onClose} aria-label="Close"><XMarkIcon size={18} /></IconButton>
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: TL.gray500 }}>No notifications</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {notifications.map((n) => (
            <Box key={n.notificationId}>
              <ListItem alignItems="flex-start" sx={{ py: 2, px: 3, bgcolor: n.status === 'unread' ? '#F8FAFC' : 'transparent' }}>
                <ListItemText
                  disableTypography
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <StatusBadge label={n.changeSeverity?.toUpperCase() || 'INFO'} tone={severityTone(n.changeSeverity)} dot />
                      <Typography sx={{ fontSize: '0.75rem', color: TL.gray500 }}>{n.changeType}</Typography>
                      {n.status === 'unread' && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#EF4444', ml: 'auto' }} />}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography sx={{ fontSize: '0.875rem', color: TL.gray800, mb: 0.5, fontWeight: n.status === 'unread' ? 500 : 400 }}>
                        {n.changeSummary || 'No summary'}
                      </Typography>
                      {n.changedFields && (
                        <Typography sx={{ display: 'block', mb: 1, fontSize: '0.75rem', color: TL.gray500 }}>
                          {n.changedFields}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        {n.status === 'unread' && (
                          <>
                            <Button size="small" variant="outlined" startIcon={<EyeIcon size={16} />} onClick={() => handleReview(n)}>
                              Review
                            </Button>
                            <Button size="small" startIcon={<CheckCircleIcon size={16} />} onClick={() => handleAcknowledge(n.notificationId)}>
                              Confirm
                            </Button>
                          </>
                        )}
                        {n.status === 'read' && (
                          <Button size="small" startIcon={<CheckCircleIcon size={16} />} onClick={() => handleAcknowledge(n.notificationId)}>
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
