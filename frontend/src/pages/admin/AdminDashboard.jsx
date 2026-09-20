import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  CheckCircle2,
  ShieldCheck,
  FolderKanban,
  Sparkles,
  Users,
  Settings,
  FileCheck
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';

// Sub-components for admin tabs
import UserManagement from './UserManagement';
import Departments from './Departments';
import Schemes from './Schemes';
import BudgetAllocation from './BudgetAllocation';
import SendToFinance from './SendToFinance';
import FinancialYears from './FinancialYears';
import AuditReportsReview from './AuditReportsReview';
import AuditExplorer from '../auditor/AuditExplorer';

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState('');

  const setTab = (t) => {
    setSearchParams({ tab: t });
  };

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
      {/* Government Institutional Hero Banner */}
      <div className="gov-hero-banner" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <ShieldCheck size={13} />
              <span>National Planning & Public Finance Oversight</span>
            </div>
            <h1 className="gov-hero-title">
              Central Government Super Administrator Dashboard
            </h1>
            <p className="gov-hero-subtitle">
              Cabinet Secretariat & Ministry of Finance • Union budget ceiling management, multi-year national schemes, user access control, and multi-tier blockchain ledger tracking.
            </p>
          </div>

          {/* Quick Action Controls & Financial Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Financial Year Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <Calendar size={14} color="var(--color-primary)" />
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>CYCLE:</span>
              <select
                className="form-control form-select"
                style={{
                  width: 'auto',
                  height: '30px',
                  padding: '2px 24px 2px 6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)'
                }}
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

            <button 
              type="button"
              onClick={() => setTab('config')}
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'transparent', fontWeight: '700' }}
            >
              <Calendar size={13} />
              <span>Manage FYs</span>
            </button>

            <button 
              type="button"
              onClick={() => setTab('allocation')}
              className="btn btn-sm"
              style={{ 
                backgroundColor: '#F59E0B', 
                color: '#0F172A', 
                borderColor: '#F59E0B',
                fontWeight: '800'
              }}
            >
              <Plus size={14} />
              <span>New Allocation</span>
            </button>

            <button 
              type="button"
              onClick={() => setTab('send_finance')}
              className="btn btn-secondary btn-sm"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'transparent', fontWeight: '700' }}
            >
              <Send size={13} />
              <span>Send to Finance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
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
          <span>System Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('users')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'users' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'users' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={15} />
          <span>User Management</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('departments')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'departments' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'departments' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'departments' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={15} />
          <span>Department Management</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('schemes')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'schemes' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'schemes' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'schemes' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={15} />
          <span>Scheme Management</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('allocation')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'allocation' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'allocation' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'allocation' ? '800' : '600',
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
          <span>Budget Allocation</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('send_finance')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'send_finance' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'send_finance' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'send_finance' ? '800' : '600',
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
          <span>Send to Finance</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('monitoring')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'monitoring' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'monitoring' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'monitoring' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Activity size={15} />
          <span>System Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('audits')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'audits' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'audits' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'audits' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldAlert size={15} />
          <span>Audit Review</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('config')}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderBottom: activeTab === 'config' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'config' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Settings size={15} />
          <span>System Config</span>
        </button>
      </div>

      {/* Sub-tab rendering */}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'departments' && <Departments />}
      {activeTab === 'schemes' && <Schemes />}
      {activeTab === 'allocation' && <BudgetAllocation />}
      {activeTab === 'send_finance' && <SendToFinance />}
      {activeTab === 'monitoring' && <AuditExplorer />}
      {activeTab === 'audits' && <AuditReportsReview />}
      {activeTab === 'config' && <FinancialYears />}

      {/* Overview tab rendering */}
      {activeTab === 'overview' && (
        <>
      {/* KPI Metrics Row for Selected FY */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Sanctioned Union Ceiling"
          value={metrics?.sanctioned_union_ceiling ?? 0}
          icon={Coins}
          color="green"
          isCurrency={true}
          subtitle={`FY ${metrics?.selected_financial_year || '2026-27'} Total Ceiling`}
        />
        <StatCard
          title="Allocated to Schemes"
          value={metrics?.allocated_to_schemes ?? 0}
          icon={TrendingUp}
          color="blue"
          isCurrency={true}
          subtitle={`${metrics?.fy_allocations_count ?? 0} Schemes in FY ${metrics?.selected_financial_year || '2026-27'}`}
        />
        <StatCard
          title="Remaining Unallocated"
          value={metrics?.remaining_unallocated_ceiling ?? 0}
          icon={Coins}
          color="orange"
          isCurrency={true}
          subtitle="Available Ceiling Pool"
        />
        <StatCard
          title="Total Disbursed to States"
          value={metrics?.disbursed_to_states ?? 0}
          icon={Activity}
          color="teal"
          isCurrency={true}
          subtitle="On-Chain State Releases"
        />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1D4ED8'
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                GOVERNMENT SCHEMES
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {metrics?.schemes_count ?? 0} National Programs
              </div>
            </div>
          </div>
          <Link to="/admin/schemes" className="btn btn-secondary btn-sm">Manage</Link>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#15803D'
            }}>
              <FolderKanban size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MONITORED PROJECTS
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {metrics?.active_projects_count || 0} Local Works
              </div>
            </div>
          </div>
          <Link to="/public/projects" className="btn btn-secondary btn-sm">Directory</Link>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: metrics?.open_fraud_alerts > 0 ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${metrics?.open_fraud_alerts > 0 ? '#FECACA' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: metrics?.open_fraud_alerts > 0 ? '#DC2626' : '#15803D'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                FORENSIC FRAUD AUDITS
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: metrics?.open_fraud_alerts > 0 ? 'var(--color-danger)' : 'var(--color-success)', marginTop: '2px' }}>
                {metrics?.open_fraud_alerts || 0} Active Inquiries
              </div>
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
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{a.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{a.allocation_id}</span> • {a.department} (FY {a.financial_year})
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '14px' }}>
                      {formatCurrency(a.amount)}
                    </div>
                    <div style={{ marginTop: '3px' }}>
                      {a.blockchain_tx_hash && <BlockchainBadge txHash={a.blockchain_tx_hash} />}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                No budget allocations created for FY {metrics?.selected_financial_year || '2026-27'} yet.
                <div style={{ marginTop: '12px' }}>
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
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{t.state_name} Treasury</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      TRF: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{t.transfer_id}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(t.amount)}
                    </div>
                    <div style={{ marginTop: '3px' }}>
                      {t.blockchain_tx_hash && <BlockchainBadge txHash={t.blockchain_tx_hash} />}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                No state treasury disbursals recorded yet.
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

export default AdminDashboard;
