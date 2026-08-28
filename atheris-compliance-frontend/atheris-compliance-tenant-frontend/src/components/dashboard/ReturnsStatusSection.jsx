import { Paper, Typography, Box, Chip, List, ListItem, ListItemText, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Error as OverdueIcon,
  CheckCircle as OnTimeIcon,
  Schedule as SoonIcon,
} from '@mui/icons-material';

function StatusCard({ title, count, total, icon: Icon, color, items, drillLabel }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const chipColor = pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'error';

  return (
    <Paper
      elevation={0}
      onClick={() => navigate('/returns')}
      sx={{
        p: 3, height: '100%', cursor: 'pointer',
        borderTop: `4px solid ${color}`,
        border: '1px solid',
        borderColor: theme.palette.divider,
        borderTopWidth: 4,
        borderTopColor: color,
        transition: 'all 0.15s',
        '&:hover': { bgcolor: theme.palette.action.hover, transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h3" fontWeight={700} color={color}>{count}</Typography>
        </Box>
        <Icon sx={{ color, fontSize: 36, opacity: 0.6 }} />
      </Box>
      {total > 0 && (
        <Chip
          label={`${pct}%`}
          size="small"
          color={chipColor}
          sx={{ mt: 1, fontWeight: 600, fontSize: 12 }}
        />
      )}
      {items && items.length > 0 && (
        <List dense sx={{ mt: 1.5, maxHeight: 140, overflow: 'auto' }}>
          {items.map((item, i) => (
            <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
              <ListItemText
                primary={
                  <Typography variant="caption" noWrap sx={{ display: 'block', maxWidth: 200 }}>
                    {item.title || item.name || `Return #${item.returnId || ''}`}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {item.regulator || ''} {item.dueDate ? `· Due ${new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                  </Typography>
                }
                secondaryTypographyProps={{ component: 'span' }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

export default function ReturnsStatusSection({ stats = {}, calendar = [] }) {
  const overdue = stats.overdue || 0;
  const submitted = stats.submitted || 0;
  const total = stats.total || 1;

  const upcoming = calendar
    .filter(c => c.status === 'NOT_STARTED' || c.status === 'IN_PROGRESS')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
      <StatusCard
        title="Overdue"
        count={overdue}
        total={total}
        icon={OverdueIcon}
        color="#d32f2f"
      />
      <StatusCard
        title="On Time"
        count={submitted}
        total={total}
        icon={OnTimeIcon}
        color="#2e7d32"
      />
      <StatusCard
        title="Coming Soon"
        count={upcoming.length}
        total={total}
        icon={SoonIcon}
        color="#ed6c02"
        items={upcoming}
      />
    </Box>
  );
}
