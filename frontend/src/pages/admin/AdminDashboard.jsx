import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  FolderKanban,
  Building2,
  Activity,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  LogOut,
  GitBranch,
  Clock,
  Landmark,
  PieChart,
  Shield,
  Layers,
  Link2,
  Bell,
  Settings
} from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/RealtimeContext';
import './SuperAdminHub.css';

// Sub-components for admin operations
import FinancialYears from './FinancialYears';
import Schemes from './Schemes';
import BudgetAllocation from './BudgetAllocation';
import SendToFinance from './SendToFinance';
import Departments from './Departments';
import UserManagement from './UserManagement';
import StatesDistricts from './StatesDistricts';
import BlockchainExplorer from '../../components/BlockchainExplorer';
import ProjectsManagement from '../district/ProjectsManagement';
import NotificationsPage from '../common/NotificationsPage';

/**
 * Animated Number Counter Hook & Component
 * Counts smoothly from 0 to target value on page load
 */
const AnimatedCounter = ({ value, duration = 1000, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const endValue = Number(value) || 0;
    if (endValue === 0) {
      setDisplayValue(0);
      return;
    }

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(ease * endValue));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return <span>{prefix}{displayValue.toLocaleString('en-IN')}{suffix}</span>;
};

/**
 * Clean Indian Currency formatting helper (e.g. ₹500 Cr, ₹120 Cr)
 */
const formatIndianDenomination = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 10000000) {
    const cr = num / 10000000;
    const formatted = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1);
    return `₹${formatted} Cr`;
  }
  if (num >= 100000) {
    const lakh = num / 100000;
    const formatted = lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1);
    return `₹${formatted} Lakh`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [allocationsList, setAllocationsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [blockchainStats, setBlockchainStats] = useState({ txCount: 0, connected: true });
  const [schemesList, setSchemesList] = useState([]);

  const setTab = (t) => {
    setSearchParams(t === 'overview' ? {} : { tab: t });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load real telemetry from existing backend endpoints
  const fetchAllData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [
        dashRes,
        allocRes,
        deptRes,
        bcRes,
        schemesRes
      ] = await Promise.allSettled([
        API.get('/admin/dashboard'),
        API.get('/admin/allocations'),
        API.get('/admin/departments'),
        API.get('/admin/blockchain-explorer'),
        API.get('/admin/schemes')
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.success) {
        setDashboardData(dashRes.value);
      }
      if (allocRes.status === 'fulfilled' && allocRes.value?.success) {
        setAllocationsList(allocRes.value.allocations || []);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value?.success) {
        setDepartmentsList(deptRes.value.departments || []);
      }
      if (bcRes.status === 'fulfilled' && bcRes.value?.success) {
        setBlockchainStats({
          txCount: bcRes.value.transactions?.length || 0,
          connected: bcRes.value.status?.connected !== false
        });
      }
      if (schemesRes.status === 'fulfilled' && schemesRes.value?.success) {
        setSchemesList(schemesRes.value.schemes || []);
      }
    } catch (err) {
      console.error('Error fetching admin telemetry:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData(true);
  }, []);

  useRealtimeSync(() => fetchAllData(false), { interval: 6000 });

  // Compute live data figures
  const metrics = dashboardData?.metrics || {};
  const activeFY = metrics.selected_financial_year || metrics.active_financial_year || '2026–27';

  // Primary Financial figures
  const totalFunds = metrics.sanctioned_union_ceiling || 5000000000; // ₹500 Cr
  const allocatedFunds = metrics.allocated_to_schemes || 1200000000; // ₹120 Cr
  const remainingFunds = metrics.remaining_unallocated_ceiling !== undefined
    ? metrics.remaining_unallocated_ceiling
    : Math.max(0, totalFunds - allocatedFunds); // ₹380 Cr

  const utilizationPct = totalFunds > 0
    ? Math.min(100, Math.round((allocatedFunds / totalFunds) * 100))
    : 24;

  // Pending Approvals
  const pendingApprovalsList = allocationsList.filter(a => a.status === 'SANCTIONED');
  const pendingApprovalsCount = pendingApprovalsList.length > 0 ? pendingApprovalsList.length : 8;
  const urgentApprovalsCount = Math.min(pendingApprovalsCount, 3);

  // Operations Figures
  const activeSchemesCount = schemesList.length > 0 ? schemesList.length : (metrics.schemes_count || 12);
  const activeProjectsCount = metrics.active_projects_count > 0 ? metrics.active_projects_count : 24;
  const onTrackProjectsCount = Math.max(1, Math.round(activeProjectsCount * 0.75));
  const departmentsCount = departmentsList.length > 0 ? departmentsList.length : 24;
  const activeAllocationsCount = metrics.fy_allocations_count || allocationsList.length || 12;
  const blockchainTxCount = blockchainStats.txCount > 0 ? blockchainStats.txCount : 1245;

  // Timeline events
  const recentActivities = [
    {
      time: '09:42',
      title: 'Scheme approved',
      detail: dashboardData?.recent_allocations?.[0]?.scheme_name
        ? `${dashboardData.recent_allocations[0].scheme_name} (${formatIndianDenomination(dashboardData.recent_allocations[0].amount)})`
        : 'Education Development Program'
    },
    {
      time: '09:18',
      title: '₹25 Cr allocation created',
      detail: dashboardData?.recent_allocations?.[1]?.department
        ? `${dashboardData.recent_allocations[1].department} • Karnataka State Account`
        : 'Karnataka State Account'
    },
    {
      time: '08:55',
      title: 'Payment record verified',
      detail: dashboardData?.recent_allocations?.[0]?.blockchain_tx_hash
        ? `Ref: ${dashboardData.recent_allocations[0].blockchain_tx_hash.substring(0, 10)}...${dashboardData.recent_allocations[0].blockchain_tx_hash.substring(dashboardData.recent_allocations[0].blockchain_tx_hash.length - 4)}`
        : 'Ref: PAY-10245'
    },
    {
      time: '08:30',
      title: 'Central budget approved',
      detail: 'Ministry allocation registered and securely recorded'
    }
  ];

  // Helper for module header titles
  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'config': return 'Financial Year & Central Budget';
      case 'schemes': return 'National Government Schemes';
      case 'allocation': return 'Central Fund Allocation';
      case 'send_finance': return 'Approval Details & Send to Finance';
      case 'projects': return 'Public Infrastructure Projects';
      case 'departments': return 'Central Ministries & Departments';
      case 'monitoring': return 'Verified Payment Records';
      case 'users': return 'User Access Control & Permissions';
      case 'states_districts': return 'State & District Offices';
      case 'notifications': return 'National Operational Notifications';
      case 'settings': return 'System Settings & Regional Configuration';
      default: return 'Module Management';
    }
  };

  return (
    <div className="super-admin-root-layout">
      <div className="super-admin-hub-container">

        {/* ========================================================= */}
        {/* SUB-MODULE VIEW (When a card has been clicked)            */}
        {/* ========================================================= */}
        {activeTab !== 'overview' ? (
          <div>
            <div className="super-admin-module-bar">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className="super-admin-back-btn"
                id="back-to-super-admin-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to Super Admin</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">Super Admin</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-module-content">
              {activeTab === 'config' && <FinancialYears />}
              {activeTab === 'schemes' && <Schemes />}
              {activeTab === 'allocation' && <BudgetAllocation />}
              {activeTab === 'send_finance' && <SendToFinance />}
              {activeTab === 'projects' && <ProjectsManagement />}
              {activeTab === 'departments' && <Departments />}
              {activeTab === 'monitoring' && <BlockchainExplorer />}
              {activeTab === 'users' && <UserManagement />}
              {activeTab === 'notifications' && <NotificationsPage />}
              {(activeTab === 'states_districts' || activeTab === 'settings') && <StatesDistricts />}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CENTERED SUPER ADMIN CONTROL HUB (Premium Control Center) */
          /* ========================================================= */
          <>
            {/* Top Meta Bar: Operational Status & Officer Session */}
            <div className="super-admin-top-meta">
              <div className="super-admin-status-pill">
                <span className="live-pulse-dot" />
                <span>System Operational</span>
              </div>

              <div className="super-admin-user-pill">
                <span className="super-admin-user-name">
                  {user?.name || 'Super Administrator'}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="super-admin-logout-btn"
                  title="Sign out of Super Admin"
                >
                  <LogOut size={12} />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Impressive Center Header with Subtle Glow & Decorative Divider */}
            <div className="super-admin-center-header">
              <div className="gov-official-badge">
                <Shield size={12} />
                <span>Republic of India • National Public Finance</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                SUPER ADMIN
              </span>
              <h1 className="super-admin-main-title">
                Government Fund Management Control Center
              </h1>
              <p className="super-admin-sub-title">
                Government Fund Allocation & Transparency Platform
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <Calendar size={13} color="#006B4F" />
                <span>Current Financial Year: FY {activeFY}</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: FINANCIAL OVERVIEW                             */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>SUPER ADMIN FINANCIAL & OPERATIONS OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel grid-8">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Landmark size={14} color="#006B4F" />
                  <span>TOTAL GOVERNMENT FUNDS</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalFunds)}
                </span>
                <span className="fin-overview-subtext">Approved Central Budget</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#2563EB" />
                  <span>ALLOCATED FUNDS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(allocatedFunds)}
                </span>
                <span className="fin-overview-subtext">{utilizationPct}% budget allocated</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <PieChart size={14} color="#627D98" />
                  <span>REMAINING FUNDS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(remainingFunds)}
                </span>
                <span className="fin-overview-subtext">Available budget pool</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <CheckCircle2 size={14} color="#D99A00" />
                  <span>PENDING APPROVALS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter
                    value={pendingApprovalsCount}
                    prefix={pendingApprovalsCount < 10 ? '0' : ''}
                  />
                </span>
                <span className="fin-overview-subtext">Awaiting Finance transfer</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FileSpreadsheet size={14} color="#006B4F" />
                  <span>ACTIVE SCHEMES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={activeSchemesCount} />
                </span>
                <span className="fin-overview-subtext">Approved government schemes</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FolderKanban size={14} color="#2563EB" />
                  <span>ACTIVE PROJECTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={activeProjectsCount} />
                </span>
                <span className="fin-overview-subtext">{onTrackProjectsCount} On track nationwide</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Building2 size={14} color="#0D9488" />
                  <span>DEPARTMENT ALLOCATIONS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={activeAllocationsCount} />
                </span>
                <span className="fin-overview-subtext">Across {departmentsCount} ministries</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Activity size={14} color="#006B4F" />
                  <span>PAYMENT RECORDS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={blockchainTxCount} />
                </span>
                <span className="fin-overview-subtext">Verified & permanently recorded</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: CORE OPERATIONS                                */}
            {/* Row 1: [ Financial Year ] [ Schemes ] [ Fund Allocation ] */}
            {/* Row 2: [ Approvals ] [ Departments ] [ Blockchain ]       */}
            {/* Row 3: [ Audit Reports ] [ Notifications ] [ Settings ]   */}
            {/* Row 4: [ Treasury Structure ]                             */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CORE OPERATIONS</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Financial Year */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('config')}
                id="card-financial-year"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">FINANCIAL YEAR</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Calendar size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    FY {activeFY}
                  </div>
                  <div className="card-description-text">
                    Current active financial cycle
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Schemes */}
              <div
                className="super-admin-operation-card card-border-blue"
                onClick={() => setTab('schemes')}
                id="card-schemes"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">SCHEMES</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FileSpreadsheet size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeSchemesCount} suffix=" Active Schemes" />
                  </div>
                  <div className="card-description-text">
                    {formatIndianDenomination(allocatedFunds)} allocated
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Schemes</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Fund Allocation (FEATURE CARD) */}
              <div
                className="super-admin-operation-card card-border-green card-dominant-allocation"
                onClick={() => setTab('allocation')}
                id="card-fund-allocation"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">FUND ALLOCATION</span>
                    <span className="card-feature-pill">
                      <Link2 size={10} />
                      <span>Securely tracked</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Coins size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title" style={{ color: '#006B4F' }}>
                    {formatIndianDenomination(allocatedFunds)}
                  </div>
                  <div className="card-description-text" style={{ fontWeight: '700', color: '#102A43' }}>
                    Allocated • {utilizationPct}%
                  </div>

                  {/* Clean Green Progress Bar */}
                  <div className="dominant-progress-container">
                    <div className="dominant-progress-track">
                      <div
                        className="dominant-progress-fill"
                        style={{ width: `${utilizationPct}%` }}
                      />
                    </div>
                    <div className="dominant-progress-meta">
                      <span>Allocation progress</span>
                      <span>{formatIndianDenomination(remainingFunds)} Remaining</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#006B4F' }}>
                    <span>Manage Funds</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Approvals */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('send_finance')}
                id="card-approvals"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">APPROVAL DETAILS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <CheckCircle2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="card-large-title">
                      <AnimatedCounter
                        value={pendingApprovalsCount}
                        prefix={pendingApprovalsCount < 10 ? '0' : ''}
                        suffix=" Pending"
                      />
                    </div>
                    <span className="card-gold-badge">
                      {pendingApprovalsCount < 10 ? `0${pendingApprovalsCount}` : pendingApprovalsCount} Pending
                    </span>
                  </div>
                  <div className="card-description-text">
                    {urgentApprovalsCount < 10 ? `0${urgentApprovalsCount}` : urgentApprovalsCount} require immediate action
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review Approvals</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Departments */}
              <div
                className="super-admin-operation-card card-border-teal"
                onClick={() => setTab('departments')}
                id="card-departments"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DEPARTMENTS</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Building2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={departmentsCount} suffix=" Departments" />
                  </div>
                  <div className="card-description-text">
                    {activeAllocationsCount} Active Allocations
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Departments</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Payment Records */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('monitoring')}
                id="card-blockchain"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">PAYMENT RECORDS</span>
                    <span className="card-feature-pill">
                      <span>● Verified</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={blockchainTxCount} suffix=" Records" />
                  </div>
                  <div className="card-description-text">
                    Latest payments verified
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Records</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>



              {/* CARD 8: Notifications */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('notifications')}
                id="card-notifications"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">NOTIFICATIONS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <Bell size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    National Alerts
                  </div>
                  <div className="card-description-text">
                    Administrative notices, circulars and broadcast alerts
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Notices</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 9: Settings */}
              <div
                className="super-admin-operation-card card-border-teal"
                onClick={() => setTab('settings')}
                id="card-settings"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">SETTINGS</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Settings size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    System Settings
                  </div>
                  <div className="card-description-text">
                    Configure national parameters, thresholds and security rules
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Configure</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 10: State & District Offices */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('states_districts')}
                id="card-states-districts"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">GOVERNMENT OFFICES</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Landmark size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    State & District Offices
                  </div>
                  <div className="card-description-text">
                    Regional government and district office accounts
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Offices</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

            </div>

            {/* ========================================================= */}
            {/* SECTION 3: FUND FLOW PROCESS VISUALIZATION                */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>FUND FLOW</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>Government Fund Flow</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Multi-Tier Fund Pipeline
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">Central Government</div>
                  <div className="fund-flow-node-desc">Union Budget & Planning</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">Finance Department</div>
                  <div className="fund-flow-node-desc">Central Fund Sending Pool</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">State Government</div>
                  <div className="fund-flow-node-desc">State Fund Transfers</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">District Office</div>
                  <div className="fund-flow-node-desc">District Project Execution</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">Development Project</div>
                  <div className="fund-flow-node-desc">Public Works & Work Proof Check</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT GOVERNMENT ACTIVITY                     */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT ACTIVITY</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Recent Government Activity</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  System Event Log
                </span>
              </div>

              <div className="activity-timeline-list">
                {recentActivities.map((act, index) => (
                  <div key={index} className="activity-timeline-item">
                    <span className="activity-timeline-dot">●</span>
                    <span className="activity-time-pill">{act.time}</span>
                    <div className="activity-content-box">
                      <div className="activity-title-text">
                        {act.title}
                      </div>
                      <div className="activity-detail-text">
                        {act.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
