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
import API, { getApiConnectionDetails } from '../services/api';

const TransactionDetailsModal = ({ isOpen = true, onClose, transaction, autoVerify = false }) => {
  const [verifying, setVerifying] = useState(false);
  const [liveVerification, setLiveVerification] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [blockchainStatus, setBlockchainStatus] = useState(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const txId = transaction?.transaction_id || transaction?.transactionId || transaction?.transfer_id || 'TX-UNKNOWN';
  const txHash = transaction?.blockchain_tx_hash || transaction?.blockchainTxHash || transaction?.tx_hash || '';
  const txType = transaction?.transaction_type || 'FINANCIAL_DISBURSAL';

  const connectionDetails = getApiConnectionDetails();
  const isCloudEnvironment = !connectionDetails.isLocalTarget;
  const isBlockchainDisabled = Boolean(
    statusLoaded
      ? (!blockchainStatus?.enabled || !blockchainStatus?.connected)
      : isCloudEnvironment
  );

  useEffect(() => {
    let isMounted = true;
    API.get('/blockchain/status')
      .then((res) => {
        if (isMounted) {
          if (res && res.success) {
            setBlockchainStatus(res);
          } else {
            setBlockchainStatus({ enabled: false, connected: false });
          }
          setStatusLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBlockchainStatus({ enabled: false, connected: false });
          setStatusLoaded(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLiveVerification(null);
    setVerifyError('');
  }, [transaction?.transaction_id, transaction?.transfer_id]);

  useEffect(() => {
    if (
      autoVerify &&
      transaction &&
      txId &&
      txId !== 'TX-UNKNOWN' &&
      !liveVerification &&
      !verifying &&
      statusLoaded &&
      !isBlockchainDisabled
    ) {
      handleVerify();
    }
  }, [autoVerify, transaction, txId, statusLoaded, isBlockchainDisabled]);

  if (!transaction) return null;

  const handleCopyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleVerify = async () => {
    if (isBlockchainDisabled) {
      setVerifyError('Blockchain verification is inactive on cloud environment (ENABLE_BLOCKCHAIN=false).');
      return;
    }

    setVerifying(true);
    setVerifyError('');
    setLiveVerification(null);
    try {
      const res = await API.get(`/transactions/${txId}/verify`);
      setLiveVerification(res);
      if (res && res.success && res.verified) {
        // Fresh live verification confirmed on ledger
      } else {
        const errorMsg = res?.message || (res?.verification_status === 'BLOCKCHAIN_DISABLED'
          ? 'Blockchain verification is inactive on cloud environment (ENABLE_BLOCKCHAIN=false).'
          : 'Verification could not confirm block record.');
        setVerifyError(errorMsg);
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
        return { label: 'Central Office -> State Government Account', color: 'var(--color-primary)' };
      case 'STATE_TO_DISTRICT':
        return { label: 'State Government Account -> District Office', color: '#7C3AED' };
      case 'DISTRICT_TO_CONTRACTOR':
        return { label: 'District Office -> Contractor', color: '#059669' };
      default:
        return { label: type, color: 'var(--text-secondary)' };
    }
  };

  const typeInfo = getTypeLabel(txType);

  return (
    <Modal
      title="Payment Record & Verification Check"
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
              Payment Reference
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
              background: transaction.status === 'COMPLETED' ? 'var(--color-success-bg)' : '#FEF3C7',
              color: transaction.status === 'COMPLETED' ? 'var(--color-success)' : '#D97706',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700',
              border: transaction.status === 'COMPLETED' ? '1px solid var(--color-success-border)' : '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={12} />
              Status: {transaction.status || 'COMPLETED'}
            </span>

            {transaction.blockchain_status === 'VERIFIED' && (
              <span style={{
                background: '#F0FDF4',
                color: '#15803D',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} />
                On-Chain Verified
              </span>
            )}
          </div>
        </div>

        {/* Bank Account Details (Source -> Destination) */}
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          background: '#FFFFFF',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>
            Government Account Details
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
                  From: Sending Account
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                {transaction.source_entity_name || transaction.sender_department || 'Central Office Account'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Bank: <strong>{transaction.source_bank_name || 'Reserve Bank of India'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Account: <strong>{transaction.source_masked_account || 'XXXX XXXX 6451'}</strong>
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
                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>AMOUNT PAID</div>
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
                  To: Receiving Account
                </span>
              </div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                {transaction.destination_entity_name || transaction.receiver_department || 'Government Receiving Account'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                Bank: <strong>{transaction.destination_bank_name || 'State Bank of India'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Account: <strong>{transaction.destination_masked_account || 'XXXX XXXX 8472'}</strong>
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
              <span style={{ color: 'var(--text-muted)' }}>Scheme:</span>{' '}
              <strong style={{ color: 'var(--text-main)' }}>{transaction.related_scheme_name}</strong>
            </div>
          )}

          {transaction.related_project_id && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Project:</span>{' '}
              <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{transaction.related_project_id}</strong>
            </div>
          )}

          {transaction.related_allocation_id && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Fund Allocation ID:</span>{' '}
              <strong style={{ fontFamily: 'monospace' }}>{transaction.related_allocation_id}</strong>
            </div>
          )}

          <div>
            <span style={{ color: 'var(--text-muted)' }}>Date & Time:</span>{' '}
            <strong>{new Date(transaction.created_at || transaction.timestamp || Date.now()).toLocaleString()}</strong>
          </div>

          {transaction.purpose && (
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Purpose:</span>{' '}
              <span style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>"{transaction.purpose || transaction.notes}"</span>
            </div>
          )}
        </div>

        {/* Verification Check Section */}
        <div style={{
          border: '1px solid #C7D2FE',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          background: '#F0F9FF',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-primary)" />
              <strong style={{ fontSize: '13px', color: '#1E1B4B' }}>
                Official Record Check
              </strong>
            </div>

            {isBlockchainDisabled ? (
              <button
                className="btn btn-secondary btn-sm"
                disabled
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  opacity: 0.75,
                  cursor: 'not-allowed',
                  background: '#F1F5F9',
                  borderColor: '#CBD5E1',
                  color: '#64748B'
                }}
                title="Verification unavailable in cloud demo"
              >
                <AlertCircle size={13} color="#D97706" />
                <span>Verification unavailable in cloud demo</span>
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleVerify}
                disabled={verifying}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <RefreshCw size={13} className={verifying ? 'spinning' : ''} />
                <span>{verifying ? 'Checking Record...' : 'Verify Record'}</span>
              </button>
            )}
          </div>

          {isBlockchainDisabled && (
            <div style={{
              marginBottom: '12px',
              padding: '8px 12px',
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 'var(--radius-sm)',
              color: '#92400E',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>
                Blockchain verification is inactive on cloud environment (ENABLE_BLOCKCHAIN=false). Live cryptographic ledger verification requires a connected local Ganache node.
              </span>
            </div>
          )}

          <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid #E0E7FF', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>System:</span>
              <strong style={{ color: 'var(--text-main)' }}>National Public Fund System (Audit-Protected)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Financial Record:</span>
              <strong style={{ color: transaction.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} />
                {transaction.status || 'COMPLETED'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--text-muted)' }}>Stored Ledger Status:</span>
              <div style={{ textAlign: 'right' }}>
                {transaction.blockchain_status === 'VERIFIED' ? (
                  <>
                    <strong style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={13} />
                      Previously Verified
                      {transaction.blockchain_block ? ` (Block #${transaction.blockchain_block})` : ''}
                    </strong>
                    {transaction.last_verified_at && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Verified: {new Date(transaction.last_verified_at).toLocaleString()}
                      </div>
                    )}
                  </>
                ) : txHash ? (
                  <strong style={{ color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} />
                    Hash Recorded (Unverified)
                  </strong>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Off-Chain Record (No Hash)</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Reference:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-primary)' }}>
                  {txHash ? `${txHash.substring(0, 16)}...` : txId}
                </span>
                {txHash && (
                  <button
                    onClick={handleCopyHash}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)' }}
                    title="Copy Reference ID"
                  >
                    <Copy size={13} />
                  </button>
                )}
                {copySuccess && <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>Copied!</span>}
              </div>
            </div>
          </div>

          {/* Live Verification Results Panel (Only shows when a live check succeeded in this session) */}
          {liveVerification && liveVerification.success && liveVerification.verified && (
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
                <span>Fresh On-Chain Check Confirmed: Verified</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                Confirmed on ledger at block #{liveVerification.blockchain?.block_number || liveVerification.block_number || 'N/A'} with {liveVerification.blockchain?.confirmations || liveVerification.confirmations || 0} confirmation(s).
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
