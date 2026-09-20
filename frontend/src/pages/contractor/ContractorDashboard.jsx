import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Layers,
  Sparkles,
  Building2
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

const ContractorDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadDashboard = () => {
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
        setActionSuccess(`Project ${projectId} accepted! Automatically divided into 3 standardized phases (30%, 40%, 30%).`);
        loadDashboard();
      }
    } catch (e) {
      setActionError(e.message || 'Failed to accept project');
    }
  };

  const metrics = data?.metrics;
  const contractor = data?.contractor_profile;
  const pendingAssignments = data?.pending_assignments || [];
  const assignedProjects = data?.assigned_projects || [];
  const recentPayments = data?.recent_payments || [];

  return (
    <div>
      {/* Institutional Hero Banner */}
      <div className="gov-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <Building2 size={13} />
              <span>Concessionaire & Enterprise Operations Hub</span>
            </div>
            <h1 className="gov-hero-title">
              {contractor?.company_name || data?.contractor_name || 'Apex Infrastructure Contractors Pvt Ltd'}
            </h1>
            <p className="gov-hero-subtitle">
              GSTIN: <strong>{contractor?.gst_number || '29AABCU9603R1ZM'}</strong> • Concessionaire ID: <strong>{data?.contractor_id || 'CON-KA-APEX'}</strong> • Public Works Contractor Portal
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link 
              to="/contractor/kyc" 
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'transparent' }}
            >
              <FileCheck size={14} />
              <span>KYC Credentials</span>
            </Link>
            <Link 
              to="/contractor/my-projects" 
              className="btn btn-sm"
              style={{ 
                backgroundColor: '#F59E0B', 
                color: '#0F172A', 
                borderColor: '#F59E0B',
                fontWeight: '800'
              }}
            >
              <Upload size={14} />
              <span>Manage 3 Phases & Evidence</span>
            </Link>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          color: 'var(--color-success)',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          fontSize: '13px'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div style={{
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          color: 'var(--color-danger)',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '600',
          fontSize: '13px'
        }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Total Contract Value"
          value={metrics?.total_contract_value || 0}
          icon={Coins}
          color="green"
          isCurrency={true}
          subtitle="Smart Contract Escrows"
        />
        <StatCard
          title="Milestone Payments Received"
          value={metrics?.total_payments_received || 0}
          icon={TrendingUp}
          color="teal"
          isCurrency={true}
          subtitle="Disbursed to Concessionaire"
        />
        <StatCard
          title="Assigned Projects"
          value={metrics?.assigned_projects_count || 0}
          icon={FolderKanban}
          color="blue"
          subtitle="Active & Pending Works"
        />
        <StatCard
          title="Statutory KYC Status"
          value={metrics?.kyc_status || 'APPROVED'}
          icon={ShieldCheck}
          color="orange"
          subtitle="PWD Class-1 Verified"
        />
      </div>

      {/* Pending Assignments Alert Box */}
      {pendingAssignments.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #EA580C', background: 'rgba(234, 88, 12, 0.03)' }}>
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
            <div className="card-title">
              <Sparkles size={18} color="#EA580C" />
              <span style={{ color: '#EA580C', fontWeight: '800' }}>
                Pending Project Assignments Awaiting Acceptance ({pendingAssignments.length})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {pendingAssignments.map((p) => (
              <div key={p.project_id} style={{
                background: '#FFFFFF',
                border: '1px solid #FED7AA',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                transition: 'all 0.15s ease'
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{p.project_id}</span> • District: <strong>{p.district_name}</strong> • Scheme: <strong>{p.scheme_name}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '15px' }}>{formatCurrency(p.total_budget)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3 Phases (30%, 40%, 30%)</div>
                  </div>

                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleQuickAccept(p.project_id)}
                  >
                    <CheckCircle2 size={13} />
                    <span>Accept Project</span>
                  </button>

                  <Link to="/contractor/my-projects" className="btn btn-secondary btn-sm">
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column: Assigned Projects & Payment History */}
      <div className="grid-2">
        {/* Left: Active Infrastructure Projects */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FolderKanban size={18} color="var(--color-primary)" />
              <span>Infrastructure Projects Directory</span>
            </div>
            <Link to="/contractor/my-projects" className="btn btn-secondary btn-sm">Manage All</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {assignedProjects.length > 0 ? (
              assignedProjects.map((p) => (
                <div key={p.project_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{p.project_id}</span> • District: {p.district_name}
                    </div>
                    <div style={{ marginTop: '5px' }}>
                      <span className={`badge ${p.status === 'COMPLETED' ? 'badge-success' : p.status === 'ASSIGNED' ? 'badge-warning' : 'badge-info'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(p.total_budget)}</div>
                    <Link to="/contractor/my-projects" className="btn btn-primary btn-sm" style={{ marginTop: '6px' }}>
                      <span>3 Phases →</span>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                No active projects assigned yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: Smart Contract Disbursals */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <CreditCard size={18} color="var(--color-primary)" />
              <span>Smart Contract Escrow Releases</span>
            </div>
            <Link to="/contractor/payments" className="btn btn-secondary btn-sm">Ledger</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentPayments.length > 0 ? (
              recentPayments.map((tx, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                      Milestone Installment Released
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Entity: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{tx.entity_id}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(tx.amount)}</div>
                    <div style={{ marginTop: '3px' }}>
                      <BlockchainBadge txHash={tx.tx_hash} blockNumber={tx.block_number} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                Milestone release records will appear here as payments are unlocked.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorDashboard;
