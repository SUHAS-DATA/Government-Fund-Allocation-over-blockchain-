import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const StateHistory = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/state/allocations')
      .then((res) => {
        if (res.success) setAllocations(res.allocations || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'District Alloc ID',
      accessor: 'district_alloc_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.district_alloc_id}</strong>
    },
    { header: 'District Name', accessor: 'district_name' },
    { header: 'Scheme Title', accessor: 'scheme_name' },
    {
      header: 'Allocated Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    { header: 'Allocated By', accessor: 'allocated_by' },
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
            <span>District Allocation History</span>
          </h1>
          <p className="page-subtitle">Historical records of fund allocations distributed to District Development Agencies.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={allocations} searchKey="district_name" searchPlaceholder="Search by district name..." />
      </div>
    </div>
  );
};

export default StateHistory;
