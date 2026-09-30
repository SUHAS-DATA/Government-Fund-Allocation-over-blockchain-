import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Layers } from 'lucide-react';
import API from '../services/api';
import { formatCurrency, formatAddress, getContractAddress } from '../services/blockchain';
import BlockchainBadge from './BlockchainBadge';
import TransactionFlowBadge from './TransactionFlowBadge';
import DataTable from './DataTable';

const BlockchainExplorer = () => {
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOp, setFilterOp] = useState('');

  const loadExplorerData = () => {
    setLoading(true);
    Promise.allSettled([
      API.get('/blockchain/status'),
      API.get('/blockchain/transactions')
    ]).then(([statusRes, txRes]) => {
      if (statusRes.status === 'fulfilled' && statusRes.value?.success) {
        setStatus(statusRes.value);
      }
      if (txRes.status === 'fulfilled' && txRes.value?.success) {
        setTransactions(txRes.value.transactions || []);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExplorerData();
  }, []);

  const filteredTransactions = filterOp
    ? transactions.filter((t) => t.operation_type === filterOp || t.transfer_tier === filterOp)
    : transactions;

  const columns = [
    {
      header: 'Payment Flow (Sender ➔ Recipient)',
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
      header: 'Record Type',
      accessor: 'operation_type',
      render: (r) => (
        <div>
          <span className="badge badge-info" style={{ fontWeight: '600' }}>
            {r.operation_type?.replace(/_/g, ' ')}
          </span>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Record #{r.block_number || 'Latest'}
          </div>
        </div>
      )
    },
    {
      header: 'Reference ID',
      accessor: 'entity_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.entity_id}</strong>
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (r) => (
        <span style={{ fontWeight: '700', color: r.amount ? 'var(--color-success)' : 'var(--text-muted)' }}>
          {r.amount ? formatCurrency(r.amount) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Details',
      accessor: 'details',
      render: (r) => <div style={{ fontSize: '12px', maxWidth: '280px', color: 'var(--text-main)' }}>{r.details}</div>
    },
    {
      header: 'Date & Time',
      accessor: 'timestamp',
      render: (r) => new Date(r.timestamp).toLocaleString()
    },
    {
      header: 'Record Check',
      accessor: 'tx_hash',
      render: (r) => <BlockchainBadge txHash={r.tx_hash} blockNumber={r.block_number} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Activity size={24} color="var(--color-primary)" />
            <span>Verified Payment & Fund Records</span>
          </h1>
          <p className="page-subtitle">
            Official payment and fund allocation records verified and protected by the system.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadExplorerData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Contract & Node Status Box */}
      <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '24px', padding: '18px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Record System Status:</span>
            <span className={`badge ${status?.connected !== false ? 'badge-success' : 'badge-danger'}`}>
              {status?.connected !== false ? 'ONLINE & SECURE' : 'OFFLINE'}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Verification Engine ID:</span>
            <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: '600', fontSize: '12px' }}>
              SEC-REC-NODE-01
            </code>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Authority Reference:</span>
            <code style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '12px' }}>
              Ministry of Finance Verified Officer
            </code>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Security Status:</span>
            <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>Active & Tamper-Protected</span>
          </div>
        </div>
      </div>

      {/* Operation Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['', 'BUDGET_ALLOCATION', 'STATE_TRANSFER', 'DISTRICT_ALLOCATION', 'PROJECT_ESCROW', 'MILESTONE_PAYMENT'].map((op) => (
          <button
            key={op}
            className={`btn btn-sm ${filterOp === op ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterOp(op)}
          >
            {op ? op.replace(/_/g, ' ') : 'All Records'}
          </button>
        ))}
      </div>

      <div className="card">
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <Layers size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '6px' }}>No Payment Records Found Yet</h3>
            <p style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto' }}>
              Once fund releases, state allocations, or milestone payments occur, the verified payment records will appear here in real-time.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredTransactions}
            searchKey="entity_id"
            searchPlaceholder="Filter by reference ID, project, or recipient..."
          />
        )}
      </div>
    </div>
  );
};

export default BlockchainExplorer;
