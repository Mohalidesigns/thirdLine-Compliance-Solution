import { Box, Tab, Tabs } from '@mui/material';
import { TL } from '../theme/tokens';

/**
 * Tab bar with per-tab count pills for detail pages (Thirdline underline tabs:
 * gray-500 labels, primary when selected, 2px primary indicator, gray-200 baseline).
 * tabs: [{ key, label, count? }]
 */
export default function SectionTabs({ tabs = [], value, onChange, sx }) {
  return (
    <Box sx={{ borderBottom: `1px solid ${TL.gray200}`, ...sx }}>
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, px: 2.5 } }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t.label}
                {t.count != null && (
                  <Box
                    component="span"
                    sx={{
                      px: 1, py: '1px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600,
                      bgcolor: value === t.key ? 'rgba(26, 54, 93, 0.08)' : TL.gray100,
                      color: value === t.key ? TL.primary : TL.gray600,
                    }}
                  >
                    {t.count}
                  </Box>
                )}
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}
