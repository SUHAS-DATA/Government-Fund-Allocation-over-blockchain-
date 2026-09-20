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
  MapPin, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  TrendingUp,
  Building2,
  ArrowRight,
  MessageSquareWarning,
  Eye
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import PublicProjects from '../public/PublicProjects';
import PublicExplorer from '../public/PublicExplorer';
import GrievancePortal from '../public/GrievancePortal';
import PortalNavHeader from '../../components/PortalNavHeader';

const PublicPortalPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'projects';

  const [stats, setStats] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  // QR Verification Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrVerifyId, setQrVerifyId] = useState('');
  const [qrProjectData, setQrProjectData] = useState(null);
  const [qrSearching, setQrSearching] = useState(false);
  const [qrError, setQrError] = useState('');

  const setTab = (t) => {
    setSearchParams({ tab: t });
  };

  useEffect(() => {
    API.get('/public/stats').then((res) => {
      if (res.success) setStats(res.stats);
    }).catch(() => {});

    API.get('/public/schemes').then((res) => {
      if (res.success && res.schemes) setSchemes(res.schemes);
    }).catch(() => {
      API.get('/admin/schemes').then((res) => {
        if (res.success && res.schemes) setSchemes(res.schemes);
      }).catch(() => {});
    }).finally(() => setLoading(false));
  }, []);

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

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Shared Portal Navigation Header with Back to Portals & Switcher */}
      <PortalNavHeader currentPortal="public" />
      
      {/* Official Government Public Portal Banner */}
      <div className="gov-hero-banner" style={{ marginBottom: '24px', padding: '36px 36px 30px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <Globe size={13} />
              <span>Public Transparency Portal • Open Citizen Access • No Login Required</span>
            </div>
            <h1 className="gov-hero-title">
              National Public Fund & Project Transparency Ledger
            </h1>
            <p className="gov-hero-subtitle">
              Real-time public tracking of Indian government infrastructure projects, multi-tier public treasury transfers, QR site inspection proofs, and cryptographic Ethereum ledger verification.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="btn btn-sm"
              style={{
                backgroundColor: '#F59E0B',
                color: '#0F172A',
                borderColor: '#F59E0B',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <QrCode size={14} />
              <span>Verify Project QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('explorer')}
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: 'transparent', fontWeight: '700' }}
            >
              <Activity size={14} />
              <span>Live Blockchain Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Public High-Level Metrics */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Total Sanctioned Ceiling"
          value={stats?.total_allocated || 350000000000}
          icon={Coins}
          color="green"
          isCurrency={true}
          subtitle="Union Budget Ceiling"
        />
        <StatCard
          title="State Disbursals"
          value={stats?.total_disbursed || 165000000000}
          icon={TrendingUp}
          color="blue"
          isCurrency={true}
          subtitle="On-Chain State Releases"
        />
        <StatCard
          title="Public Monitored Works"
          value={stats?.total_projects || 24}
          icon={FolderKanban}
          color="teal"
          subtitle="Geo-Tagged Development Sites"
        />
        <StatCard
          title="Cryptographic Proofs"
          value={stats?.verified_milestones || 15}
          icon={ShieldCheck}
          color="orange"
          subtitle="SHA-256 Document Hashes"
        />
      </div>

      {/* Public Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          type="button"
          onClick={() => setTab('projects')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'projects' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'projects' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'projects' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FolderKanban size={16} />
          <span>Project Tracking</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('schemes')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'schemes' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'schemes' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'schemes' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={16} />
          <span>Scheme Tracking</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('explorer')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'explorer' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'explorer' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'explorer' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Activity size={16} />
          <span>Blockchain Fund Tracking</span>
        </button>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: '3px solid transparent',
            background: 'none',
            color: 'var(--text-secondary)',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <QrCode size={16} />
          <span>QR & Geo Verification</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('grievances')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'grievances' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'grievances' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'grievances' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquareWarning size={16} />
          <span>Citizen Reports & Grievances</span>
        </button>
      </div>

      {/* TAB 1: Project Tracking */}
      {activeTab === 'projects' && (
        <PublicProjects />
      )}

      {/* TAB 2: Scheme Tracking */}
      {activeTab === 'schemes' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileSpreadsheet size={18} color="var(--color-primary)" />
              <span>National Schemes & Centrally Sponsored Programs</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Scheme Code</th>
                  <th>Scheme Name</th>
                  <th>Central Ministry / Department</th>
                  <th>Budget Share (Central:State)</th>
                  <th>Public Status</th>
                </tr>
              </thead>
              <tbody>
                {schemes.length > 0 ? (
                  schemes.map((s) => (
                    <tr key={s.code || s._id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                          {s.code || s.scheme_code}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{s.name || s.scheme_name}</strong>
                        {s.description && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {s.department}
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: '700' }}>
                        {s.center_share_pct || 60}% : {s.state_share_pct || 40}%
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>
                          ACTIVE SCHEME
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      Loading national schemes...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Blockchain Fund Tracking */}
      {activeTab === 'explorer' && (
        <PublicExplorer />
      )}

      {/* TAB 4: Citizen Grievances */}
      {activeTab === 'grievances' && (
        <GrievancePortal />
      )}

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
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={22} color="var(--color-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  Public QR & Milestone Verification
                </h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Every public works site features an official Government QR Board. Enter the Project ID or scan code below to inspect real-time progress, contractor information, and on-chain verified photos.
            </p>

            <form onSubmit={handleVerifyQr} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Project ID (e.g. PRJ-BEL-001)"
                value={qrVerifyId}
                onChange={(e) => setQrVerifyId(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={qrSearching}
                style={{ whiteSpace: 'nowrap' }}
              >
                {qrSearching ? 'Verifying...' : 'Verify on Ledger'}
              </button>
            </form>

            {qrError && (
              <div style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: 'var(--color-danger)',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{qrError}</span>
              </div>
            )}

            {qrProjectData && (
              <div style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                      {qrProjectData.name}
                    </h4>
                    <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: '700', marginTop: '2px' }}>
                      ID: {qrProjectData.project_id}
                    </div>
                  </div>
                  <span className="badge badge-success">
                    {qrProjectData.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Location: </span>
                    <strong>{qrProjectData.district_name}, {qrProjectData.state_code}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Sanctioned Budget: </span>
                    <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(qrProjectData.total_budget)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Scheme: </span>
                    <strong>{qrProjectData.scheme_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Department: </span>
                    <strong>{qrProjectData.department}</strong>
                  </div>
                </div>

                {qrProjectData.blockchain_tx_hash && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Smart Contract Escrow Tx Hash:
                    </span>
                    <BlockchainBadge txHash={qrProjectData.blockchain_tx_hash} />
                  </div>
                )}

                <div style={{ marginTop: '8px' }}>
                  <Link
                    to={`/public/projects/${qrProjectData.project_id}`}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setShowQrModal(false)}
                  >
                    <span>View Complete Public Milestone Breakdown & Photos</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicPortalPage;
