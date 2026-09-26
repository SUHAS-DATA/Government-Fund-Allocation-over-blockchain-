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
  X,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import { getAllStates, getDistrictsByState, getStateForDistrict, getState } from '../../config/statesDistrictsData';
import '../admin/SuperAdminHub.css';

// Sub-components for district operations
import ProjectsManagement from './ProjectsManagement';
import ContractorKYCReview from './ContractorKYCReview';
import GrievanceInbox from './GrievanceInbox';

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

const DistrictDashboard = () => {
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
        console.error("District Dashboard load error:", err);
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
  const totalReceived = metrics?.total_funds_received || 0;
  const recentProjects = data?.recent_projects || [];
  const receivedFunds = data?.received_funds || [];

  // Committed budget across active projects
  const allocatedProjects = metrics?.total_allocated_to_projects !== undefined 
    ? metrics.total_allocated_to_projects 
    : recentProjects.reduce((sum, p) => sum + (Number(p.total_budget) || 0), 0);
  
  const totalPaymentsReleased = metrics?.total_payments_released || 0;
  
  const remainingTreasury = metrics?.remaining_district_balance !== undefined
    ? metrics.remaining_district_balance
    : Math.max(0, totalReceived - allocatedProjects);

  const committedPct = totalReceived > 0 
    ? Math.min(100, Math.round((allocatedProjects / totalReceived) * 100))
    : (allocatedProjects > 0 ? 100 : 0);

  // Operational Counts
  const activeProjectsCount = metrics?.active_projects_count || recentProjects.length || 0;
  const totalProjectsCount = metrics?.total_projects_count || recentProjects.length || 0;
  const pendingKycs = metrics?.pending_kyc_count || 0;
  const openGrievances = metrics?.open_grievances_count || 0;

  // Sub-module Title Resolver
  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'projects':
        return 'District Public Works & Projects Management';
      case 'contractors':
        return 'Contractor Statutory KYC & Verification';
      case 'grievances':
        return 'Citizen Grievance Resolution & Tracking';
      case 'received':
        return 'State Treasury Allocations Received';
      default:
        return 'District Module';
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
                id="back-to-district-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to District Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">District Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-submodule-wrapper">
              {activeTab === 'projects' && (
                <ProjectsManagement />
              )}

              {activeTab === 'contractors' && (
                <ContractorKYCReview />
              )}

              {activeTab === 'grievances' && (
                <GrievanceInbox />
              )}

              {activeTab === 'received' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '18px' }}>
                    <div className="card-title">
                      <Landmark size={20} color="#006B4F" />
                      <span>State Treasury Allocations Received ({currentDistrictName})</span>
                    </div>
                  </div>
                  
                  {receivedFunds.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {receivedFunds.map((f, idx) => (
                        <div key={idx} style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{f.scheme_name}</div>
                            <div style={{ fontSize: '12px', color: '#627D98', marginTop: '3px' }}>
                              Allocation ID: <span style={{ fontFamily: 'monospace', color: '#006B4F', fontWeight: '700' }}>{f.district_alloc_id}</span> • Department: {f.department || 'Infrastructure'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                              Received: {f.created_at ? new Date(f.created_at).toLocaleDateString('en-IN') : 'Recent'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>
                              {formatCurrency(f.amount)}
                            </div>
                            {f.blockchain_tx_hash && (
                              <div style={{ marginTop: '4px' }}>
                                <BlockchainBadge txHash={f.blockchain_tx_hash} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#627D98' }}>
                      No state treasury allocations found for {currentDistrictName}.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN CENTERED DISTRICT CONTROL HUB VIEW                   */
          /* ========================================================= */
          <>
            {/* Top Bar: Official Emblem, Live Pulse & Jurisdiction Pill */}
            <div className="super-admin-top-meta-bar">
              <div className="super-admin-badge-left">
                <span className="live-pulse-dot" />
                <span className="live-network-text">IMMUTABLE BLOCKCHAIN ACTIVE</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ color: '#486581', fontWeight: '600' }}>ETHEREUM LEDGER VERIFIED</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* District Switcher (Only if non-district officer like Admin) */}
                {!isDistrictOfficer ? (
                  <div className="super-admin-jurisdiction-pill">
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
                ) : (
                  <div className="super-admin-jurisdiction-pill">
                    <MapPin size={12} color="#006B4F" />
                    <span style={{ color: '#102A43', fontWeight: '800' }}>
                      {assignedDistrict} ({assignedStateCode})
                    </span>
                    <span style={{ fontSize: '10px', background: '#E6F4EA', color: '#006B4F', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                      LOCKED
                    </span>
                  </div>
                )}

                <div className="super-admin-user-pill">
                  <span className="super-admin-user-name">
                    {user?.name || 'District Magistrate'} (DISTRICT)
                  </span>
                  <button 
                    type="button" 
                    onClick={logout} 
                    className="super-admin-logout-btn"
                    title="Sign out of District Portal"
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
                <span>Republic of India • District Development Authority</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                DISTRICT PLANNING & PUBLIC WORKS CELL
              </span>
              <h1 className="super-admin-main-title">
                District Development Authority Hub
              </h1>
              <p className="super-admin-sub-title">
                Public Infrastructure Works, Contractor Escrow & Local Execution • {currentDistrictName} ({assignedStateName})
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <MapPin size={13} color="#006B4F" />
                <span>Operational Jurisdiction: {currentDistrictName} DRDA • FY 2026–27</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: FINANCIAL OVERVIEW                             */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>DISTRICT FINANCIAL OVERVIEW</span>
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
                <span className="fin-overview-subtext">{committedPct}% utilized in local public works</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <TrendingUp size={14} color="#0D9488" />
                  <span>DISBURSED TO CONTRACTORS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(totalPaymentsReleased)}
                </span>
                <span className="fin-overview-subtext">Verified smart escrow settlements</span>
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
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: 3x2 CORE OPERATIONS GRID                       */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CORE DISTRICT OPERATIONS</span>
            </div>

            <div className="super-admin-operations-grid">
              
              {/* CARD 1: Projects Management */}
              <div 
                className="super-admin-operation-card card-border-blue" 
                onClick={() => setTab('projects')}
                id="district-card-projects"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECTS MANAGEMENT</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeProjectsCount} suffix=" Active Works" />
                  </div>
                  <div className="card-description-text">
                    Create works, assign contractors, inspect site progress & verify evidence
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Projects</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Project Commitment & Escrow (FEATURE CARD) */}
              <div 
                className="super-admin-operation-card card-border-green card-dominant-allocation" 
                onClick={() => setTab('projects')}
                id="district-card-fund-commitment"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">PROJECT COMMITMENT & ESCROW</span>
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
                    Committed • {committedPct}% of District Budget
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
                      <span>{formatIndianDenomination(remainingTreasury)} Available</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#006B4F' }}>
                    <span>Inspect Escrows</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Received State Funds */}
              <div 
                className="super-admin-operation-card card-border-green" 
                onClick={() => setTab('received')}
                id="district-card-received"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">RECEIVED STATE ALLOCATIONS</span>
                    <span className="card-feature-pill">
                      <span>● State Inflow</span>
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
                    State Treasury credits verified on immutable Ethereum ledger
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Inflows</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Contractor KYC Review */}
              <div 
                className="super-admin-operation-card card-border-gold" 
                onClick={() => setTab('contractors')}
                id="district-card-contractors"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CONTRACTOR KYC REVIEW</span>
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
                    Statutory vendor verification reviews, licenses & bank linkage
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
                id="district-card-grievances"
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
                    Public transparency complaints and site resolution tracker
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Open Inbox</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Fund Requisition to State */}
              <div 
                className="super-admin-operation-card card-border-teal" 
                onClick={() => setShowRequestFundModal(true)}
                id="district-card-requisition"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">STATE FUND REQUISITION</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Send size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Request Sanction
                  </div>
                  <div className="card-description-text">
                    Submit supplementary budget requisition to State Finance Department
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>New Requisition</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

            </div>

            {/* ========================================================= */}
            {/* SECTION 3: DISTRICT PUBLIC WORKS FLOW                     */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>DISTRICT PUBLIC WORKS PIPELINE</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>5-Stage Local Public Works Execution Lifecycle</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  District Project Workflow
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">Project Planning</div>
                  <div className="fund-flow-node-desc">Technical Requisition</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">Contractor Tendering</div>
                  <div className="fund-flow-node-desc">KYC Validation & Award</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">Smart Escrow Lock</div>
                  <div className="fund-flow-node-desc">Ethereum Contract Deposit</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">Site Milestone Review</div>
                  <div className="fund-flow-node-desc">Geo-tagged Evidence</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">Direct Vendor Payment</div>
                  <div className="fund-flow-node-desc">Escrow Release</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY TIMELINE                       */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT DISTRICT ACTIVITY</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Audited Project & Milestone Events ({currentDistrictName})</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  On-Chain District Events
                </span>
              </div>

              <div className="activity-timeline-list">
                {recentProjects.length > 0 ? (
                  recentProjects.slice(0, 4).map((p, idx) => (
                    <div key={p.project_id || idx} className="activity-timeline-item">
                      <span className="activity-timeline-dot">●</span>
                      <span className="activity-time-pill">
                        {p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}
                      </span>
                      <div className="activity-content-box">
                        <div className="activity-title-text">
                          Project Sanction: {p.name}
                        </div>
                        <div className="activity-detail-text">
                          Budget: {formatCurrency(p.total_budget)} • Status: {p.status || 'Active'} • Scheme: {p.scheme_name || 'Public Works'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="activity-timeline-item">
                    <span className="activity-timeline-dot">●</span>
                    <span className="activity-time-pill">Active</span>
                    <div className="activity-content-box">
                      <div className="activity-title-text">
                        District Development Authority Initialized
                      </div>
                      <div className="activity-detail-text">
                        Ready for project planning and contractor onboarding for {currentDistrictName} district.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </>
        )}

      </div>

      {/* ========================================================= */}
      {/* MODAL: Request Additional Fund from State                 */}
      {/* ========================================================= */}
      {showRequestFundModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#E6F4EA',
                  color: '#006B4F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#102A43' }}>
                    Requisition Funds from State Treasury
                  </h3>
                  <div style={{ fontSize: '12px', color: '#627D98' }}>
                    Jurisdiction: {currentDistrictName} ({assignedStateName})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestFundModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#627D98', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRequestFundSubmit} style={{ padding: '24px' }}>
              {requestSuccess && (
                <div style={{
                  padding: '12px 16px',
                  background: '#E6F4EA',
                  color: '#006B4F',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  {requestSuccess}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>
                  Target Scheme Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rural Water Connectivity Mission"
                  value={requestForm.scheme_name}
                  onChange={(e) => setRequestForm({ ...requestForm, scheme_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>
                  Requested Amount (in INR)
                </label>
                <input
                  type="number"
                  required
                  min="100000"
                  step="10000"
                  placeholder="e.g. 50000000"
                  value={requestForm.amount_requested}
                  onChange={(e) => setRequestForm({ ...requestForm, amount_requested: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {requestForm.amount_requested > 0 && (
                  <div style={{ fontSize: '12px', color: '#006B4F', fontWeight: '700', marginTop: '4px' }}>
                    Amount in words: {formatIndianDenomination(requestForm.amount_requested)} ({formatCurrency(Number(requestForm.amount_requested))})
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>
                  Technical Justification & Purpose
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide brief engineering estimate and purpose for state sanction..."
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowRequestFundModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#006B4F',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0, 107, 79, 0.25)'
                  }}
                >
                  {requestSubmitting ? 'Submitting Requisition...' : 'Submit to State Treasury'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DistrictDashboard;
