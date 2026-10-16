import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import SplashScreen, { shouldShowSplash } from './pages/SplashScreen';
import LoginPage from './pages/LoginPage';
import OtpVerifyPage from './pages/OtpVerifyPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ResolverDashboard from './pages/ResolverDashboard';
import DeptAdminDashboard from './pages/DeptAdminDashboard';
import SystemAdminDashboard from './pages/SystemAdminDashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

// ── ProtectedRoute ────────────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F5]">
        <span className="text-slate-400 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && !hasRole(...roles)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F5] gap-3">
        <p className="text-2xl font-bold text-slate-700">403 — Access Denied</p>
        <p className="text-sm text-slate-400">
          You don&apos;t have permission to view this page.
        </p>
        <a href="/dashboard" className="text-[#1A9F52] text-sm font-semibold hover:underline">
          Back to Dashboard
        </a>
      </div>
    );
  }

  return children;
}

// ── RoleDashboard ─────────────────────────────────────────────────────────────
function RoleDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F5]">
        <span className="text-slate-400 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }

  switch (user?.role) {
    case 'system_admin': return <Navigate to="/dashboard/admin" replace />;
    case 'dept_admin':   return <Navigate to="/dashboard/dept-admin" replace />;
    case 'resolver':     return <Navigate to="/dashboard/resolver" replace />;
    default:             return <Navigate to="/dashboard/employee" replace />;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route
          path="/"
          element={shouldShowSplash() ? <SplashScreen /> : <Navigate to="/login" replace />}
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-otp" element={<OtpVerifyPage />} />

        {/* /dashboard → role-based redirect */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleDashboard />
            </ProtectedRoute>
          }
        />

        {/* Role dashboards */}
        <Route
          path="/dashboard/employee"
          element={
            <ProtectedRoute roles={['employee']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/resolver"
          element={
            <ProtectedRoute roles={['resolver', 'dept_admin', 'system_admin']}>
              <ResolverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/dept-admin"
          element={
            <ProtectedRoute roles={['dept_admin', 'system_admin']}>
              <DeptAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute roles={['system_admin']}>
              <SystemAdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Analytics */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute roles={['dept_admin', 'system_admin']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
