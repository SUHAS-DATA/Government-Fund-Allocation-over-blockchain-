import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import FundAmountInput from '../../components/FundAmountInput';

import { getDistrictsByState, getState } from '../../config/statesDistrictsData';

const AllocateToDistrict = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [receivedFunds, setReceivedFunds] = useState([]);
  const [selectedTransferId, setSelectedTransferId] = useState(searchParams.get('transfer_id') || '');
  const [districtName, setDistrictName] = useState('');
  const [amount, setAmount] = useState(50000000); // 5 Crores
  
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/state/received-funds').then((res) => {
      if (res.success && res.received_funds?.length > 0) {
        setReceivedFunds(res.received_funds);
        if (!selectedTransferId) {
          setSelectedTransferId(res.received_funds[0].transfer_id);
        }
      }
    });
  }, []);

  const activeTransfer = receivedFunds.find((f) => f.transfer_id === selectedTransferId);
  const activeStateCode = activeTransfer?.state_code || 'KA';
  const activeStateObj = getState(activeStateCode);
  const availableDistricts = getDistrictsByState(activeStateCode);

  // Automatically reset district if current district does not belong to active state
  useEffect(() => {
    if (availableDistricts.length > 0) {
      const isValid = availableDistricts.some((d) => d.name === districtName);
      if (!isValid) {
        setDistrictName(availableDistricts[0].name);
      }
    }
  }, [selectedTransferId, activeStateCode, availableDistricts]);

  const availableBalance = activeTransfer ? Math.max(0, activeTransfer.amount - (activeTransfer.allocated_to_districts || 0)) : 0;

  const handleAllocate = async (e) => {
    e.preventDefault();
    if (amount <= 0 || amount > availableBalance) {
      setError(`Amount must be positive and cannot exceed available state transfer balance of ${formatCurrency(availableBalance)}`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await API.post('/state/allocate-to-district', {
        transfer_id: selectedTransferId,
        district_name: districtName,
        amount: Number(amount)
      });

      if (res.success) {
        setSuccessResult(res);
      }
    } catch (err) {
      setError(err.message || 'District allocation failed');
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
            <span>Allocate Funds to District Agency</span>
          </h1>
          <p className="page-subtitle">
            Validate available state balance, prevent regional overspending, and record on-chain district allocation.
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
            District Fund Allocated on Blockchain
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
            Funds have been transferred to the District Development Agency with verifiable on-chain proof.
          </p>

          <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>District Alloc ID:</div>
                <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{successResult.allocation?.district_alloc_id}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>District:</div>
                <strong style={{ color: 'var(--text-main)' }}>{successResult.allocation?.district_name}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Allocated Amount:</div>
                <strong style={{ color: 'var(--color-success)', fontSize: '16px' }}>{formatCurrency(successResult.allocation?.amount)}</strong>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)' }}>Blockchain Receipt:</div>
                <BlockchainBadge txHash={successResult.blockchain?.tx_hash} blockNumber={successResult.blockchain?.block_number} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <button className="btn btn-secondary" onClick={() => setSuccessResult(null)}>
              Allocate to Another District
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/state/history')}>
              <span>View State Allocation History</span>
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

          <form onSubmit={handleAllocate}>
            <div className="form-group">
              <label className="form-label">Select State Fund Disbursal Source</label>
              <select
                className="form-control form-select"
                value={selectedTransferId}
                onChange={(e) => setSelectedTransferId(e.target.value)}
                required
              >
                {receivedFunds.map((f) => (
                  <option key={f.transfer_id} value={f.transfer_id}>
                    {f.transfer_id} - {f.scheme_name} ({formatCurrency(f.amount)})
                  </option>
                ))}
              </select>
            </div>

            {activeTransfer && (
              <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Scheme: </span>
                  <strong style={{ color: 'var(--text-main)' }}>{activeTransfer.scheme_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Available State Balance: </span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '15px' }}>{formatCurrency(availableBalance)}</strong>
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target District Agency ({activeStateObj?.name || activeStateCode})</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{availableDistricts.length} Districts Available</span>
                </label>
                <select
                  className="form-control form-select"
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  required
                >
                  {availableDistricts.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <FundAmountInput
                label="District Allocation Amount"
                value={amount}
                onChange={(val) => setAmount(val)}
                max={availableBalance}
                required={true}
                helperText="Select or enter district sanction in Crores, Lakhs, or Thousands. Ex: 100 (Cr)."
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '10px' }} disabled={submitting || availableBalance <= 0}>
              <ShieldCheck size={16} />
              <span>{submitting ? 'Executing On-Chain District Allocation...' : 'Allocate Funds to District Agency'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AllocateToDistrict;
