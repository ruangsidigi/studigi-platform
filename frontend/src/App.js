import React, { useCallback, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { brandingService } from './services/api';

// Components
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import CategoryPackages from './pages/CategoryPackages';
import BundleDetail from './pages/BundleDetail';
import Reports from './pages/Reports';
import ReviewPage from './pages/ReviewPage';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import AdminDashboard from './pages/AdminDashboard';
import CMSContentLibraryPage from './pages/CMSContentLibraryPage';
import CMSUploadCenterPage from './pages/CMSUploadCenterPage';
import CMSWorkflowApprovalPage from './pages/CMSWorkflowApprovalPage';
import CMSBundleBuilderPage from './pages/CMSBundleBuilderPage';
import AdaptiveDashboard from './pages/AdaptiveDashboard';
import UserMaterialsPage from './pages/UserMaterialsPage';

// Styles
import './styles/global.css';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" />;
    }
  }

  return children;
};

function App() {
  const [branding, setBranding] = useState({
    logoUrl: null,
    headerColor: '#1d7a7a',
    buttonColor: '#007bff',
    lineColor: '#dddddd',
  });

  const loadBranding = useCallback(async () => {
    try {
      const response = await brandingService.getSettings();
      const settings = response.data || {};
      const headerColor = settings.headerColor || '#1d7a7a';
      const buttonColor = settings.buttonColor || '#007bff';
      const lineColor = settings.lineColor || '#dddddd';
      const rawLogoUrl = settings.logoUrl || null;
      const isDataUrl = typeof rawLogoUrl === 'string' && rawLogoUrl.startsWith('data:');
      const logoUrl = rawLogoUrl
        ? (isDataUrl
          ? rawLogoUrl
          : `${rawLogoUrl}${rawLogoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(settings.updatedAt || Date.now())}`)
        : null;

      setBranding({
        logoUrl,
        headerColor,
        buttonColor,
        lineColor,
      });

      document.documentElement.style.setProperty('--header-color', headerColor);
      document.documentElement.style.setProperty('--button-color', buttonColor);
      document.documentElement.style.setProperty('--line-color', lineColor);
    } catch (error) {
      document.documentElement.style.setProperty('--header-color', '#1d7a7a');
      document.documentElement.style.setProperty('--button-color', '#007bff');
      document.documentElement.style.setProperty('--line-color', '#dddddd');
    }
  }, []);

  useEffect(() => {
    loadBranding();

    const handleBrandingUpdated = () => {
      loadBranding();
    };

    window.addEventListener('branding-updated', handleBrandingUpdated);
    return () => window.removeEventListener('branding-updated', handleBrandingUpdated);
  }, [loadBranding]);

  return (
    <Router>
      <Navbar branding={branding} />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/categories/:categoryId"
          element={
            <ProtectedRoute>
              <CategoryPackages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bundles/:bundleId"
          element={
            <ProtectedRoute>
              <BundleDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:attemptId"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/:packageId"
          element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <ProtectedRoute>
              <Results />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adaptive-dashboard"
          element={
            <ProtectedRoute>
              <AdaptiveDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-materials"
          element={
            <ProtectedRoute>
              <UserMaterialsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/library"
          element={
            <ProtectedRoute requiredRole={['admin', 'content_manager', 'reviewer']}>
              <CMSContentLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/upload"
          element={
            <ProtectedRoute requiredRole={['admin', 'content_manager']}>
              <CMSUploadCenterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/workflow"
          element={
            <ProtectedRoute requiredRole={['admin', 'reviewer']}>
              <CMSWorkflowApprovalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cms/bundles"
          element={
            <ProtectedRoute requiredRole={['admin', 'content_manager']}>
              <CMSBundleBuilderPage />
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
