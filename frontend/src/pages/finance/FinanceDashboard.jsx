import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Coins, Send, TrendingUp, Activity, ArrowRight } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

const FinanceDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/finance/dashboard')
      .then((res) => {
        if (res.success) setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--color-primary)" />
            <span>Finance Disbursal Authority Dashboard</span>
          </h1>
          <p className="page-subtitle">
            Sanction central budget allocations, execute state treasury transfers, and record multi-level fund movements on blockchain.
          </p>
        </div>

        <Link to="/finance/transfers" className="btn btn-primary">
          <Send size={15} />
          <span>Transfer to State Treasury</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Pending Disbursals"
          value={metrics?.pending_budgets_count || 0}
          icon={Coins}
          subtitle="Awaiting Finance Sanction"
        />
        <StatCard
          title="Total Disbursed to States"
          value={metrics?.total_disbursed || 0}
          icon={TrendingUp}
          isCurrency={true}
          subtitle="Transferred via Ethereum Ledger"
        />
        <StatCard
          title="Disbursal Transactions"
          value={metrics?.transfers_count || 0}
          icon={Activity}
          subtitle="On-Chain Confirmed"
        />
        <StatCard
          title="Supported States"
          value={metrics?.states_supported ?? 0}
          icon={Building2}
          subtitle="Regional Treasury Networks"
        />
      </div>

      {/* 2-Column: Pending Budgets & State Breakdown */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Coins size={18} color="var(--color-primary)" />
              <span>Pending Central Budgets for Disbursal</span>
            </div>
            <Link to="/finance/received-budgets" className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.pending_budgets?.length > 0 ? (
              data.pending_budgets.map((b) => (
                <div key={b.allocation_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{b.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ID: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{b.allocation_id}</span> | {b.department}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(b.amount - (b.disbursed_amount || 0))}
                    </div>
                    <Link to={`/finance/transfers?allocation_id=${b.allocation_id}`} className="btn btn-primary btn-sm" style={{ marginTop: '4px' }}>
                      Transfer
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No pending budget disbursals.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Building2 size={18} color="var(--color-primary)" />
              <span>State Treasury Disbursal Breakdown</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.state_breakdown?.length > 0 ? (
              data.state_breakdown.map((st, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '13px' }}>
                    {st._id || 'State Treasury'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(st.total_amount)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {st.transfer_count} On-Chain Disbursals
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Execute state transfers to see regional breakdown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
