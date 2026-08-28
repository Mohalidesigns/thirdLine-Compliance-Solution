import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './contexts/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/CcoDashboardPage'));
const ReviewInboxPage = lazy(() => import('./pages/ReviewInboxPage'));
const ReviewEditPage = lazy(() => import('./pages/ReviewEditPage'));
const InstrumentsPage = lazy(() => import('./pages/InstrumentsPage'));
const RegulatorsPage = lazy(() => import('./pages/RegulatorsPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const UploadStatusPage = lazy(() => import('./pages/UploadStatusPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ControlsPage = lazy(() => import('./pages/ControlsPage'));
const FindingsPage = lazy(() => import('./pages/FindingsPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const SanctionsPage = lazy(() => import('./pages/SanctionsPage'));
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'));
const EvidenceVaultPage = lazy(() => import('./pages/EvidenceVaultPage'));
const ObligationsRegisterPage = lazy(() => import('./pages/ObligationsRegisterPage'));
const ObligationDetailPage = lazy(() => import('./pages/ObligationDetailPage'));

function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="review" element={<ReviewInboxPage />} />
          <Route path="review/:reviewId" element={<ReviewEditPage />} />
          <Route path="instruments" element={<InstrumentsPage />} />
          <Route path="obligations" element={<ObligationsRegisterPage />} />
          <Route path="obligations/:id" element={<ObligationDetailPage />} />
          <Route path="regulators" element={<RegulatorsPage />} />
          <Route path="uploads" element={<UploadPage />} />
          <Route path="upload-history" element={<UploadStatusPage />} />
          <Route path="controls" element={<ControlsPage />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="sanctions" element={<SanctionsPage />} />
          <Route path="audit" element={<AuditTrailPage />} />
          <Route path="evidence" element={<EvidenceVaultPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="overview" element={<Navigate to="/dashboard" />} />
          <Route path="upload" element={<Navigate to="/uploads" />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}
