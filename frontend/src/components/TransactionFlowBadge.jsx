import React, { useState } from 'react';
import { ArrowRight, Copy, Check, ShieldCheck, Building, Landmark, HardHat, FileText, CheckCircle2 } from 'lucide-react';
import { getKnownEntity, formatAddress, copyToClipboard } from '../services/blockchain';

const TransactionFlowBadge = ({ fromAddress, toAddress, fromEntity, toEntity, flowStage, compact = false }) => {
  const [copiedFrom, setCopiedFrom] = useState(false);
  const [copiedTo, setCopiedTo] = useState(false);

  const sender = getKnownEntity(fromAddress, fromEntity);
  const recipient = getKnownEntity(toAddress, toEntity);

  const copySender = (e) => {
    e.stopPropagation();
    if (fromAddress) {
      copyToClipboard(fromAddress);
      setCopiedFrom(true);
      setTimeout(() => setCopiedFrom(false), 1800);
    }
  };

  const copyRecipient = (e) => {
    e.stopPropagation();
    if (toAddress) {
      copyToClipboard(toAddress);
      setCopiedTo(true);
      setTimeout(() => setCopiedTo(false), 1800);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '380px' }}>
      {flowStage && (
        <div style={{
          fontSize: '10px',
          fontWeight: '700',
          textTransform: 'uppercase',
          color: 'var(--color-primary)',
          letterSpacing: '0.5px'
        }}>
          {flowStage}
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        fontSize: '12px'
      }}>
        {/* Sender Box */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: sender.bg || '#F1F5F9',
          color: sender.color || '#334155',
          border: `1px solid ${sender.color}33`,
          borderRadius: '6px',
          padding: '2px 6px',
          fontWeight: '600'
        }}
        title={`From: ${fromEntity || sender.name}\nAddress: ${fromAddress}`}
        >
          <span>{fromEntity || sender.shortName}</span>
          {fromAddress && (
            <button
              onClick={copySender}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: sender.color,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Copy Sender Wallet Address"
            >
              {copiedFrom ? <Check size={11} color="var(--color-success)" /> : <Copy size={11} />}
            </button>
          )}
        </div>

        <ArrowRight size={13} color="var(--text-muted)" />

        {/* Recipient Box */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: recipient.bg || '#F1F5F9',
          color: recipient.color || '#334155',
          border: `1px solid ${recipient.color}33`,
          borderRadius: '6px',
          padding: '2px 6px',
          fontWeight: '600'
        }}
        title={`To: ${toEntity || recipient.name}\nAddress: ${toAddress}`}
        >
          <span>{toEntity || recipient.shortName}</span>
          {toAddress && (
            <button
              onClick={copyRecipient}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: recipient.color,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Copy Recipient Wallet Address"
            >
              {copiedTo ? <Check size={11} color="var(--color-success)" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionFlowBadge;
