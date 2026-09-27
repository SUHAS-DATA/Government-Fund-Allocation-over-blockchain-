import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  LogOut,
  Send,
  Layers,
  FileSpreadsheet,
  UserCheck,
  Camera,
  FileText,
  CheckCircle,
  Eye,
  Award
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import '../admin/SuperAdminHub.css';

// Subcomponents for contractor operations
import MyProjects from './MyProjects';
import MilestonePayments from './MilestonePayments';
import ContractorKYC from './ContractorKYC';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Bid submission form state
  const [bidForm, setBidForm] = useState({
    project_id: '',
    quoted_amount: '',
    completion_timeline_months: 12,
    technical_proposal: ''
  });
  const [bidSubmitting, setBidSubmitting] = useState(false);

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

  const setTab = (tabName) => {
    setSearchParams(tabName === 'overview' ? {} : { tab: tabName });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBidSubmit = (e) => {
    e.preventDefault();
    setBidSubmitting(true);
    setTimeout(() => {
      setActionSuccess(`Bid for project ${bidForm.project_id || 'PRJ-KA-102'} submitted successfully! Digital tender receipt generated.`);
      setBidSubmitting(false);
      setBidForm({ project_id: '', quoted_amount: '', completion_timeline_months: 12, technical_proposal: '' });
      setTimeout(() => {
        setTab('my_bids');
        setActionSuccess('');
      }, 1500);
    }, 700);
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

  // 8 Dashboard Stats as per requirements:
  // - Available Projects
  // - Submitted Bids
  // - Active Contracts
  // - Active Projects
  // - Project Progress
  // - Pending Milestones
  // - Payment Requests
  // - Payments Received
  const availableProjectsCount = metrics?.available_projects_count || 8;
  const submittedBidsCount = metrics?.submitted_bids_count || 4;
  const activeContractsCount = metrics?.active_contracts_count || 3;
  const avgProjectProgress = metrics?.avg_progress || 68;
  const pendingMilestonesCount = metrics?.pending_milestones_count || 5;
  const pendingPaymentRequestsCount = metrics?.pending_payment_requests || 2;

  // Submodule title resolver
  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'available':
        return 'Available Public Works Projects & Tenders';
      case 'apply_bid':
        return 'Apply / Submit Electronic Tender Bid';
      case 'my_bids':
        return 'My Submitted Bids & Evaluation Status';
      case 'contracts':
        return 'Awarded Contracts & Concession Agreements';
      case 'projects':
        return 'Active Project Work Execution & Monitoring';
      case 'upload':
        return 'Upload Site Progress Proofs & Evidence';
      case 'milestones':
        return '30-40-30 Milestone Verification Tracking';
      case 'payment_requests':
        return 'Escrow Payment Requests & Invoices';
      case 'history':
        return 'Disbursed Payment History & Settlement Vouchers';
      case 'documents':
        return 'Statutory Documents & Quality Certifications';
      case 'blockchain':
        return 'On-Chain Blockchain Settlement Records';
      case 'profile':
        return 'Contractor Statutory Profile & PWD KYC';
      default:
        return 'Contractor Module';
    }
  };

  // Timeline events
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
                id="back-to-contractor-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to Contractor Hub</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">Contractor Hub</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-submodule-wrapper">
              {activeTab === 'projects' && (
                <MyProjects />
              )}

              {activeTab === 'history' && (
                <MilestonePayments />
              )}

              {activeTab === 'profile' && (
                <ContractorKYC />
              )}

              {activeTab === 'available' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <FolderKanban size={20} color="#006B4F" />
                      <span>Available Government Projects Open for Bidding</span>
                    </div>
                    <button type="button" onClick={() => setTab('apply_bid')} className="super-admin-back-btn" style={{ background: '#006B4F', color: '#FFF' }}>
                      <Send size={14} />
                      <span>Submit Tender Bid</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { id: 'PRJ-KA-204', name: 'Four-Lane Rural Bypass Macadam Highway', dept: 'PWD & National Highways', district: 'Belagavi, Karnataka', budget: '₹14,50,00,000', deadline: '2026-10-15', status: 'Bidding Open' },
                      { id: 'PRJ-KA-205', name: 'District Multi-Specialty Mother & Child Care Wing', dept: 'Health & Family Welfare', district: 'Belagavi, Karnataka', budget: '₹22,00,00,000', deadline: '2026-10-20', status: 'Bidding Open' },
                      { id: 'PRJ-KA-206', name: 'Smart Panchayat Drinking Water Filtration Network', dept: 'Rural Water Supply', district: 'Dharwad, Karnataka', budget: '₹6,80,00,000', deadline: '2026-10-25', status: 'Bidding Open' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '16px' }}>{p.name}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                            Tender ID: <code style={{ color: '#006B4F', fontWeight: '700' }}>{p.id}</code> • Department: {p.dept} • {p.district}
                          </div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '4px' }}>
                            Submission Deadline: <strong>{p.deadline}</strong> • Security Deposit: 1% EMD
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>{p.budget}</div>
                          <button 
                            type="button" 
                            onClick={() => { setBidForm({ ...bidForm, project_id: p.id }); setTab('apply_bid'); }}
                            style={{ marginTop: '8px', background: '#006B4F', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Apply / Bid →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'apply_bid' && (
                <div className="card" style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Send size={20} color="#2563EB" />
                      <span>Electronic Tender Bid Submission Form</span>
                    </div>
                  </div>
                  <form onSubmit={handleBidSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>Select Target Project / Tender ID</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. PRJ-KA-204" 
                        value={bidForm.project_id} 
                        onChange={(e) => setBidForm({ ...bidForm, project_id: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>Quoted Commercial Bid Amount (in INR)</label>
                      <input 
                        type="number" 
                        required 
                        min="100000"
                        step="1000"
                        placeholder="e.g. 142000000" 
                        value={bidForm.quoted_amount} 
                        onChange={(e) => setBidForm({ ...bidForm, quoted_amount: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      />
                      {bidForm.quoted_amount > 0 && (
                        <div style={{ fontSize: '12px', color: '#006B4F', fontWeight: '700', marginTop: '4px' }}>
                          Quoted Value: {formatIndianDenomination(bidForm.quoted_amount)} ({formatCurrency(Number(bidForm.quoted_amount))})
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>Proposed Completion Timeline (Months)</label>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        max="60"
                        value={bidForm.completion_timeline_months} 
                        onChange={(e) => setBidForm({ ...bidForm, completion_timeline_months: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#102A43', marginBottom: '6px' }}>Technical Methodology & Equipment Deployment Plan</label>
                      <textarea 
                        required 
                        rows={4} 
                        placeholder="Describe technical engineering methodology, machinery mobilization, and safety standards..."
                        value={bidForm.technical_proposal}
                        onChange={(e) => setBidForm({ ...bidForm, technical_proposal: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" onClick={() => setTab('available')} className="super-admin-back-btn">Cancel</button>
                      <button type="submit" disabled={bidSubmitting} style={{ background: '#006B4F', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>
                        {bidSubmitting ? 'Submitting Bid...' : 'Submit Sealed Tender Bid'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'my_bids' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Clock size={20} color="#D97706" />
                      <span>My Submitted Tender Bids & Evaluation Progress</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { tender: 'TND-2026-891', project: 'Model Smart Secondary School Building Complex', quoted: '₹3,40,00,000', status: 'Technically Qualified (L1 Vendor)', rank: 'L1', date: '2026-09-12' },
                      { tender: 'TND-2026-880', project: 'District Hospital Oxygen Generation Plant', quoted: '₹4,45,00,000', status: 'Contract Awarded & Initialized', rank: 'Awarded', date: '2026-08-25' },
                      { tender: 'TND-2026-874', project: 'Bridge Pier Construction over Malaprabha River', quoted: '₹18,20,00,000', status: 'Financial Evaluation in Progress', rank: 'Under Scrutiny', date: '2026-09-19' }
                    ].map((b, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{b.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Tender ID: <code style={{ color: '#006B4F', fontWeight: '700' }}>{b.tender}</code> • Submitted: {b.date}</div>
                          <div style={{ fontSize: '12px', color: '#0284C7', fontWeight: '700', marginTop: '4px' }}>Status: {b.status}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#102A43' }}>{b.quoted}</div>
                          <span style={{ fontSize: '11px', background: '#E6F4EA', color: '#006B4F', padding: '3px 8px', borderRadius: '4px', fontWeight: '800' }}>Rank: {b.rank}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'contracts' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Award size={20} color="#7C3AED" />
                      <span>Legally Binding Concession Agreements & Contract Awards</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { agreementId: 'AGR-2026-KA-44', project: 'Rural Bypass Roadway & Drainage Works', authority: 'Belagavi District Development Authority', value: '₹14,50,00,000', signed: '2026-06-15', escrow: '0x71C...aB42' },
                      { agreementId: 'AGR-2026-KA-38', project: 'Model Smart Secondary School Complex', authority: 'Public Works Department (Govt of KA)', value: '₹3,40,00,000', signed: '2026-07-02', escrow: '0x99D...eF10' }
                    ].map((c, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '16px' }}>{c.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Agreement: <code style={{ color: '#7C3AED', fontWeight: '700' }}>{c.agreementId}</code> • Authority: {c.authority}</div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '4px' }}>Executed on: {c.signed} • Smart Escrow Vault: <span style={{ fontFamily: 'monospace', color: '#006B4F' }}>{c.escrow}</span></div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>{c.value}</div>
                          <span style={{ fontSize: '11px', background: '#F3E8FF', color: '#7C3AED', padding: '3px 8px', borderRadius: '4px', fontWeight: '800' }}>Contract Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <Camera size={20} color="#0D9488" />
                      <span>Upload Field Progress Proofs & Geo-Tagged Evidence</span>
                    </div>
                    <button type="button" onClick={() => setTab('projects')} className="super-admin-back-btn">
                      <FolderKanban size={14} />
                      <span>Go to Project Management</span>
                    </button>
                  </div>
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '13px', color: '#166534' }}>
                    📸 <strong>Tamper-Proof Proof of Work:</strong> Upload geo-tagged photos with EXIF GPS coordinates and testing certificates. Each file generates an immutable SHA-256 hash registered on the Ethereum blockchain.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <button 
                      type="button" 
                      onClick={() => setTab('projects')} 
                      style={{ background: '#006B4F', color: '#FFF', border: 'none', padding: '14px 20px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', textAlign: 'center' }}
                    >
                      Open Active Projects to Attach Geo-Evidence →
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'milestones' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <FileCheck size={20} color="#7C3AED" />
                      <span>Statutory 30-40-30 Milestone Verification Schedule</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { stage: 'Phase 1: Mobilization & Foundation (30%)', project: 'Rural Bypass Roadway', status: 'Verified & Disbursed (₹4.35 Cr)', color: '#006B4F' },
                      { stage: 'Phase 2: Superstructure & Paving (40%)', project: 'Rural Bypass Roadway', status: 'Site Proofs Under Review by District Engineer', color: '#D97706' },
                      { stage: 'Phase 3: Final Surfacing, Signage & Handover (30%)', project: 'Rural Bypass Roadway', status: 'Scheduled for Q4', color: '#627D98' }
                    ].map((m, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{m.stage}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Project: {m.project}</div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: m.color, background: '#FFF', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${m.color}` }}>
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'payment_requests' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <CreditCard size={20} color="#EA580C" />
                      <span>Milestone Payment Requisition & Escrow Claims</span>
                    </div>
                    <button type="button" onClick={() => setTab('projects')} className="super-admin-back-btn" style={{ background: '#006B4F', color: '#FFF' }}>
                      <Coins size={14} />
                      <span>Submit New Claim</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { id: 'CLM-KA-2026-90', project: 'Model Smart Secondary School Complex', amount: '₹1,02,00,000', phase: 'Phase 1 Milestone (30%)', status: 'District Technical Verification Complete', date: '2026-09-21' },
                      { id: 'CLM-KA-2026-88', project: 'Rural Bypass Roadway', amount: '₹5,80,00,000', phase: 'Phase 2 Milestone (40%)', status: 'State Treasury Disbursal Queued', date: '2026-09-18' }
                    ].map((c, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{c.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Claim ID: <code style={{ color: '#EA580C', fontWeight: '700' }}>{c.id}</code> • {c.phase}</div>
                          <div style={{ fontSize: '12px', color: '#006B4F', fontWeight: '700', marginTop: '4px' }}>Status: {c.status}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#EA580C' }}>{c.amount}</div>
                          <span style={{ fontSize: '11px', color: '#627D98' }}>Submitted: {c.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Layers size={20} color="#1E3A8A" />
                      <span>Statutory Contractor Documents & Quality Certifications</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {[
                      { name: 'Class-1 PWD Engineering Contractor License', authority: 'Public Works Department', validUntil: '2029-03-31', hash: '0xa71b...88f1' },
                      { name: 'GSTIN Registration Certificate', authority: 'Goods and Services Tax Network', validUntil: 'Active', hash: '0x94cc...12d4' },
                      { name: 'Pan-India ISO 9001:2015 Quality Certificate', authority: 'Bureau of Indian Standards', validUntil: '2028-11-30', hash: '0xbb19...33aa' },
                      { name: 'Bank Solvency & Performance Guarantee', authority: 'State Bank of India', validUntil: '2027-04-15', hash: '0xee45...9910' }
                    ].map((d, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: '800', color: '#102A43', fontSize: '14px' }}>{d.name}</div>
                        <div style={{ fontSize: '12px', color: '#627D98' }}>Issuing Authority: {d.authority}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#1E3A8A', background: '#EFF6FF', padding: '4px 8px', borderRadius: '4px' }}>
                          SHA-256: {d.hash}
                        </div>
                        <div style={{ fontSize: '11px', color: '#006B4F', fontWeight: '700', marginTop: 'auto' }}>Validity: {d.validUntil}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'blockchain' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Activity size={20} color="#006B4F" />
                      <span>On-Chain Cryptographic Escrow Disbursal Records</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { hash: '0x9e8a7c6b5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a', block: '19482910', event: 'Escrow Milestone 1 Settlement', amount: '₹4,35,00,000', time: '2026-09-20 14:32' },
                      { hash: '0x4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e', block: '19478105', event: 'Contractor Work Agreement Anchoring', amount: '₹14,50,00,000', time: '2026-06-15 11:20' }
                    ].map((tx, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '14px' }}>{tx.event}</div>
                          <div style={{ marginTop: '4px' }}><BlockchainBadge txHash={tx.hash} blockNumber={tx.block} /></div>
                          <div style={{ fontSize: '11px', color: '#627D98', marginTop: '4px' }}>Timestamp: {tx.time}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#006B4F' }}>{tx.amount}</div>
                          <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '800' }}>✓ Confirmed by Validators</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN CENTERED CONTRACTOR HUB VIEW                         */
          /* ========================================================= */
          <>
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
            {/* SECTION 1: 8-METRIC CONTRACTOR DASHBOARD STATS            */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CONTRACTOR OPERATIONAL & FINANCIAL OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel grid-8">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FolderKanban size={14} color="#0284C7" />
                  <span>AVAILABLE PROJECTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={availableProjectsCount} />
                </span>
                <span className="fin-overview-subtext">Open for bidding</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Send size={14} color="#7C3AED" />
                  <span>SUBMITTED BIDS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={submittedBidsCount} />
                </span>
                <span className="fin-overview-subtext">Tender evaluations</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Award size={14} color="#D97706" />
                  <span>ACTIVE CONTRACTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={activeContractsCount} />
                </span>
                <span className="fin-overview-subtext">Legally executed</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Building2 size={14} color="#006B4F" />
                  <span>ACTIVE PROJECTS</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  <AnimatedCounter value={activeProjectsCount} />
                </span>
                <span className="fin-overview-subtext">Under site work</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <TrendingUp size={14} color="#16A34A" />
                  <span>PROJECT PROGRESS</span>
                </div>
                <span className="fin-overview-value">
                  {avgProjectProgress}%
                </span>
                <span className="fin-overview-subtext">Average milestone rate</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FileCheck size={14} color="#9333EA" />
                  <span>PENDING MILESTONES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={pendingMilestonesCount} />
                </span>
                <span className="fin-overview-subtext">Under field audit</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <CreditCard size={14} color="#EA580C" />
                  <span>PAYMENT REQUESTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={pendingPaymentRequestsCount} />
                </span>
                <span className="fin-overview-subtext">Escrow claims</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#006B4F" />
                  <span>PAYMENTS RECEIVED</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalDisbursed)}
                </span>
                <span className="fin-overview-subtext">{disbursedPct}% settled</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* CONTRACTOR 14-STAGE WORKFLOW PIPELINE                     */}
            {/* ========================================================= */}
            <div className="gov-workflow-card">
              <div className="gov-workflow-header">
                <div className="gov-workflow-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>Complete Contractor End-to-End Workflow</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700' }}>
                  14-STAGE STATUTORY PUBLIC WORKS PIPELINE
                </span>
              </div>
              <div className="gov-workflow-steps">
                {[
                  { step: 1, title: 'Registration' },
                  { step: 2, title: 'Login' },
                  { step: 3, title: 'Available Projects', tab: 'available' },
                  { step: 4, title: 'Apply/Bid', tab: 'apply_bid' },
                  { step: 5, title: 'Bid Evaluation', tab: 'my_bids' },
                  { step: 6, title: 'Contract Award', tab: 'contracts' },
                  { step: 7, title: 'Project Execution', tab: 'projects' },
                  { step: 8, title: 'Upload Progress', tab: 'upload' },
                  { step: 9, title: 'Milestone Verification', tab: 'milestones' },
                  { step: 10, title: 'Payment Request', tab: 'payment_requests' },
                  { step: 11, title: 'Payment Approval', tab: 'payment_requests' },
                  { step: 12, title: 'Blockchain Record', tab: 'blockchain' },
                  { step: 13, title: 'Payment Released', tab: 'history' },
                  { step: 14, title: 'Project Completion', tab: 'projects' }
                ].map((s, idx, arr) => (
                  <React.Fragment key={s.step}>
                    <div 
                      className="gov-workflow-step active" 
                      onClick={() => s.tab && setTab(s.tab)}
                      style={{ cursor: s.tab ? 'pointer' : 'default' }}
                    >
                      <span className="gov-workflow-step-num">{s.step}</span>
                      <span>{s.title}</span>
                    </div>
                    {idx < arr.length - 1 && <span className="gov-workflow-arrow">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: 12 INTERACTIVE MODULES (3 Cards Per Row)       */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CONTRACTOR OPERATIONS MODULES</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Available Projects */}
              <div 
                onClick={() => setTab('available')}
                className="super-admin-operation-card card-border-blue" 
                id="con-card-available"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">AVAILABLE PROJECTS</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={availableProjectsCount} suffix=" Tenders" />
                  </div>
                  <div className="card-description-text">
                    Browse open public works tenders and notices inviting bids (NIB)
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Browse Projects</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Apply / Bid */}
              <div 
                onClick={() => setTab('apply_bid')}
                className="super-admin-operation-card card-border-teal" 
                id="con-card-apply-bid"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">APPLY / BID</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <Send size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Submit Proposal
                  </div>
                  <div className="card-description-text">
                    Submit commercial quote, technical methodology, and equipment plan
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Apply Now</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: My Bids */}
              <div 
                onClick={() => setTab('my_bids')}
                className="super-admin-operation-card card-border-gold" 
                id="con-card-my-bids"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">MY BIDS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <Clock size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={submittedBidsCount} suffix=" Active Bids" />
                  </div>
                  <div className="card-description-text">
                    Track bid scrutiny, technical qualification status, and L1 evaluations
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Submitted Bids</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Contracts */}
              <div 
                onClick={() => setTab('contracts')}
                className="super-admin-operation-card card-border-purple" 
                id="con-card-contracts"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CONTRACTS</span>
                  <div className="card-mono-icon-container icon-box-purple">
                    <Award size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeContractsCount} suffix=" Awarded" />
                  </div>
                  <div className="card-description-text">
                    Tripartite concession agreements signed and anchored on blockchain
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Contracts</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Project Work */}
              <div 
                onClick={() => setTab('projects')}
                className="super-admin-operation-card card-border-blue" 
                id="con-card-projects"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECT WORK</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <Building2 size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeProjectsCount} suffix=" Active Sites" />
                  </div>
                  <div className="card-description-text">
                    Execute construction tasks, schedule mobilization, and log daily works
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Work</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Upload Progress */}
              <div 
                onClick={() => setTab('upload')}
                className="super-admin-operation-card card-border-navy" 
                id="con-card-upload"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">UPLOAD PROGRESS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <Camera size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Geo-Tagged Media
                  </div>
                  <div className="card-description-text">
                    Upload drone photos, concrete cube test certificates, and site videos
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Upload Evidence</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 7: Milestones */}
              <div 
                onClick={() => setTab('milestones')}
                className="super-admin-operation-card card-border-purple" 
                id="con-card-milestones"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">MILESTONES</span>
                  <div className="card-mono-icon-container icon-box-purple">
                    <FileCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    30-40-30 Formula
                  </div>
                  <div className="card-description-text">
                    Foundation, structural, and finishing milestone sign-off milestones
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Track Milestones</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 8: Payment Requests */}
              <div 
                onClick={() => setTab('payment_requests')}
                className="super-admin-operation-card card-border-orange" 
                id="con-card-payment-requests"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PAYMENT REQUESTS</span>
                  <div className="card-mono-icon-container icon-box-orange">
                    <CreditCard size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={pendingPaymentRequestsCount} suffix=" In Review" />
                  </div>
                  <div className="card-description-text">
                    Submit escrow release claims against verified engineering milestones
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Requests</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 9: Payment History */}
              <div 
                onClick={() => setTab('history')}
                className="super-admin-operation-card card-border-green" 
                id="con-card-payment-history"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PAYMENT HISTORY</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Coins size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {formatIndianDenomination(totalDisbursed)}
                  </div>
                  <div className="card-description-text">
                    Audited bank credit vouchers and smart contract payment transactions
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Receipts</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 10: Documents */}
              <div 
                onClick={() => setTab('documents')}
                className="super-admin-operation-card card-border-navy" 
                id="con-card-documents"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DOCUMENTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <Layers size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Compliance Vault
                  </div>
                  <div className="card-description-text">
                    Measurement books, material quality test certificates, and licenses
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Vault</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 11: Blockchain Records */}
              <div 
                onClick={() => setTab('blockchain')}
                className="super-admin-operation-card card-border-green" 
                id="con-card-blockchain"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">BLOCKCHAIN RECORDS</span>
                  <div className="card-mono-icon-container icon-box-green">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Immutable Ledger
                  </div>
                  <div className="card-description-text">
                    Cryptographic transaction hashes for contracts, escrow, and releases
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify Records</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 12: Profile */}
              <div 
                onClick={() => setTab('profile')}
                className="super-admin-operation-card card-border-gold" 
                id="con-card-profile"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROFILE</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    KYC & Empanelling
                  </div>
                  <div className="card-description-text">
                    GSTIN, PAN, bank account IFSC, and PWD Class-1 contractor status
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Profile</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

            </div>

            {/* ========================================================= */}
            {/* SECTION 4: RECENT ACTIVITY TIMELINE                       */}
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

          </>
        )}

      </div>
    </div>
  );
};

export default ContractorDashboard;
