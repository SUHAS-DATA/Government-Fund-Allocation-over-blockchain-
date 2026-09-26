import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Lock, 
  FileText, 
  CheckCircle2, 
  TrendingUp, 
  ShieldAlert, 
  History, 
  FileCheck,
  Landmark,
  PieChart,
  Clock,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Coins,
  LogOut,
  Link2,
  FileSearch,
  Shield
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import { useAuth } from '../../context/AuthContext';
import '../admin/SuperAdminHub.css';

// Sub-components for auditor tabs
import AuditExplorer from './AuditExplorer';
import DocumentAudit from './DocumentAudit';
import AnomalyAnalytics from './AnomalyAnalytics';
import FraudFreeze from './FraudFreeze';
import SubmitAuditReport from './SubmitAuditReport';

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

const AuditorDashboard = () => {
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
    API.get('/auditor/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics || {};
  const totalMonitored = '₹500 Cr';
  const verifiedDocsCount = metrics?.hash_verified_docs || 48;
  const openAlertsCount = metrics?.open_alerts || 2;
  const frozenCount = metrics?.frozen_accounts || 0;
  const totalProjects = metrics?.total_audited_projects || 24;
  const submittedReports = metrics?.submitted_reports || 8;

  // Recent timeline events
  const recentActivities = [
    {
      time: '11:20',
      title: 'Cryptographic Hash Validated',
      detail: `SHA-256 match confirmed for Milestone 2 Completion Certificate (Belagavi Road Works)`
    },
    {
      time: '10:05',
      title: 'Discrepancy Ingestion Complete',
      detail: `Automated ML anomaly scan detected 0 critical variance deviations`
    },
    {
      time: '09:12',
      title: 'Statutory Verdict Recorded',
      detail: `CAG Audit Clearance Certificate issued for Karnataka State Treasury Releases`
    },
    {
      time: '08:40',
      title: 'Ledger Node Verification',
      detail: `Ethereum block #175 integrity re-confirmed across multi-tier distributed nodes`
    }
  ];

  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'explorer': return 'Blockchain Transparency & Multi-Tier Explorer';
      case 'documents': return 'Cryptographic Document Hash Verification';
      case 'anomalies': return 'Forensic Anomaly Detection Analytics';
      case 'freeze': return 'Emergency Smart Contract Fund Freeze';
      case 'report': return 'Submit Statutory CAG Audit Verdict';
      default: return 'Auditor Module';
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
                id="back-to-auditor-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to CAG Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">CAG Forensic Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-module-content">
              {activeTab === 'explorer' && <AuditExplorer />}
              {activeTab === 'documents' && <DocumentAudit />}
              {activeTab === 'anomalies' && <AnomalyAnalytics />}
              {activeTab === 'freeze' && <FraudFreeze />}
              {activeTab === 'report' && <SubmitAuditReport />}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CENTERED AUDITOR CONTROL HUB (Premium Control Center)      */
          /* ========================================================= */
          <>
            {/* Top Meta Bar: Operational Status & Officer Session */}
            <div className="super-admin-top-meta">
              <div className="super-admin-status-pill">
                <span className="live-pulse-dot" />
                <span>CAG Forensic Cell • Cryptographic Sensors Active</span>
              </div>

              <div className="super-admin-user-pill">
                <span className="super-admin-user-name">
                  {user?.name || 'Chief Forensic Auditor'} ({user?.role || 'AUDITOR'})
                </span>
                <button 
                  type="button" 
                  onClick={logout} 
                  className="super-admin-logout-btn"
                  title="Sign out of Auditor Portal"
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
                <span>Comptroller & Auditor General of India • Forensic Cell</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                CAG FORENSIC AUDIT CONTROL CENTER
              </span>
              <h1 className="super-admin-main-title">
                National Forensic Audit & Financial Integrity Hub
              </h1>
              <p className="super-admin-sub-title">
                Cryptographic SHA-256 Document Verification, AI Anomaly Detection & Emergency Smart Contract Freeze
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <ShieldCheck size={13} color="#006B4F" />
                <span>Statutory Forensic Oversight Authority • FY 2026–27</span>
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
                  <span>TOTAL MONITORED VOLUME</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {totalMonitored}
                </span>
                <span className="fin-overview-subtext">Across all multi-tier capital flows</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FileCheck size={14} color="#2563EB" />
                  <span>CRYPTOGRAPHIC DOCUMENTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={verifiedDocsCount} suffix=" Verified" />
                </span>
                <span className="fin-overview-subtext">SHA-256 tamper-proof hash matches</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <AlertTriangle size={14} color="#D99A00" />
                  <span>ACTIVE ANOMALY INQUIRIES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={openAlertsCount} prefix={openAlertsCount < 10 ? '0' : ''} />
                </span>
                <span className="fin-overview-subtext">Under statutory forensic review</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Lock size={14} color="#102A43" />
                  <span>EMERGENCY FREEZES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={frozenCount} prefix="0" />
                </span>
                <span className="fin-overview-subtext">Zero smart contract halts active</span>
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

              {/* CARD 1: Blockchain Explorer */}
              <div 
                className="super-admin-operation-card card-border-green" 
                onClick={() => setTab('explorer')}
                id="audit-card-explorer"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">BLOCKCHAIN EXPLORER</span>
                    <span className="card-feature-pill">
                      <span>● Ledger Verified</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Audit Trail Explorer
                  </div>
                  <div className="card-description-text">
                    Inspect multi-tier transactions and smart contract state across all 4 departments
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Open Explorer</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Document Audit */}
              <div 
                className="super-admin-operation-card card-border-blue" 
                onClick={() => setTab('documents')}
                id="audit-card-documents"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DOCUMENT INTEGRITY</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FileSearch size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={verifiedDocsCount} suffix=" Cryptographic Hashes" />
                  </div>
                  <div className="card-description-text">
                    SHA-256 tamper-proof verification of invoices, bids and inspection proofs
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Inspect Documents</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Anomaly Analytics (FEATURE CARD) */}
              <div 
                className="super-admin-operation-card card-border-gold card-dominant-allocation" 
                onClick={() => setTab('anomalies')}
                id="audit-card-anomalies"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">ANOMALY ANALYTICS</span>
                    <span className="card-feature-pill" style={{ backgroundColor: '#FEF3C7', color: '#D99A00', borderColor: '#FDE68A' }}>
                      <AlertTriangle size={10} />
                      <span>Forensic AI Active</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-gold">
                    <ShieldAlert size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title" style={{ color: '#D99A00' }}>
                    <AnimatedCounter value={openAlertsCount} suffix=" Inquiries Active" />
                  </div>
                  <div className="card-description-text" style={{ fontWeight: '700', color: '#102A43' }}>
                    Statistical Outlier & Disbursal Deviation Detection
                  </div>

                  {/* Clean Subtle Progress Track */}
                  <div className="dominant-progress-container">
                    <div className="dominant-progress-track">
                      <div 
                        className="dominant-progress-fill" 
                        style={{ width: '15%', backgroundColor: '#D99A00' }}
                      />
                    </div>
                    <div className="dominant-progress-meta">
                      <span>Forensic risk index: 0.15 (Low)</span>
                      <span>Zero high-severity alerts</span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link" style={{ color: '#D99A00' }}>
                    <span>Analyze Anomalies</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Emergency Fund Freeze */}
              <div 
                className="super-admin-operation-card card-border-gold" 
                onClick={() => setTab('freeze')}
                id="audit-card-freeze"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">EMERGENCY FUND FREEZE</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <Lock size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="card-large-title">
                      Smart Contract Halt
                    </div>
                    <span className="card-gold-badge">Armed</span>
                  </div>
                  <div className="card-description-text">
                    Statutory power to freeze project or contractor smart contracts on suspicious activity
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Emergency Controls</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Statutory Audit Reports */}
              <div 
                className="super-admin-operation-card card-border-navy" 
                onClick={() => setTab('report')}
                id="audit-card-reports"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">AUDIT REPORTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <FileText size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={submittedReports} suffix=" Submitted Verdicts" />
                  </div>
                  <div className="card-description-text">
                    Formal CAG audit reviews forwarded to Cabinet Secretariat & Finance Ministry
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Submit & View Reports</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Compliance Monitoring */}
              <div 
                className="super-admin-operation-card card-border-teal" 
                onClick={() => setTab('explorer')}
                id="audit-card-compliance"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">COMPLIANCE BENCHMARK</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <ShieldCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={totalProjects} suffix=" Audited Projects" />
                  </div>
                  <div className="card-description-text">
                    Comprehensive cross-tier financial audit rating: 98.4%
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Inspect Benchmarks</span>
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
              <span>FORENSIC SURVEILLANCE PIPELINE</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>Statutory CAG Audit Surveillance Flow</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Cryptographic Integrity Verification
                </span>
              </div>

              <div className="fund-flow-wrapper">
                <div className="fund-flow-node">
                  <div className="fund-flow-circle">01</div>
                  <div className="fund-flow-node-title">Raw Ledger Ingestion</div>
                  <div className="fund-flow-node-desc">On-Chain Event Streaming</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">02</div>
                  <div className="fund-flow-node-title">SHA-256 Matching</div>
                  <div className="fund-flow-node-desc">Cryptographic Document Check</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">03</div>
                  <div className="fund-flow-node-title">AI Anomaly Analysis</div>
                  <div className="fund-flow-node-desc">Outlier & Velocity Risk</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">04</div>
                  <div className="fund-flow-node-title">Forensic Audit Verdict</div>
                  <div className="fund-flow-node-desc">Official Inquiry Findings</div>
                </div>

                <div className="fund-flow-connector" />

                <div className="fund-flow-node">
                  <div className="fund-flow-circle">05</div>
                  <div className="fund-flow-node-title">Cabinet Enforcement</div>
                  <div className="fund-flow-node-desc">Smart Contract Freeze / Clear</div>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY                                */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>RECENT FORENSIC EVENTS</span>
            </div>

            <div className="super-admin-section-container">
              <div className="section-container-header">
                <div className="section-container-title">
                  <Clock size={16} color="#006B4F" />
                  <span>Audited System Forensic Log</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Real-time Integrity Record
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

export default AuditorDashboard;
