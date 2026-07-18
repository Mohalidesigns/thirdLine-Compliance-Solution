import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './contexts/AuthContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RegulatorsPage = lazy(() => import('./pages/RegulatorsPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const UploadStatusPage = lazy(() => import('./pages/UploadStatusPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="regulators" element={<RegulatorsPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="uploads" element={<UploadStatusPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}
