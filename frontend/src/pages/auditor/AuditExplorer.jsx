import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, RefreshCw, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress, getContractAddress, copyToClipboard } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const AuditExplorer = () => {
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOp, setFilterOp] = useState('');

  const loadExplorerData = () => {
    setLoading(true);
    API.get('/auditor/blockchain-explorer')
      .then((res) => {
        if (res.success) {
          setTransactions(res.transactions || []);
          if (res.status) setStatus(res.status);
        }
      })
      .catch(() => {
        // Fallback to /blockchain/status & /blockchain/transactions
        API.get('/blockchain/status').then((res) => {
          if (res.success) setStatus(res);
        });
        API.get('/blockchain/transactions').then((res) => {
          if (res.success) setTransactions(res.transactions || []);
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExplorerData();
  }, []);

  const filteredTransactions = filterOp
    ? transactions.filter((t) => t.operation_type === filterOp)
    : transactions;

  const columns = [
    {
      header: 'Block / Operation',
      accessor: 'operation_type',
      render: (r) => (
        <div>
          <span className="badge badge-info" style={{ fontWeight: '600' }}>
            {r.operation_type?.replace(/_/g, ' ')}
          </span>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Block #{r.block_number || 'Latest'}
          </div>
        </div>
      )
    },
    {
      header: 'Entity / Target ID',
      accessor: 'entity_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.entity_id}</strong>
    },
    {
      header: 'Disbursed / Ceiling Amount',
      accessor: 'amount',
      render: (r) => (
        <span style={{ fontWeight: '700', color: r.amount ? 'var(--color-success)' : 'var(--text-muted)' }}>
          {r.amount ? formatCurrency(r.amount) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Details & On-Chain State',
      accessor: 'details',
      render: (r) => <div style={{ fontSize: '12px', maxWidth: '280px', color: 'var(--text-main)' }}>{r.details}</div>
    },
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (r) => new Date(r.timestamp).toLocaleString()
    },
    {
      header: 'Receipt Tx Hash',
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
            <span>Forensic Blockchain Ledger Explorer</span>
          </h1>
          <p className="page-subtitle">
            Cryptographic ledger transactions recorded on the local EVM blockchain network with verified gas receipts.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadExplorerData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Contract & Node Status Box */}
      <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '24px', padding: '18px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>EVM Node Status:</span>
            <span className={`badge ${status?.connected !== false ? 'badge-success' : 'badge-danger'}`}>
              {status?.connected !== false ? `CONNECTED (Chain ID ${status?.chain_id || 1337})` : 'DISCONNECTED'}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Smart Contract Address:</span>
            <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: '600', fontSize: '12px' }}>
              {status?.contract_address || getContractAddress()}
            </code>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Signer Wallet Address:</span>
            <code style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '12px' }}>
              {status?.wallet_address || '0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B'}
            </code>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RPC Endpoint:</span>
            <span style={{ fontWeight: '500' }}>{status?.rpc_url || 'http://127.0.0.1:7545'}</span>
          </div>
        </div>
      </div>

      {/* Operation Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['', 'BUDGET_ALLOCATION', 'STATE_TRANSFER', 'DISTRICT_ALLOCATION', 'PROJECT_ESCROW', 'MILESTONE_PAYMENT', 'FREEZE', 'UNFREEZE', 'AUDIT_REPORT'].map((op) => (
          <button
            key={op}
            className={`btn btn-sm ${filterOp === op ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterOp(op)}
          >
            {op ? op.replace(/_/g, ' ') : 'All Transactions'}
          </button>
        ))}
      </div>

      <div className="card">
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <Layers size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <h3 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '6px' }}>No Blockchain Transactions Yet</h3>
            <p style={{ fontSize: '13px', maxWidth: '440px', margin: '0 auto' }}>
              Once you perform actions (e.g. Budget Allocation, State Transfer, Milestone Payment, or Project Freeze), the on-chain receipts will appear here in real-time.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredTransactions}
            searchKey="entity_id"
            searchPlaceholder="Filter by entity, project, or allocation ID..."
          />
        )}
      </div>
    </div>
  );
};

export default AuditExplorer;
