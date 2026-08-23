import { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { CalendarMonth, Shield } from '@mui/icons-material';
import RenditionTab from '../components/dashboard/RenditionTab';
import ControlCoverageTab from '../components/dashboard/ControlCoverageTab';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

export default function DashboardV2Page() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Dashboard</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<CalendarMonth />} iconPosition="start" label="Rendition Tracker" />
        <Tab icon={<Shield />} iconPosition="start" label="Control Coverage" />
      </Tabs>
      <TabPanel value={tab} index={0}>
        <RenditionTab />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <ControlCoverageTab />
      </TabPanel>
    </Box>
  );
}
