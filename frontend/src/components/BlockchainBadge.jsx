import React, { useState } from 'react';
import { Check, Copy, ShieldCheck, Lock } from 'lucide-react';
import { formatTxHash, copyToClipboard } from '../services/blockchain';

const BlockchainBadge = ({ txHash, blockNumber, showIcon = true }) => {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontStyle: 'italic'
      }}>
        Pending Block...
      </span>
    );
  }

  const handleCopy = async (e) => {
    e.stopPropagation();
    const ok = await copyToClipboard(txHash);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: '#F0FDF4',
      border: '1px solid #BBF7D0',
      borderRadius: '6px',
      padding: '3px 8px',
      fontSize: '11px',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#166534',
      fontWeight: '600',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
    }}>
      {showIcon && <ShieldCheck size={13} color="#16A34A" />}
      <span title={`Full Hash: ${txHash}`}>{formatTxHash(txHash)}</span>
      {blockNumber && (
        <span style={{
          backgroundColor: '#DCFCE7',
          color: '#15803D',
          padding: '1px 5px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: '700'
        }}>
          #{blockNumber}
        </span>
      )}
      <button
        onClick={handleCopy}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: '#166534',
          padding: '1px',
          marginLeft: '2px',
          transition: 'color 0.15s ease'
        }}
        title="Copy Transaction Hash"
      >
        {copied ? (
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#15803D' }}>Copied!</span>
        ) : (
          <Copy size={11} />
        )}
      </button>
    </div>
  );
};

export default BlockchainBadge;
