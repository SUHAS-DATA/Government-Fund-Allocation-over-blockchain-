import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Send, Coins, TrendingUp, Building2, ShieldCheck } from 'lucide-react';
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
      {/* Institutional Hero Banner */}
      <div className="gov-hero-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <MapPin size={13} />
              <span>State Department of Finance • Regional Treasury</span>
            </div>
            <h1 className="gov-hero-title">
              State Treasury Authority Dashboard ({data?.state_name || 'State'})
            </h1>
            <p className="gov-hero-subtitle">
              Manage regional fund distributions from Central Finance to District Development Agencies with cryptographic tracking and ceiling checks.
            </p>
          </div>

          <Link 
            to="/state/allocations" 
            className="btn btn-sm"
            style={{ 
              backgroundColor: '#F59E0B', 
              color: '#0F172A', 
              borderColor: '#F59E0B',
              fontWeight: '800'
            }}
          >
            <Send size={14} />
            <span>Allocate to District</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <StatCard
          title="State Treasury Funds Received"
          value={metrics?.total_funds_received || 0}
          icon={Coins}
          color="green"
          isCurrency={true}
          subtitle={`${metrics?.received_transfers_count || 0} Central Transfers`}
        />
        <StatCard
          title="Allocated to District Agencies"
          value={metrics?.total_allocated_to_districts || 0}
          icon={TrendingUp}
          color="blue"
          isCurrency={true}
          subtitle={`${metrics?.district_allocations_count || 0} District Sanctions`}
        />
        <StatCard
          title="Remaining State Balance"
          value={metrics?.remaining_state_treasury_balance || 0}
          icon={Building2}
          color="teal"
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
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{f.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{f.transfer_id}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(f.amount)}</div>
                    <div style={{ marginTop: '3px' }}>
                      {f.blockchain_tx_hash && <BlockchainBadge txHash={f.blockchain_tx_hash} />}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
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
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13px' }}>
                    {d._id} District
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>{formatCurrency(d.total_allocated)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{d.alloc_count} Allocations</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
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
