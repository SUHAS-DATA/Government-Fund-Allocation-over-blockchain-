import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FolderKanban, 
  CreditCard, 
  FileCheck, 
  Coins, 
  TrendingUp, 
  ShieldCheck, 
  Upload, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  Building2,
  Landmark,
  PieChart,
  Shield,
  GitBranch,
  Link2,
  Activity,
  LogOut
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import { useAuth } from '../../context/AuthContext';
import '../admin/SuperAdminHub.css';

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
 * Clean Indian Currency formatting helper (e.g. ₹85 Cr, ₹48 Cr)
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

const ContractorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadDashboard = () => {
    setLoading(true);
    API.get('/contractor/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .catch((err) => {
        setActionError(err.message || 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleQuickAccept = async (projectId) => {
    try {
      const res = await API.post(`/contractor/projects/${projectId}/accept`);
      if (res.success) {
        setActionSuccess(`Project ${projectId} accepted! Standardized into 3 milestone phases (30%, 40%, 30%).`);
        loadDashboard();
      }
    } catch (e) {
      setActionError(e.message || 'Failed to accept project');
    }
  };

  const metrics = data?.metrics || {};
  const contractor = data?.contractor_profile;
  const pendingAssignments = data?.pending_assignments || [];
  const assignedProjects = data?.assigned_projects || [];
  const recentPayments = data?.recent_payments || [];

  // Financial calculations
  const totalValue = metrics?.total_assigned_budget || 850000000; // ₹85 Cr
  const totalDisbursed = metrics?.disbursed_to_contractor || 480000000; // ₹48 Cr
  const pendingMilestones = metrics?.pending_payments || 370000000; // ₹37 Cr
  const disbursedPct = totalValue > 0 ? Math.min(100, Math.round((totalDisbursed / totalValue) * 100)) : 56;
  const activeProjectsCount = metrics?.active_projects_count || assignedProjects.length || 6;

  // Recent timeline events
  const recentActivities = [
    {
      time: '11:45',
      title: 'Phase 2 Milestone Payment Credited',
      detail: `₹14 Cr released from State Treasury via smart contract escrow`
    },
    {
      time: '10:15',
      title: 'Geo-tagged Site Proof Uploaded',
      detail: `Cryptographic SHA-256 hash generated for Belagavi Road Structural Work`
    },
    {
      time: '09:00',
      title: 'Phase 1 Inspection Verified',
      detail: `District Assistant Executive Engineer validated excavation completion`
    },
    {
      time: '08:15',
      title: 'Contract Agreement Initialized',
      detail: `Tripartite digital contract anchored on government blockchain`
    }
  ];

  return (
    <div className="super-admin-root-layout">
      <div className="super-admin-hub-container">
        
        {/* Top Meta Bar: Operational Status & Contractor Session */}
        <div className="super-admin-top-meta">
          <div className="super-admin-status-pill">
            <span className="live-pulse-dot" />
            <span>Contractor Node Online • Escrow Disbursal Verified</span>
          </div>

          <div className="super-admin-user-pill">
            <span className="super-admin-user-name">
              {contractor?.company_name || user?.name || 'Apex Infrastructure Pvt Ltd'} ({user?.role || 'CONTRACTOR'})
            </span>
            <button 
              type="button" 
              onClick={logout} 
              className="super-admin-logout-btn"
              title="Sign out of Contractor Portal"
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
            <span>Republic of India • Public Infrastructure & Construction Directorate</span>
          </div>

          <span className="super-admin-badge-eyebrow">
            CONTRACTOR EXECUTION HUB
          </span>
          <h1 className="super-admin-main-title">
            {contractor?.company_name || data?.contractor_name || 'Apex Infrastructure Contractors Pvt Ltd'}
          </h1>
          <p className="super-admin-sub-title">
            GSTIN: <strong>{contractor?.gst_number || '29AABCU9603R1ZM'}</strong> • Concessionaire ID: <strong>{data?.contractor_id || 'CON-KA-APEX'}</strong> • Public Works Contractor Portal
          </p>

          {/* Thin Decorative Green Line */}
          <div className="header-green-divider" />

          <div className="super-admin-fy-pill">
            <Building2 size={13} color="#006B4F" />
            <span>Authorized Public Works Concessionaire • FY 2026–27</span>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div style={{
            background: '#E6F4EA',
            border: '1px solid #A7F3D0',
            borderRadius: '10px',
            padding: '14px 18px',
            color: '#006B4F',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: '700',
            fontSize: '13px'
          }}>
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div style={{
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '14px 18px',
            color: '#DC2626',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: '700',
            fontSize: '13px'
          }}>
            <AlertTriangle size={18} />
            <span>{actionError}</span>
          </div>
        )}

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
              <span>TOTAL CONTRACT VALUE</span>
            </div>
            <span className="fin-overview-value highlight-green">
              {formatIndianDenomination(totalValue)}
            </span>
            <span className="fin-overview-subtext">Across assigned public works contracts</span>
          </div>

          <div className="fin-overview-column">
            <div className="fin-overview-top-label">
              <Coins size={14} color="#2563EB" />
              <span>DISBURSED PAYMENTS</span>
            </div>
            <span className="fin-overview-value">
              {formatIndianDenomination(totalDisbursed)}
            </span>
            <span className="fin-overview-subtext">{disbursedPct}% settled via blockchain escrow</span>
          </div>

          <div className="fin-overview-column">
            <div className="fin-overview-top-label">
              <PieChart size={14} color="#627D98" />
              <span>PENDING MILESTONES</span>
            </div>
            <span className="fin-overview-value">
              {formatIndianDenomination(pendingMilestones)}
            </span>
            <span className="fin-overview-subtext">Under site verification & inspection</span>
          </div>

          <div className="fin-overview-column">
            <div className="fin-overview-top-label">
              <FolderKanban size={14} color="#D99A00" />
              <span>ACTIVE PROJECTS</span>
            </div>
            <span className="fin-overview-value">
              <AnimatedCounter 
                value={activeProjectsCount} 
                prefix={activeProjectsCount < 10 ? '0' : ''} 
              />
            </span>
            <span className="fin-overview-subtext">Assigned project work sites</span>
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

          {/* CARD 1: My Projects */}
          <Link 
            to="/contractor/my-projects"
            className="super-admin-operation-card card-border-blue" 
            id="con-card-projects"
          >
            <div className="card-top-row">
              <span className="card-category-heading">ASSIGNED PROJECTS</span>
              <div className="card-mono-icon-container icon-box-blue">
                <FolderKanban size={22} />
              </div>
            </div>

            <div className="card-content-body">
              <div className="card-large-title">
                <AnimatedCounter value={activeProjectsCount} suffix=" Assigned Works" />
              </div>
              <div className="card-description-text">
                Manage 3 phases, geo-tagged inspection evidence and completion logs
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link">
                <span>My Projects</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

          {/* CARD 2: Milestone Payments (FEATURE CARD) */}
          <Link 
            to="/contractor/milestone-payments"
            className="super-admin-operation-card card-border-green card-dominant-allocation" 
            id="con-card-milestones"
          >
            <div className="card-top-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="card-category-heading">MILESTONE SETTLEMENT</span>
                <span className="card-feature-pill">
                  <Link2 size={10} />
                  <span>Escrow Disbursal</span>
                </span>
              </div>
              <div className="card-mono-icon-container icon-box-green">
                <Coins size={22} />
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
                  <span>Milestone fulfillment</span>
                  <span>{formatIndianDenomination(pendingMilestones)} Pending</span>
                </div>
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link" style={{ color: '#006B4F' }}>
                <span>Submit Claim</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

          {/* CARD 3: Statutory KYC */}
          <Link 
            to="/contractor/kyc"
            className="super-admin-operation-card card-border-gold" 
            id="con-card-kyc"
          >
            <div className="card-top-row">
              <span className="card-category-heading">STATUTORY KYC</span>
              <div className="card-mono-icon-container icon-box-gold">
                <ShieldCheck size={22} />
              </div>
            </div>

            <div className="card-content-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="card-large-title">
                  Vendor Verified
                </div>
                <span className="card-gold-badge">Compliant</span>
              </div>
              <div className="card-description-text">
                GSTIN, PAN, and Bank linkage authenticated on government portal
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link">
                <span>View Status</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

          {/* CARD 4: Payment Invoices */}
          <Link 
            to="/contractor/milestone-payments"
            className="super-admin-operation-card card-border-teal" 
            id="con-card-receipts"
          >
            <div className="card-top-row">
              <span className="card-category-heading">PAYMENT VOUCHERS</span>
              <div className="card-mono-icon-container icon-box-teal">
                <CreditCard size={22} />
              </div>
            </div>

            <div className="card-content-body">
              <div className="card-large-title">
                Treasury Vouchers
              </div>
              <div className="card-description-text">
                Audited direct treasury credit receipts and smart contract logs
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link">
                <span>View Receipts</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

          {/* CARD 5: Document Proof Vault */}
          <Link 
            to="/contractor/my-projects"
            className="super-admin-operation-card card-border-navy" 
            id="con-card-vault"
          >
            <div className="card-top-row">
              <span className="card-category-heading">PROOF OF WORK VAULT</span>
              <div className="card-mono-icon-container icon-box-navy">
                <FileCheck size={22} />
              </div>
            </div>

            <div className="card-content-body">
              <div className="card-large-title">
                Geo-tagged Vault
              </div>
              <div className="card-description-text">
                Upload photos, inspection reports, and materials certifications
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link">
                <span>Upload Evidence</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

          {/* CARD 6: Blockchain Receipts */}
          <Link 
            to="/contractor/my-projects"
            className="super-admin-operation-card card-border-green" 
            id="con-card-blockchain"
          >
            <div className="card-top-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="card-category-heading">LEDGER SETTLEMENT</span>
                <span className="card-feature-pill">
                  <span>● On-Chain</span>
                </span>
              </div>
              <div className="card-mono-icon-container icon-box-green">
                <Activity size={22} />
              </div>
            </div>

            <div className="card-content-body">
              <div className="card-large-title">
                Automated Escrow
              </div>
              <div className="card-description-text">
                Zero-delay payment release upon District Engineer milestone approval
              </div>
            </div>

            <div className="card-bottom-row">
              <div className="card-action-link">
                <span>Verify Ledger</span>
                <ArrowRight size={14} className="action-arrow" />
              </div>
            </div>
          </Link>

        </div>

        {/* ========================================================= */}
        {/* SECTION 3: FUND FLOW PROCESS VISUALIZATION                */}
        {/* ========================================================= */}
        <div className="section-eyebrow-heading">
          <span className="section-bullet" />
          <span>STANDARDIZED WORK EXECUTION PIPELINE</span>
        </div>

        <div className="super-admin-section-container">
          <div className="section-container-header">
            <div className="section-container-title">
              <GitBranch size={16} color="#006B4F" />
              <span>3-Phase Milestone Verification & Escrow Settlement</span>
            </div>
            <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Statutory 30-40-30 Disbursal Formula
            </span>
          </div>

          <div className="fund-flow-wrapper">
            <div className="fund-flow-node">
              <div className="fund-flow-circle">01</div>
              <div className="fund-flow-node-title">Tender Award</div>
              <div className="fund-flow-node-desc">Contract Agreement Signed</div>
            </div>

            <div className="fund-flow-connector" />

            <div className="fund-flow-node">
              <div className="fund-flow-circle">02</div>
              <div className="fund-flow-node-title">Phase 1 (30%)</div>
              <div className="fund-flow-node-desc">Foundation & Site Prep</div>
            </div>

            <div className="fund-flow-connector" />

            <div className="fund-flow-node">
              <div className="fund-flow-circle">03</div>
              <div className="fund-flow-node-title">Phase 2 (40%)</div>
              <div className="fund-flow-node-desc">Structural Construction</div>
            </div>

            <div className="fund-flow-connector" />

            <div className="fund-flow-node">
              <div className="fund-flow-circle">04</div>
              <div className="fund-flow-node-title">Phase 3 (30%)</div>
              <div className="fund-flow-node-desc">Final Completion & Audit</div>
            </div>

            <div className="fund-flow-connector" />

            <div className="fund-flow-node">
              <div className="fund-flow-circle">05</div>
              <div className="fund-flow-node-title">Final Settlement</div>
              <div className="fund-flow-node-desc">Full Escrow Release</div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: RECENT ACTIVITY                                */}
        {/* ========================================================= */}
        <div className="section-eyebrow-heading">
          <span className="section-bullet" />
          <span>RECENT MILESTONE EVENTS</span>
        </div>

        <div className="super-admin-section-container">
          <div className="section-container-header">
            <div className="section-container-title">
              <Clock size={16} color="#006B4F" />
              <span>Project Execution & Payment Log</span>
            </div>
            <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              On-Chain Settlement Records
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

      </div>
    </div>
  );
};

export default ContractorDashboard;
