import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './contexts/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const RegulatorsPage = lazy(() => import('./pages/RegulatorsPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const UploadStatusPage = lazy(() => import('./pages/UploadStatusPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ControlsPage = lazy(() => import('./pages/ControlsPage'));
const FindingsPage = lazy(() => import('./pages/FindingsPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'));
const EvidenceVaultPage = lazy(() => import('./pages/EvidenceVaultPage'));
const ObligationsRegisterPage = lazy(() => import('./pages/ObligationsRegisterPage'));

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/overview" /> : <LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/overview" />} />
          <Route path="overview" element={<DashboardPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="obligations" element={<ObligationsRegisterPage />} />
          <Route path="regulators" element={<RegulatorsPage />} />
          <Route path="uploads" element={<UploadPage />} />
          <Route path="upload-history" element={<UploadStatusPage />} />
          <Route path="controls" element={<ControlsPage />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="audit" element={<AuditTrailPage />} />
          <Route path="evidence" element={<EvidenceVaultPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="dashboard" element={<Navigate to="/overview" />} />
          <Route path="upload" element={<Navigate to="/uploads" />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" />} />
      </Routes>
    </Suspense>
  );
}
