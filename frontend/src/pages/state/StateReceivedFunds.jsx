import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Send } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const StateReceivedFunds = () => {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/state/received-funds').then((res) => {
      if (res.success) setFunds(res.received_funds || []);
    }).finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'Transfer ID',
      accessor: 'transfer_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.transfer_id}</strong>
    },
    {
      header: 'State Treasury',
      accessor: 'state_name',
      render: (r) => <span className="badge badge-info">{r.state_name} ({r.state_code})</span>
    },
    { header: 'Scheme Title', accessor: 'scheme_name' },
    { header: 'Department', accessor: 'department' },
    {
      header: 'Received Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    {
      header: 'Received Date',
      accessor: 'created_at',
      render: (r) => new Date(r.created_at).toLocaleString()
    },
    {
      header: 'Blockchain Tx',
      accessor: 'blockchain_tx_hash',
      render: (r) => <BlockchainBadge txHash={r.blockchain_tx_hash} blockNumber={r.blockchain_block} />
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        <Link to={`/state/allocations?transfer_id=${r.transfer_id}`} className="btn btn-primary btn-sm">
          <Send size={13} />
          <span>Allocate to District</span>
        </Link>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Coins size={24} color="var(--color-primary)" />
            <span>State Treasury Received Funds</span>
          </h1>
          <p className="page-subtitle">Disbursements received from Central Finance Authority anchored on blockchain.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={funds} searchKey="scheme_name" />
      </div>
    </div>
  );
};

export default StateReceivedFunds;
