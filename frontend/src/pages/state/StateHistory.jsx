import React, { useState, useEffect } from 'react';
import { FileText, Eye, ShieldCheck, Landmark, CheckCircle2 } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { useRealtimeSync } from '../../context/RealtimeContext';

const StateHistory = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [autoVerifyModal, setAutoVerifyModal] = useState(false);

  const loadHistory = async () => {
    try {
      // First check universal financial transactions for state to district
      const txRes = await API.get('/transactions?transaction_type=STATE_TO_DISTRICT');
      if (txRes.success && txRes.transactions && txRes.transactions.length > 0) {
        setAllocations(txRes.transactions);
        return;
      }

      // Fallback to legacy state/allocations
      const res = await API.get('/state/allocations');
      if (res.success) {
        setAllocations(res.allocations || []);
      }
    } catch (err) {
      console.error('Error loading state allocation history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useRealtimeSync(loadHistory, { interval: 6000 });

  const handleOpenModal = (tx, verifyNow = false) => {
    setSelectedTx(tx);
    setAutoVerifyModal(verifyNow);
  };

  const columns = [
    {
      header: 'Payment Reference',
      accessor: 'transaction_id',
      render: (r) => (
        <div>
          <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '13px' }}>
            {r.transaction_id || r.district_alloc_id}
          </strong>
          {r.related_scheme_name && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.related_scheme_name}</div>
          )}
        </div>
      )
    },
    {
      header: 'From (State Account)',
      accessor: 'source_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.source_entity_name || 'State Government Account'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.source_masked_account || 'XXXX XXXX 8472'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {r.source_bank_name || 'State Bank of India'}
          </div>
        </div>
      )
    },
    {
      header: 'To (District Office)',
      accessor: 'destination_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.destination_entity_name || `${r.district_name || 'District'} Development Office`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.destination_masked_account || 'XXXX XXXX 3914'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {r.destination_bank_name || 'Canara Bank'}
          </div>
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (r) => (
        <span style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>
          {formatCurrency(r.amount)}
        </span>
      )
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (r) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {new Date(r.created_at).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span style={{
          background: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '3px 8px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: '700',
          border: '1px solid var(--color-success-border)'
        }}>
          {r.status || 'COMPLETED'}
        </span>
      )
    },
    {
      header: 'Record Check',
      accessor: 'blockchain_tx_hash',
      render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: '700',
            color: '#059669'
          }}>
            <CheckCircle2 size={12} />
            {r.blockchain_status || 'VERIFIED'}
          </span>
          <BlockchainBadge txHash={r.blockchain_tx_hash} blockNumber={r.blockchain_block} />
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleOpenModal(r, false)}
            style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="View payment details & account info"
          >
            <Eye size={12} />
            <span>View</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenModal(r, true)}
            style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Check and verify payment record"
          >
            <ShieldCheck size={12} />
            <span>Verify</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileText size={24} color="var(--color-primary)" />
            <span>State → District Payment History</span>
          </h1>
          <p className="page-subtitle">
            Payment records transferring funds directly from State Government Accounts to District Offices.
          </p>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={allocations}
          searchKey="transaction_id"
          searchPlaceholder="Search by payment reference, district, or account..."
        />
      </div>

      {selectedTx && (
        <TransactionDetailsModal
          isOpen={true}
          transaction={selectedTx}
          autoVerify={autoVerifyModal}
          onClose={() => {
            setSelectedTx(null);
            setAutoVerifyModal(false);
          }}
        />
      )}
    </div>
  );
};

export default StateHistory;

