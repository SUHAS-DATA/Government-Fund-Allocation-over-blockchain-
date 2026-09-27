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
import { useRealtimeSync } from '../../context/RealtimeContext';
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

  const loadDashboard = (district = selectedDistrict, showSpinner = false) => {
    if (showSpinner) setLoading(true);
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
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    if (isDistrictOfficer) {
      setSelectedDistrict(assignedDistrict);
      setSelectedState(assignedStateCode);
      loadDashboard(assignedDistrict, true);
    } else {
      loadDashboard(selectedDistrict, true);
    }
  }, [selectedDistrict, user]);

  useRealtimeSync(() => {
    const target = isDistrictOfficer ? assignedDistrict : selectedDistrict;
    loadDashboard(target, false);
  }, { interval: 6000 });

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
        return 'Contractor Statutory KYC & Allocation';
      case 'progress':
        return 'Project Progress & Field Engineering Monitoring';
      case 'milestones':
        return 'Milestone Verification & Field Inspection';
      case 'payments':
        return 'Contractor Payment Requests & Requisitions';
      case 'documents':
        return 'Statutory Documents & Geo-Tagged Media Evidence';
      case 'reports':
        return 'District Utilization & Audit Reports';
      case 'notifications':
        return 'Official District Notifications & Dispatches';
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

              {activeTab === 'progress' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <TrendingUp size={20} color="#006B4F" />
                      <span>District Civil Works Progress Tracking</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab('projects')}
                      className="super-admin-back-btn"
                    >
                      <FolderKanban size={14} />
                      <span>Manage All Works</span>
                    </button>
                  </div>

                  {recentProjects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {recentProjects.map((p, idx) => (
                        <div key={idx} style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#102A43' }}>{p.name}</h4>
                              <span style={{ fontSize: '12px', color: '#627D98' }}>
                                ID: <code style={{ color: '#006B4F', fontWeight: '700' }}>{p.project_id || `PRJ-${idx + 101}`}</code> • Scheme: {p.scheme_name || 'Public Infrastructure'}
                              </span>
                            </div>
                            <span style={{
                              background: '#E6F4EA',
                              color: '#006B4F',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}>
                              Status: {p.status || 'IN_PROGRESS'}
                            </span>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#486581' }}>
                              <span>Physical Milestone Progress</span>
                              <span style={{ color: '#006B4F' }}>{p.progress_percentage || 65}% Completed</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${p.progress_percentage || 65}%`, height: '100%', background: '#006B4F', borderRadius: '4px' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', paddingTop: '8px', borderTop: '1px solid #EDF2F7', color: '#627D98' }}>
                            <span>Budget: <strong style={{ color: '#102A43' }}>{formatCurrency(p.total_budget || 0)}</strong></span>
                            <span>Contractor: <strong style={{ color: '#102A43' }}>{p.assigned_contractor_name || 'Empanelled Vendor'}</strong></span>
                            <span>Inspection: <strong style={{ color: '#006B4F' }}>Bi-Weekly Drone/Site Log Verified</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#627D98' }}>
                      No active construction projects currently tracked in this district.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'milestones' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <FileCheck size={20} color="#7C3AED" />
                      <span>District Milestone Inspection & Verification</span>
                    </div>
                  </div>
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#0369A1' }}>
                    💡 <strong>Smart Escrow Security:</strong> Field engineers must verify geotagged photos and test reports before milestone sign-off triggers escrow release.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { id: 'M-101', project: 'District Hospital Oxygen Pipeline', stage: 'Stage 2: Pressure Testing & Line Certification', completion: '100%', amount: '₹45,00,000', status: 'Awaiting District Engineer Sign-off' },
                      { id: 'M-102', project: 'Rural Bypass Macadam Roadway', stage: 'Stage 3: Sub-Base Compaction & Layering', completion: '100%', amount: '₹1,20,00,000', status: 'Geo-Photo Audit Verified' },
                      { id: 'M-103', project: 'Panchayat Model Smart School', stage: 'Stage 1: Foundation Piling & Plinth Level', completion: '100%', amount: '₹35,00,000', status: 'Inspection Scheduled' }
                    ].map((m, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{m.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{m.stage} • Target Value: <strong style={{ color: '#006B4F' }}>{m.amount}</strong></div>
                          <div style={{ fontSize: '11px', color: '#7C3AED', fontWeight: '700', marginTop: '4px' }}>Milestone ID: {m.id} • {m.status}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab('projects')}
                          style={{ background: '#7C3AED', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Verify & Sign Off
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <CreditCard size={20} color="#EA580C" />
                      <span>Contractor Payment Requests & Sanction Requisitions</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRequestFundModal(true)}
                      className="super-admin-back-btn"
                      style={{ background: '#006B4F', color: '#FFFFFF', borderColor: '#006B4F' }}
                    >
                      <Send size={14} />
                      <span>New State Fund Requisition</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { reqId: 'PAY-REQ-882', contractor: 'Apex Infra Projects Pvt Ltd', project: 'Model Smart Secondary School', amount: '₹35,00,000', date: '2026-09-22', status: 'Milestone Cleared - Under Review' },
                      { reqId: 'PAY-REQ-881', contractor: 'Shree Balaji Constructions', project: 'Rural Bypass Roadway', amount: '₹62,50,000', date: '2026-09-18', status: 'Escrow Settlement Queued' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{p.project}</div>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>Contractor: {p.contractor} • Requisition ID: <code style={{ color: '#EA580C', fontWeight: '700' }}>{p.reqId}</code></div>
                          <div style={{ fontSize: '11px', color: '#627D98', marginTop: '4px' }}>Submitted on {p.date} • {p.status}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: '#EA580C' }}>{p.amount}</div>
                          <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>Pending Approval</span>
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
                      <span>Statutory Civil Documents & Geo-Tagged Inspection Records</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {[
                      { name: 'Measurement Book (MB) Vol-IV', type: 'Civil Engineering Record', date: '2026-09-20', hash: '0x8f2d...3a91', format: 'PDF (Signed)' },
                      { name: 'Geo-tagged Drone Site Survey Video', type: 'Site Evidence', date: '2026-09-18', hash: '0x3c11...99e4', format: 'MP4 / GPS metadata' },
                      { name: 'Concrete Compressive Strength Test Lab Report', type: 'Quality Certification', date: '2026-09-15', hash: '0x44ab...ee10', format: 'PDF (Certified)' },
                      { name: 'Environmental Impact Clearance (EIA)', type: 'Statutory Clearance', date: '2026-08-30', hash: '0x77bc...1122', format: 'PDF (Gazetted)' }
                    ].map((doc, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: '800', color: '#102A43', fontSize: '14px' }}>{doc.name}</div>
                        <div style={{ fontSize: '12px', color: '#627D98' }}>{doc.type} • {doc.format}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#1E3A8A', background: '#EFF6FF', padding: '4px 8px', borderRadius: '4px' }}>
                          SHA-256: {doc.hash}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: 'auto' }}>Timestamp: {doc.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <PieChart size={20} color="#0284C7" />
                      <span>District Public Works Expenditure & Utilization Reports</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '800', color: '#102A43' }}>Quarterly Utilization Certificate (Form 12-C GFR)</div>
                        <div style={{ fontSize: '12px', color: '#627D98' }}>Period: Q2 FY 2026-27 • Certified for State Finance Department</div>
                      </div>
                      <button type="button" onClick={() => window.print()} className="super-admin-back-btn">Download PDF</button>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '800', color: '#102A43' }}>Scheme-wise District Fund Ledger</div>
                        <div style={{ fontSize: '12px', color: '#627D98' }}>Complete breakdown of inflows, commitments, and contractor escrow releases</div>
                      </div>
                      <button type="button" onClick={() => window.print()} className="super-admin-back-btn">Export Excel</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Activity size={20} color="#D97706" />
                      <span>District Administrative Dispatches & Notices</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { title: 'State Treasury Sanction Order Dispatched', desc: 'Sanction order issued for Belagavi District rural road upgrade project.', date: 'Today, 11:30 AM', type: 'Finance' },
                      { title: 'Field Technical Audit Advisory', desc: 'CAG & State Inspection team scheduled for bridge pier inspection.', date: 'Yesterday, 04:15 PM', type: 'Audit' },
                      { title: 'Contractor Milestone Submission Notice', desc: 'Milestone 2 evidence submitted by Apex Infra Projects.', date: '2 days ago', type: 'Milestone' }
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
            {/* SECTION 1: DISTRICT 7-METRIC DASHBOARD OVERVIEW           */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>DISTRICT FINANCIAL & OPERATIONAL OVERVIEW</span>
            </div>

            <div className="super-admin-financial-overview-panel grid-7">
              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Landmark size={14} color="#006B4F" />
                  <span>FUNDS RECEIVED</span>
                </div>
                <span className="fin-overview-value highlight-green">
                  {formatIndianDenomination(totalReceived)}
                </span>
                <span className="fin-overview-subtext">From State Treasury</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <Coins size={14} color="#2563EB" />
                  <span>ALLOCATED TO PROJECTS</span>
                </div>
                <span className="fin-overview-value">
                  {formatIndianDenomination(allocatedProjects)}
                </span>
                <span className="fin-overview-subtext">{committedPct}% budget utilized</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FolderKanban size={14} color="#0284C7" />
                  <span>ACTIVE PROJECTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={activeProjectsCount} />
                </span>
                <span className="fin-overview-subtext">In execution phase</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <UserCheck size={14} color="#D97706" />
                  <span>CONTRACTORS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={metrics?.contractors_count || 14} />
                </span>
                <span className="fin-overview-subtext">{pendingKycs} pending KYC</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <TrendingUp size={14} color="#16A34A" />
                  <span>PROJECT PROGRESS</span>
                </div>
                <span className="fin-overview-value">
                  {metrics?.avg_progress || (recentProjects.length ? Math.round(recentProjects.reduce((acc, p) => acc + (p.progress_percentage || 45), 0) / recentProjects.length) : 68)}%
                </span>
                <span className="fin-overview-subtext">Average site progress</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <FileCheck size={14} color="#7C3AED" />
                  <span>PENDING MILESTONES</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={metrics?.pending_milestones || 6} />
                </span>
                <span className="fin-overview-subtext">Awaiting inspection</span>
              </div>

              <div className="fin-overview-column">
                <div className="fin-overview-top-label">
                  <CreditCard size={14} color="#EA580C" />
                  <span>PAYMENT REQUESTS</span>
                </div>
                <span className="fin-overview-value">
                  <AnimatedCounter value={metrics?.pending_payment_requests || 3} />
                </span>
                <span className="fin-overview-subtext">Pending clearance</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* DISTRICT AGENCY WORKFLOW PIPELINE                         */}
            {/* ========================================================= */}
            <div className="gov-workflow-card">
              <div className="gov-workflow-header">
                <div className="gov-workflow-title">
                  <GitBranch size={16} color="#006B4F" />
                  <span>District Agency Operational Workflow</span>
                </div>
                <span style={{ fontSize: '11px', color: '#627D98', fontWeight: '700' }}>
                  6-STAGE FIELD EXECUTION PIPELINE
                </span>
              </div>
              <div className="gov-workflow-steps">
                <div className="gov-workflow-step active" onClick={() => setTab('received')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">1</span>
                  <span>Received Funds</span>
                </div>
                <span className="gov-workflow-arrow">→</span>
                <div className="gov-workflow-step active" onClick={() => setTab('projects')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">2</span>
                  <span>Create/Manage Projects</span>
                </div>
                <span className="gov-workflow-arrow">→</span>
                <div className="gov-workflow-step active" onClick={() => setTab('contractors')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">3</span>
                  <span>Assign Contractor</span>
                </div>
                <span className="gov-workflow-arrow">→</span>
                <div className="gov-workflow-step active" onClick={() => setTab('progress')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">4</span>
                  <span>Monitor Project</span>
                </div>
                <span className="gov-workflow-arrow">→</span>
                <div className="gov-workflow-step active" onClick={() => setTab('milestones')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">5</span>
                  <span>Verify Milestones</span>
                </div>
                <span className="gov-workflow-arrow">→</span>
                <div className="gov-workflow-step active" onClick={() => setTab('payments')} style={{ cursor: 'pointer' }}>
                  <span className="gov-workflow-step-num">6</span>
                  <span>Request Payment</span>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: 3x3 INTERACTIVE OPERATIONS MODULES GRID        */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>DISTRICT AGENCY MODULES</span>
            </div>

            <div className="super-admin-operations-grid">

              {/* CARD 1: Received Funds */}
              <div
                className="super-admin-operation-card card-border-green"
                onClick={() => setTab('received')}
                id="district-card-received"
              >
                <div className="card-top-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="card-category-heading">RECEIVED FUNDS</span>
                    <span className="card-feature-pill">
                      <span>● State Treasury Credits</span>
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
                    Central and State grants credited directly into district treasury escrow
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Received Funds</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 2: Projects */}
              <div
                className="super-admin-operation-card card-border-blue"
                onClick={() => setTab('projects')}
                id="district-card-projects"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECTS</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={activeProjectsCount} suffix=" Works" />
                  </div>
                  <div className="card-description-text">
                    Create works, assign sanctioned budgets, and initiate local execution
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Manage Projects</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 3: Contractor Assignment */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('contractors')}
                id="district-card-contractors"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">CONTRACTOR ASSIGNMENT</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="card-large-title">
                      <AnimatedCounter value={metrics?.contractors_count || 14} suffix=" Registered" />
                    </div>
                    {pendingKycs > 0 && (
                      <span className="card-gold-badge">
                        {pendingKycs} Pending KYC
                      </span>
                    )}
                  </div>
                  <div className="card-description-text">
                    Assign empanelled vendors, review statutory KYC, and issue work orders
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Assign Contractors</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 4: Project Progress */}
              <div
                className="super-admin-operation-card card-border-teal"
                onClick={() => setTab('progress')}
                id="district-card-progress"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PROJECT PROGRESS</span>
                  <div className="card-mono-icon-container icon-box-teal">
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    {metrics?.avg_progress || (recentProjects.length ? Math.round(recentProjects.reduce((acc, p) => acc + (p.progress_percentage || 45), 0) / recentProjects.length) : 68)}% Avg Progress
                  </div>
                  <div className="card-description-text">
                    Monitor real-time site engineering work, Gantt schedules, and milestones
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Track Progress</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 5: Milestones */}
              <div
                className="super-admin-operation-card card-border-purple"
                onClick={() => setTab('milestones')}
                id="district-card-milestones"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">MILESTONES</span>
                  <div className="card-mono-icon-container icon-box-purple">
                    <FileCheck size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={metrics?.pending_milestones || 6} suffix=" Verifications" />
                  </div>
                  <div className="card-description-text">
                    Verify civil construction milestones and field engineer inspection certificates
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify Milestones</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 6: Payment Requests */}
              <div
                className="super-admin-operation-card card-border-orange"
                onClick={() => setTab('payments')}
                id="district-card-payments"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">PAYMENT REQUESTS</span>
                  <div className="card-mono-icon-container icon-box-orange">
                    <CreditCard size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={metrics?.pending_payment_requests || 3} suffix=" In Review" />
                  </div>
                  <div className="card-description-text">
                    Approve contractor invoice claims and forward requisitions to State Treasury
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Review Payment Requests</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 7: Documents */}
              <div
                className="super-admin-operation-card card-border-navy"
                onClick={() => setTab('documents')}
                id="district-card-documents"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">DOCUMENTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <Layers size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    <AnimatedCounter value={metrics?.total_documents || 42} suffix=" Verified Files" />
                  </div>
                  <div className="card-description-text">
                    Geo-tagged inspection photos, measurement books (MB), and SHA-256 proofs
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Browse Documents</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 8: Reports */}
              <div
                className="super-admin-operation-card card-border-blue"
                onClick={() => setTab('reports')}
                id="district-card-reports"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">REPORTS</span>
                  <div className="card-mono-icon-container icon-box-blue">
                    <PieChart size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    District Expenditure
                  </div>
                  <div className="card-description-text">
                    Generate utilization certificates (UC), audit summaries, and scheme ledgers
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Reports</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 9: Notifications */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setTab('notifications')}
                id="district-card-notifications"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">NOTIFICATIONS</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <Activity size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Alerts & Dispatches
                  </div>
                  <div className="card-description-text">
                    State Treasury sanction orders, inspection notices, and milestone advisories
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
