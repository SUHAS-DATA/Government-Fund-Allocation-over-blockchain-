import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const MilestonePayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/contractor/payments')
      .then((res) => {
        if (res.success) setPayments(res.payments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'Payment / Tx Hash',
      accessor: 'tx_hash',
      render: (r) => <BlockchainBadge txHash={r.tx_hash} blockNumber={r.block_number} />
    },
    { header: 'Project ID', accessor: 'entity_id', render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.entity_id}</strong> },
    {
      header: 'Disbursed Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    { header: 'Payment Purpose', accessor: 'details' },
    {
      header: 'Receipt Date',
      accessor: 'timestamp',
      render: (r) => new Date(r.timestamp).toLocaleString()
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CreditCard size={24} color="var(--color-primary)" />
            <span>Milestone Payment Receipts</span>
          </h1>
          <p className="page-subtitle">Verifiable smart contract escrow disbursements transferred to your contractor wallet.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={payments} searchKey="entity_id" searchPlaceholder="Search by Project ID..." />
      </div>
    </div>
  );
};

export default MilestonePayments;
