import React, { useState, useEffect } from 'react';
import { Activity, Search, ShieldCheck, ArrowRight, Layers, Filter } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatTxHash } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import TransactionFlowBadge from '../../components/TransactionFlowBadge';
import DataTable from '../../components/DataTable';

const PublicExplorer = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTierFilter, setActiveTierFilter] = useState('ALL');

  useEffect(() => {
    API.get('/blockchain/transactions')
      .then((res) => {
        if (res.success) setTransactions(res.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const tierFilters = [
    { id: 'ALL', label: 'All Transfers' },
    { id: 'CENTRAL_TO_FINANCE', label: '1. Central ➔ Finance' },
    { id: 'FINANCE_TO_STATE', label: '2. Finance ➔ State Treasury' },
    { id: 'STATE_TO_DISTRICT', label: '3. State ➔ District Agency' },
    { id: 'DISTRICT_TO_ESCROW', label: '4. District ➔ Project Escrow' },
    { id: 'ESCROW_TO_CONTRACTOR', label: '5. Escrow ➔ Contractor' }
  ];

  const filteredTransactions = transactions.filter((t) => {
    if (activeTierFilter === 'ALL') return true;
    if (t.transfer_tier === activeTierFilter) return true;
    // Fallback based on operation_type
    if (activeTierFilter === 'CENTRAL_TO_FINANCE' && t.operation_type === 'CENTRAL_BUDGET_ALLOCATION') return true;
    if (activeTierFilter === 'FINANCE_TO_STATE' && (t.operation_type === 'FINANCE_STATE_TRANSFER' || t.operation_type === 'STATE_TRANSFER')) return true;
    if (activeTierFilter === 'STATE_TO_DISTRICT' && t.operation_type === 'STATE_DISTRICT_ALLOCATION') return true;
    if (activeTierFilter === 'DISTRICT_TO_ESCROW' && t.operation_type === 'PROJECT_ESCROW_CREATION') return true;
    if (activeTierFilter === 'ESCROW_TO_CONTRACTOR' && t.operation_type === 'MILESTONE_PAYMENT_RELEASE') return true;
    return false;
  });

  const columns = [
    {
      header: 'Transfer Flow (Sender ➔ Recipient)',
      accessor: 'from_address',
      render: (r) => (
        <TransactionFlowBadge
          fromAddress={r.from_address}
          toAddress={r.to_address}
          fromEntity={r.from_entity}
          toEntity={r.to_entity}
          flowStage={r.flow_stage}
        />
      )
    },
    {
      header: 'Operation / Reference ID',
      accessor: 'entity_id',
      render: (r) => (
        <div>
          <span className="badge badge-info" style={{ fontSize: '10px' }}>
            {r.operation_type?.replace(/_/g, ' ')}
          </span>
          <div style={{ color: 'var(--color-primary)', fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', marginTop: '3px' }}>
            {r.entity_id}
          </div>
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (r) => (
        <span style={{ fontWeight: '700', color: r.amount > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
          {r.amount ? formatCurrency(r.amount) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Description',
      accessor: 'details',
      render: (r) => (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
          {r.details || '-'}
        </div>
      )
    },
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (r) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {new Date(r.timestamp).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Blockchain Receipt',
      accessor: 'tx_hash',
      render: (r) => <BlockchainBadge txHash={r.tx_hash} blockNumber={r.block_number} />
    }
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">
            <Activity size={24} color="var(--color-primary)" />
            <span>Public Blockchain Ledger Explorer</span>
          </h1>
          <p className="page-subtitle">
            Complete multi-tier financial ledger tracking funds from Central Ministry ➔ State Treasury ➔ District Agency ➔ Project Escrows ➔ Contractor Wallets.
          </p>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginRight: '4px' }}>
          <Filter size={14} />
          <span>Stage:</span>
        </div>
        {tierFilters.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTierFilter(tab.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: activeTierFilter === tab.id ? '700' : '500',
              backgroundColor: activeTierFilter === tab.id ? 'var(--color-primary)' : '#FFFFFF',
              color: activeTierFilter === tab.id ? '#FFFFFF' : 'var(--text-main)',
              border: activeTierFilter === tab.id ? 'none' : '1px solid var(--border-color)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={filteredTransactions}
          searchKey="entity_id"
          searchPlaceholder="Search by Project ID, Transfer ID, or Allocation ID..."
        />
      </div>
    </div>
  );
};

export default PublicExplorer;
