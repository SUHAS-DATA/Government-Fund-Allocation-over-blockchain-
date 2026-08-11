import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import DataTable from '../../components/DataTable';

const ReceivedBudgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [verifyingId, setVerifyingId] = useState(null);

  const loadBudgets = () => {
    API.get('/finance/received-budgets').then((res) => {
      if (res.success) setBudgets(res.budgets || []);
    });
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleVerify = async (allocId) => {
    setVerifyingId(allocId);
    try {
      await API.post(`/finance/verify-budget/${allocId}`);
      loadBudgets();
    } catch (e) {
      alert(e.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const columns = [
    { header: 'Allocation ID', accessor: 'allocation_id', render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.allocation_id}</strong> },
    { header: 'Scheme Title', accessor: 'scheme_name' },
    { header: 'Department', accessor: 'department' },
    { header: 'Total Sanctioned', accessor: 'amount', render: (r) => <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(r.amount)}</span> },
    {
      header: 'Disbursed to States',
      accessor: 'disbursed_amount',
      render: (r) => (
        <div>
          <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.disbursed_amount || 0)}</span>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Remaining: {formatCurrency(r.amount - (r.disbursed_amount || 0))}
          </div>
        </div>
      )
    },
    {
      header: 'Verification Status',
      accessor: 'verification_status',
      render: (r) => (
        r.verification_status === 'VERIFIED' ? (
          <span className="badge badge-success">
            <CheckCircle2 size={12} />
            <span>VERIFIED</span>
          </span>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleVerify(r.allocation_id)}
            disabled={verifyingId === r.allocation_id}
          >
            <ShieldCheck size={13} />
            <span>{verifyingId === r.allocation_id ? 'Verifying...' : 'Verify Budget'}</span>
          </button>
        )
      )
    },
    {
      header: 'Actions',
      accessor: 'action',
      render: (r) => (
        <Link to={`/finance/transfers?allocation_id=${r.allocation_id}`} className="btn btn-primary btn-sm">
          <Send size={13} />
          <span>Disburse Funds</span>
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
            <span>Received Central Budgets</span>
          </h1>
          <p className="page-subtitle">Verify budget sanctions and initiate state treasury transfers.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={budgets} searchKey="scheme_name" />
      </div>
    </div>
  );
};

export default ReceivedBudgets;
