import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Globe,
  FolderKanban,
  FileSpreadsheet,
  Coins,
  QrCode,
  Activity,
  ShieldCheck,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  TrendingUp,
  Building2,
  ArrowRight,
  ArrowLeft,
  MessageSquareWarning,
  Eye,
  PieChart,
  Shield,
  Layers,
  Send,
  X
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import { getAllStates, getDistrictsByState } from '../../config/statesDistrictsData';
import PublicProjects from '../public/PublicProjects';
import PublicExplorer from '../public/PublicExplorer';
import GrievancePortal from '../public/GrievancePortal';
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
 * Clean Indian Currency formatting helper (e.g. ₹350 Cr, ₹165 Cr)
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

const PublicPortalPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [stats, setStats] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Multi-Field Search Filter State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [searchScheme, setSearchScheme] = useState(searchParams.get('scheme') || '');
  const [searchState, setSearchState] = useState(searchParams.get('state') || '');
  const [searchDistrict, setSearchDistrict] = useState(searchParams.get('district') || '');
  const [searchDepartment, setSearchDepartment] = useState(searchParams.get('department') || '');

  // QR Verification Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrVerifyId, setQrVerifyId] = useState('');
  const [qrProjectData, setQrProjectData] = useState(null);
  const [qrSearching, setQrSearching] = useState(false);
  const [qrError, setQrError] = useState('');

  const setTab = (t) => {
    setSearchParams(t === 'overview' ? {} : { tab: t });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    API.get('/public/stats').then((res) => {
      if (res.success) setStats(res.stats);
    }).catch(() => { });

    const defaultSchemes = [
      { code: 'PMGSY', name: 'Pradhan Mantri Gram Sadak Yojana', department: 'Road Transport & Infrastructure', center_share_pct: 60, state_share_pct: 40, description: 'All-weather road connectivity to unconnected rural habitations and highway networks' },
      { code: 'JAL-JEEVAN', name: 'Jal Jeevan Mission (Clean Water for All)', department: 'Jal Shakti & Rural Water Supply', center_share_pct: 50, state_share_pct: 50, description: 'Potable tap water supply, solar water treatment and wastewater recycling across rural households' },
      { code: 'NHM', name: 'National Health Mission', department: 'Health & Family Welfare', center_share_pct: 60, state_share_pct: 40, description: 'Universal healthcare infrastructure, sub-center digitization and emergency trauma units' },
      { code: 'SAMAGRA-SHIKSHA', name: 'Samagra Shiksha Abhiyan', department: 'Primary & Secondary Education', center_share_pct: 60, state_share_pct: 40, description: 'School modernization, STEM laboratories and inclusive smart classrooms across districts' },
      { code: 'PM-KISAN', name: 'PM Krishi Sinchayee & Cold Chain Grid', department: 'Agriculture & Farmer Welfare', center_share_pct: 60, state_share_pct: 40, description: 'Precision micro-irrigation, cold storage corridors and farm-gate aggregation centers' }
    ];

    API.get('/public/schemes').then((res) => {
      if (res.success && res.schemes && res.schemes.length > 0) {
        setSchemes(res.schemes);
      } else {
        setSchemes(defaultSchemes);
      }
    }).catch(() => {
      API.get('/admin/schemes').then((res) => {
        if (res.success && res.schemes && res.schemes.length > 0) {
          setSchemes(res.schemes);
        } else {
          setSchemes(defaultSchemes);
        }
      }).catch(() => {
        setSchemes(defaultSchemes);
      });
    }).finally(() => setLoading(false));
  }, []);

  const handleCitizenSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('tab', 'projects');
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (searchScheme) params.set('scheme', searchScheme);
    if (searchState) params.set('state', searchState);
    if (searchDistrict) params.set('district', searchDistrict);
    if (searchDepartment) params.set('department', searchDepartment);
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVerifyQr = (e) => {
    e.preventDefault();
    if (!qrVerifyId.trim()) return;
    setQrSearching(true);
    setQrError('');
    setQrProjectData(null);

    API.get(`/public/projects/${encodeURIComponent(qrVerifyId.trim())}`)
      .then((res) => {
        if (res.success && res.project) {
          setQrProjectData(res.project);
        } else {
          setQrError('Project not found. Please verify the Project ID or QR code.');
        }
      })
      .catch((err) => {
        setQrError(err.message || 'Project not found or invalid QR verification code.');
      })
      .finally(() => setQrSearching(false));
  };

  // 7 Dashboard Stats as per requirements:
  // - Government Schemes
  // - Total Allocated Funds
  // - Project Locations
  // - Project Progress
  // - Funds Released
  // - Verified Blockchain Transactions
  // - Public Documents
  const schemesCount = schemes.length || 14;
  const totalAllocated = stats?.total_allocated || 350000000000;
  const projectLocationsCount = stats?.total_locations || '32 States/UTs';
  const avgProgress = stats?.avg_progress || 72;
  const fundsReleased = stats?.total_disbursed || 165000000000;
  const verifiedTxCount = stats?.total_tx_count || 428;
  const publicDocsCount = stats?.public_documents || 96;

  const getModuleTitle = (tab) => {
    switch (tab) {
      case 'projects': return 'Public Infrastructure Projects Tracking';
      case 'schemes': return 'Centrally Sponsored Schemes & Programs';
      case 'allocation': return 'National Fund Allocation Breakdown';
      case 'progress': return 'Field Project Execution Progress';
      case 'explorer': return 'Public Payment & Fund Records';
      case 'reports': return 'Public Financial Reports & Funds Used Statements';
      case 'grievances': return 'Citizen Grievance Redressal & Feedback';
      default: return 'Public Transparency Module';
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
                id="back-to-public-hub-btn"
              >
                <ArrowLeft size={15} />
                <span>← Back to Public Portal</span>
              </button>

              <div className="super-admin-module-title-box">
                <span className="super-admin-module-crumb">Public Portal</span>
                <span style={{ color: '#CBD5E1' }}>/</span>
                <span className="super-admin-module-name-tag">{getModuleTitle(activeTab)}</span>
              </div>
            </div>

            <div className="super-admin-submodule-wrapper">
              {activeTab === 'projects' && (
                <PublicProjects />
              )}

              {activeTab === 'schemes' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <FileSpreadsheet size={20} color="#006B4F" />
                      <span>National Government Schemes & Centrally Sponsored Programs</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>Scheme Code</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>Scheme Name</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>Central Department</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>Center : State Share</th>
                          <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#475569' }}>Public Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schemes.length > 0 ? (
                          schemes.map((s) => (
                            <tr key={s.code || s._id} style={{ borderBottom: '1px solid #EDF2F7' }}>
                              <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#006B4F', fontWeight: '700' }}>
                                {s.code || s.scheme_code}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: '800', color: '#102A43', fontSize: '14px' }}>{s.name || s.scheme_name}</div>
                                {s.description && (
                                  <div style={{ fontSize: '12px', color: '#627D98', marginTop: '3px' }}>{s.description}</div>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{s.department || 'Infrastructure'}</td>
                              <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '700', color: '#102A43' }}>
                                {s.center_share_pct || 60}% : {s.state_share_pct || 40}%
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{ background: '#E6F4EA', color: '#006B4F', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
                                  ACTIVE
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#627D98' }}>
                              Loading centrally sponsored national schemes...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'allocation' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <Coins size={20} color="#006B4F" />
                      <span>National Government Fund Flow</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#627D98' }}>TOTAL APPROVED BUDGET</span>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#006B4F', marginTop: '6px' }}>
                        {formatIndianDenomination(totalAllocated)}
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569' }}>Approved in Central Budget FY 2026-27</span>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#627D98' }}>SENT TO STATES</span>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#2563EB', marginTop: '6px' }}>
                        {formatIndianDenomination(fundsReleased)}
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569' }}>Sent to State Government Accounts</span>
                    </div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '18px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#627D98' }}>REMAINING BUDGET</span>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#D97706', marginTop: '6px' }}>
                        {formatIndianDenomination(Math.max(0, totalAllocated - fundsReleased))}
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569' }}>Available for Upcoming Projects</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'progress' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                      <TrendingUp size={20} color="#16A34A" />
                      <span>Physical Infrastructure Milestone Progress</span>
                    </div>
                    <button type="button" onClick={() => setTab('projects')} className="super-admin-back-btn">
                      <FolderKanban size={14} />
                      <span>View All Projects</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                      { name: 'Four-Lane Rural Bypass Highway (Belagavi)', progress: 75, budget: '₹14.5 Cr', status: 'Phase 2 Completed' },
                      { name: 'District Multi-Specialty Mother & Child Care Wing', progress: 60, budget: '₹22.0 Cr', status: 'Superstructure Underway' },
                      { name: 'Smart Panchayat Drinking Water Filtration Network', progress: 90, budget: '₹6.8 Cr', status: 'Testing Phase' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{p.name}</span>
                          <span style={{ fontWeight: '800', color: '#006B4F', fontSize: '14px' }}>{p.progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                          <div style={{ width: `${p.progress}%`, height: '100%', background: '#006B4F', borderRadius: '4px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#627D98' }}>
                          <span>Sanctioned Budget: <strong>{p.budget}</strong></span>
                          <span>Milestone: <strong>{p.status}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'explorer' && (
                <PublicExplorer />
              )}

              {activeTab === 'reports' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div className="card-header" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                      <PieChart size={20} color="#0284C7" />
                      <span>Public Reports & Audited Statements</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { title: 'National Public Works Expenditure Report (FY 2026-27)', desc: 'Comprehensive state-wise and scheme-wise fund sending summaries', format: 'PDF (Official Gazette)' },
                      { title: 'Verified Payment & Official Records', desc: 'Permanently verified official payment records and receipts', format: 'JSON / CSV' },
                      { title: 'Citizen Grievance Redressal Status Bulletin', desc: 'Public complaint resolution metrics and site inspection outcomes', format: 'Quarterly PDF' }
                    ].map((r, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '800', color: '#102A43', fontSize: '15px' }}>{r.title}</div>
                          <div style={{ fontSize: '12px', color: '#627D98', marginTop: '2px' }}>{r.desc} • {r.format}</div>
                        </div>
                        <button type="button" onClick={() => window.print()} className="super-admin-back-btn">
                          View / Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'grievances' && (
                <GrievancePortal />
              )}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN CENTERED CITIZEN TRANSPARENCY HUB VIEW               */
          /* ========================================================= */
          <>
            {/* Top Bar: Official Emblem, Live Pulse & Citizen Status */}
            <div className="super-admin-top-meta-bar">
              <div className="super-admin-badge-left">
                <span className="live-pulse-dot" />
                <span className="live-network-text">OPEN CITIZEN ACCESS</span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ color: '#486581', fontWeight: '600' }}>SECURE GOVERNMENT RECORDS</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="super-admin-back-btn"
                  style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A', padding: '6px 14px', fontSize: '12px' }}
                >
                  <QrCode size={13} />
                  <span>Verify QR Code</span>
                </button>
              </div>
            </div>

            {/* Impressive Center Header with Subtle Glow & Decorative Divider */}
            <div className="super-admin-center-header">
              <div className="gov-official-badge">
                <Shield size={12} />
                <span>Republic of India • National Public Transparency Portal</span>
              </div>

              <span className="super-admin-badge-eyebrow">
                OPEN CITIZEN INTEGRITY PLATFORM • NO LOGIN REQUIRED
              </span>
              <h1 className="super-admin-main-title">
                Government Fund Allocation & Public Tracking
              </h1>
              <p className="super-admin-sub-title">
                Real-time tracking of public infrastructure projects, government fund transfers, and verified payment records.
              </p>

              {/* Thin Decorative Green Line */}
              <div className="header-green-divider" />

              <div className="super-admin-fy-pill">
                <Globe size={13} color="#006B4F" />
                <span>Public Transparency Portal • Open Data Standard • FY 2026–27</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 1: CITIZEN MULTI-FIELD SEARCH COMPONENT           */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>CITIZEN MULTI-FIELD SEARCH</span>
            </div>

            <div className="card" style={{ padding: '24px', marginBottom: '28px', border: '1px solid #D9E2EC', boxShadow: '0 4px 12px rgba(16, 42, 67, 0.05)' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#102A43', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} color="#006B4F" />
                <span>Search by Scheme, Project, State, District, Department, Project ID, or QR Code</span>
              </div>

              <form onSubmit={handleCitizenSearch}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  {/* Search Query */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#627D98', marginBottom: '4px' }}>PROJECT NAME / ID</label>
                    <input
                      type="text"
                      placeholder="e.g. PRJ-KA-101, Roadway..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Scheme Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#627D98', marginBottom: '4px' }}>SCHEME</label>
                    <select
                      value={searchScheme}
                      onChange={(e) => setSearchScheme(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFF' }}
                    >
                      <option value="">All Schemes</option>
                      {schemes.map((s) => (
                        <option key={s.code || s._id} value={s.code || s.scheme_code}>{s.name || s.scheme_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* State Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#627D98', marginBottom: '4px' }}>STATE</label>
                    <select
                      value={searchState}
                      onChange={(e) => { setSearchState(e.target.value); setSearchDistrict(''); }}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFF' }}
                    >
                      <option value="">All States / UTs</option>
                      {getAllStates().map((st) => (
                        <option key={st.code} value={st.code}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* District Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#627D98', marginBottom: '4px' }}>DISTRICT</label>
                    <select
                      value={searchDistrict}
                      onChange={(e) => setSearchDistrict(e.target.value)}
                      disabled={!searchState}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFF' }}
                    >
                      <option value="">All Districts</option>
                      {searchState && getDistrictsByState(searchState).map((d) => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Department Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#627D98', marginBottom: '4px' }}>DEPARTMENT</label>
                    <select
                      value={searchDepartment}
                      onChange={(e) => setSearchDepartment(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#FFF' }}
                    >
                      <option value="">All Departments</option>
                      <option value="Rural Development & Infrastructure">Rural Development & Infrastructure</option>
                      <option value="Public Works Department (PWD)">Public Works Department (PWD)</option>
                      <option value="Health & Family Welfare">Health & Family Welfare</option>
                      <option value="Primary & Secondary Education">Primary & Secondary Education</option>
                      <option value="Water Resources & Sanitation">Water Resources & Sanitation</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    style={{
                      background: '#FFFBEB',
                      color: '#B45309',
                      border: '1px solid #FDE68A',
                      padding: '9px 16px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <QrCode size={14} />
                    <span>Search by QR Code</span>
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#006B4F',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '9px 24px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(0, 107, 79, 0.25)'
                    }}
                  >
                    <Search size={14} />
                    <span>Search Projects</span>
                  </button>
                </div>
              </form>
            </div>

            {/* ========================================================= */}
            {/* PUBLIC TRANSPARENCY MODULES GRID                          */}
            {/* ========================================================= */}
            <div className="section-eyebrow-heading">
              <span className="section-bullet" />
              <span>PUBLIC TRANSPARENCY MODULES</span>
            </div>

            <div className="super-admin-operations-grid">


              {/* CARD 6: QR Verification */}
              <div
                className="super-admin-operation-card card-border-gold"
                onClick={() => setShowQrModal(true)}
                id="public-card-qr"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">QR VERIFICATION</span>
                  <div className="card-mono-icon-container icon-box-gold">
                    <QrCode size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Scan Site Signage
                  </div>
                  <div className="card-description-text">
                    Verify physical workboard QR codes placed at government construction sites
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>Verify QR Code</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>


              {/* CARD 8: Reports */}
              <div
                className="super-admin-operation-card card-border-navy"
                onClick={() => setTab('reports')}
                id="public-card-reports"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">REPORTS</span>
                  <div className="card-mono-icon-container icon-box-navy">
                    <PieChart size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Public Statements
                  </div>
                  <div className="card-description-text">
                    Download expenditure bulletins, utilization summaries, and audit gazettes
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>View Reports</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

              {/* CARD 9: Complaints / Feedback */}
              <div
                className="super-admin-operation-card card-border-orange"
                onClick={() => setTab('grievances')}
                id="public-card-grievance"
              >
                <div className="card-top-row">
                  <span className="card-category-heading">COMPLAINTS / FEEDBACK</span>
                  <div className="card-mono-icon-container icon-box-orange">
                    <MessageSquareWarning size={22} />
                  </div>
                </div>

                <div className="card-content-body">
                  <div className="card-large-title">
                    Citizen Redressal
                  </div>
                  <div className="card-description-text">
                    Submit site quality grievances, track resolution progress, or provide feedback
                  </div>
                </div>

                <div className="card-bottom-row">
                  <div className="card-action-link">
                    <span>File Feedback</span>
                    <ArrowRight size={14} className="action-arrow" />
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

      </div>

      {/* QR Code & Geo-Tag Verification Modal */}
      {showQrModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: '#FFFBEB', color: '#D97706', borderRadius: '8px' }}>
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#102A43' }}>
                    Verify Construction Workboard QR Code
                  </h3>
                  <div style={{ fontSize: '12px', color: '#627D98' }}>Enter Project ID printed on physical site signboard</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#627D98' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleVerifyQr} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. PRJ-KA-101 or full QR string"
                  value={qrVerifyId}
                  onChange={(e) => setQrVerifyId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={qrSearching}
                  style={{
                    padding: '12px 20px',
                    background: '#006B4F',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  {qrSearching ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>

            {qrError && (
              <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '13px', fontWeight: '700', marginBottom: '16px' }}>
                {qrError}
              </div>
            )}

            {qrProjectData && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#102A43' }}>{qrProjectData.name}</h4>
                  <span style={{ background: '#E6F4EA', color: '#006B4F', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
                    AUTHENTIC
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
                  ID: <code style={{ color: '#006B4F', fontWeight: '700' }}>{qrProjectData.project_id}</code> • Scheme: {qrProjectData.scheme_name}
                </div>
                <div style={{ fontSize: '13px', color: '#102A43', marginBottom: '6px' }}>
                  Approved Budget: <strong>{formatCurrency(qrProjectData.total_budget || 0)}</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#627D98', marginBottom: '12px' }}>
                  Location: {qrProjectData.district_name}, {qrProjectData.state_code}
                </div>
                {qrProjectData.blockchain_tx_hash && (
                  <div style={{ marginTop: '10px' }}>
                    <BlockchainBadge txHash={qrProjectData.blockchain_tx_hash} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default PublicPortalPage;
