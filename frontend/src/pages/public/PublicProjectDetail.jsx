import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Building2, 
  Coins, 
  MapPin, 
  ShieldCheck, 
  Activity, 
  FileText, 
  MessageSquareWarning, 
  CheckCircle2, 
  Clock,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatTxHash } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DocumentHashViewer from '../../components/DocumentHashViewer';

const PublicProjectDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/public/projects/${id}`)
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center' }}>Loading project verification data...</div>;
  }

  if (!data || !data.project) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-danger)' }}>Project Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 20px 0' }}>The requested project ID does not exist in the public directory.</p>
        <Link to="/public/projects" className="btn btn-secondary">Return to Directory</Link>
      </div>
    );
  }

  const proj = data.project;
  const milestones = data.milestones || [];
  const documents = data.documents || [];
  const transactions = data.transactions || [];

  const spentAmount = proj.released_amount || 0;
  const totalBudget = proj.total_budget || 0;
  const remainingBudget = Math.max(0, totalBudget - spentAmount);

  // Real-time calculated work progress percentage
  const calculateProgress = () => {
    if (proj.status === 'COMPLETED' || proj.status === 'FINAL_PROJECT_COMPLETED' || proj.status === 'CLOSED' || proj.is_closed) {
      return 100;
    }
    if (proj.progress_percentage && proj.progress_percentage > 0) {
      return proj.progress_percentage;
    }
    if (milestones && milestones.length > 0) {
      const total = proj.total_budget || milestones.reduce((acc, m) => acc + (m.amount || 0), 0) || 1;
      let weighted = 0;
      milestones.forEach((m) => {
        const weight = (m.amount || 0) / total;
        let p = 0;
        if (m.status === 'COMPLETED' || m.status === 'RELEASED') p = 100;
        else if (m.status === 'SUBMITTED') p = m.progress_percentage || 100;
        else if (m.status === 'APPROVED_FOR_WORK' || m.phase_status === 'EXECUTING_WORK') p = m.progress_percentage || 40;
        else if (m.status === 'FUNDS_TRANSFERRED') p = m.progress_percentage || 15;
        else p = m.progress_percentage || 0;
        weighted += p * weight;
      });
      return Math.min(100, Math.round(weighted));
    }
    return 0;
  };

  const progressPercent = calculateProgress();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/public/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
          <ArrowLeft size={14} />
          <span>Back to Projects Directory</span>
        </Link>
      </div>

      {/* Project Title Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span className={`badge ${proj.is_frozen ? 'badge-danger' : proj.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>
              {proj.is_frozen ? 'FUNDS FROZEN BY AUDITOR' : proj.status}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {proj.project_id}</span>
          </div>

          <h1 className="page-title">{proj.name}</h1>
          <p className="page-subtitle">{proj.scheme_name} • {proj.department}</p>
        </div>

        <Link to={`/public/grievance?project_id=${proj.project_id}&district=${proj.district_name}`} className="btn btn-warning">
          <MessageSquareWarning size={15} />
          <span>Report Issue / Complaint</span>
        </Link>
      </div>

      {proj.is_frozen && (
        <div style={{
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          color: 'var(--color-danger)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={24} />
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px' }}>EMERGENCY AUDIT HOLD ACTIVE</div>
            <div style={{ fontSize: '12px' }}>Reason: {proj.freeze_reason || 'Discrepancy detected by auditors.'}</div>
          </div>
        </div>
      )}

      {/* 3-Column Financial Breakdown */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Approved Budget</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>{formatCurrency(totalBudget)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Total Approved Project Funds</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Released Payments</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-success)', marginTop: '4px' }}>{formatCurrency(spentAmount)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Paid for Completed Work</div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Remaining Balance</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-primary)', marginTop: '4px' }}>{formatCurrency(remainingBudget)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Safe on Blockchain</div>
        </div>
      </div>

      {/* Physical Progress Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>Work Progress</span>
          <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--color-primary)' }}>{progressPercent}% Completed</span>
        </div>
        <div style={{ height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          {proj.description}
        </div>
      </div>

      {/* Milestones Schedule */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} color="var(--color-primary)" />
            <span>Milestone Payment Stages ({milestones.length} Phases)</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {milestones.length > 0 ? (
            milestones.map((m, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                    Phase #{idx + 1}: {m.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {m.description}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '14px' }}>
                    {formatCurrency(m.amount)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginTop: '4px' }}>
                    <span className={`badge ${m.status === 'COMPLETED' || m.status === 'RELEASED' ? 'badge-success' : 'badge-warning'}`}>
                      {m.status === 'COMPLETED' ? '✓ COMPLETED' : m.status?.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Progress: {m.status === 'COMPLETED' ? '100%' : `${m.progress_percentage || 0}%`}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Milestones schedule under review by District Authority.
            </div>
          )}
        </div>
      </div>

      {/* Off-Chain Documents with SHA-256 Proofs */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} color="var(--color-primary)" />
            <span>Inspection Documents & Blockchain Verification Hashes</span>
          </div>
        </div>

        {documents.length > 0 ? (
          documents.map((doc, idx) => (
            <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Physical milestone inspection reports will be listed here with cryptographic hashes.
          </div>
        )}
      </div>

      {/* Blockchain Transactions Log */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={18} color="var(--color-primary)" />
            <span>Immutable Blockchain Ledger Receipts</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {transactions.length > 0 ? (
            transactions.map((tx, idx) => (
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
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tx.details}</div>
                </div>
                <div>
                  <BlockchainBadge txHash={tx.tx_hash} blockNumber={tx.block_number} />
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              On-chain milestone and escrow receipts will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProjectDetail;
