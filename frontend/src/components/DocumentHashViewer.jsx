import React, { useState } from 'react';
import { FileText, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Copy, Check, Lock } from 'lucide-react';
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
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: 'var(--shadow-xs)',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
              {document.file_name || document.document_id}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Type: <strong>{document.doc_type || 'OFF_CHAIN_FILE'}</strong> • Size: {(document.file_size ? (document.file_size / 1024).toFixed(1) + ' KB' : 'N/A')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {document.blockchain_tx_hash ? (
            <span className="badge badge-success">
              <ShieldCheck size={12} />
              <span>ANCHORED ON-CHAIN</span>
            </span>
          ) : (
            <span className="badge badge-warning">OFF-CHAIN</span>
          )}

          {showVerifyButton && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', padding: '5px 10px' }}
            >
              <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} />
              <span>{verifying ? 'Verifying...' : 'Verify Hash'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SHA-256 Digest Box */}
      <div style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: '6px', fontWeight: '700' }}>SHA-256:</span>
          <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{document.sha256_hash}</span>
        </div>
        <button
          onClick={handleCopyHash}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0
          }}
          title="Copy SHA-256 Digest"
        >
          {copied ? (
            <span style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '10px' }}>Copied!</span>
          ) : (
            <Copy size={13} />
          )}
        </button>
      </div>

      {/* Verification Feedback */}
      {verificationResult && (
        <div style={{
          background: verificationResult.is_verified ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          border: `1px solid ${verificationResult.is_verified ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: verificationResult.is_verified ? 'var(--color-success)' : 'var(--color-danger)',
          fontWeight: '700'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {verificationResult.is_verified ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <span>{verificationResult.is_verified ? 'HASH MATCH: 100% Cryptographically Verified on Blockchain' : 'HASH MISMATCH / TAMPER DETECTED'}</span>
          </div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.9 }}>Disk vs On-Chain Match</span>
        </div>
      )}
    </div>
  );
};

export default DocumentHashViewer;
