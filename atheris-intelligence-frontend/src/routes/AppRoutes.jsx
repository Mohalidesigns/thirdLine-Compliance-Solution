import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ROUTES } from '../utils/constants';

const LoginForm = lazy(() => import('../features/auth/components/LoginForm'));
const OnboardingPage = lazy(() => import('../features/onboarding/components/OnboardingPage'));
const DashboardPage = lazy(() => import('../features/dashboard/components/DashboardPage'));

const LibraryPage = lazy(() => import('../features/intelligence/components/LibraryPage'));
const InboxPage = lazy(() => import('../features/intelligence/components/InboxPage'));
const WatchlistPage = lazy(() => import('../features/intelligence/components/WatchlistPage'));

const ApiSettingsPage = lazy(() => import('../features/settings/components/ApiSettingsPage'));
const ComplianceSettingsPage = lazy(() => import('../features/settings/components/ComplianceSettingsPage'));

const TenantAdminPage = lazy(() => import('../features/admin/components/TenantAdminPage'));
const TenantDetailPage = lazy(() => import('../features/admin/components/TenantDetailPage'));
const RegulatorAdminPage = lazy(() => import('../features/admin/components/RegulatorAdminPage'));
const RegulatorDetailPage = lazy(() => import('../features/admin/components/RegulatorDetailPage'));
const JobQueuePage = lazy(() => import('../features/admin/components/JobQueuePage'));
const JobDetailPage = lazy(() => import('../features/admin/components/JobDetailPage'));
const InstrumentTenantDetailPage = lazy(() => import('../features/admin/components/InstrumentTenantDetailPage'));
const LicenseAdminPage = lazy(() => import('../features/admin/components/LicenseAdminPage'));

function Loading() {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress sx={{ color: theme.palette.primary.main }} />
    </Box>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} />;
  return children;
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={isAuthenticated ? <Navigate to={ROUTES.DASHBOARD} /> : <LoginForm />} />
        <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={ROUTES.DASHBOARD} />} />
          <Route path="dashboard" element={<DashboardPage />} />
          
          <Route path="library" element={<LibraryPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          
          <Route path="settings/api" element={<ApiSettingsPage />} />
          <Route path="settings/compliance" element={<ComplianceSettingsPage />} />
          
          <Route path="admin/licenses" element={<LicenseAdminPage />} />
          <Route path="admin/tenants" element={<TenantAdminPage />} />
          <Route path="admin/tenants/:id" element={<TenantDetailPage />} />
          <Route path="admin/regulators" element={<RegulatorAdminPage />} />
          <Route path="admin/regulators/:id" element={<RegulatorDetailPage />} />
          <Route path="admin/pipeline" element={<JobQueuePage />} />
          <Route path="admin/pipeline/:id" element={<JobDetailPage />} />
          <Route path="admin/instruments/:id/tenants" element={<InstrumentTenantDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} />} />
      </Routes>
    </Suspense>
  );
}
