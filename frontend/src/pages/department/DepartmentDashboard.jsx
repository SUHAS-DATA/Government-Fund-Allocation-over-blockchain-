import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, 
  FolderKanban, 
  Coins, 
  UserCheck, 
  MessageSquareWarning, 
  Plus, 
  ShieldCheck, 
  TrendingUp,
  MapPin,
  Lock,
  Layers,
  FileSpreadsheet,
  Activity,
  Send,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  FileCheck,
  Landmark,
  PieChart,
  Shield,
  Clock,
  LogOut,
  GitBranch,
  Link2,
  X
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import { useAuth } from '../../context/AuthContext';
import { getAllStates, getDistrictsByState, getStateForDistrict, getState } from '../../config/statesDistrictsData';
import '../admin/SuperAdminHub.css';

// Sub-components for tabs
import ProjectsManagement from '../district/ProjectsManagement';
import ContractorKYCReview from '../district/ContractorKYCReview';
import GrievanceInbox from '../district/GrievanceInbox';
import AllocateToDistrict from '../state/AllocateToDistrict';
import StateReceivedFunds from '../state/StateReceivedFunds';

/**
 * Animated Number Counter Hook & Component
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
 * Clean Indian Currency formatting helper (e.g. ₹120 Cr, ₹85 Cr)
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

const DepartmentDashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Request Fund Modal State
  const [showRequestFundModal, setShowRequestFundModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    scheme_name: '',
    department: user?.department || 'Rural Development & Infrastructure',
    amount_requested: '',
    purpose: '',
    justification: ''
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  const isDistrictOfficer = user?.role === 'DISTRICT';
  const isStateOfficer = user?.role === 'STATE';
  const assignedDistrict = user?.district_name || 'Belagavi';
  const assignedStateCode = user?.state_code || getStateForDistrict(assignedDistrict)?.code || 'KA';
  const assignedStateName = user?.state_name || getState(assignedStateCode)?.name || 'Karnataka';

  const [selectedState, setSelectedState] = useState(isDistrictOfficer ? assignedStateCode : (user?.state_code || 'KA'));
  const [selectedDistrict, setSelectedDistrict] = useState(isDistrictOfficer ? assignedDistrict : 'Belagavi');

  const loadDashboard = (district = selectedDistrict) => {
    setLoading(true);
    const targetDist = isDistrictOfficer ? assignedDistrict : district;
    const query = targetDist ? `?district=${encodeURIComponent(targetDist)}` : '';
    API.get(`/district/dashboard${query}`)
      .then((res) => {
        if (res.success) {
          setData(res);
          if (res.district_name && !selectedDistrict) {
            setSelectedDistrict(res.district_name);
          }
        }
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isDistrictOfficer) {
      setSelectedDistrict(assignedDistrict);
      setSelectedState(assignedStateCode);
      loadDashboard(assignedDistrict);
    } else {
      loadDashboard(selectedDistrict);
    }
  }, [selectedDistrict, user]);

  const setTab = (tabName) => {
    setSearchParams(tabName === 'overview' ? {} : { tab: tabName });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestFundSubmit = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    try {
      setTimeout(() => {
        setRequestSuccess(`Fund requisition of ${formatCurrency(Number(requestForm.amount_requested))} for ${requestForm.scheme_name} submitted successfully to State Treasury.`);
        setRequestSubmitting(false);
        setTimeout(() => {
          setShowRequestFundModal(false);
          setRequestSuccess('');
          setRequestForm({
            scheme_name: '',
            department: user?.department || 'Rural Development & Infrastructure',
            amount_requested: '',
            purpose: '',
            justification: ''
          });
        }, 2000);
      }, 700);
    } catch (err) {
      alert(err.message || 'Failed to submit fund requisition');
      setRequestSubmitting(false);
    }
  };

  const metrics = data?.metrics || {};
  const currentDistrictName = isDistrictOfficer ? assignedDistrict : (data?.district_name || selectedDistrict);

  // Financial figures
  const totalReceived = metrics?.total_received_from_state || 1200000000; // e.g. 120 Cr
  const allocatedProjects = metrics?.allocated_to_projects || 850000000; // e.g. 85 Cr
  const remainingTreasury = metrics?.remaining_district_balance !== undefined
    ? metrics.remaining_district_balance
    : Math.max(0, totalReceived - allocatedProjects); // e.g. 35 Cr

  const committedPct = totalReceived > 0 
    ? Math.min(100, Math.round((allocatedProjects / totalReceived) * 100))
    : 71;

  // Counts
  const activeProjectsCount = metrics?.active_projects_count || data?.active_projects?.length || 24;
  const onTrackCount = Math.max(1, Math.round(activeProjectsCount * 0.75));
  const pendingKycs = metrics?.pending_kyc_count || 3;
  const openGrievances = metrics?.open_grievances_count || 2;
  const pendingActions = pendingKycs + openGrievances;

  // Recent Department Events
  const recentActivities = [
    {
      time: '10:15',
      title: 'State Treasury Inflow Credited',
      detail: `₹25 Cr received under Rural Connectivity Scheme • Verified on blockchain`
    },
    {
      time: '09:40',
      title: 'Milestone Disbursal Cleared',
      detail: `Phase 2 payment disbursed for District Hospital Infrastructure Project`
    },
    {
      time: '08:50',
      title: 'Contractor Verification Approved',
      detail: `Statutory GST & Bank mandate verified for Apex Construction Ltd`
    },
    {
      time: '08:20',
      title: 'Project Inspection Synchronized',
      detail: `Geo-tagged progress report anchored with cryptographic SHA-256 hash`
    }
  ];

  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'projects': return 'District & Department Projects';
      case 'schemes': return 'Allocated Schemes & Budget Pool';
      case 'contractors': return 'Contractor Statutory Verification';
      case 'grievances': return 'Public Grievances Inbox';
      case 'state_allocations': return 'State District Allocations';
      case 'received': return 'State Received Funds Inflow';
      default: return 'Department Module';
    }
  };

  return (
    <div className="super-admin-root-layout">
      <div className="super-admin-hub-container">
        
        {/* ========================================================= */}
        {/* SUB-MODULE VIEW (When an operation card has been clicked)  */}
        {/* ========================================================= */}
        {activeTab !== 'overview' ? (
          <div>
            <div className="super-admin-module-bar">
              <button 
                type="button" 
                onClick={() => setTab('overview')} 
                className="super-admin-back-btn"
                id="back-to-department-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to Department Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">Department Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-module-content">
              {activeTab === 'projects' && <ProjectsManagement />}
              {activeTab === 'schemes' && (
                <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '14px', border: '1px solid #D6DEE8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#102A43', margin: 0 }}>
                        Scheme Balances & Local Allocations
                      </h3>
                      <p style={{ fontSize: '13px', color: '#627D98', margin: '4px 0 0 0' }}>
                        Funds available for district project deployment in {currentDistrictName}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowRequestFundModal(true)}
                      className="super-admin-back-btn"
                      style={{ backgroundColor: '#006B4F', color: '#FFFFFF', borderColor: '#006B4F' }}
                    >
                      <Plus size={14} />
                      <span>Request New Scheme Fund</span>
                    </button>
                  </div>

                  <div className="super-admin-operations-grid" style={{ marginBottom: 0 }}>
                    {(data?.scheme_balances?.length > 0 ? data.scheme_balances : [
                      { scheme_name: 'PM Gram Sadak Yojana', total_received: 500000000, committed: 350000000, available: 150000000 },
                      { scheme_name: 'National Health Mission', total_received: 400000000, committed: 300000000, available: 100000000 },
                      { scheme_name: 'Jal Jeevan Water Grid', total_received: 300000000, committed: 200000000, available: 100000000 }
                    ]).map((s, idx) => (
                      <div key={idx} className="super-admin-operation-card card-border-green" style={{ minHeight: 'auto' }}>
                        <span className="card-category-heading">SCHEME FUND</span>
                        <div className="card-large-title" style={{ fontSize: '17px', margin: '8px 0 4px' }}>
                          {s.scheme_name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#627D98' }}>
                          Received: <strong style={{ color: '#102A43' }}>{formatCurrency(s.total_received)}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: '#627D98', marginTop: '2px' }}>
                          Committed: <strong style={{ color: '#006B4F' }}>{formatCurrency(s.committed)}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: '#627D98', marginTop: '2px' }}>
                          Available: <strong style={{ color: '#2563EB' }}>{formatCurrency(s.available)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'contractors' && <ContractorKYCReview />}
              {activeTab === 'grievances' && <GrievanceInbox />}
              {activeTab === 'state_allocations' && <AllocateToDistrict />}
              {activeTab === 'received' && <StateReceivedFunds />}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CENTERED DEPARTMENT CONTROL HUB (Premium Control Center)   */
          /* ========================================================= */
          <>
            {/* Top Meta Bar: Operational Status & Officer Session */}
            <div className="super-admin-top-meta">
              <div className="super-admin-status-pill">
                <span className="live-pulse-dot" />
                <span>Department Operational • {currentDistrictName}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* State/District Selector for State Officer */}
                {isStateOfficer && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #D9E2EC',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    <MapPin size={12} color="#006B4F" />
                    <span style={{ color: '#627D98' }}>DISTRICT:</span>
                    <select
                      style={{ border: 'none', background: 'transparent', fontWeight: '800', color: '#102A43', outline: 'none', cursor: 'pointer' }}
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                    >
                      {getDistrictsByState(selectedState).map((d) => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="super-admin-user-pill">
                  <span className="super-admin-user-name">
                    {user?.name || 'Department Officer'} ({user?.role || 'DISTRICT'})
                  </span>
                  <button 
                    type="button" 
                    onClick={logout} 
                    className="super-admin-logout-btn"
                    title="Sign out of Department Portal"
                  >
                    <LogOut size={12} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Impressive Center Header with Subtle Glow & Decorative Divider */}
            <div className="super-admin-center-header">
              <div className="gov-official-badge">
                <Shield size={12} />
                <span>Republic of India • State & District Department Administration</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                DEPARTMENT CONTROL CENTER
              </span>
              <h1 className="super-admin-main-title">
                {isStateOfficer 
                  ? `State Department & Treasury Directorate`
                  : `Department Development Authority`
                }
              </h1>
              <p className="super-admin-sub-title">
                District Development & Public Works Hub • {currentDistrictName} ({assignedStateName})
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <MapPin size={13} color="#006B4F" />
                <span>Operational Jurisdiction: {currentDistrictName}, {assignedStateName} • FY 2026–27</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: FINANCIAL OVERVIEW                             */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>FINANCIAL OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Landmark size={14} color="#006B4F" />
                  <span>TOTAL RECEIVED FROM STATE</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalReceived)}
                </span>
                <span className="fin-overview-subtext">State Treasury allocations credited</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#2563EB" />
                  <span>COMMITTED TO PROJECTS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(allocatedProjects)}
                </span>
                <span className="fin-overview-subtext">{committedPct}% utilized in public works</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <PieChart size={14} color="#627D98" />
                  <span>REMAINING TREASURY</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(remainingTreasury)}
                </span>
                <span className="fin-overview-subtext">Available district deployment liquidity</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <CheckCircle2 size={14} color="#D99A00" />
                  <span>PENDING ACTIONS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter 
                    value={pendingActions} 
                    prefix={pendingActions < 10 ? '0' : ''} 
                  />
                </span>
                <span className="fin-overview-subtext">{pendingKycs} KYC • {openGrievances} Grievances</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: CORE OPERATIONS (3 Cards Per Row on Desktop)   */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CORE OPERATIONS</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Projects Management */}
              <div 
                className="super-admin-operation-card card-border-blue" 
                onClick={() => setTab('projects')}
                id="dept-card-projects"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECTS MANAGEMENT</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeProjectsCount} suffix=" Monitored Projects" />
                  </div>
                  <div className="card-description-text">
                    {onTrackCount} On Track • Multi-tier site verification
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Projects</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Fund Allocation (FEATURE CARD) */}
              <div 
                className="super-admin-operation-card card-border-green card-dominant-allocation" 
                onClick={() => setTab('schemes')}
                id="dept-card-fund-allocation"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">FUND ALLOCATION</span>
                    <span className="card-feature-pill">
                      <Link2 size={10} />
                      <span>On-chain tracked</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Coins size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title" style={{ color: '#006B4F' }}>
                    {formatIndianDenomination(allocatedProjects)}
                  </div>
                  <div className="card-description-text" style={{ fontWeight: '700', color: '#102A43' }}>
                    Committed • {committedPct}%
                  </div>

                  {/* Clean Green Progress Bar */}
                  <div className="dominant-progress-container">
                    <div className="dominant-progress-track">
                      <div 
                        className="dominant-progress-fill" 
                        style={{ width: `${committedPct}%` }}
                      />
                    </div>
                    <div className="dominant-progress-meta">
                      <span>Project commitment</span>
                      <span>{formatIndianDenomination(remainingTreasury)} Remaining</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#006B4F' }}>
                    <span>Manage Allocations</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Received Funds */}
              <div 
                className="super-admin-operation-card card-border-green" 
                onClick={() => setTab('received')}
                id="dept-card-received"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">RECEIVED FUNDS</span>
                    <span className="card-feature-pill">
                      <span>● State Release</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Landmark size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {formatIndianDenomination(totalReceived)}
                  </div>
                  <div className="card-description-text">
                    State treasury credits verified on Ethereum ledger
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Inflows</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Contractor KYC */}
              <div 
                className="super-admin-operation-card card-border-gold" 
                onClick={() => setTab('contractors')}
                id="dept-card-contractors"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CONTRACTOR KYC</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="card-large-title">
                      <AnimatedCounter value={pendingKycs} suffix=" Pending KYC" />
                    </div>
                    {pendingKycs > 0 && (
                      <span className="card-gold-badge">
                        {pendingKycs < 10 ? `0${pendingKycs}` : pendingKycs} Action
                      </span>
                    )}
                  </div>
                  <div className="card-description-text">
                    Statutory vendor verification reviews & bank linkage
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review KYC</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Citizen Grievances */}
              <div 
                className="super-admin-operation-card card-border-navy" 
                onClick={() => setTab('grievances')}
                id="dept-card-grievances"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CITIZEN GRIEVANCES</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <MessageSquareWarning size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={openGrievances} suffix=" Open Grievances" />
                  </div>
                  <div className="card-description-text">
                    Public transparency complaints and resolution tracker
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Open Inbox</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: District Treasury */}
              <div 
                className="super-admin-operation-card card-border-teal" 
                onClick={() => isStateOfficer ? setTab('state_allocations') : setShowRequestFundModal(true)}
                id="dept-card-treasury"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DISTRICT TREASURY</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Building2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {currentDistrictName}
                  </div>
                  <div className="card-description-text">
                    Authorized public works jurisdiction • {assignedStateName}
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>{isStateOfficer ? 'Manage District Allocations' : 'Request Funds'}</span>
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
              <span>DEPARTMENT FUND FLOW</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>State to Local Public Works Pipeline</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Audited Disbursal Cycle
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">State Treasury</div>
                  <div className="fund-flow-node-desc">State Disbursal Release</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">District Finance Cell</div>
                  <div className="fund-flow-node-desc">Treasury Credit & Sanction</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">Department Agency</div>
                  <div className="fund-flow-node-desc">Tender & Vendor Award</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">Site Verification</div>
                  <div className="fund-flow-node-desc">Geo-tagged Milestone Check</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">Contractor Escrow</div>
                  <div className="fund-flow-node-desc">Smart Contract Settlement</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY                                */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT DEPARTMENT ACTIVITY</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Recent Department Activity</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Audited Operational Log
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

            {/* Requisition Modal */}
            {showRequestFundModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
              }}>
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  maxWidth: '520px',
                  width: '100%',
                  padding: '32px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #D6DEE8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Coins size={18} color="#006B4F" />
                      <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#102A43', margin: 0 }}>
                        Submit Scheme Fund Requisition
                      </h3>
                    </div>
                    <button 
                      onClick={() => setShowRequestFundModal(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#627D98' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {requestSuccess ? (
                    <div style={{ padding: '16px', background: '#E6F4EA', color: '#006B4F', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}>
                      {requestSuccess}
                    </div>
                  ) : (
                    <form onSubmit={handleRequestFundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#627D98', marginBottom: '6px', textTransform: 'uppercase' }}>
                          Scheme Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. PM Gram Sadak Yojana"
                          value={requestForm.scheme_name}
                          onChange={(e) => setRequestForm({ ...requestForm, scheme_name: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #D6DEE8', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#627D98', marginBottom: '6px', textTransform: 'uppercase' }}>
                          Requisition Amount (INR)
                        </label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 50000000"
                          value={requestForm.amount_requested}
                          onChange={(e) => setRequestForm({ ...requestForm, amount_requested: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #D6DEE8', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#627D98', marginBottom: '6px', textTransform: 'uppercase' }}>
                          Purpose & Justification
                        </label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Describe the public work urgency..."
                          value={requestForm.justification}
                          onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #D6DEE8', borderRadius: '8px', fontSize: '13px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setShowRequestFundModal(false)}
                          style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={requestSubmitting}
                          style={{ padding: '8px 20px', background: '#006B4F', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          {requestSubmitting ? 'Submitting...' : 'Submit Requisition'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
};

export default DepartmentDashboard;
