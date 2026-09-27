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
  Shield,
  FolderKanban,
  UserCheck,
  Layers,
  Camera,
  AlertCircle
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/RealtimeContext';
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

  const loadAuditorData = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    API.get('/auditor/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    loadAuditorData(true);
  }, []);

  useRealtimeSync(() => loadAuditorData(false), { interval: 6000 });

  const metrics = data?.metrics || {};
  const totalMonitored = '₹500 Cr';
  const verifiedDocsCount = metrics?.hash_verified_docs || 48;
  const openAlertsCount = metrics?.open_alerts || 2;
  const frozenCount = metrics?.frozen_accounts || 0;
  const totalProjects = metrics?.total_audited_projects || 24;
  const submittedReports = metrics?.submitted_reports || 8;

  // 7 Dashboard Stats as per requirements:
  // - Assigned Audits
  // - Projects Under Audit
  // - Funds Under Review
  // - Pending Verifications
  // - Suspicious Transactions
  // - Blockchain Verification Status
  // - Completed Audits
  const assignedAuditsCount = metrics?.assigned_audits || 12;
  const projectsUnderAuditCount = metrics?.projects_under_audit || totalProjects;
  const fundsUnderReview = '₹500 Cr';
  const pendingVerificationsCount = metrics?.pending_verifications || 7;
  const suspiciousTransactionsCount = openAlertsCount;
  const blockchainStatus = '100% Immutable';
  const completedAuditsCount = submittedReports;

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
      case 'assigned_audits': return 'Assigned Statutory Audits & Mandates';
      case 'projects': return 'Audited Public Works Projects';
      case 'transactions': return 'Multi-Tier Fund Transactions Trail';
      case 'contractors': return 'Empanelled Contractor Statutory Records';
      case 'documents': return 'Cryptographic Document Hash Verification';
      case 'progress': return 'Site Progress & Physical Inspection Verification';
      case 'explorer': return 'Blockchain Transparency & Multi-Tier Explorer';
      case 'anomalies': return 'Forensic Anomaly Detection Analytics';
      case 'freeze': return 'Emergency Smart Contract Fund Freeze';
      case 'report': return 'Submit Statutory CAG Audit Verdict';
      case 'notifications': return 'Forensic Alerts & Red Flag Notifications';
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

              {activeTab === 'assigned_audits' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <ShieldCheck size={20} color="#006B4F" />
                      <span>Statutory Audit Mandates Assigned to Forensic Cell</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { ref: 'AUD-2026-KA-01', mandate: 'Karnataka State Rural Infrastructure Fund Reconciliations', authority: 'Finance Ministry', scope: 'Central Grants (₹120 Cr) to District DRDA Allocations', status: 'In Progress (85%)' },
                      { ref: 'AUD-2026-KA-02', mandate: 'Belagavi District Health Infrastructure Procurement Audit', authority: 'CAG Office', scope: 'Oxygen Line & Hospital Equipment Escrow Settlements', status: 'Verification Stage' },
                      { ref: 'AUD-2026-DL-03', mandate: 'Central Smart City Urban Water Pipeline Forensic Review', authority: 'Cabinet Secretariat', scope: 'Multi-Vendor Smart Contract Disbursals', status: 'Scheduled' }
                    ].map((a, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{a.mandate}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Mandate Ref: <code style={{ color: '#006B4F', fontWeight: '700' }}>{a.ref}</code> • Authorized By: {a.authority}</div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '4px' }}>Scope: {a.scope}</div>
                        </div>
                        <span style={{ fontSize: '12px', background: '#E6F4EA', color: '#006B4F', padding: '4px 10px', borderRadius: '4px', fontWeight: '800' }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'projects' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <FolderKanban size={20} color="#0284C7" />
                      <span>Projects Currently Under Statutory Forensic Audit</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { id: 'PRJ-KA-101', name: 'Belagavi District Multi-Specialty Hospital Complex', dept: 'Health & Infrastructure', state: 'Karnataka', budget: '₹22,00,00,000', auditScore: '98.5% Compliant' },
                      { id: 'PRJ-KA-102', name: 'Four-Lane Rural Bypass Macadam Highway', dept: 'Public Works (PWD)', state: 'Karnataka', budget: '₹14,50,00,000', auditScore: '99.1% Compliant' },
                      { id: 'PRJ-KA-103', name: 'Smart Panchayat Drinking Water Filtration Network', dept: 'Rural Development', state: 'Karnataka', budget: '₹6,80,00,000', auditScore: '96.8% Compliant' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{p.name}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Project ID: <code style={{ color: '#0284C7', fontWeight: '700' }}>{p.id}</code> • {p.dept} • {p.state}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#102A43' }}>{p.budget}</div>
                          <span style={{ fontSize: '11px', color: '#006B4F', fontWeight: '800' }}>{p.auditScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <History size={20} color="#006B4F" />
                      <span>Complete Multi-Tier Fund Transaction Trail</span>
                    </div>
                    <button type="button" onClick={() => setTab('explorer')} className="super-admin-back-btn">
                      <Activity size={14} />
                      <span>Open Blockchain Explorer</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { tier: 'Central Ministry → Karnataka State Treasury', amount: '₹120,00,00,000', tx: '0x8f2d...3a91', block: '19482900', status: 'Treasury Disbursed', date: '2026-09-18' },
                      { tier: 'State Treasury → Belagavi District DRDA', amount: '₹45,00,00,000', tx: '0x7c3a...88ff', block: '19482905', status: 'District Credited', date: '2026-09-19' },
                      { tier: 'District DRDA → Contractor Smart Escrow (Milestone 2)', amount: '₹14,00,00,000', tx: '0x9e8a...9f8a', block: '19482910', status: 'Escrow Released', date: '2026-09-20' }
                    ].map((t, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{t.tier}</div>
                          <div style={{ marginTop: '4px' }}><BlockchainBadge txHash={t.tx} blockNumber={t.block} /></div>
                          <div style={{ fontSize: '11px', color: '#627D98', marginTop: '4px' }}>Date: {t.date} • {t.status}</div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>{t.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'contractors' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <UserCheck size={20} color="#D97706" />
                      <span>Empanelled Contractor Statutory KYC & Performance Records</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { name: 'Apex Infrastructure Contractors Pvt Ltd', gst: '29AABCU9603R1ZM', pan: 'AABCU9603R', license: 'PWD-CLASS1-0941', status: 'KYC Verified (Compliant)', rating: '4.9/5' },
                      { name: 'Shree Balaji Civil Engineering Works', gst: '29BBDFS8812K1Z9', pan: 'BBDFS8812K', license: 'PWD-CLASS1-0812', status: 'KYC Verified (Compliant)', rating: '4.8/5' }
                    ].map((c, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{c.name}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>GSTIN: <strong>{c.gst}</strong> • PAN: <strong>{c.pan}</strong> • License: {c.license}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', background: '#E6F4EA', color: '#006B4F', padding: '4px 10px', borderRadius: '4px', fontWeight: '800' }}>{c.status}</span>
                          <div style={{ fontSize: '11px', color: '#627D98', marginTop: '4px' }}>Audit Performance: {c.rating}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'progress' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <TrendingUp size={20} color="#16A34A" />
                      <span>Physical Works & Drone Milestone Progress Verification</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { project: 'Belagavi Rural Bypass Roadway', stage: 'Milestone 2: Subgrade & Macadam Layering', progress: '100% of Phase 2', evidence: 'Geo-tagged GPS Drone Imagery & Lab Density Certificate', result: 'Verified Authentic' },
                      { project: 'Model Smart Secondary School Complex', stage: 'Milestone 1: RCC Piling & Plinth Level', progress: '100% of Phase 1', evidence: 'Core Strength Compression Test Lab Report', result: 'Verified Authentic' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{p.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Stage: {p.stage} ({p.progress})</div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '4px' }}>Evidence: {p.evidence}</div>
                        </div>
                        <span style={{ fontSize: '12px', background: '#E6F4EA', color: '#006B4F', padding: '4px 10px', borderRadius: '4px', fontWeight: '800' }}>✓ {p.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <AlertTriangle size={20} color="#D97706" />
                      <span>Forensic Alerts & Red Flag Notifications</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { title: 'Velocity Anomaly Warning Cleared', desc: 'Disbursal velocity test for Dharwad Rural School passed variance threshold.', date: 'Today, 10:15 AM', type: 'Resolved' },
                      { title: 'Statutory Audit Report Acknowledged', desc: 'Quarterly review report received by Public Accounts Committee (PAC).', date: 'Yesterday, 03:40 PM', type: 'Official' }
                    ].map((n, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '800', color: '#102A43', fontSize: '14px' }}>{n.title}</span>
                          <span style={{ fontSize: '11px', color: '#627D98' }}>{n.date}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>{n.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            {/* SECTION 1: AUDITOR 7-METRIC DASHBOARD OVERVIEW            */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>FORENSIC AUDIT OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel grid-7">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <ShieldCheck size={14} color="#006B4F" />
                  <span>ASSIGNED AUDITS</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  <AnimatedCounter value={assignedAuditsCount} />
                </span>
                <span className="fin-overview-subtext">Active statutory mandates</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FolderKanban size={14} color="#0284C7" />
                  <span>PROJECTS UNDER AUDIT</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={projectsUnderAuditCount} />
                </span>
                <span className="fin-overview-subtext">Multi-state public works</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Landmark size={14} color="#006B4F" />
                  <span>FUNDS UNDER REVIEW</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {fundsUnderReview}
                </span>
                <span className="fin-overview-subtext">Total scrutinized volume</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Clock size={14} color="#D97706" />
                  <span>PENDING VERIFICATIONS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={pendingVerificationsCount} />
                </span>
                <span className="fin-overview-subtext">Field inspection audits</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <AlertTriangle size={14} color="#DC2626" />
                  <span>SUSPICIOUS TRANSACTIONS</span>
                </div>
                <span className="fin-overview-value" style={{ color: suspiciousTransactionsCount > 0 ? '#DC2626' : '#102A43' }}>
                  <AnimatedCounter value={suspiciousTransactionsCount} />
                </span>
                <span className="fin-overview-subtext">Under AI inquiry</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Activity size={14} color="#2563EB" />
                  <span>BLOCKCHAIN STATUS</span>
                </div>
                <span className="fin-overview-value" style={{ fontSize: '18px', color: '#2563EB' }}>
                  {blockchainStatus}
                </span>
                <span className="fin-overview-subtext">Consensus verified</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FileCheck size={14} color="#7C3AED" />
                  <span>COMPLETED AUDITS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={completedAuditsCount} />
                </span>
                <span className="fin-overview-subtext">Verdicts delivered</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: 10 INTERACTIVE MODULES (3 Cards Per Row)       */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>FORENSIC AUDITOR MODULES</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Assigned Audits */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('assigned_audits')}
                id="audit-card-assigned"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">ASSIGNED AUDITS</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <ShieldCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={assignedAuditsCount} suffix=" Mandates" />
                  </div>
                  <div className="card-description-text">
                    Statutory forensic oversight mandates assigned by Cabinet Secretariat
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Inspect Mandates</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Projects */}
              <div
                className="super-admin-operation-card card-border-blue"
                onClick={() => setTab('projects')}
                id="audit-card-projects"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECTS</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={projectsUnderAuditCount} suffix=" Under Audit" />
                  </div>
                  <div className="card-description-text">
                    Scrutinize public works projects, milestone logs, and approved budgets
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Inspect Projects</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Fund Transactions */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('transactions')}
                id="audit-card-transactions"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">FUND TRANSACTIONS</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Coins size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Multi-Tier Ledger
                  </div>
                  <div className="card-description-text">
                    Inspect complete capital movements across Central, State, and District tiers
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Inspect Transactions</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Contractor Records */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('contractors')}
                id="audit-card-contractors"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CONTRACTOR RECORDS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Vendor Scrutiny
                  </div>
                  <div className="card-description-text">
                    Statutory vendor KYC verification, tax filings, and bank account linkages
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review Contractors</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Documents */}
              <div
                className="super-admin-operation-card card-border-navy"
                onClick={() => setTab('documents')}
                id="audit-card-documents"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DOCUMENTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <Layers size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={verifiedDocsCount} suffix=" Cryptographic Files" />
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

              {/* CARD 6: Progress Verification */}
              <div
                className="super-admin-operation-card card-border-teal"
                onClick={() => setTab('progress')}
                id="audit-card-progress"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROGRESS VERIFICATION</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Camera size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Field Evidence
                  </div>
                  <div className="card-description-text">
                    Audit geo-tagged site images, drone videos, and civil quality certificates
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify Progress</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 7: Blockchain Verification */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('explorer')}
                id="audit-card-blockchain"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">BLOCKCHAIN VERIFICATION</span>
                    <span className="card-feature-pill">
                      <span>● Consensus Verified</span>
                    </span>
                  </div>
                  <div className="card-mono-icon-container icon-box-green">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Cryptographic Ledger
                  </div>
                  <div className="card-description-text">
                    Inspect multi-tier transactions and smart contract state on Ethereum nodes
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify Blockchain</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 8: Fraud / Anomaly Detection */}
              <div
                className="super-admin-operation-card card-border-gold card-dominant-allocation"
                onClick={() => setTab('anomalies')}
                id="audit-card-anomalies"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">FRAUD / ANOMALY DETECTION</span>
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

              {/* CARD 9: Audit Reports */}
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

              {/* CARD 10: Notifications */}
              <div
                className="super-admin-operation-card card-border-red"
                onClick={() => setTab('notifications')}
                id="audit-card-notifications"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">NOTIFICATIONS</span>
                  <div className="card-mono-icon-container icon-box-red">
                    <AlertTriangle size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Red Flag Alerts
                  </div>
                  <div className="card-description-text">
                    Real-time transaction alerts, milestone disputes, and freeze advisories
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Notifications</span>
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
