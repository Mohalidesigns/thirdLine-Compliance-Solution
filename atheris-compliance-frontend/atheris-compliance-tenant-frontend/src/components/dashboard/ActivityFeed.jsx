import { Paper, Typography, Box, List, ListItem, ListItemAvatar, Avatar, ListItemText, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowForward as ArrowIcon } from '@mui/icons-material';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const SUBJECT_ROUTES = {
  return_instance: '/returns',
  control: '/controls',
  finding: '/findings',
  obligation: '/obligations',
  instrument: '/instruments',
  regulatory_return: '/returns',
};

export default function ActivityFeed({ events = [] }) {
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Recent Activity
        </Typography>
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/audit')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          View Full Trail <ArrowIcon sx={{ fontSize: 14 }} />
        </Link>
      </Box>
      <List dense sx={{ flex: 1, overflow: 'auto', maxHeight: 340 }}>
        {events.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No recent activity
          </Typography>
        )}
        {events.map((ev, i) => (
          <ListItem
            key={ev.eventId || i}
            onClick={() => {
              const route = SUBJECT_ROUTES[ev.subjectType];
              if (route) navigate(route);
            }}
            sx={{
              cursor: SUBJECT_ROUTES[ev.subjectType] ? 'pointer' : 'default',
              borderRadius: 1,
              mb: 0.5,
              '&:hover': SUBJECT_ROUTES[ev.subjectType] ? { bgcolor: 'action.hover' } : {},
            }}
          >
            <ListItemAvatar sx={{ minWidth: 44 }}>
              <Avatar
                sx={{
                  width: 34, height: 34, fontSize: 13, fontWeight: 700,
                  bgcolor: i % 3 === 0 ? '#1976d2' : i % 3 === 1 ? '#7b1fa2' : '#388e3c',
                }}
              >
                {initials(ev.actorName)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography variant="body2">
                  <Box component="span" fontWeight={600}>{ev.actorName || 'System'}</Box>
                  {' '}{ev.actionDescription?.toLowerCase() || ev.action?.replace(/_/g, ' ')}
                </Typography>
              }
              secondary={timeAgo(ev.occurredAt)}
              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
