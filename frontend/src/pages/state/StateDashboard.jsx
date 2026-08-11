import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Send, Coins, TrendingUp, Building2 } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

const StateDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/state/dashboard')
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
            <MapPin size={24} color="var(--color-primary)" />
            <span>State Treasury Authority Dashboard ({data?.state_name || 'Maharashtra'})</span>
          </h1>
          <p className="page-subtitle">
            Manage regional fund distributions from Central Finance to District Development Agencies.
          </p>
        </div>

        <Link to="/state/allocations" className="btn btn-primary">
          <Send size={15} />
          <span>Allocate to District</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <StatCard
          title="State Treasury Funds Received"
          value={metrics?.total_funds_received || 0}
          icon={Coins}
          isCurrency={true}
          subtitle={`${metrics?.received_transfers_count || 0} Central Transfers`}
        />
        <StatCard
          title="Allocated to District Agencies"
          value={metrics?.total_allocated_to_districts || 0}
          icon={TrendingUp}
          isCurrency={true}
          subtitle={`${metrics?.district_allocations_count || 0} District Sanctions`}
        />
        <StatCard
          title="Remaining State Balance"
          value={metrics?.remaining_state_treasury_balance || 0}
          icon={Building2}
          isCurrency={true}
          subtitle="Available for Regional Distribution"
        />
      </div>

      {/* 2-Column: Recent Received & District Breakdown */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Coins size={18} color="var(--color-primary)" />
              <span>Funds Received from Finance Authority</span>
            </div>
            <Link to="/state/received-funds" className="btn btn-secondary btn-sm">View All</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_received_funds?.length > 0 ? (
              data.recent_received_funds.map((f) => (
                <div key={f.transfer_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{f.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {f.transfer_id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(f.amount)}</div>
                    {f.blockchain_tx_hash && <BlockchainBadge txHash={f.blockchain_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No central transfers received yet.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <MapPin size={18} color="var(--color-primary)" />
              <span>District Allocations Breakdown</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.district_breakdown?.length > 0 ? (
              data.district_breakdown.map((d, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '13px' }}>{d._id} District</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(d.total_allocated)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.alloc_count} Allocations</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                Allocate funds to districts to see regional breakdown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StateDashboard;
