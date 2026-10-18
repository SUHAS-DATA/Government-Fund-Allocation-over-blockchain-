import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { NotificationProvider } from './context/NotificationContext';
import { FinancialYearProvider } from './context/FinancialYearContext';

// Portal Configuration Helper & Error Screen
import { getActivePortal, PORTAL_TYPES } from './config/portalConfig';
import PortalConfigError from './components/PortalConfigError';

// Shared Components
import { FloatingThemeToggle } from './components/ThemeToggle';

// Lightweight fallback spinner for route transitions
const PageFallback = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '45vh',
    gap: '12px',
    color: '#64748B'
  }}>
    <div style={{
      width: '28px',
      height: '28px',
      border: '3px solid #E2E8F0',
      borderTopColor: '#002B49',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '13px', fontWeight: '600' }}>Loading module...</span>
  </div>
);

// Safe lazy-loading with automatic retry for deployment asset version updates
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const reloadKey = 'chunk_reloaded_' + window.location.pathname;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

// 4 Dedicated Frontend Portal Entry Pages (Lazy Loaded)
const AdminPortalPage = lazyWithRetry(() => import('./pages/portals/AdminPortalPage'));
const FieldPortalPage = lazyWithRetry(() => import('./pages/portals/FieldPortalPage'));
const ContractorPortalPage = lazyWithRetry(() => import('./pages/portals/ContractorPortalPage'));
const PublicPortalPage = lazyWithRetry(() => import('./pages/portals/PublicPortalPage'));

// Public Pages (Lazy Loaded)
const PublicProjects = lazyWithRetry(() => import('./pages/public/PublicProjects'));
const PublicProjectDetail = lazyWithRetry(() => import('./pages/public/PublicProjectDetail'));
const PublicVerificationPage = lazyWithRetry(() => import('./pages/public/PublicVerificationPage'));
const PublicExplorer = lazyWithRetry(() => import('./pages/public/PublicExplorer'));
const GrievancePortal = lazyWithRetry(() => import('./pages/public/GrievancePortal'));
const GrievanceTrack = lazyWithRetry(() => import('./pages/public/GrievanceTrack'));
const HowItWorks = lazyWithRetry(() => import('./pages/public/HowItWorks'));

// Admin Pages (Lazy Loaded)
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));

// Finance Pages (Lazy Loaded)
const FinanceDashboard = lazyWithRetry(() => import('./pages/finance/FinanceDashboard'));

// State Pages (Lazy Loaded)
const StateDashboard = lazyWithRetry(() => import('./pages/state/StateDashboard'));

// Department / District Pages (Lazy Loaded)
const DistrictDashboard = lazyWithRetry(() => import('./pages/district/DistrictDashboard'));
const DepartmentDashboard = lazyWithRetry(() => import('./pages/department/DepartmentDashboard'));

// Contractor Pages (Lazy Loaded)
const ContractorDashboard = lazyWithRetry(() => import('./pages/contractor/ContractorDashboard'));
const ContractorKYC = lazyWithRetry(() => import('./pages/contractor/ContractorKYC'));
const MyProjects = lazyWithRetry(() => import('./pages/contractor/MyProjects'));
const MilestonePayments = lazyWithRetry(() => import('./pages/contractor/MilestonePayments'));

// Common Pages (Lazy Loaded)
const ProfilePage = lazyWithRetry(() => import('./pages/common/ProfilePage'));
const NotificationsPage = lazyWithRetry(() => import('./pages/common/NotificationsPage'));

// Role Home Helper based on Active Portal
const getRoleHome = (role, activePortal) => {
  if (activePortal === PORTAL_TYPES.ADMIN || activePortal === PORTAL_TYPES.AUDITOR) {
    if (role === 'AUDITOR') return '/admin?tab=monitoring';
    return role === 'FINANCE' ? '/finance' : '/admin';
  }
  if (activePortal === PORTAL_TYPES.FIELD) {
    return role === 'STATE' ? '/state' : '/district';
  }
  if (activePortal === PORTAL_TYPES.CONTRACTOR) {
    return '/contractor/dashboard';
  }
  return '/';
};

// Protected Route Guard Component with Portal-Specific Redirection
const ProtectedRoute = ({ allowedRoles, activePortal, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role, activePortal)} replace />;
  }
  return children;
};

// Portal Layout Wrapper with Centered Control Hub & Floating Theme Toggle
const PortalLayout = ({ children }) => {
  return (
    <div className="super-admin-portal-wrapper">
      {children}
      <FloatingThemeToggle />
    </div>
  );
};


function App() {
  const activePortal = getActivePortal();

  // If VITE_PORTAL is missing or invalid: show configuration error screen (DO NOT show the 7 roles screen)
  if (!activePortal || activePortal === 'INVALID') {
    return <PortalConfigError detectedValue={import.meta.env.VITE_PORTAL} />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <RealtimeProvider>
          <NotificationProvider>
            <FinancialYearProvider>
              <BrowserRouter>
            <PortalLayout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
              {/* ========================================================= */}
              {/* Universal Public QR Verification (No Login Required)      */}
              {/* ========================================================= */}
              <Route path="/verify/:qrId" element={<PublicVerificationPage />} />
              <Route path="/public/verify/:qrId" element={<PublicVerificationPage />} />
              <Route path="/verify-project/:qrId" element={<PublicVerificationPage />} />
              {/* ========================================================= */}
              {/* PORTAL 1 & 5 — ADMIN & AUDITOR (VITE_PORTAL=ADMIN|AUDITOR)*/}
              {/* Shows Super Admin, Finance, and Auditor Operations        */}
              {/* ========================================================= */}
              {(activePortal === PORTAL_TYPES.ADMIN || activePortal === PORTAL_TYPES.AUDITOR) && (
                <>
                  {/* Entry Point: Admin / Auditor Portal Login */}
                  <Route path="/" element={<AdminPortalPage />} />
                  <Route path="/admin-portal" element={<AdminPortalPage />} />
                  <Route path="/login" element={<AdminPortalPage />} />

                  {/* Super Admin & Auditor Centered Control Hub & Operations */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'AUDITOR']} activePortal={activePortal}><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
                  <Route path="/admin/financial-years" element={<Navigate to="/admin?tab=config" replace />} />
                  <Route path="/admin/departments" element={<Navigate to="/admin?tab=departments" replace />} />
                  <Route path="/admin/states-districts" element={<Navigate to="/admin?tab=states_districts" replace />} />
                  <Route path="/admin/schemes" element={<Navigate to="/admin?tab=schemes" replace />} />
                  <Route path="/admin/budget-allocation" element={<Navigate to="/admin?tab=allocation" replace />} />
                  <Route path="/admin/send-to-finance" element={<Navigate to="/admin?tab=send_finance" replace />} />
                  <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
                  <Route path="/admin/blockchain-explorer" element={<Navigate to="/admin?tab=monitoring" replace />} />
                  <Route path="/admin/projects" element={<Navigate to="/admin?tab=projects" replace />} />

                  {/* Finance Department Dashboards & Operations */}
                  <Route path="/finance" element={<ProtectedRoute allowedRoles={['FINANCE']} activePortal={activePortal}><FinanceDashboard /></ProtectedRoute>} />
                  <Route path="/finance/dashboard" element={<Navigate to="/finance" replace />} />
                  <Route path="/finance/received-budgets" element={<Navigate to="/finance?tab=pending" replace />} />
                  <Route path="/finance/transfers" element={<Navigate to="/finance?tab=release" replace />} />
                  <Route path="/finance/history" element={<Navigate to="/finance?tab=history" replace />} />

                  {/* Common Authenticated Routes */}
                  <Route path="/profile" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'FINANCE', 'AUDITOR']} activePortal={activePortal}><ProfilePage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'FINANCE', 'AUDITOR']} activePortal={activePortal}><NotificationsPage /></ProtectedRoute>} />

                  {/* Inter-portal links */}
                  <Route path="/contractor-portal" element={<Navigate to="/?portal=CONTRACTOR" replace />} />
                  <Route path="/contractor-login" element={<Navigate to="/?portal=CONTRACTOR" replace />} />
                  <Route path="/register" element={<Navigate to="/?portal=CONTRACTOR&tab=register" replace />} />
                  <Route path="/field-portal" element={<Navigate to="/?portal=FIELD" replace />} />

                  {/* Catch-all: Redirect to Admin Portal Entry */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}

              {/* ========================================================= */}
              {/* PORTAL 2 — FIELD (VITE_PORTAL=FIELD)                      */}
              {/* Shows ONLY State Treasury and District Agency             */}
              {/* ========================================================= */}
              {activePortal === PORTAL_TYPES.FIELD && (
                <>
                  {/* Entry Point: Field Portal Login */}
                  <Route path="/" element={<FieldPortalPage />} />
                  <Route path="/field-portal" element={<FieldPortalPage />} />
                  <Route path="/district-login" element={<FieldPortalPage />} />

                  {/* Dedicated District Development Control Hub & Operations */}
                  <Route path="/district" element={<ProtectedRoute allowedRoles={['DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><DistrictDashboard /></ProtectedRoute>} />
                  <Route path="/district/dashboard" element={<Navigate to="/district" replace />} />
                  <Route path="/district/projects" element={<Navigate to="/district?tab=projects" replace />} />
                  <Route path="/district/contractors" element={<Navigate to="/district?tab=contractors" replace />} />
                  <Route path="/district/grievances" element={<Navigate to="/district?tab=grievances" replace />} />

                  {/* Dedicated State Treasury Control Hub & Operations */}
                  <Route path="/state" element={<ProtectedRoute allowedRoles={['STATE']} activePortal={activePortal}><StateDashboard /></ProtectedRoute>} />
                  <Route path="/state/dashboard" element={<Navigate to="/state" replace />} />
                  <Route path="/state/received-funds" element={<Navigate to="/state?tab=received" replace />} />
                  <Route path="/state/allocations" element={<Navigate to="/state?tab=allocations" replace />} />
                  <Route path="/state/history" element={<Navigate to="/state?tab=history" replace />} />
                  <Route path="/state/contractors" element={<Navigate to="/state?tab=contractors" replace />} />

                  {/* Role-based Department Entry Dispatcher */}
                  <Route path="/department" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><DepartmentDashboard /></ProtectedRoute>} />
                  <Route path="/department/dashboard" element={<Navigate to="/department" replace />} />

                  {/* Common Authenticated Routes */}
                  <Route path="/profile" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><ProfilePage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><NotificationsPage /></ProtectedRoute>} />

                  {/* Inter-portal links */}
                  <Route path="/contractor-portal" element={<Navigate to="/?portal=CONTRACTOR" replace />} />
                  <Route path="/contractor-login" element={<Navigate to="/?portal=CONTRACTOR" replace />} />
                  <Route path="/register" element={<Navigate to="/?portal=CONTRACTOR&tab=register" replace />} />
                  <Route path="/admin-portal" element={<Navigate to="/?portal=ADMIN" replace />} />

                  {/* Catch-all: Redirect to Field Portal Entry */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}

              {/* ========================================================= */}
              {/* PORTAL 3 — CONTRACTOR (VITE_PORTAL=CONTRACTOR)            */}
              {/* Shows ONLY Contractor Registration, Login, & Dashboard    */}
              {/* ========================================================= */}
              {activePortal === PORTAL_TYPES.CONTRACTOR && (
                <>
                  {/* Entry Point: Contractor Portal (Login & Registration) */}
                  <Route path="/" element={<ContractorPortalPage />} />
                  <Route path="/contractor-portal" element={<ContractorPortalPage />} />
                  <Route path="/contractor-login" element={<ContractorPortalPage />} />
                  <Route path="/register" element={<ContractorPortalPage />} />

                  {/* Contractor Dashboard & Operations */}
                  <Route path="/contractor/dashboard" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><ContractorDashboard /></ProtectedRoute>} />
                  <Route path="/contractor/my-projects" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><MyProjects /></ProtectedRoute>} />
                  <Route path="/contractor/kyc" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><ContractorKYC /></ProtectedRoute>} />
                  <Route path="/contractor/payments" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><MilestonePayments /></ProtectedRoute>} />

                  {/* Common Authenticated Routes */}
                  <Route path="/profile" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><ProfilePage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={['CONTRACTOR']} activePortal={activePortal}><NotificationsPage /></ProtectedRoute>} />

                  {/* Catch-all: Redirect to Contractor Portal Entry */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}

              {/* ========================================================= */}
              {/* PORTAL 4 — PUBLIC (VITE_PORTAL=PUBLIC)                    */}
              {/* Shows ONLY Public / Citizen Interface (No Login Required) */}
              {/* ========================================================= */}
              {activePortal === PORTAL_TYPES.PUBLIC && (
                <>
                  {/* Entry Point: Public Portal */}
                  <Route path="/" element={<PublicPortalPage />} />
                  <Route path="/public" element={<PublicPortalPage />} />
                  <Route path="/public/projects" element={<PublicProjects />} />
                  <Route path="/public/projects/:id" element={<PublicProjectDetail />} />
                  <Route path="/public/explorer" element={<PublicExplorer />} />
                  <Route path="/public/grievance" element={<GrievancePortal />} />
                  <Route path="/public/grievance/track/:refId" element={<GrievanceTrack />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />

                  {/* Catch-all: Redirect to Public Portal Entry */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}


            </Routes>
            </Suspense>
          </PortalLayout>
        </BrowserRouter>
        </FinancialYearProvider>
      </NotificationProvider>
    </RealtimeProvider>
  </AuthProvider>
</ThemeProvider>
  );
}

export default App;
