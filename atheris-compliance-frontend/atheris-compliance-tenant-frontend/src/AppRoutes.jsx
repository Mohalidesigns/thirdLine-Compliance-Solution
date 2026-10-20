import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './contexts/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/CcoDashboardPage'));
const DashboardV2Page = lazy(() => import('./pages/DashboardV2Page'));
const ReviewInboxPage = lazy(() => import('./pages/ReviewInboxPage'));
const ReviewEditPage = lazy(() => import('./pages/ReviewEditPage'));
const InstrumentsPage = lazy(() => import('./pages/InstrumentsPage'));
const UniversePage = lazy(() => import('./pages/UniversePage'));
const RegulatorsPage = lazy(() => import('./pages/RegulatorsPage'));
const RegulatorDetailPage = lazy(() => import('./pages/RegulatorDetailPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const UploadStatusPage = lazy(() => import('./pages/UploadStatusPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ControlsPage = lazy(() => import('./pages/ControlsPage'));
const FindingsPage = lazy(() => import('./pages/FindingsPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const ReturnsDetailPage = lazy(() => import('./pages/ReturnsDetailPage'));
const SanctionsPage = lazy(() => import('./pages/SanctionsPage'));
const AuditTrailPage = lazy(() => import('./pages/AuditTrailPage'));
const EvidenceVaultPage = lazy(() => import('./pages/EvidenceVaultPage'));
const ObligationsRegisterPage = lazy(() => import('./pages/ObligationsRegisterPage'));
const ObligationDetailPage = lazy(() => import('./pages/ObligationDetailPage'));
const ActsPage = lazy(() => import('./pages/ActsPage'));
const ActDetailPage = lazy(() => import('./pages/ActDetailPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const RunbooksLibraryPage = lazy(() => import('./pages/runbooks/RunbooksLibraryPage'));
const RunbookDetailPage = lazy(() => import('./pages/runbooks/RunbookDetailPage'));
const RunbookBuilderPage = lazy(() => import('./pages/runbooks/RunbookBuilderPage'));
const ExecutionsPage = lazy(() => import('./pages/runbooks/ExecutionsPage'));
const ExecutionConsolePage = lazy(() => import('./pages/runbooks/ExecutionConsolePage'));
const ExecutionSummaryPage = lazy(() => import('./pages/runbooks/ExecutionSummaryPage'));
const ApprovalsPage = lazy(() => import('./pages/runbooks/ApprovalsPage'));
const CoverageMatrixPage = lazy(() => import('./pages/runbooks/CoverageMatrixPage'));
const TemplateLibraryPage = lazy(() => import('./pages/runbooks/TemplateLibraryPage'));
const PublicRemediatePage = lazy(() => import('./pages/PublicRemediatePage'));
const PublicReturnUploadPage = lazy(() => import('./pages/PublicReturnUploadPage'));

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
        {/* Public, no-login owner remediation page reached via an emailed token link. */}
        <Route path="/remediate/:token" element={<PublicRemediatePage />} />
        {/* Public, no-login return event-filing upload page reached via an emailed token link. */}
        <Route path="/return-upload/:token" element={<PublicReturnUploadPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/v2" element={<DashboardV2Page />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="review" element={<ReviewInboxPage />} />
          <Route path="review/:reviewId" element={<ReviewEditPage />} />
          <Route path="universe" element={<UniversePage />} />
          <Route path="instruments" element={<InstrumentsPage />} />
          <Route path="obligations" element={<ObligationsRegisterPage />} />
          <Route path="obligations/:id" element={<ObligationDetailPage />} />
          <Route path="acts" element={<ActsPage />} />
          <Route path="acts/:id" element={<ActDetailPage />} />
          <Route path="regulators" element={<RegulatorsPage />} />
          <Route path="regulators/:id" element={<RegulatorDetailPage />} />
          <Route path="uploads" element={<UploadPage />} />
          <Route path="upload-history" element={<UploadStatusPage />} />
          <Route path="controls" element={<ControlsPage />} />
          <Route path="runbooks" element={<RunbooksLibraryPage />} />
          <Route path="runbooks/new" element={<RunbookBuilderPage />} />
          <Route path="runbooks/executions" element={<ExecutionsPage />} />
          <Route path="runbooks/executions/:execId" element={<ExecutionConsolePage />} />
          <Route path="runbooks/executions/:execId/summary" element={<ExecutionSummaryPage />} />
          <Route path="runbooks/approvals" element={<ApprovalsPage />} />
          <Route path="runbooks/coverage" element={<CoverageMatrixPage />} />
          <Route path="runbooks/templates" element={<TemplateLibraryPage />} />
          <Route path="runbooks/:id" element={<RunbookDetailPage />} />
          <Route path="runbooks/:id/edit" element={<RunbookBuilderPage />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="returns/:returnId" element={<ReturnsDetailPage />} />
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
