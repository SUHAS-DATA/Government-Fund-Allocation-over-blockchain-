import React, { useState, useEffect } from 'react';
import { Activity, Search, ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatTxHash } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const PublicExplorer = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/blockchain/transactions')
      .then((res) => {
        if (res.success) setTransactions(res.transactions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'Operation',
      accessor: 'operation_type',
      render: (r) => <span className="badge badge-info">{r.operation_type?.replace(/_/g, ' ')}</span>
    },
    {
      header: 'Entity / Project ID',
      accessor: 'entity_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.entity_id}</strong>
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{r.amount ? formatCurrency(r.amount) : '-'}</span>
    },
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (r) => new Date(r.timestamp).toLocaleString()
    },
    {
      header: 'Blockchain Receipt',
      accessor: 'tx_hash',
      render: (r) => <BlockchainBadge txHash={r.tx_hash} blockNumber={r.block_number} />
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Activity size={24} color="var(--color-primary)" />
            <span>Public Blockchain Ledger Explorer</span>
          </h1>
          <p className="page-subtitle">Verifiable immutable transactions recorded on the Ethereum blockchain network.</p>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={transactions}
          searchKey="entity_id"
          searchPlaceholder="Search by Project ID or Allocation ID..."
        />
      </div>
    </div>
  );
};

export default PublicExplorer;
