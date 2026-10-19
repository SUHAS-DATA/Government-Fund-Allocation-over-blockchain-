import React, { useState, useEffect } from 'react';
import { FileText, Eye, ShieldCheck, Landmark, CheckCircle2 } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { useRealtimeSync } from '../../context/RealtimeContext';
import { useFinancialYear } from '../../context/FinancialYearContext';

const FinanceHistory = () => {
  const { selectedFY } = useFinancialYear();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [autoVerifyModal, setAutoVerifyModal] = useState(false);

  const loadHistory = async () => {
    try {
      const fyParam = selectedFY && selectedFY !== 'ALL' ? `&fy=${selectedFY}` : '';
      const legacyFyParam = selectedFY && selectedFY !== 'ALL' ? `?fy=${selectedFY}` : '';

      // First check universal financial transactions
      const txRes = await API.get(`/transactions?transaction_type=CENTRAL_TO_STATE${fyParam}`);
      if (txRes.success && txRes.transactions && txRes.transactions.length > 0) {
        setTransfers(txRes.transactions);
        return;
      }

      // Fallback to finance/transfers
      const legacyRes = await API.get(`/finance/transfers${legacyFyParam}`);
      if (legacyRes.success) {
        setTransfers(legacyRes.transfers || []);
      }
    } catch (err) {
      console.error('Error loading finance transfer history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedFY]);

  useRealtimeSync(loadHistory, { interval: 6000 });

  const handleOpenModal = (tx, verifyNow = false) => {
    setSelectedTx(tx);
    setAutoVerifyModal(verifyNow);
  };

  const columns = [
    {
      header: 'Payment Reference',
      accessor: 'transaction_id',
      render: (r) => {
        const txId = r.transaction_id || r.transactionId;
        const trfId = r.transfer_id || r.related_transfer_id;
        return (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginRight: '4px' }}>
                  TX:
                </span>
                <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '13px' }}>
                  {txId || trfId || 'N/A'}
                </strong>
              </div>
              {trfId && txId && trfId !== txId && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginRight: '4px' }}>
                    Transfer ID:
                  </span>
                  <span>{trfId}</span>
                </div>
              )}
            </div>
            {r.related_scheme_name && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.related_scheme_name}</div>
            )}
          </div>
        );
      }
    },
    {
      header: 'From (Sending Account)',
      accessor: 'source_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.source_entity_name || 'Central Office'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.source_masked_account || 'XXXX XXXX 6451'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {r.source_bank_name || 'Reserve Bank of India'}
          </div>
        </div>
      )
    },
    {
      header: 'To (Receiving Account)',
      accessor: 'destination_entity_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
            {r.destination_entity_name || r.state_name || 'State Government Account'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {r.destination_masked_account || 'XXXX XXXX 8472'}
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
            <span>Central → State Payment History</span>
          </h1>
          <p className="page-subtitle">
            Payment records transferring approved funds from Central Office to State Government Accounts.
          </p>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={transfers}
          searchKeys={[
            'transaction_id',
            'transactionId',
            'transfer_id',
            'related_transfer_id',
            'destination_entity_name',
            'destination_account_id',
            'destination_masked_account',
            'destination_bank_name',
            'source_entity_name',
            'source_account_id',
            'source_masked_account',
            'source_bank_name',
            'state_name',
            'state_code',
            'related_scheme_name',
            'blockchain_tx_hash'
          ]}
          searchPlaceholder="Search by payment reference, state, or account..."
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

export default FinanceHistory;

