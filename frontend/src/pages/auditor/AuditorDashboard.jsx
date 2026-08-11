import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Lock, 
  FileSearch, 
  FileText, 
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import AnomalyAlertCard from '../../components/AnomalyAlertCard';
import BlockchainBadge from '../../components/BlockchainBadge';

const AuditorDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={24} color="var(--color-primary)" />
            <span>Forensic CAG Audit & Oversight Dashboard</span>
          </h1>
          <p className="page-subtitle">
            Comptroller & Auditor General cell • Cryptographic SHA-256 document hashing, anomaly detection, and emergency smart contract fund freeze.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/auditor/fraud-freeze" className="btn btn-danger">
            <Lock size={15} />
            <span>Emergency Fund Freeze</span>
          </Link>
          <Link to="/auditor/submit-report" className="btn btn-primary">
            <FileText size={15} />
            <span>Submit CAG Report</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="On-Chain Verified Hashes"
          value={metrics?.total_verified_documents || 0}
          icon={FileSearch}
          subtitle="100% Match with Disk"
        />
        <StatCard
          title="Active Forensic Fraud Inquiries"
          value={metrics?.open_fraud_reports || 0}
          icon={AlertTriangle}
          subtitle="Flagged by Auditor Cell"
        />
        <StatCard
          title="Escrows Frozen on Blockchain"
          value={metrics?.frozen_projects_count || 0}
          icon={Lock}
          subtitle="Halted Smart Contracts"
        />
        <StatCard
          title="CAG Audit Reports Filed"
          value={metrics?.filed_audit_reports || 0}
          icon={ShieldCheck}
          subtitle="Immutable On-Chain Verdicts"
        />
      </div>

      {/* Forensic Anomalies Alert Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            No active forensic fraud patterns detected. All state allocations match cryptographic ceilings.
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
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{r.project_name || r.project_id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Score: <strong style={{ color: r.compliance_score >= 80 ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.compliance_score}/100</strong> | {r.auditor_name}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${r.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`} style={{ marginBottom: '4px' }}>
                      {r.status}
                    </span>
                    {r.blockchain_tx_hash && <BlockchainBadge txHash={r.blockchain_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No audit reports submitted yet.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="var(--color-primary)" />
              <span>Live Blockchain Transactions</span>
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
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{tx.operation_type?.replace(/_/g, ' ')}</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.entity_id}</div>
                  </div>
                  <div>
                    <BlockchainBadge txHash={tx.tx_hash} blockNumber={tx.block_number} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Transactions on local Hardhat blockchain will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditorDashboard;
