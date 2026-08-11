import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Shared Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

// Public Pages
import HomePage from './pages/public/HomePage';
import PublicProjects from './pages/public/PublicProjects';
import PublicProjectDetail from './pages/public/PublicProjectDetail';
import PublicExplorer from './pages/public/PublicExplorer';
import GrievancePortal from './pages/public/GrievancePortal';
import GrievanceTrack from './pages/public/GrievanceTrack';
import HowItWorks from './pages/public/HowItWorks';
import SelectUserTypePage from './pages/public/SelectUserTypePage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DistrictLoginPage from './pages/auth/DistrictLoginPage';
import ContractorLoginPage from './pages/auth/ContractorLoginPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import FinancialYears from './pages/admin/FinancialYears';
import Departments from './pages/admin/Departments';
import StatesDistricts from './pages/admin/StatesDistricts';
import Schemes from './pages/admin/Schemes';
import BudgetAllocation from './pages/admin/BudgetAllocation';
import SendToFinance from './pages/admin/SendToFinance';
import UserManagement from './pages/admin/UserManagement';
import AuditReportsReview from './pages/admin/AuditReportsReview';

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

// District Pages
import DistrictDashboard from './pages/district/DistrictDashboard';
import ProjectsManagement from './pages/district/ProjectsManagement';
import ContractorKYCReview from './pages/district/ContractorKYCReview';
import GrievanceInbox from './pages/district/GrievanceInbox';

// Contractor Pages
import ContractorDashboard from './pages/contractor/ContractorDashboard';
import ContractorKYC from './pages/contractor/ContractorKYC';
import MyProjects from './pages/contractor/MyProjects';
import MilestonePayments from './pages/contractor/MilestonePayments';

// Auditor Pages
import AuditorDashboard from './pages/auditor/AuditorDashboard';
import AuditExplorer from './pages/auditor/AuditExplorer';
import DocumentAudit from './pages/auditor/DocumentAudit';
import AnomalyAnalytics from './pages/auditor/AnomalyAnalytics';
import FraudFreeze from './pages/auditor/FraudFreeze';
import SubmitAuditReport from './pages/auditor/SubmitAuditReport';

// Common Pages
import ProfilePage from './pages/common/ProfilePage';
import NotificationsPage from './pages/common/NotificationsPage';
import NotFoundPage from './pages/common/NotFoundPage';

// Protected Route Guard Component
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '60px', textAlign: 'center' }}>Authenticating government session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Portal Layout Wrapper
const PortalLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  return (
    <div className="app-container">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="portal-layout">
        {user && sidebarOpen && <Sidebar />}
        <main className={user && sidebarOpen ? "main-content" : "public-content"}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <PortalLayout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/select-user-type" element={<SelectUserTypePage />} />
              <Route path="/portals" element={<SelectUserTypePage />} />
              <Route path="/public/projects" element={<PublicProjects />} />
              <Route path="/public/projects/:id" element={<PublicProjectDetail />} />
              <Route path="/public/explorer" element={<PublicExplorer />} />
              <Route path="/public/grievance" element={<GrievancePortal />} />
              <Route path="/public/grievance/track/:refId" element={<GrievanceTrack />} />
              <Route path="/how-it-works" element={<HowItWorks />} />

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/district-login" element={<DistrictLoginPage />} />
              <Route path="/auth/district-login" element={<DistrictLoginPage />} />
              <Route path="/contractor-login" element={<ContractorLoginPage />} />
              <Route path="/auth/contractor-login" element={<ContractorLoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Super Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/financial-years" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><FinancialYears /></ProtectedRoute>} />
              <Route path="/admin/departments" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><Departments /></ProtectedRoute>} />
              <Route path="/admin/states-districts" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><StatesDistricts /></ProtectedRoute>} />
              <Route path="/admin/schemes" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><Schemes /></ProtectedRoute>} />
              <Route path="/admin/budget-allocation" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><BudgetAllocation /></ProtectedRoute>} />
              <Route path="/admin/send-to-finance" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SendToFinance /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><UserManagement /></ProtectedRoute>} />
              <Route path="/admin/blockchain-explorer" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AuditExplorer /></ProtectedRoute>} />
              <Route path="/admin/audit-reports" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AuditReportsReview /></ProtectedRoute>} />

              {/* Finance Routes */}
              <Route path="/finance/dashboard" element={<ProtectedRoute allowedRoles={['FINANCE', 'SUPER_ADMIN']}><FinanceDashboard /></ProtectedRoute>} />
              <Route path="/finance/received-budgets" element={<ProtectedRoute allowedRoles={['FINANCE', 'SUPER_ADMIN']}><ReceivedBudgets /></ProtectedRoute>} />
              <Route path="/finance/transfers" element={<ProtectedRoute allowedRoles={['FINANCE', 'SUPER_ADMIN']}><TransferToState /></ProtectedRoute>} />
              <Route path="/finance/history" element={<ProtectedRoute allowedRoles={['FINANCE', 'SUPER_ADMIN']}><FinanceHistory /></ProtectedRoute>} />

              {/* State Routes */}
              <Route path="/state/dashboard" element={<ProtectedRoute allowedRoles={['STATE', 'SUPER_ADMIN']}><StateDashboard /></ProtectedRoute>} />
              <Route path="/state/received-funds" element={<ProtectedRoute allowedRoles={['STATE', 'SUPER_ADMIN']}><StateReceivedFunds /></ProtectedRoute>} />
              <Route path="/state/allocations" element={<ProtectedRoute allowedRoles={['STATE', 'SUPER_ADMIN']}><AllocateToDistrict /></ProtectedRoute>} />
              <Route path="/state/history" element={<ProtectedRoute allowedRoles={['STATE', 'SUPER_ADMIN']}><StateHistory /></ProtectedRoute>} />

              {/* District Routes */}
              <Route path="/district/dashboard" element={<ProtectedRoute allowedRoles={['DISTRICT', 'SUPER_ADMIN']}><DistrictDashboard /></ProtectedRoute>} />
              <Route path="/district/projects" element={<ProtectedRoute allowedRoles={['DISTRICT', 'SUPER_ADMIN']}><ProjectsManagement /></ProtectedRoute>} />
              <Route path="/district/contractors" element={<ProtectedRoute allowedRoles={['DISTRICT', 'SUPER_ADMIN']}><ContractorKYCReview /></ProtectedRoute>} />
              <Route path="/district/grievances" element={<ProtectedRoute allowedRoles={['DISTRICT', 'SUPER_ADMIN']}><GrievanceInbox /></ProtectedRoute>} />

              {/* Contractor Routes */}
              <Route path="/contractor/dashboard" element={<ProtectedRoute allowedRoles={['CONTRACTOR']}><ContractorDashboard /></ProtectedRoute>} />
              <Route path="/contractor/my-projects" element={<ProtectedRoute allowedRoles={['CONTRACTOR']}><MyProjects /></ProtectedRoute>} />
              <Route path="/contractor/kyc" element={<ProtectedRoute allowedRoles={['CONTRACTOR']}><ContractorKYC /></ProtectedRoute>} />
              <Route path="/contractor/payments" element={<ProtectedRoute allowedRoles={['CONTRACTOR']}><MilestonePayments /></ProtectedRoute>} />

              {/* Auditor Routes */}
              <Route path="/auditor/dashboard" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><AuditorDashboard /></ProtectedRoute>} />
              <Route path="/auditor/blockchain-explorer" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><AuditExplorer /></ProtectedRoute>} />
              <Route path="/auditor/document-audit" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><DocumentAudit /></ProtectedRoute>} />
              <Route path="/auditor/anomalies" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><AnomalyAnalytics /></ProtectedRoute>} />
              <Route path="/auditor/fraud-freeze" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><FraudFreeze /></ProtectedRoute>} />
              <Route path="/auditor/submit-report" element={<ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN']}><SubmitAuditReport /></ProtectedRoute>} />

              {/* Common Routes */}
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </PortalLayout>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
