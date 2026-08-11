import React, { useState, useEffect } from 'react';
import { FileSearch, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Upload } from 'lucide-react';
import API from '../../services/api';
import DocumentHashViewer from '../../components/DocumentHashViewer';

const DocumentAudit = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live file upload & audit test
  const [testFile, setTestFile] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadDocuments = () => {
    API.get('/auditor/document-audit').then((res) => {
      if (res.success) setDocuments(res.documents || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleTestAudit = async (e) => {
    e.preventDefault();
    if (!testFile) return;
    setTesting(true);
    setTestResult(null);

    const data = new FormData();
    data.append('file', testFile);

    try {
      // Send file to calculate server hash and verify
      const res = await API.post('/auditor/calculate-and-verify-file', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTestResult(res);
    } catch (err) {
      alert(err.message || 'Audit test error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileSearch size={24} color="var(--color-primary)" />
            <span>Document SHA-256 Cryptographic Audit</span>
          </h1>
          <p className="page-subtitle">
            Extract cryptographic SHA-256 digests from off-chain inspection photos, engineer certificates, and verify 100% on-chain match.
          </p>
        </div>
      </div>

      {/* Live File Drag-and-Drop / Audit Tester */}
      <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
          Forensic File Tamper Testing & Live On-Chain Hash Verification
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Upload any site photo, invoice, or engineering certificate to compute its real-time SHA-256 digest and verify it against Ethereum smart contract records.
        </p>

        <form onSubmit={handleTestAudit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            className="form-control"
            style={{ maxWidth: '400px' }}
            onChange={(e) => setTestFile(e.target.files[0])}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={testing || !testFile}>
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            <span>{testing ? 'Computing SHA-256...' : 'Audit File Hash'}</span>
          </button>
        </form>

        {testResult && (
          <div style={{
            marginTop: '16px',
            background: testResult.match ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            border: `1px solid ${testResult.match ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: testResult.match ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {testResult.match ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
              <span>{testResult.match ? '100% CRYPTOGRAPHIC HASH MATCH CONFIRMED' : 'VALID SHA-256 COMPUTED (No Prior Tamper Detected)'}</span>
            </div>

            <div style={{ marginTop: '8px', fontFamily: 'monospace' }}>
              <div>Computed SHA-256: <strong>{testResult.computed_sha256}</strong></div>
              <div>File Name: {testResult.file_name} ({testResult.file_size} bytes)</div>
            </div>
          </div>
        )}
      </div>

      {/* Tracked Off-Chain Documents List */}
      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
          Registered Off-Chain Documents in Government Database ({documents.length})
        </h3>

        {documents.length > 0 ? (
          documents.map((doc, idx) => (
            <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No project documents registered yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentAudit;
