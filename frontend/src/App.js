import React, { useCallback, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { brandingService } from './services/api';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
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
import HomePage from './pages/Home.tsx';
import LibraryPage from './pages/Library.tsx';
import ActivityPage from './pages/Activity.tsx';
import PayoutsPage from './pages/Payouts.tsx';
import SettingsPage from './pages/Settings.tsx';
import PaymentPage from './pages/Payment.tsx';
import ContactUsPage from './pages/ContactUs.tsx';
import DashboardLayout from './layouts/DashboardLayout.tsx';

// Styles
import './styles/global.css';

const FAVICON_CACHE_KEY = 'appFaviconUrl';

const applyFavicon = (faviconUrl) => {
  const nextUrl = String(faviconUrl || '').trim();
  if (!nextUrl || typeof document === 'undefined') return;

  let iconLink = document.querySelector("link[rel='icon']");
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.setAttribute('rel', 'icon');
    document.head.appendChild(iconLink);
  }

  iconLink.setAttribute('href', nextUrl);
};

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
  useEffect(() => {
    const cachedFavicon = localStorage.getItem(FAVICON_CACHE_KEY);
    if (cachedFavicon) {
      applyFavicon(cachedFavicon);
    }
  }, []);

  const loadBranding = useCallback(async () => {
    try {
      const response = await brandingService.getSettings();
      const settings = response.data || {};
      const headerColor = settings.headerColor || '#103c21';
      const buttonColor = settings.buttonColor || '#007bff';
      const lineColor = settings.lineColor || '#dddddd';
      const secondaryColor = '#69655e';

      document.documentElement.style.setProperty('--header-color', headerColor);
      document.documentElement.style.setProperty('--button-color', buttonColor);
      document.documentElement.style.setProperty('--line-color', lineColor);
      document.documentElement.style.setProperty('--secondary-color', secondaryColor);

      const faviconFromApi = String(settings.faviconUrl || settings.favicon_url || '').trim();
      if (faviconFromApi) {
        localStorage.setItem(FAVICON_CACHE_KEY, faviconFromApi);
        applyFavicon(faviconFromApi);
      }
    } catch (error) {
      document.documentElement.style.setProperty('--header-color', '#103c21');
      document.documentElement.style.setProperty('--button-color', '#007bff');
      document.documentElement.style.setProperty('--line-color', '#dddddd');
      document.documentElement.style.setProperty('--secondary-color', '#69655e');
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
      <div className="app-shell">
        <main className="app-content">
          <Routes>
            {/* Public Routes */}
            <Route
              path="/home"
              element={
                <DashboardLayout>
                  <HomePage />
                </DashboardLayout>
              }
            />
            <Route
              path="/library"
              element={
                <DashboardLayout>
                  <LibraryPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/activity"
              element={
                <DashboardLayout>
                  <ActivityPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/payouts"
              element={
                <DashboardLayout>
                  <PayoutsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/payment"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PaymentPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-us"
              element={
                <DashboardLayout>
                  <ContactUsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/categories/:categoryId/packages"
              element={
                <DashboardLayout>
                  <CategoryPackages />
                </DashboardLayout>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard/packages" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/packages"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/adaptive"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AdaptiveDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/report"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Reports />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/categories/:categoryId"
              element={
                <DashboardLayout>
                  <CategoryPackages />
                </DashboardLayout>
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
            <Route path="/adaptive-dashboard" element={<Navigate to="/dashboard/adaptive" />} />
            <Route path="/reports" element={<Navigate to="/dashboard/report" />} />
            <Route
              path="/my-materials"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserMaterialsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DashboardLayout>
                    <AdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cms/library"
              element={
                <ProtectedRoute requiredRole={['admin', 'content_manager', 'reviewer']}>
                  <DashboardLayout>
                    <CMSContentLibraryPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cms/upload"
              element={
                <ProtectedRoute requiredRole={['admin', 'content_manager']}>
                  <DashboardLayout>
                    <CMSUploadCenterPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cms/workflow"
              element={
                <ProtectedRoute requiredRole={['admin', 'reviewer']}>
                  <DashboardLayout>
                    <CMSWorkflowApprovalPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cms/bundles"
              element={
                <ProtectedRoute requiredRole={['admin', 'content_manager']}>
                  <DashboardLayout>
                    <CMSBundleBuilderPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/home" />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;
