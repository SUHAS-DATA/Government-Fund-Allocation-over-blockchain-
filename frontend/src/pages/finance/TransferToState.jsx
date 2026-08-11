import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';

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

  const [budgets, setBudgets] = useState([]);
  const [states, setStates] = useState(DEFAULT_STATES);
  const [selectedAllocId, setSelectedAllocId] = useState(searchParams.get('allocation_id') || '');
  const [selectedStateCode, setSelectedStateCode] = useState('MH');
  const [amount, setAmount] = useState(250000000); // 25 Crores
  const [signOffNote, setSignOffNote] = useState('Sanctioned and disbursed by Central Finance Authority.');
  
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/finance/received-budgets').then((res) => {
      if (res.success) {
        setBudgets(res.budgets || []);
        if (!selectedAllocId && res.budgets?.length > 0) {
          setSelectedAllocId(res.budgets[0].allocation_id);
        }
      }
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

  const activeBudget = budgets.find((b) => b.allocation_id === selectedAllocId);
  const availableBalance = activeBudget ? (activeBudget.amount - (activeBudget.disbursed_amount || 0)) : 0;

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
            <span>Approve & Transfer Funds to State Treasury</span>
          </h1>
          <p className="page-subtitle">
            Validate central budget ceiling, prevent double-spending, and record on-chain state treasury disbursal.
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
            State Treasury Transfer Completed
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
            Funds have been transferred to the State Treasury and anchored to the Ethereum blockchain ledger.
          </p>

          <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Transfer ID:</div>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{successResult.transfer?.transfer_id}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>State Treasury:</div>
                <strong style={{ color: 'var(--text-main)' }}>{successResult.transfer?.state_name}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Disbursed Amount:</div>
                <strong style={{ color: 'var(--color-success)', fontSize: '16px' }}>{formatCurrency(successResult.transfer?.amount)}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Blockchain Verification:</div>
                <BlockchainBadge txHash={successResult.blockchain?.tx_hash} blockNumber={successResult.blockchain?.block_number} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button className="btn btn-secondary" onClick={() => setSuccessResult(null)}>
              Transfer More Funds
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/finance/history')}>
              <span>View Transfer History</span>
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
              <label className="form-label">Select Central Budget Allocation</label>
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
                  <span style={{ color: 'var(--text-muted)' }}>Available Ceiling: </span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '15px' }}>{formatCurrency(availableBalance)}</strong>
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Destination State Treasury</label>
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

              <div className="form-group">
                <label className="form-label">Disbursal Amount (INR)</label>
                <input
                  type="number"
                  className="form-control"
                  max={availableBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Multi-Approver & Digital Sign-Off Note</label>
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
              <span>{submitting ? 'Executing On-Chain State Transfer...' : 'Approve & Disburse Funds to State Treasury'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TransferToState;
