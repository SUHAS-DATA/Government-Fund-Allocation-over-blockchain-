import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Coins, 
  MapPin, 
  ShieldAlert, 
  Activity, 
  TrendingUp, 
  FileSpreadsheet, 
  ArrowRight,
  Send,
  Plus,
  Calendar,
  Layers,
  CheckCircle2
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState('');

  const loadDashboard = (fy = '') => {
    setLoading(true);
    const query = fy ? `?fy=${fy}` : '';
    API.get(`/admin/dashboard${query}`)
      .then((res) => {
        if (res.success) {
          setData(res);
          if (!selectedFY && res.metrics?.selected_financial_year) {
            setSelectedFY(res.metrics.selected_financial_year);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard(selectedFY);
  }, [selectedFY]);

  const metrics = data?.metrics;
  const financialYears = data?.financial_years || [];

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--color-primary)" />
            <span>Central Government Super Administrator Dashboard</span>
          </h1>
          <p className="page-subtitle">
            Cabinet Secretariat & National Planning Commission • Sanctioned ceiling controls, multi-year cycles, and blockchain oversight.
          </p>
        </div>

        {/* Action Controls & Financial Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Financial Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <Calendar size={15} color="var(--color-primary)" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>CYCLE:</span>
            <select
              className="form-control form-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
              value={selectedFY || metrics?.selected_financial_year || '2026-27'}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              {financialYears.map((fy) => (
                <option key={fy.year} value={fy.year}>
                  FY {fy.year} {fy.status === 'ACTIVE' ? '(Current Active)' : `(${fy.status})`}
                </option>
              ))}
            </select>
          </div>

          <Link to="/admin/financial-years" className="btn btn-secondary btn-sm">
            <Calendar size={14} />
            <span>Manage FYs</span>
          </Link>

          <Link to="/admin/budget-allocation" className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>New Allocation</span>
          </Link>

          <Link to="/admin/send-to-finance" className="btn btn-secondary btn-sm">
            <Send size={14} />
            <span>Send to Finance</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Row for Selected FY */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Sanctioned Union Ceiling"
          value={metrics?.sanctioned_union_ceiling || 5000000000}
          icon={Coins}
          isCurrency={true}
          subtitle={`FY ${metrics?.selected_financial_year || '2026-27'} Total Ceiling`}
        />
        <StatCard
          title="Allocated to Schemes"
          value={metrics?.allocated_to_schemes || 0}
          icon={TrendingUp}
          isCurrency={true}
          subtitle={`${metrics?.fy_allocations_count || 0} Schemes in FY ${metrics?.selected_financial_year || '2026-27'}`}
        />
        <StatCard
          title="Remaining Unallocated"
          value={metrics?.remaining_unallocated_ceiling != null ? metrics.remaining_unallocated_ceiling : 5000000000}
          icon={Coins}
          isCurrency={true}
          subtitle="Available Ceiling Pool"
        />
        <StatCard
          title="Total Disbursed to States"
          value={metrics?.disbursed_to_states || 0}
          icon={Activity}
          isCurrency={true}
          subtitle="On-Chain State Releases"
        />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>GOVERNMENT SCHEMES</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
              {metrics?.schemes_count || 4} National Programs
            </div>
          </div>
          <Link to="/admin/schemes" className="btn btn-secondary btn-sm">Manage</Link>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>MONITORED PROJECTS</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
              {metrics?.active_projects_count || 0} Local Works
            </div>
          </div>
          <Link to="/public/projects" className="btn btn-secondary btn-sm">Directory</Link>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>FORENSIC FRAUD AUDITS</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: metrics?.open_fraud_alerts > 0 ? 'var(--color-danger)' : 'var(--color-success)', marginTop: '2px' }}>
              {metrics?.open_fraud_alerts || 0} Active Inquiries
            </div>
          </div>
          <Link to="/admin/audit-reports" className="btn btn-secondary btn-sm">Review</Link>
        </div>
      </div>

      {/* 2-Column: Recent Central Allocations & Recent State Transfers */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Coins size={18} color="var(--color-primary)" />
              <span>Central Allocations (FY {metrics?.selected_financial_year || '2026-27'})</span>
            </div>
            <Link to="/admin/budget-allocation" className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_allocations?.length > 0 ? (
              data.recent_allocations.map((a) => (
                <div key={a.allocation_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{a.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ID: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{a.allocation_id}</span> | {a.department} (FY {a.financial_year})
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>
                      {formatCurrency(a.amount)}
                    </div>
                    {a.blockchain_tx_hash && <BlockchainBadge txHash={a.blockchain_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No budget allocations created for FY {metrics?.selected_financial_year || '2026-27'} yet.
                <div style={{ marginTop: '8px' }}>
                  <Link to="/admin/budget-allocation" className="btn btn-primary btn-sm">
                    Create Allocation for this FY
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} color="var(--color-primary)" />
              <span>State Treasury Disbursals</span>
            </div>
            <Link to="/admin/blockchain-explorer" className="btn btn-secondary btn-sm">
              Explorer
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_transfers?.length > 0 ? (
              data.recent_transfers.map((t) => (
                <div key={t.transfer_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{t.state_name} Treasury</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      TRF: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{t.transfer_id}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(t.amount)}
                    </div>
                    {t.blockchain_tx_hash && <BlockchainBadge txHash={t.blockchain_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No state treasury disbursals recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
