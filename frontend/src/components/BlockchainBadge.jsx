import React, { useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatTxHash, copyToClipboard } from '../services/blockchain';

const BlockchainBadge = ({ txHash, blockNumber, showIcon = true }) => {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Pending Block...</span>;
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
      borderRadius: 'var(--radius-sm)',
      padding: '2px 8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#166534'
    }}>
      {showIcon && <ShieldCheck size={12} color="#16A34A" />}
      <span>{formatTxHash(txHash)}</span>
      {blockNumber && <span style={{ color: '#65A30D' }}>#{blockNumber}</span>}
      <button
        onClick={handleCopy}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#166534', padding: 0 }}
        title="Copy Transaction Hash"
      >
        {copied ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
      </button>
    </div>
  );
};

export default BlockchainBadge;
