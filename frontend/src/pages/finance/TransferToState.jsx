import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Landmark,
  ArrowRight,
  Eye,
  Laptop,
  Cloud,
  Settings2,
  RefreshCw
} from 'lucide-react';
import API, {
  getApiConnectionDetails,
  setApiHost,
  DEFAULT_LOCAL_BACKEND,
  DEFAULT_CLOUD_BACKEND
} from '../../services/api';
import ApiConnectionModal from '../../components/ApiConnectionModal';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import FundAmountInput from '../../components/FundAmountInput';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { useRealtimeSync } from '../../context/RealtimeContext';

const TransferToState = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const DEFAULT_STATES = [
    { code: 'MH', name: 'Maharashtra' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'TG', name: 'Telangana' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'WB', name: 'West Bengal' }
  ];

  const [connectionDetails, setConnectionDetails] = useState(getApiConnectionDetails());
  const [showApiModal, setShowApiModal] = useState(false);

  const [budgets, setBudgets] = useState([]);
  const [states, setStates] = useState(DEFAULT_STATES);
  const [selectedAllocId, setSelectedAllocId] = useState(searchParams.get('allocation_id') || '');
  const [selectedStateCode, setSelectedStateCode] = useState('MH');
  const [amount, setAmount] = useState(250000000); // 25 Crores
  const [signOffNote, setSignOffNote] = useState('Sanctioned and disbursed by Central Finance Authority.');

  const [centralAccount, setCentralAccount] = useState(null);
  const [stateAccount, setStateAccount] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  const loadBudgets = () => {
    API.get('/finance/received-budgets').then((res) => {
      if (res.success) {
        setBudgets(res.budgets || []);
        if (res.budgets?.length > 0) {
          const current = res.budgets.find((b) => b.allocation_id === selectedAllocId);
          if (!current || (current.amount - (current.disbursed_amount || 0) <= 0)) {
            const firstWithBal = res.budgets.find((b) => (b.amount - (b.disbursed_amount || 0)) > 0) || res.budgets[0];
            setSelectedAllocId(firstWithBal.allocation_id);
            const avail = firstWithBal.amount - (firstWithBal.disbursed_amount || 0);
            if (avail > 0) {
              setAmount(Math.min(avail, 10000000));
            }
          }
        }
      }
    });
  };

  useEffect(() => {
    loadBudgets();

    API.get('/bank-accounts/central').then((res) => {
      if (res.success) setCentralAccount(res.account);
    });

    API.get('/finance/states').then((res) => {
      if (res.success && res.states?.length > 0) {
        setStates(res.states);
        if (!selectedStateCode) {
          setSelectedStateCode(res.states[0].code);
        }
      }
    }).catch(() => {
      API.get('/admin/states').then((res) => {
        if (res.success && res.states?.length > 0) {
          setStates(res.states);
        }
      }).catch(() => {
        // Keep DEFAULT_STATES
      });
    });
  }, []);

  useEffect(() => {
    const handleHostChange = () => {
      setConnectionDetails(getApiConnectionDetails());
      loadBudgets();
    };
    window.addEventListener('govtfund_api_host_changed', handleHostChange);
    return () => window.removeEventListener('govtfund_api_host_changed', handleHostChange);
  }, []);

  useEffect(() => {
    if (selectedStateCode) {
      API.get(`/bank-accounts/state/${selectedStateCode}`).then((res) => {
        if (res.success) setStateAccount(res.account);
      });
    }
  }, [selectedStateCode]);

  useRealtimeSync(loadBudgets, { interval: 6000 });

  const activeBudget = budgets.find((b) => b.allocation_id === selectedAllocId);
  const availableBalance = activeBudget ? (activeBudget.amount - (activeBudget.disbursed_amount || 0)) : 0;

  useEffect(() => {
    if (activeBudget) {
      const avail = activeBudget.amount - (activeBudget.disbursed_amount || 0);
      if (avail > 0 && (amount <= 0 || amount > avail)) {
        setAmount(Math.min(avail, 10000000));
      }
    }
  }, [selectedAllocId, activeBudget]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (amount <= 0 || amount > availableBalance) {
      setError(`Transfer amount must be positive and cannot exceed available balance of ${formatCurrency(availableBalance)}`);
      return;
    }

    const st = states.find((s) => s.code === selectedStateCode);

    setSubmitting(true);
    setError('');
    try {
      const res = await API.post('/finance/approve-and-transfer', {
        allocation_id: selectedAllocId,
        state_code: selectedStateCode,
        state_name: st?.name || 'Maharashtra',
        amount: Number(amount),
        sign_off_note: signOffNote
      });

      if (res.success) {
        setSuccessResult(res);
      }
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '10px 0 60px 0' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Send size={24} color="var(--color-primary)" />
            <span>Send Funds to State Government</span>
          </h1>
          <p className="page-subtitle">
            Send approved central budget funds directly to state government accounts with secure verification.
          </p>
        </div>
      </div>

      {/* Blockchain Execution Target Banner */}
      <div
        style={{
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          border: connectionDetails.isLocalTarget ? '1.5px solid #10B981' : '1.5px solid #0284C7',
          backgroundColor: connectionDetails.isLocalTarget ? '#ECFDF5' : '#F0F9FF',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: connectionDetails.isLocalTarget ? '#D1FAE5' : '#E0F2FE',
                color: connectionDetails.isLocalTarget ? '#059669' : '#0284C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {connectionDetails.isLocalTarget ? <Laptop size={20} /> : <Cloud size={20} />}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: connectionDetails.isLocalTarget ? '#065F46' : '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BLOCKCHAIN EXECUTION TARGET
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{connectionDetails.isLocalTarget ? 'Local Ganache Blockchain' : 'Cloud Deployed Backend'}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 8px',
                    borderRadius: '10px',
                    backgroundColor: connectionDetails.isLocalTarget ? '#10B981' : '#0284C7',
                    color: '#FFFFFF'
                  }}
                >
                  {connectionDetails.isLocalTarget ? 'Chain ID: 1337' : 'Render Cloud'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!connectionDetails.isLocalTarget && (
              <button
                type="button"
                onClick={() => {
                  setApiHost(DEFAULT_LOCAL_BACKEND);
                  setConnectionDetails(getApiConnectionDetails());
                  loadBudgets();
                }}
                style={{
                  background: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Laptop size={14} />
                <span>Switch to Local Ganache Backend</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowApiModal(true)}
              style={{
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Settings2 size={14} />
              <span>Configure Connection</span>
            </button>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: connectionDetails.isLocalTarget ? '#047857' : '#0369A1', lineHeight: '1.4' }}>
          {connectionDetails.isLocalTarget ? (
            <span>
              Targeting API: <code>{connectionDetails.currentBaseUrl}</code>. Transactions are signed locally and verified on Ganache contract <code>0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20</code>.
            </span>
          ) : (
            <span>
              Targeting API: <code>{connectionDetails.currentBaseUrl}</code>. To execute transactions directly on your local Ganache without cloud tunnels, click <strong>"Switch to Local Ganache Backend"</strong> above.
            </span>
          )}
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
            Funds Sent to State Successfully
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
            Funds have been sent to the State Government Account and recorded securely.
          </p>

          <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Payment Reference:</div>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{successResult.transfer?.transfer_id}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>State Government Account:</div>
                <strong style={{ color: 'var(--text-main)' }}>{successResult.transfer?.state_name}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Amount Sent:</div>
                <strong style={{ color: 'var(--color-success)', fontSize: '16px' }}>{formatCurrency(successResult.transfer?.amount)}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Record Check:</div>
                <BlockchainBadge
                  txHash={successResult.blockchain?.tx_hash || successResult.transfer?.blockchain_tx_hash}
                  blockNumber={successResult.blockchain?.block_number || successResult.transfer?.blockchain_block}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setSuccessResult(null)}>
              Send More Funds
            </button>
            {successResult.transaction && (
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={16} />
                <span>View Payment Details</span>
              </button>
            )}
            <button className="btn btn-primary" onClick={() => navigate('/finance/history')}>
              <span>View Payment History</span>
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

          <form onSubmit={handleTransfer}>
            <div className="form-group">
              <label className="form-label">Select Approved Budget</label>
              <select
                className="form-control form-select"
                value={selectedAllocId}
                onChange={(e) => setSelectedAllocId(e.target.value)}
                required
              >
                {budgets.map((b) => (
                  <option key={b.allocation_id} value={b.allocation_id}>
                    {b.allocation_id} - {b.scheme_name} (Avail: {formatCurrency(b.amount - (b.disbursed_amount || 0))})
                  </option>
                ))}
              </select>
            </div>

            {activeBudget && (
              <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Department: </span>
                  <strong style={{ color: 'var(--text-main)' }}>{activeBudget.department}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining Approved Budget: </span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '15px' }}>{formatCurrency(availableBalance)}</strong>
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Destination State Government</label>
                <select
                  className="form-control form-select"
                  value={selectedStateCode}
                  onChange={(e) => setSelectedStateCode(e.target.value)}
                >
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <FundAmountInput
                label="Amount to Send to State Account"
                value={amount}
                onChange={(val) => setAmount(val)}
                max={availableBalance}
                required={true}
                helperText="Enter the amount to send in Crores, Lakhs, or Thousands. Ex: 100 (Cr)."
              />
            </div>

            {/* Registered Bank Account Routing Card */}
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Landmark size={15} color="var(--color-primary)" />
                  <span>Government Account Details</span>
                </div>
                <span style={{ fontSize: '11px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                  Verified Government Account Link
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '14px', alignItems: 'center' }}>
                {/* Source Central Account */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                    From: Central Office Account
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '12px', color: 'var(--text-main)', marginBottom: '3px' }}>
                    {centralAccount?.account_holder_name || 'Ministry of Finance - Central Fund'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Bank: <strong>{centralAccount?.bank_name || 'Reserve Bank of India'}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    A/C: <strong>{centralAccount?.masked_account_number || 'XXXX XXXX 6451'}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    IFSC: {centralAccount?.ifsc || 'RBIS0GOVT01'}
                  </div>
                </div>

                {/* Direction */}
                <div style={{ textAlign: 'center' }}>
                  <ArrowRight size={20} color="var(--color-primary)" />
                </div>

                {/* Destination State Account */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', marginBottom: '4px' }}>
                    To: State Government Account
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '12px', color: 'var(--text-main)', marginBottom: '3px' }}>
                    {stateAccount?.account_holder_name || `${states.find(s => s.code === selectedStateCode)?.name || selectedStateCode} State Treasury`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Bank: <strong>{stateAccount?.bank_name || 'State Bank of India'}</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    A/C: <strong>{stateAccount?.masked_account_number || 'XXXX XXXX 8472'}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    IFSC: {stateAccount?.ifsc || 'SBIN0004582'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
                Funds will be transferred directly to the confirmed State Government Account with secure record verification.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Approval Note</label>
              <textarea
                className="form-control"
                rows="3"
                value={signOffNote}
                onChange={(e) => setSignOffNote(e.target.value)}
                required
              ></textarea>
            </div>

            <button type="submit" className="btn btn-success btn-lg" style={{ width: '100%', marginTop: '10px' }} disabled={submitting || availableBalance <= 0}>
              <ShieldCheck size={16} />
              <span>{submitting ? 'Sending Funds...' : 'Confirm & Send Funds'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Transaction Details & Blockchain Verification Modal */}
      <TransactionDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        transaction={successResult?.transaction || successResult?.transfer}
        autoVerify={true}
      />

      {/* API & Blockchain Network Connection Modal */}
      <ApiConnectionModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
      />
    </div>
  );
};

export default TransferToState;
