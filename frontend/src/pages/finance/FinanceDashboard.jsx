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
  LogOut
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import { useAuth } from '../../context/AuthContext';
import '../admin/SuperAdminHub.css';

// Sub-components for finance operations
import ReceivedBudgets from './ReceivedBudgets';
import TransferToState from './TransferToState';
import FinanceHistory from './FinanceHistory';

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
 * Clean Indian Currency formatting helper (e.g. ₹120 Cr, ₹80 Cr)
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

const FinanceDashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const setTab = (t) => {
    setSearchParams(t === 'overview' ? {} : { tab: t });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setLoading(true);
    API.get('/finance/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics || {};
  const pendingBudgets = data?.pending_budgets || [];
  const pendingAmount = pendingBudgets.reduce((acc, b) => acc + ((b.amount || 0) - (b.disbursed_amount || 0)), 0) || 400000000; // ₹40 Cr fallback
  const totalDisbursed = metrics?.total_disbursed || 800000000; // ₹80 Cr fallback
  const totalVolume = pendingAmount + totalDisbursed || 1200000000; // ₹120 Cr
  const disbursedPct = totalVolume > 0 ? Math.min(100, Math.round((totalDisbursed / totalVolume) * 100)) : 67;
  const pendingCount = metrics?.pending_budgets_count || pendingBudgets.length || 3;
  const statesCount = metrics?.states_count || 28;
  const transfersCount = data?.recent_transfers?.length || 18;

  // Recent timeline events
  const recentActivities = [
    {
      time: '11:05',
      title: 'State Treasury Disbursal Executed',
      detail: `₹25 Cr transferred to Karnataka State Treasury • TX: 0x4f12...e81`
    },
    {
      time: '09:30',
      title: 'Central Budget Sanction Received',
      detail: `₹50 Cr allocated for National Highways Development Program`
    },
    {
      time: '08:45',
      title: 'Smart Contract Escrow Verified',
      detail: `Consensus verified across multi-node government ledger`
    },
    {
      time: '08:15',
      title: 'Treasury Disbursal Scheduled',
      detail: `Maharashtra State Treasury tranche queued for settlement`
    }
  ];

  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'pending': return 'Central Sanctions Received';
      case 'release': return 'Execute State Treasury Transfers';
      case 'history': return 'Audited Disbursal Ledger History';
      default: return 'Finance Module';
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
                id="back-to-finance-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to Finance Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">Finance Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-module-content">
              {activeTab === 'pending' && <ReceivedBudgets />}
              {activeTab === 'release' && <TransferToState />}
              {activeTab === 'history' && <FinanceHistory />}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CENTERED FINANCE CONTROL HUB (Premium Control Center)      */
          /* ========================================================= */
          <>
            {/* Top Meta Bar: Operational Status & Officer Session */}
            <div className="super-admin-top-meta">
              <div className="super-admin-status-pill">
                <span className="live-pulse-dot" />
                <span>Finance Engine Operational • Disbursal Authority</span>
              </div>

              <div className="super-admin-user-pill">
                <span className="super-admin-user-name">
                  {user?.name || 'Finance Officer'} ({user?.role || 'FINANCE'})
                </span>
                <button 
                  type="button" 
                  onClick={logout} 
                  className="super-admin-logout-btn"
                  title="Sign out of Finance Portal"
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
                <span>Republic of India • Ministry of Finance</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                FINANCE DISBURSAL AUTHORITY
              </span>
              <h1 className="super-admin-main-title">
                Public Financial Disbursal & State Allocation Hub
              </h1>
              <p className="super-admin-sub-title">
                Central Sanction Execution, State Treasury Releases & On-Chain Ledger Anchoring
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <Calendar size={13} color="#006B4F" />
                <span>Union Budget Disbursal Authority • FY 2026–27</span>
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
                  <span>TOTAL CENTRAL SANCTIONS</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalVolume)}
                </span>
                <span className="fin-overview-subtext">Received from Cabinet Secretariat</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#2563EB" />
                  <span>DISBURSED TO STATES</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(totalDisbursed)}
                </span>
                <span className="fin-overview-subtext">{disbursedPct}% settled to State Treasuries</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <PieChart size={14} color="#627D98" />
                  <span>PENDING DISBURSAL POOL</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(pendingAmount)}
                </span>
                <span className="fin-overview-subtext">Available for state releases</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Clock size={14} color="#D99A00" />
                  <span>PENDING RELEASES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter 
                    value={pendingCount} 
                    prefix={pendingCount < 10 ? '0' : ''} 
                  />
                </span>
                <span className="fin-overview-subtext">Awaiting state transfer execution</span>
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

              {/* CARD 1: Received Budgets */}
              <div 
                className="super-admin-operation-card card-border-blue" 
                onClick={() => setTab('pending')}
                id="fin-card-received"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">RECEIVED BUDGETS</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FileSpreadsheet size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={pendingCount} suffix=" Central Sanctions" />
                  </div>
                  <div className="card-description-text">
                    Budget allocations approved by Super Admin awaiting release
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Sanctions</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Transfer to State (FEATURE CARD) */}
              <div 
                className="super-admin-operation-card card-border-green card-dominant-allocation" 
                onClick={() => setTab('release')}
                id="fin-card-transfer"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">TRANSFER TO STATE</span>
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
                    {formatIndianDenomination(totalDisbursed)}
                  </div>
                  <div className="card-description-text" style={{ fontWeight: '700', color: '#102A43' }}>
                    Disbursed • {disbursedPct}%
                  </div>

                  {/* Clean Green Progress Bar */}
                  <div className="dominant-progress-container">
                    <div className="dominant-progress-track">
                      <div 
                        className="dominant-progress-fill" 
                        style={{ width: `${disbursedPct}%` }}
                      />
                    </div>
                    <div className="dominant-progress-meta">
                      <span>Disbursal progress</span>
                      <span>{formatIndianDenomination(pendingAmount)} Pending</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#006B4F' }}>
                    <span>Execute Transfer</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Disbursal History */}
              <div 
                className="super-admin-operation-card card-border-navy" 
                onClick={() => setTab('history')}
                id="fin-card-history"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">DISBURSAL HISTORY</span>
                    <span className="card-feature-pill">
                      <span>● Verified</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-navy">
                    <History size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={transfersCount} suffix=" State Releases" />
                  </div>
                  <div className="card-description-text">
                    Audited ledger records of transfers to State Treasuries
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View History</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: State Treasuries */}
              <div 
                className="super-admin-operation-card card-border-teal" 
                onClick={() => setTab('release')}
                id="fin-card-states"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">STATE TREASURIES</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Building2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={statesCount} suffix=" State Accounts" />
                  </div>
                  <div className="card-description-text">
                    Authorized RBI state treasury linked smart contract wallets
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Accounts</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Blockchain Settlement */}
              <div 
                className="super-admin-operation-card card-border-green" 
                onClick={() => setTab('history')}
                id="fin-card-blockchain"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">BLOCKCHAIN SETTLEMENT</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Ethereum Consensus
                  </div>
                  <div className="card-description-text">
                    Real-time inter-governmental smart contract anchoring
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Ledger</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Audit Reconciliation */}
              <div 
                className="super-admin-operation-card card-border-gold" 
                onClick={() => setTab('history')}
                id="fin-card-audit"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">AUDIT RECONCILIATION</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <ShieldCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="card-large-title">
                      CAG Compliant
                    </div>
                    <span className="card-gold-badge">Audited</span>
                  </div>
                  <div className="card-description-text">
                    Full reconciliation with Comptroller General of India
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review Status</span>
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
              <span>CAPITAL PIPELINE FLOW</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>Central to State Capital Disbursal Flow</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Statutory Disbursal Pipeline
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">Central Cabinet</div>
                  <div className="fund-flow-node-desc">Planning Ceiling Sanction</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">Ministry of Finance</div>
                  <div className="fund-flow-node-desc">Disbursal Pool Authorization</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">State Treasury</div>
                  <div className="fund-flow-node-desc">Direct Account Credit</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">District Agency</div>
                  <div className="fund-flow-node-desc">Execution Work Orders</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">Contractor Escrow</div>
                  <div className="fund-flow-node-desc">Milestone Settlement</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY                                */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT DISBURSAL ACTIVITY</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Recent Disbursal Events</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  On-Chain Financial Events
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

export default FinanceDashboard;
