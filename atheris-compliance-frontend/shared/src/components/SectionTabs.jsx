import { Box, Tab, Tabs, Chip } from '@mui/material';

/**
 * Tab bar with per-tab count badges for detail pages.
 * tabs: [{ key, label, count? }]
 */
export default function SectionTabs({ tabs = [], value, onChange, sx }) {
  return (
    <Box sx={{ borderBottom: '1px solid #E2E8F0', ...sx }}>
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 64,
          '& .MuiTab-root': {
            textTransform: 'none',
            minHeight: 64,
            px: 3,
            fontSize: '0.95rem',
            fontWeight: 600,
          },
        }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t.label}
                {t.count != null && (
                  <Chip
                    label={t.count}
                    size="small"
                    sx={{ height: 24, fontSize: '0.78rem', fontWeight: 700, bgcolor: '#EDF2F7' }}
                  />
                )}
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}
