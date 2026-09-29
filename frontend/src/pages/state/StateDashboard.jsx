import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Coins,
  Send,
  TrendingUp,
  Activity,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileSpreadsheet,
  History,
  CheckCircle2,
  Clock,
  PieChart,
  Landmark,
  Shield,
  GitBranch,
  Link2,
  LogOut,
  Calendar,
  Layers,
  MapPin,
  CreditCard,
  Bell,
  FileText
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/RealtimeContext';
import '../admin/SuperAdminHub.css';

// Sub-components for state operations
import AllocateToDistrict from './AllocateToDistrict';
import StateReceivedFunds from './StateReceivedFunds';
import StateHistory from './StateHistory';
import BlockchainExplorer from '../../components/BlockchainExplorer';
import NotificationsPage from '../common/NotificationsPage';

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

const StateDashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(5);

  const loadStateData = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    API.get('/state/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .catch((err) => {
        console.error("State Dashboard error:", err);
      })
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    loadStateData(true);
  }, [data?.state_code]);

  useRealtimeSync(() => loadStateData(false), { interval: 6000 });

  const setTab = (tabName) => {
    setSearchParams(tabName === 'overview' ? {} : { tab: tabName });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const metrics = data?.metrics || {};
  const totalReceived = metrics?.total_funds_received || 0;
  const totalAllocated = metrics?.total_allocated_to_districts || 0;
  const remainingTreasury = metrics?.remaining_state_treasury_balance !== undefined
    ? metrics.remaining_state_treasury_balance
    : Math.max(0, totalReceived - totalAllocated);

  const allocatedPct = totalReceived > 0
    ? Math.min(100, Math.round((totalAllocated / totalReceived) * 100))
    : (totalAllocated > 0 ? 100 : 0);

  const districtAllocationsCount = metrics?.district_allocations_count || 0;
  const receivedTransfersCount = metrics?.received_transfers_count || 0;
  const stateName = data?.state_name || user?.state_name || 'State Treasury';
  const stateCode = data?.state_code || user?.state_code || 'KA';

  const recentTransfers = data?.recent_received_funds || [];
  const districtBreakdown = data?.district_breakdown || [];

  // Sub-module Title Resolver
  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'received':
        return 'Central Finance Received Funds';
      case 'allocations':
        return 'State-to-District Fund Allocation';
      case 'breakdown':
        return 'District Allocations Matrix';
      case 'payment_requests':
        return 'District Agency Payment Requests & Requisitions';
      case 'history':
        return 'District Disbursements & Audit Ledger';
      case 'blockchain':
        return 'Ethereum Blockchain Ledger Records';
      case 'reports':
        return 'State Treasury Compliance & Expenditure Reports';
      case 'notifications':
        return 'State Treasury Official Notifications';
      default:
        return 'State Treasury Module';
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
                id="back-to-state-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to State Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">State Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-submodule-wrapper">
              {activeTab === 'received' && (
                <StateReceivedFunds />
              )}

              {activeTab === 'allocations' && (
                <AllocateToDistrict />
              )}

              {activeTab === 'breakdown' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '18px' }}>
                    <div className="card-title">
                      <Building2 size={20} color="#006B4F" />
                      <span>District Treasury Disbursal Matrix ({stateName})</span>
                    </div>
                  </div>

                  {districtBreakdown.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {districtBreakdown.map((d, idx) => (
                        <div key={idx} style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>
                              {d._id} District Development Agency
                            </div>
                            <div style={{ fontSize: '12px', color: '#627D98', marginTop: '2px' }}>
                              Total Sanctions: {d.alloc_count} Verified Allocations
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>
                              {formatCurrency(d.total_allocated)}
                            </div>
                            <button
                              type="button"
                              onClick={() => setTab('allocations')}
                              style={{
                                marginTop: '4px',
                                background: '#E6F4EA',
                                color: '#006B4F',
                                border: '1px solid #A7F3D0',
                                borderRadius: '4px',
                                padding: '3px 10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              Allocate More →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#627D98' }}>
                      No district allocations recorded yet for {stateName}.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payment_requests' && (
                <div className="card" style={{ padding: '28px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <CreditCard size={20} color="#006B4F" />
                      <span>Pending Payment Requests from Subordinate Districts</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { district: 'Belagavi District DRDA', scheme: 'Rural Road Infrastructure', amount: 45000000, reason: 'Milestone 2 road excavation & grading completion', date: 'Today' },
                      { district: 'Bengaluru Urban DRDA', scheme: 'Urban Water Drainage', amount: 62000000, reason: 'Pipeline laying & quality inspection certification', date: 'Yesterday' },
                      { district: 'Mysuru District Agency', scheme: 'Primary Health Center Construction', amount: 28000000, reason: 'Foundation structural work inspected', date: '3 days ago' }
                    ].map((req, idx) => (
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
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{req.district}</div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '2px' }}>
                            Scheme: <strong>{req.scheme}</strong> • {req.reason}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Requested: {req.date}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>
                            {formatIndianDenomination(req.amount)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setTab('allocations')}
                            style={{
                              marginTop: '4px',
                              background: '#E6F4EA',
                              color: '#006B4F',
                              border: '1px solid #A7F3D0',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Approve Disbursal →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <StateHistory />
              )}

              {activeTab === 'blockchain' && (
                <BlockchainExplorer />
              )}

              {activeTab === 'reports' && (
                <div className="card" style={{ padding: '28px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <FileText size={20} color="#006B4F" />
                      <span>State Treasury Financial Compliance & Utilization Report</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#627D98', textTransform: 'uppercase' }}>Central Receipts</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#102A43', marginTop: '4px' }}>{formatIndianDenomination(totalReceived)}</div>
                    </div>
                    <div style={{ background: '#E6F4EA', padding: '16px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#006B4F', textTransform: 'uppercase' }}>District Deployments</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#006B4F', marginTop: '4px' }}>{formatIndianDenomination(totalAllocated)}</div>
                    </div>
                    <div style={{ background: '#EFF6FF', padding: '16px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' }}>Treasury Balance</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>{formatIndianDenomination(remainingTreasury)}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#486581', lineHeight: '1.6' }}>
                    State Treasury statutory accounts are anchored to the RBI clearing gateway and verified against the National Ethereum Ledger. All tranches disbursed to district collectorates require valid administrative requisitions and utilization certificates.
                  </p>
                </div>
              )}

              {activeTab === 'notifications' && (
                <NotificationsPage />
              )}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN CENTERED STATE CONTROL HUB VIEW                      */
          /* ========================================================= */
          <>
            {/* Top Bar: Official Emblem, Live Pulse & Officer Pill */}
            <div className="super-admin-top-meta-bar">
              <div className="super-admin-badge-left">
                <span className="live-pulse-dot" />
                <span className="live-network-text">STATE TREASURY ACTIVE</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ color: '#486581', fontWeight: '600' }}>ETHEREUM SMART CONTRACT ANCHORED</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="super-admin-jurisdiction-pill">
                  <MapPin size={12} color="#006B4F" />
                  <span style={{ color: '#102A43', fontWeight: '800' }}>
                    {stateName} ({stateCode})
                  </span>
                  <span style={{ fontSize: '10px', background: '#E6F4EA', color: '#006B4F', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                    STATE TREASURY
                  </span>
                </div>

                <div className="super-admin-user-pill">
                  <span className="super-admin-user-name">
                    {user?.name || 'Finance Secretary'} (STATE)
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="super-admin-logout-btn"
                    title="Sign out of State Portal"
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
                <span>Republic of India • State Department of Finance</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                STATE TREASURY DIRECTORATE
              </span>
              <h1 className="super-admin-main-title">
                State Treasury & Regional Allocation Hub
              </h1>
              <p className="super-admin-sub-title">
                Central Sanction Execution, District Requisitions & Regional Treasury Liquidity • {stateName}
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <Calendar size={13} color="#006B4F" />
                <span>State Treasury Directorate • FY 2026–27</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: FINANCIAL OVERVIEW                             */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>STATE FINANCIAL OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel grid-6">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Landmark size={14} color="#006B4F" />
                  <span>FUNDS RECEIVED FROM CENTRE</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalReceived)}
                </span>
                <span className="fin-overview-subtext">Central Ministry sanctions credited</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#2563EB" />
                  <span>FUNDS ALLOCATED TO DISTRICTS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(totalAllocated)}
                </span>
                <span className="fin-overview-subtext">{allocatedPct}% deployed across districts</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <PieChart size={14} color="#627D98" />
                  <span>REMAINING STATE FUNDS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(remainingTreasury)}
                </span>
                <span className="fin-overview-subtext">Available regional deployment liquidity</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Building2 size={14} color="#0D9488" />
                  <span>DISTRICTS COVERED</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={districtBreakdown.length || 31} suffix=" Districts" />
                </span>
                <span className="fin-overview-subtext">Subordinate collectorates allocated</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <CreditCard size={14} color="#D99A00" />
                  <span>PENDING PAYMENT REQUESTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={pendingRequestsCount} prefix="0" />
                </span>
                <span className="fin-overview-subtext">District milestone claims awaiting disbursal</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <TrendingUp size={14} color="#006B4F" />
                  <span>RECENT DISBURSEMENTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={districtAllocationsCount} suffix=" Orders" />
                </span>
                <span className="fin-overview-subtext">Subordinate agencies credited</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: 3x3 CORE OPERATIONS GRID (3 Cards Per Row)     */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CORE STATE TREASURY OPERATIONS</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Received Funds */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('received')}
                id="state-card-received"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">RECEIVED FUNDS</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Landmark size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {formatIndianDenomination(totalReceived)}
                  </div>
                  <div className="card-description-text">
                    Central Ministry sanctions credited directly to State Treasury
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Central Transfers</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: State Allocations (DOMINANT FEATURE CARD) */}
              <div
                className="super-admin-operation-card card-border-green card-dominant-allocation"
                onClick={() => setTab('allocations')}
                id="state-card-allocate"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">STATE ALLOCATIONS</span>
                    <span className="card-feature-pill">
                      <Link2 size={10} />
                      <span>On-chain tracked</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Send size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title" style={{ color: '#006B4F' }}>
                    {formatIndianDenomination(totalAllocated)}
                  </div>
                  <div className="card-description-text" style={{ fontWeight: '700', color: '#102A43' }}>
                    Allocated • {allocatedPct}% of State Treasury
                  </div>

                  {/* Clean Green Progress Bar */}
                  <div className="dominant-progress-container">
                    <div className="dominant-progress-track">
                      <div
                        className="dominant-progress-fill"
                        style={{ width: `${allocatedPct}%` }}
                      />
                    </div>
                    <div className="dominant-progress-meta">
                      <span>Regional commitment</span>
                      <span>{formatIndianDenomination(remainingTreasury)} Remaining</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#006B4F' }}>
                    <span>Allocate Funds</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: District Allocations */}
              <div
                className="super-admin-operation-card card-border-navy"
                onClick={() => setTab('breakdown')}
                id="state-card-breakdown"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DISTRICT ALLOCATIONS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <Building2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {districtBreakdown.length} Districts
                  </div>
                  <div className="card-description-text">
                    Regional breakdown of capital distribution across collectorates
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Matrix</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Payment Requests */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('payment_requests')}
                id="state-card-payment-requests"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PAYMENT REQUESTS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <CreditCard size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={pendingRequestsCount} suffix=" Requests Pending" />
                  </div>
                  <div className="card-description-text">
                    District development milestone claims awaiting State Treasury release
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review Requisitions</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Disbursements */}
              <div
                className="super-admin-operation-card card-border-teal"
                onClick={() => setTab('history')}
                id="state-card-history"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">DISBURSEMENTS</span>
                    <span className="card-feature-pill">
                      <span>● Verified</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-teal">
                    <History size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={districtAllocationsCount} suffix=" Disbursals" />
                  </div>
                  <div className="card-description-text">
                    Comprehensive ledger of district allocations and cryptographic receipts
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Audit Records</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Blockchain Records */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('blockchain')}
                id="state-card-blockchain"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">BLOCKCHAIN RECORDS</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <ShieldCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Ethereum Consensus
                  </div>
                  <div className="card-description-text">
                    Every rupee anchored on-chain with immutable cryptographic hashes
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify Ledger</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 7: Reports */}
              <div
                className="super-admin-operation-card card-border-navy"
                onClick={() => setTab('reports')}
                id="state-card-reports"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">REPORTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <FileText size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Treasury Reports
                  </div>
                  <div className="card-description-text">
                    Statutory state expenditure statements, CAG audit compliance & receipts
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Reports</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 8: Notifications */}
              <div
                className="super-admin-operation-card card-border-purple"
                onClick={() => setTab('notifications')}
                id="state-card-notifications"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">NOTIFICATIONS</span>
                  <div className="card-mono-icon-container icon-box-purple">
                    <Bell size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    State Notices
                  </div>
                  <div className="card-description-text">
                    Central fund transfer notices, ministry circulars & alerts
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Notices</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

            </div>

            {/* ========================================================= */}
            {/* SECTION 3: STATE CAPITAL PIPELINE FLOW                    */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>STATE TREASURY CAPITAL PIPELINE</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>Central to District Fund Movement Hierarchy</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  State Disbursal Protocol
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">Union Sanction</div>
                  <div className="fund-flow-node-desc">Ministry Ceiling</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">State Receipt</div>
                  <div className="fund-flow-node-desc">Direct Treasury Credit</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">District Requisition</div>
                  <div className="fund-flow-node-desc">Infrastructure Review</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">Treasury Sanction</div>
                  <div className="fund-flow-node-desc">Ceiling Validation</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">District Credit</div>
                  <div className="fund-flow-node-desc">DRDA Deployment</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY TIMELINE                       */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT STATE TREASURY ACTIVITY</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Audited Treasury Disbursal Events ({stateName})</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  On-Chain State Events
                </span>
              </div>

              <div className="activity-timeline-list">
                {recentTransfers.length > 0 ? (
                  recentTransfers.slice(0, 4).map((t, idx) => (
                    <div key={t.transfer_id || idx} className="activity-timeline-item">
                      <span className="activity-timeline-dot">●</span>
                      <span className="activity-time-pill">
                        {t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified'}
                      </span>
                      <div className="activity-content-box">
                        <div className="activity-title-text">
                          Central Inflow: {t.scheme_name}
                        </div>
                        <div className="activity-detail-text">
                          Amount: {formatCurrency(t.amount)} • Transfer ID: {t.transfer_id} • Status: Credited to State Treasury
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
                        State Treasury Directorate Initialized
                      </div>
                      <div className="activity-detail-text">
                        Ready to process central transfers and execute regional district allocations for {stateName}.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </>
        )}

      </div>
    </div>
  );
};

export default StateDashboard;
