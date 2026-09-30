import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  ArrowRight,
  Landmark,
  FileText,
  Clock,
  Coins,
  RefreshCw,
  Hash,
  AlertCircle
} from 'lucide-react';
import Modal from './Modal';
import { formatCurrency } from '../services/blockchain';
import API from '../services/api';

const TransactionDetailsModal = ({ isOpen = true, onClose, transaction, autoVerify = false }) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const txId = transaction?.transaction_id || transaction?.transactionId || transaction?.transfer_id || 'TX-UNKNOWN';
  const txHash = transaction?.blockchain_tx_hash || transaction?.blockchainTxHash || transaction?.tx_hash || '';
  const txType = transaction?.transaction_type || 'FINANCIAL_DISBURSAL';

  useEffect(() => {
    if (autoVerify && transaction && txId && txId !== 'TX-UNKNOWN' && !verificationResult && !verifying) {
      handleVerify();
    }
  }, [autoVerify, transaction, txId]);

  if (!transaction) return null;

  const handleCopyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await API.get(`/transactions/${txId}/verify`);
      if (res.success) {
        setVerificationResult(res);
      } else {
        setVerifyError(res.message || 'Verification could not confirm block record.');
      }
    } catch (err) {
      setVerifyError(err.message || 'Blockchain RPC network timeout during verification.');
    } finally {
      setVerifying(false);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'CENTRAL_TO_STATE':
        return { label: 'Central -> State Treasury', color: 'var(--color-primary)' };
      case 'STATE_TO_DISTRICT':
        return { label: 'State Treasury -> District Agency', color: '#7C3AED' };
      case 'DISTRICT_TO_CONTRACTOR':
        return { label: 'District Agency -> Contractor', color: '#059669' };
      default:
        return { label: type, color: 'var(--text-secondary)' };
    }
  };

  const typeInfo = getTypeLabel(txType);

  return (
    <Modal
      title="Financial Transaction & Blockchain Ledger Verification"
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="780px"
    >
      <div>
        {/* Top Header Badge Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          background: 'var(--bg-subtle)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
              Transaction ID
            </div>
            <strong style={{ fontFamily: 'monospace', fontSize: '15px', color: 'var(--color-primary)' }}>
              {txId}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: '#EEF2FF',
              color: typeInfo.color,
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700',
              border: `1px solid ${typeInfo.color}30`
            }}>
              {typeInfo.label}
            </span>

            <span style={{
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700',
              border: '1px solid var(--color-success-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} />
              {transaction.status || 'COMPLETED'}
            </span>
          </div>
        </div>

        {/* Bank Account Mapping (Source -> Destination) */}
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          background: '#FFFFFF',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
            Authoritative Bank Account Mapping
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '14px', alignItems: 'center' }}>
            {/* Source Account (Debit) */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-sm)',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Landmark size={14} color="#64748B" />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                  Source Account (Debit)
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                {transaction.source_entity_name || transaction.sender_department || 'Central Finance Treasury'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Bank: <strong>{transaction.source_bank_name || 'Reserve Bank of India'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                A/C: <strong>{transaction.source_masked_account || 'XXXX XXXX 6451'}</strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                IFSC: {transaction.source_ifsc || 'RBIS0GOVT01'}
              </div>
            </div>

            {/* Transfer Arrow & Amount */}
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <div style={{
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                borderRadius: '8px',
                padding: '6px 12px',
                marginBottom: '6px'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>DISBURSED</div>
                <strong style={{ fontSize: '16px', color: 'var(--color-success)', display: 'block' }}>
                  {formatCurrency(transaction.amount)}
                </strong>
              </div>
              <ArrowRight size={22} color="var(--color-primary)" style={{ margin: '0 auto' }} />
            </div>

            {/* Destination Account (Credit) */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-sm)',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Landmark size={14} color="#059669" />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>
                  Destination Account (Credit)
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                {transaction.destination_entity_name || transaction.receiver_department || 'Recipient Treasury Account'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Bank: <strong>{transaction.destination_bank_name || 'State Bank of India'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                A/C: <strong>{transaction.destination_masked_account || 'XXXX XXXX 8472'}</strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                IFSC: {transaction.destination_ifsc || 'SBIN0004582'}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Metadata Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          background: 'var(--bg-subtle)',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontSize: '12px'
        }}>
          {transaction.related_scheme_name && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Related Scheme:</span>{' '}
              <strong style={{ color: 'var(--text-main)' }}>{transaction.related_scheme_name}</strong>
            </div>
          )}

          {transaction.related_project_id && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Project ID:</span>{' '}
              <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{transaction.related_project_id}</strong>
            </div>
          )}

          {transaction.related_allocation_id && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Allocation ID:</span>{' '}
              <strong style={{ fontFamily: 'monospace' }}>{transaction.related_allocation_id}</strong>
            </div>
          )}

          <div>
            <span style={{ color: 'var(--text-muted)' }}>Created Timestamp:</span>{' '}
            <strong>{new Date(transaction.created_at || transaction.timestamp || Date.now()).toLocaleString()}</strong>
          </div>

          {transaction.purpose && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Purpose / Note:</span>{' '}
              <span style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>"{transaction.purpose || transaction.notes}"</span>
            </div>
          )}
        </div>

        {/* Blockchain Ledger Section */}
        <div style={{
          border: '1px solid #C7D2FE',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          background: '#EEF2FF',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-primary)" />
              <strong style={{ fontSize: '13px', color: '#1E1B4B' }}>
                Ethereum Smart Contract Ledger Anchor
              </strong>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleVerify}
              disabled={verifying}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <RefreshCw size={13} className={verifying ? 'spinning' : ''} />
              <span>{verifying ? 'Verifying On-Chain...' : 'Verify Transaction'}</span>
            </button>
          </div>

          <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #E0E7FF', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Network:</span>
              <strong style={{ color: 'var(--text-main)' }}>Ethereum PoA / Ganache Local Devnet (Chain ID 5777)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Block Height:</span>
              <strong style={{ fontFamily: 'monospace' }}>#{transaction.blockchain_block || 1}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Transaction Hash:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary)' }}>
                  {txHash ? `${txHash.substring(0, 16)}...${txHash.substring(txHash.length - 12)}` : 'On-Chain Pending'}
                </span>
                {txHash && (
                  <button
                    onClick={handleCopyHash}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
                    title="Copy Full Transaction Hash"
                  >
                    <Copy size={13} />
                  </button>
                )}
                {copySuccess && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>Copied!</span>}
              </div>
            </div>
          </div>

          {/* Verification Results Panel */}
          {verificationResult && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: 'var(--color-success)', marginBottom: '4px' }}>
                <CheckCircle2 size={16} />
                <span>On-Chain Verification Confirmed: MATCH</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                Application transaction state matches the immutable cryptographic seal in the National Blockchain Ledger.
                {verificationResult.blockchain?.integrity_seal && (
                  <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
                    Integrity Seal: {verificationResult.blockchain.integrity_seal.substring(0, 32)}...
                  </div>
                )}
              </div>
            </div>
          )}

          {verifyError && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} />
              <span>{verifyError}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionDetailsModal;
