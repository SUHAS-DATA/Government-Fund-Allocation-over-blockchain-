import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const FinanceHistory = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/finance/transfers')
      .then((res) => {
        if (res.success) setTransfers(res.transfers || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'Transfer ID',
      accessor: 'transfer_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.transfer_id}</strong>
    },
    { header: 'State Treasury', accessor: 'state_name' },
    { header: 'Scheme Title', accessor: 'scheme_name' },
    {
      header: 'Disbursed Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    { header: 'Disbursed By', accessor: 'transferred_by' },
    {
      header: 'Timestamp',
      accessor: 'created_at',
      render: (r) => new Date(r.created_at).toLocaleString()
    },
    {
      header: 'Blockchain Tx',
      accessor: 'blockchain_tx_hash',
      render: (r) => <BlockchainBadge txHash={r.blockchain_tx_hash} blockNumber={r.blockchain_block} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileText size={24} color="var(--color-primary)" />
            <span>State Treasury Disbursal History</span>
          </h1>
          <p className="page-subtitle">Immutable log of central finance disbursements to state treasury accounts.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={transfers} searchKey="state_name" searchPlaceholder="Search by state or transfer ID..." />
      </div>
    </div>
  );
};

export default FinanceHistory;
