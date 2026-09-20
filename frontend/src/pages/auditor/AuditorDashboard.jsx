import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Lock, 
  FileSearch, 
  FileText, 
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  History,
  FileCheck
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import AnomalyAlertCard from '../../components/AnomalyAlertCard';
import BlockchainBadge from '../../components/BlockchainBadge';

// Sub-components for auditor tabs
import AuditExplorer from './AuditExplorer';
import DocumentAudit from './DocumentAudit';
import AnomalyAnalytics from './AnomalyAnalytics';
import FraudFreeze from './FraudFreeze';
import SubmitAuditReport from './SubmitAuditReport';

const AuditorDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const setTab = (t) => {
    setSearchParams({ tab: t });
  };

  useEffect(() => {
    API.get('/auditor/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics;

  return (
    <div>
      {/* Institutional Hero Banner */}
      <div className="gov-hero-banner" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <ShieldAlert size={13} />
              <span>Comptroller & Auditor General of India • Forensic Cell</span>
            </div>
            <h1 className="gov-hero-title">
              Forensic CAG Audit & Oversight Dashboard
            </h1>
            <p className="gov-hero-subtitle">
              Cryptographic SHA-256 document hashing, real-time AI anomaly detection, statutory audit verdicts, and emergency smart contract fund freeze authority.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => setTab('freeze')}
              className="btn btn-danger btn-sm"
              style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={14} />
              <span>Emergency Fund Freeze</span>
            </button>
            <button 
              type="button"
              onClick={() => setTab('report')}
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
              <FileText size={14} />
              <span>Submit CAG Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auditor Module Navigation Tabs */}
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
          onClick={() => setTab('overview')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'overview' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'overview' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldAlert size={15} />
          <span>Audit Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('ledger')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'ledger' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'ledger' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Activity size={15} />
          <span>Blockchain Ledger & History</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('documents')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'documents' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'documents' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'documents' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSearch size={15} />
          <span>Document Hashes & Verification</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('anomalies')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'anomalies' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'anomalies' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'anomalies' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <AlertTriangle size={15} />
          <span>Forensic Anomalies</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('freeze')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'freeze' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'freeze' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'freeze' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Lock size={15} />
          <span>Emergency Fund Freeze</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('report')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'report' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'report' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'report' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileText size={15} />
          <span>Submit CAG Report</span>
        </button>
      </div>

      {/* Sub-tab rendering */}
      {activeTab === 'ledger' && <AuditExplorer />}
      {activeTab === 'documents' && <DocumentAudit />}
      {activeTab === 'anomalies' && <AnomalyAnalytics />}
      {activeTab === 'freeze' && <FraudFreeze />}
      {activeTab === 'report' && <SubmitAuditReport />}

      {/* Overview tab rendering */}
      {activeTab === 'overview' && (
        <>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="On-Chain Verified Hashes"
          value={metrics?.total_verified_documents || 0}
          icon={FileSearch}
          color="green"
          subtitle="100% Match with Disk"
        />
        <StatCard
          title="Active Forensic Inquiries"
          value={metrics?.open_fraud_reports || 0}
          icon={AlertTriangle}
          color="red"
          subtitle="Flagged by Auditor Cell"
        />
        <StatCard
          title="Escrows Frozen on Ledger"
          value={metrics?.frozen_projects_count || 0}
          icon={Lock}
          color="orange"
          subtitle="Halted Smart Contracts"
        />
        <StatCard
          title="CAG Audit Reports Filed"
          value={metrics?.filed_audit_reports || 0}
          icon={ShieldCheck}
          color="blue"
          subtitle="Immutable On-Chain Verdicts"
        />
      </div>

      {/* Forensic Anomalies Alert Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="var(--color-warning)" />
            <span>Real-Time Forensic Risk Analytics</span>
          </h3>
          <Link to="/auditor/anomalies" className="btn btn-secondary btn-sm">Full Analytics</Link>
        </div>

        {data?.live_anomalies?.length > 0 ? (
          data.live_anomalies.map((anomaly, idx) => (
            <AnomalyAlertCard key={idx} anomaly={anomaly} />
          ))
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={24} color="var(--color-success)" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>No Active Anomalies Detected</div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>All multi-tier state allocations and milestone payments conform to statutory budget ceilings.</div>
          </div>
        )}
      </div>

      {/* 2-Column: Recent Audit Reports & Recent On-Chain Ledger Events */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span>Recent CAG Audit Submissions</span>
            </div>
            <Link to="/auditor/submit-report" className="btn btn-secondary btn-sm">New Report</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_audit_reports?.length > 0 ? (
              data.recent_audit_reports.map((r) => (
                <div key={r.audit_id} style={{
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
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{r.project_name || r.project_id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Score: <strong style={{ color: r.compliance_score >= 80 ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.compliance_score}/100</strong> • Auditor: {r.auditor_name}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${r.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`} style={{ marginBottom: '4px' }}>
                      {r.status}
                    </span>
                    <div>
                      {r.blockchain_tx_hash && <BlockchainBadge txHash={r.blockchain_tx_hash} />}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                No audit reports submitted yet.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="var(--color-primary)" />
              <span>Live Blockchain Ledger Events</span>
            </div>
            <Link to="/auditor/blockchain-explorer" className="btn btn-secondary btn-sm">Explorer</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_blockchain_events?.length > 0 ? (
              data.recent_blockchain_events.map((tx, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{tx.operation_type?.replace(/_/g, ' ')}</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>{tx.entity_id}</div>
                  </div>
                  <div>
                    <BlockchainBadge txHash={tx.tx_hash} blockNumber={tx.block_number} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                Transactions on local Hardhat blockchain will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default AuditorDashboard;
