import React, { useState, useEffect } from 'react';
import { CreditCard, Eye, ShieldCheck, Landmark, CheckCircle2 } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { useRealtimeSync } from '../../context/RealtimeContext';

const MilestonePayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [autoVerifyModal, setAutoVerifyModal] = useState(false);

  const fetchPayments = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    API.get('/contractor/payments')
      .then((res) => {
        if (res.success) setPayments(res.payments || []);
      })
      .catch((err) => console.error('Error fetching payments:', err))
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    fetchPayments(true);
  }, []);

  useRealtimeSync(() => fetchPayments(false), { interval: 6000 });

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
            {r.transaction_id || r.tx_hash?.substring(0, 14) + '...'}
          </strong>
          {r.related_project_id && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Project: <span style={{ fontFamily: 'monospace' }}>{r.related_project_id}</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'From (District Office)',
      accessor: 'source_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.source_entity_name || 'District Development Office'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.source_masked_account || 'XXXX XXXX 3914'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {r.source_bank_name || 'Canara Bank'}
          </div>
        </div>
      )
    },
    {
      header: 'To (Contractor Account)',
      accessor: 'destination_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.destination_entity_name || 'Registered Contractor Account'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.destination_masked_account || 'XXXX XXXX 0293'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {r.destination_bank_name || 'State Bank of India'}
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
      header: 'Receipt Date',
      accessor: 'created_at',
      render: (r) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {new Date(r.created_at || r.timestamp || Date.now()).toLocaleString()}
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
      render: (r) => {
        const hash = r.blockchain_tx_hash || r.tx_hash;
        return (
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
            <BlockchainBadge txHash={hash} blockNumber={r.blockchain_block || r.block_number} />
          </div>
        );
      }
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
            <CreditCard size={24} color="var(--color-primary)" />
            <span>Payment Receipts</span>
          </h1>
          <p className="page-subtitle">
            Verified payment records transferred to your registered contractor bank account.
          </p>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={payments}
          searchKey="transaction_id"
          searchPlaceholder="Search by payment reference, project, or purpose..."
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

export default MilestonePayments;

