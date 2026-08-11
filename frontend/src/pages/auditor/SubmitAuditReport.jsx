import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import BlockchainBadge from '../../components/BlockchainBadge';

const SubmitAuditReport = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [complianceScore, setComplianceScore] = useState(92);
  const [status, setStatus] = useState('APPROVED');
  const [findings, setFindings] = useState('Physical ground inspection aligns 100% with submitted concrete grading test certificates and photographic SHA-256 digests. Expenditure verified within statutory ceilings.');
  
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/auditor/projects').then((res) => {
      if (res.success) {
        setProjects(res.projects || []);
        if (res.projects?.length > 0) {
          setSelectedProjectId(res.projects[0].project_id);
        }
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await API.post('/auditor/submit-audit-report', {
        project_id: selectedProjectId,
        compliance_score: Number(complianceScore),
        status,
        findings
      });

      if (res.success) {
        setSuccessResult(res);
      }
    } catch (err) {
      setError(err.message || 'Audit report submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '10px 0 60px 0' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={24} color="var(--color-primary)" />
            <span>Submit Official CAG Forensic Audit Report</span>
          </h1>
          <p className="page-subtitle">
            Anchor statutory forensic audit score, inspection findings, and compliance verdicts directly to the Ethereum blockchain.
          </p>
        </div>
      </div>

      {successResult ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <CheckCircle2 size={32} color="var(--color-success)" />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            Audit Report Anchored on Blockchain
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
            The CAG forensic report has been permanently sealed on the Ethereum network.
          </p>

          <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Audit ID:</div>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{successResult.audit_report?.audit_id}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Audited Project:</div>
                <strong style={{ color: 'var(--text-main)' }}>{successResult.audit_report?.project_id}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Compliance Score:</div>
                <strong style={{ color: 'var(--color-success)', fontSize: '16px' }}>{successResult.audit_report?.compliance_score}/100</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Blockchain Receipt:</div>
                <BlockchainBadge txHash={successResult.blockchain?.tx_hash} blockNumber={successResult.blockchain?.block_number} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button className="btn btn-secondary" onClick={() => setSuccessResult(null)}>
              Submit Another Report
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/auditor/dashboard')}>
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          {error && (
            <div style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              color: 'var(--color-danger)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Target Infrastructure Project</label>
              <select
                className="form-control form-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
              >
                {projects.map((p) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.project_id} - {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Audit Compliance Score (0 to 100)</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="100"
                  value={complianceScore}
                  onChange={(e) => setComplianceScore(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Official CAG Audit Verdict</label>
                <select
                  className="form-control form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="APPROVED">APPROVED (Full Statutory Compliance)</option>
                  <option value="FLAGGED">FLAGGED (Irregularities / Remediation Mandated)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Forensic Findings & Variance Statement</label>
              <textarea
                className="form-control"
                rows="4"
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                required
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '10px' }} disabled={submitting}>
              <ShieldCheck size={16} />
              <span>{submitting ? 'Executing On-Chain Audit...' : 'Anchor CAG Forensic Verdict on Ethereum'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SubmitAuditReport;
