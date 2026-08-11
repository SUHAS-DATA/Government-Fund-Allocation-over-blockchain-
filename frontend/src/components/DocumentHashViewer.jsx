import React, { useState } from 'react';
import { FileText, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { formatTxHash, copyToClipboard } from '../services/blockchain';
import API from '../services/api';

const DocumentHashViewer = ({ document, showVerifyButton = true }) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await API.post('/auditor/verify-document', {
        document_id: document.document_id,
        doc_hash: document.sha256_hash
      });
      setVerificationResult(res);
    } catch (e) {
      alert(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyHash = async () => {
    const ok = await copyToClipboard(document.sha256_hash);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: 'var(--shadow-xs)',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={16} color="var(--color-primary)" />
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>
              {document.file_name || document.document_id}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Type: {document.doc_type || 'OFF_CHAIN_FILE'} | Size: {(document.file_size ? (document.file_size / 1024).toFixed(1) + ' KB' : 'N/A')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {document.blockchain_tx_hash ? (
            <span className="badge badge-success">ANCHORED ON-CHAIN</span>
          ) : (
            <span className="badge badge-warning">OFF-CHAIN</span>
          )}

          {showVerifyButton && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <RefreshCw size={11} className={verifying ? 'animate-spin' : ''} />
              <span>{verifying ? 'Verifying...' : 'Verify Hash'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SHA-256 Digest Box */}
      <div style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-xs)',
        padding: '6px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}>
        <div>
          <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>SHA-256:</span>
          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{document.sha256_hash}</span>
        </div>
        <button
          onClick={handleCopyHash}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          title="Copy SHA-256 Digest"
        >
          {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
        </button>
      </div>

      {/* Verification Feedback */}
      {verificationResult && (
        <div style={{
          background: verificationResult.is_verified ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          border: `1px solid ${verificationResult.is_verified ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
          borderRadius: 'var(--radius-xs)',
          padding: '6px 10px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: verificationResult.is_verified ? 'var(--color-success)' : 'var(--color-danger)',
          fontWeight: '600'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {verificationResult.is_verified ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            <span>{verificationResult.is_verified ? 'HASH MATCH: 100% Cryptographically Verified' : 'HASH MISMATCH / TAMPER DETECTED'}</span>
          </div>
          <span>Disk vs On-Chain Match</span>
        </div>
      )}
    </div>
  );
};

export default DocumentHashViewer;
