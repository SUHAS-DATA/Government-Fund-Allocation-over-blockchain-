import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Coins, Send, TrendingUp, Activity, ArrowRight, ShieldCheck, FileSpreadsheet, History } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

// Sub-components for finance tabs
import ReceivedBudgets from './ReceivedBudgets';
import TransferToState from './TransferToState';
import FinanceHistory from './FinanceHistory';

const FinanceDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const setTab = (t) => {
    setSearchParams({ tab: t });
  };

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
      {/* Institutional Hero Banner */}
      <div className="gov-hero-banner" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <ShieldCheck size={13} />
              <span>Ministry of Finance • Disbursal Authority</span>
            </div>
            <h1 className="gov-hero-title">
              Finance Disbursal Authority Dashboard
            </h1>
            <p className="gov-hero-subtitle">
              Sanction central budget allocations, execute state treasury transfers, and record multi-level fund movements on the immutable Ethereum ledger.
            </p>
          </div>

          <button 
            type="button"
            onClick={() => setTab('release')}
            className="btn btn-sm"
            style={{ 
              backgroundColor: '#F59E0B', 
              color: '#0F172A', 
              borderColor: '#F59E0B',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Send size={14} />
            <span>Transfer to State Treasury</span>
          </button>
        </div>
      </div>

      {/* Finance Module Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          type="button"
          onClick={() => setTab('overview')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'overview' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'overview' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Building2 size={15} />
          <span>Budget Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('pending')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'pending' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'pending' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Coins size={15} />
          <span>Pending Budgets & Requests ({metrics?.pending_budgets_count || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('release')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'release' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'release' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'release' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Send size={15} />
          <span>Fund Release & Disbursals</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('history')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'history' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <History size={15} />
          <span>Disbursal History & Ledger</span>
        </button>
      </div>

      {/* Sub-tab rendering */}
      {activeTab === 'pending' && <ReceivedBudgets />}
      {activeTab === 'release' && <TransferToState />}
      {activeTab === 'history' && <FinanceHistory />}

      {/* Overview tab rendering */}
      {activeTab === 'overview' && (
        <>
          {/* Metrics Row */}
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <StatCard
              title="Pending Disbursals"
              value={metrics?.pending_budgets_count || 0}
              icon={Coins}
              color="orange"
              subtitle="Awaiting Finance Sanction"
            />
            <StatCard
              title="Total Disbursed to States"
              value={metrics?.total_disbursed || 0}
              icon={TrendingUp}
              color="green"
              isCurrency={true}
              subtitle="Transferred via Ethereum Ledger"
            />
            <StatCard
              title="Disbursal Transactions"
              value={metrics?.transfers_count || 0}
              icon={Activity}
              color="teal"
              subtitle="On-Chain Confirmed"
            />
            <StatCard
              title="Supported States"
              value={metrics?.states_supported ?? 0}
              icon={Building2}
              color="blue"
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
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTab('pending')}
                >
                  View All
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.pending_budgets?.length > 0 ? (
                  data.pending_budgets.map((b) => (
                    <div key={b.allocation_id} style={{
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
                        <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{b.scheme_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{b.allocation_id}</span> • {b.department}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>
                          {formatCurrency(b.amount - (b.disbursed_amount || 0))}
                        </div>
                        <button 
                          type="button"
                          onClick={() => setTab('release')}
                          className="btn btn-primary btn-sm" 
                          style={{ marginTop: '6px' }}
                        >
                          <span>Transfer →</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
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
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13px' }}>
                        {st._id || 'State Treasury'}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>
                          {formatCurrency(st.total_amount)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {st.transfer_count} On-Chain Disbursals
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    Execute state transfers to see regional breakdown.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceDashboard;

