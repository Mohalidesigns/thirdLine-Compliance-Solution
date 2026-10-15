import { Outlet } from 'react-router-dom';
import { AppShell } from 'shared';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <AppShell
      renderSidebar={(p) => <Sidebar {...p} />}
      renderTopBar={(p) => <TopBar {...p} />}
    >
      <Outlet />
    </AppShell>
  );
}
