import { Typography, Box, List, ListItem, ListItemAvatar, Avatar, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DataCard, CardLink, TL } from 'shared';

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
    <DataCard
      title="Recent Activity"
      actions={<CardLink onClick={() => navigate('/audit')}>View Full Trail</CardLink>}
      sx={{ height: '100%' }}
      contentSx={{ py: 1.5 }}
    >
      <List dense sx={{ flex: 1, overflow: 'auto', maxHeight: 340 }}>
        {events.length === 0 && (
          <Typography sx={{ p: 2, textAlign: 'center', fontSize: '0.875rem', color: TL.gray500 }}>
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
              borderRadius: '8px',
              mb: 0.5,
              '&:hover': SUBJECT_ROUTES[ev.subjectType] ? { bgcolor: TL.gray50 } : {},
            }}
          >
            <ListItemAvatar sx={{ minWidth: 44 }}>
              <Avatar
                sx={{
                  width: 32, height: 32, fontSize: 12, fontWeight: 600,
                  bgcolor: i % 3 === 0 ? TL.primary : i % 3 === 1 ? TL.primaryLight : TL.success,
                }}
              >
                {initials(ev.actorName)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography sx={{ fontSize: '0.875rem', color: TL.gray700 }}>
                  <Box component="span" sx={{ fontWeight: 600, color: TL.gray800 }}>{ev.actorName || 'System'}</Box>
                  {' '}{ev.actionDescription?.toLowerCase() || ev.action?.replace(/_/g, ' ')}
                </Typography>
              }
              secondary={timeAgo(ev.occurredAt)}
              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
            />
          </ListItem>
        ))}
      </List>
    </DataCard>
  );
}
