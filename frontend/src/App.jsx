import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { NotificationProvider } from './context/NotificationContext';

// Portal Configuration Helper & Error Screen
import { getActivePortal, PORTAL_TYPES } from './config/portalConfig';
import PortalConfigError from './components/PortalConfigError';

// Shared Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

// 4 Dedicated Frontend Portal Entry Pages
import AdminPortalPage from './pages/portals/AdminPortalPage';
import FieldPortalPage from './pages/portals/FieldPortalPage';
import ContractorPortalPage from './pages/portals/ContractorPortalPage';
import PublicPortalPage from './pages/portals/PublicPortalPage';

// Public Pages
import PublicProjects from './pages/public/PublicProjects';
import PublicProjectDetail from './pages/public/PublicProjectDetail';
import PublicExplorer from './pages/public/PublicExplorer';
import GrievancePortal from './pages/public/GrievancePortal';
import GrievanceTrack from './pages/public/GrievanceTrack';
import HowItWorks from './pages/public/HowItWorks';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import FinancialYears from './pages/admin/FinancialYears';
import Departments from './pages/admin/Departments';
import StatesDistricts from './pages/admin/StatesDistricts';
import Schemes from './pages/admin/Schemes';
import BudgetAllocation from './pages/admin/BudgetAllocation';
import SendToFinance from './pages/admin/SendToFinance';
import UserManagement from './pages/admin/UserManagement';

// Finance Pages
import FinanceDashboard from './pages/finance/FinanceDashboard';
import ReceivedBudgets from './pages/finance/ReceivedBudgets';
import TransferToState from './pages/finance/TransferToState';
import FinanceHistory from './pages/finance/FinanceHistory';

// State Pages
import StateDashboard from './pages/state/StateDashboard';
import StateReceivedFunds from './pages/state/StateReceivedFunds';
import AllocateToDistrict from './pages/state/AllocateToDistrict';
import StateHistory from './pages/state/StateHistory';

// Department / District Pages
import DistrictDashboard from './pages/district/DistrictDashboard';
import DepartmentDashboard from './pages/department/DepartmentDashboard';
import ProjectsManagement from './pages/district/ProjectsManagement';
import ContractorKYCReview from './pages/district/ContractorKYCReview';
import GrievanceInbox from './pages/district/GrievanceInbox';

// Contractor Pages
import ContractorDashboard from './pages/contractor/ContractorDashboard';
import ContractorKYC from './pages/contractor/ContractorKYC';
import MyProjects from './pages/contractor/MyProjects';
import MilestonePayments from './pages/contractor/MilestonePayments';

// Common Pages
import ProfilePage from './pages/common/ProfilePage';
import NotificationsPage from './pages/common/NotificationsPage';

// Role Home Helper based on Active Portal
const getRoleHome = (role, activePortal) => {
  if (activePortal === PORTAL_TYPES.ADMIN) {
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
  if (loading) return <div style={{ padding: '60px', textAlign: 'center' }}>Authenticating government session...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role, activePortal)} replace />;
  }
  return children;
};

// Portal Layout Wrapper with Responsive Drawer & Finance Theme Support
const PortalLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Automatically dismiss mobile drawer upon navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // All portals use the centered control hub layout: NO permanent sidebar, NO unnecessary top navigation
  return (
    <div className="super-admin-portal-wrapper">
      {children}
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
    <AuthProvider>
      <RealtimeProvider>
        <NotificationProvider>
          <BrowserRouter>
          <PortalLayout>
            <Routes>
              {/* ========================================================= */}
              {/* PORTAL 1 — ADMIN (VITE_PORTAL=ADMIN)                      */}
              {/* Shows ONLY Super Admin and Finance Department             */}
              {/* ========================================================= */}
              {activePortal === PORTAL_TYPES.ADMIN && (
                <>
                  {/* Entry Point: Admin Portal Login */}
                  <Route path="/" element={<AdminPortalPage />} />
                  <Route path="/admin-portal" element={<AdminPortalPage />} />
                  <Route path="/login" element={<AdminPortalPage />} />

                  {/* Super Admin Centered Control Hub & Operations */}
                  <Route path="/admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} activePortal={activePortal}><AdminDashboard /></ProtectedRoute>} />
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
                  <Route path="/profile" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'FINANCE']} activePortal={activePortal}><ProfilePage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'FINANCE']} activePortal={activePortal}><NotificationsPage /></ProtectedRoute>} />

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

                  {/* Role-based Department Entry Dispatcher */}
                  <Route path="/department" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><DepartmentDashboard /></ProtectedRoute>} />
                  <Route path="/department/dashboard" element={<Navigate to="/department" replace />} />

                  {/* Common Authenticated Routes */}
                  <Route path="/profile" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><ProfilePage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute allowedRoles={['STATE', 'DISTRICT', 'DEPARTMENT']} activePortal={activePortal}><NotificationsPage /></ProtectedRoute>} />

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
          </PortalLayout>
        </BrowserRouter>
      </NotificationProvider>
    </RealtimeProvider>
  </AuthProvider>
  );
}

export default App;
