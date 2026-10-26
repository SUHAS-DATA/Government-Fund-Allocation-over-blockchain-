import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  Landmark,
  FileSpreadsheet,
  Building,
  Layers,
  HardHat,
  Search,
  Filter,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Download,
  Info,
  ChevronRight,
  FileText,
  Eye,
  Check,
  X,
  Calendar,
  Layers3,
  BadgeAlert,
  Hash,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinancialYear } from '../../context/FinancialYearContext';
import API, { getApiBaseUrl } from '../../services/api';
import ThemeToggle from '../../components/ThemeToggle';
import FinancialYearSelector from '../../components/FinancialYearSelector';
import DataTable from '../../components/DataTable';

const BLOCK_ICONS = {
  super_admin: Landmark,
  finance: FileSpreadsheet,
  state: Building,
  district: Layers,
  contractor: HardHat
};

const BLOCK_COLORS = {
  super_admin: '#1E3A8A',
  finance: '#0F766E',
  state: '#0284C7',
  district: '#7C3AED',
  contractor: '#D97706'
};

const AuditorDashboard = () => {
  const { user, logout } = useAuth();
  const { selectedFY } = useFinancialYear();
  const navigate = useNavigate();

  // Navigation State
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'super_admin' | 'finance' | 'state' | 'district' | 'contractor' | 'central_log' | 'trace'
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Module Specific Data
  const [superAdminData, setSuperAdminData] = useState(null);
  const [financeData, setFinanceData] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [districtData, setDistrictData] = useState(null);
  const [contractorData, setContractorData] = useState(null);
  const [moduleLoading, setModuleLoading] = useState(false);

  // Centralized Audit Log State
  const [centralLogs, setCentralLogs] = useState([]);
  const [centralTotal, setCentralTotal] = useState(0);
  const [centralPage, setCentralPage] = useState(1);
  const [centralPages, setCentralPages] = useState(1);
  const [centralLoading, setCentralLoading] = useState(false);
  const [centralFilters, setCentralFilters] = useState({
    role: 'ALL',
    event_type: 'ALL',
    status: 'ALL',
    search: '',
    from_date: '',
    to_date: '',
    sort_by: 'timestamp',
    sort_dir: 'desc'
  });

  // Fund Journey Trace State
  const [traceId, setTraceId] = useState('');
  const [traceResult, setTraceResult] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');

  // Selected Record Detail Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  // 1. Fetch Dashboard Summary (The 5 Main Blocks)
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await API.get('/auditor/dashboard-summary', {
        params: { fy: selectedFY }
      });
      if (res.success) {
        setSummaryData(res);
      }
    } catch (err) {
      console.error('Failed to load auditor summary:', err);
    } finally {
      setLoadingSummary(false);
      setRefreshing(false);
    }
  }, [selectedFY]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // 2. Fetch Module Details on Tab Change
  const fetchModuleData = useCallback(async (tabName) => {
    setModuleLoading(true);
    try {
      if (tabName === 'super_admin') {
        const res = await API.get('/auditor/super-admin', { params: { fy: selectedFY, limit: 100 } });
        if (res.success) setSuperAdminData(res);
      } else if (tabName === 'finance') {
        const res = await API.get('/auditor/finance', { params: { fy: selectedFY, limit: 100 } });
        if (res.success) setFinanceData(res);
      } else if (tabName === 'state') {
        const res = await API.get('/auditor/state', { params: { fy: selectedFY, limit: 100 } });
        if (res.success) setStateData(res);
      } else if (tabName === 'district') {
        const res = await API.get('/auditor/district', { params: { fy: selectedFY, limit: 100 } });
        if (res.success) setDistrictData(res);
      } else if (tabName === 'contractor') {
        const res = await API.get('/auditor/contractor', { params: { limit: 100 } });
        if (res.success) setContractorData(res);
      }
    } catch (err) {
      console.error(`Error loading ${tabName} audit data:`, err);
    } finally {
      setModuleLoading(false);
    }
  }, [selectedFY]);

  useEffect(() => {
    if (['super_admin', 'finance', 'state', 'district', 'contractor'].includes(activeTab)) {
      fetchModuleData(activeTab);
    }
  }, [activeTab, fetchModuleData]);

  // 3. Fetch Centralized Audit Log
  const fetchCentralLogs = useCallback(async (pageToLoad = 1) => {
    setCentralLoading(true);
    try {
      const params = {
        page: pageToLoad,
        limit: 20,
        financial_year: selectedFY,
        sort_by: centralFilters.sort_by,
        sort_dir: centralFilters.sort_dir
      };
      if (centralFilters.role !== 'ALL') params.role = centralFilters.role;
      if (centralFilters.event_type !== 'ALL') params.event_type = centralFilters.event_type;
      if (centralFilters.status !== 'ALL') params.status_filter = centralFilters.status;
      if (centralFilters.search) params.search = centralFilters.search;
      if (centralFilters.from_date) params.from_date = centralFilters.from_date;
      if (centralFilters.to_date) params.to_date = centralFilters.to_date;

      const res = await API.get('/auditor/central-log', { params });
      if (res.success) {
        setCentralLogs(res.audit_logs || []);
        setCentralTotal(res.total_records || 0);
        setCentralPage(res.page || 1);
        setCentralPages(res.total_pages || 1);
      }
    } catch (err) {
      console.error('Failed to load central audit logs:', err);
    } finally {
      setCentralLoading(false);
    }
  }, [selectedFY, centralFilters]);

  useEffect(() => {
    if (activeTab === 'central_log') {
      fetchCentralLogs(1);
    }
  }, [activeTab, fetchCentralLogs]);

  // 4. Trace Fund Journey
  const handleTraceFund = async (e) => {
    if (e) e.preventDefault();
    const query = traceId.trim();
    if (!query) return;

    setTraceLoading(true);
    setTraceError('');
    setTraceResult(null);

    try {
      const res = await API.get(`/auditor/trace-fund/${encodeURIComponent(query)}`);
      if (res.success) {
        setTraceResult(res);
      } else {
        setTraceError(res.message || 'No fund journey record discovered for this identifier.');
      }
    } catch (err) {
      setTraceError(err?.message || 'Error executing fund journey trace.');
    } finally {
      setTraceLoading(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchSummary();
    if (['super_admin', 'finance', 'state', 'district', 'contractor'].includes(activeTab)) {
      fetchModuleData(activeTab);
    } else if (activeTab === 'central_log') {
      fetchCentralLogs(centralPage);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auditor/login?logged_out=1');
  };

  const exportCurrentRecords = (dataList, filename) => {
    if (!dataList || dataList.length === 0) return;
    const jsonStr = JSON.stringify(dataList, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_audit_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper formatting
  const formatAmount = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'No timestamp recorded';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return String(ts);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px', minHeight: '100vh' }}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & AUDITOR BANNER                                            */}
      {/* ========================================================================= */}
      <header style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <Scale size={28} color="#34D399" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                background: '#059669',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.05em'
              }}>
                CAG OVERSIGHT
              </span>
              <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: '500' }}>
                Comptroller & Auditor General of India
              </span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              National Auditor Portal & Ledger Cross-Examination
            </h1>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
              Strictly Read-Only Inspection • Continuous Multi-Tier Public Fund Audit
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <FinancialYearSelector compact={true} showLabel={true} />

          <button
            onClick={handleManualRefresh}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF'
            }}
            disabled={refreshing}
            title="Refresh verified records"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <ThemeToggle showLabel={false} />

          <button
            onClick={handleLogout}
            className="btn btn-danger"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Sign out of Auditor Portal"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. NAVIGATION BAR (MAIN 5 BLOCKS + CENTRAL LOG + FUND TRACE)              */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'overview' ? '2px solid #0F172A' : '1px solid var(--border-color)',
            background: activeTab === 'overview' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'overview' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'overview' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers3 size={16} color="#0F172A" />
          <span>Dashboard Overview (5 Blocks)</span>
        </button>

        <button
          onClick={() => setActiveTab('super_admin')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'super_admin' ? `2px solid ${BLOCK_COLORS.super_admin}` : '1px solid var(--border-color)',
            background: activeTab === 'super_admin' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'super_admin' ? BLOCK_COLORS.super_admin : 'var(--text-secondary)',
            fontWeight: activeTab === 'super_admin' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <Landmark size={16} />
          <span>1. Super Admin Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'finance' ? `2px solid ${BLOCK_COLORS.finance}` : '1px solid var(--border-color)',
            background: activeTab === 'finance' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'finance' ? BLOCK_COLORS.finance : 'var(--text-secondary)',
            fontWeight: activeTab === 'finance' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={16} />
          <span>2. Finance Dept Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('state')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'state' ? `2px solid ${BLOCK_COLORS.state}` : '1px solid var(--border-color)',
            background: activeTab === 'state' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'state' ? BLOCK_COLORS.state : 'var(--text-secondary)',
            fontWeight: activeTab === 'state' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <Building size={16} />
          <span>3. State Govt Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('district')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'district' ? `2px solid ${BLOCK_COLORS.district}` : '1px solid var(--border-color)',
            background: activeTab === 'district' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'district' ? BLOCK_COLORS.district : 'var(--text-secondary)',
            fontWeight: activeTab === 'district' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <Layers size={16} />
          <span>4. District Office Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('contractor')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'contractor' ? `2px solid ${BLOCK_COLORS.contractor}` : '1px solid var(--border-color)',
            background: activeTab === 'contractor' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'contractor' ? BLOCK_COLORS.contractor : 'var(--text-secondary)',
            fontWeight: activeTab === 'contractor' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <HardHat size={16} />
          <span>5. Contractor Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('central_log')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'central_log' ? '2px solid #2563EB' : '1px solid var(--border-color)',
            background: activeTab === 'central_log' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'central_log' ? '#2563EB' : 'var(--text-secondary)',
            fontWeight: activeTab === 'central_log' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <Database size={16} />
          <span>Centralized Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveTab('trace')}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: activeTab === 'trace' ? '2px solid #059669' : '1px solid var(--border-color)',
            background: activeTab === 'trace' ? 'var(--bg-surface)' : 'var(--bg-subtle)',
            color: activeTab === 'trace' ? '#059669' : 'var(--text-secondary)',
            fontWeight: activeTab === 'trace' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <TrendingUp size={16} />
          <span>5-Tier Fund Journey Trace</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB CONTENT: OVERVIEW (THE FIVE PRIMARY AUDIT BLOCKS)                  */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* Quick Metrics Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
            marginBottom: '24px'
          }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                Authoritative Audit Trail
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                {loadingSummary ? '...' : (summaryData?.total_audit_events || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Tamper-evident logs across 5 tiers
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563EB' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                On-Chain Recorded Transactions
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                {loadingSummary ? '...' : (summaryData?.total_blockchain_transactions || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Cryptographically hashed disbursements
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #7C3AED' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                Selected Financial Scope
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                {selectedFY || 'ALL YEARS'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Union & State budget cycle
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #0F172A' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                Statutory Access Clearance
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#059669', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={18} />
                <span>ACTIVE AUDITOR SESSION</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Authenticated as: {user?.name || user?.email}
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Five Primary Audit Modules
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Click "View Audit Records" on any department block to open the comprehensive audit ledger and reconciliation sheets.
              </p>
            </div>
          </div>

          {/* THE FIVE MAIN BLOCKS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {(summaryData?.modules || []).map((m) => {
              const Icon = BLOCK_ICONS[m.id] || Landmark;
              const color = BLOCK_COLORS[m.id] || '#0F172A';
              return (
                <div
                  key={m.id}
                  className="card"
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-md)',
                    borderTop: `4px solid ${color}`,
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: `${color}15`,
                          color: color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={22} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                            {m.name}
                          </h3>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                            {m.department}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        color: color,
                        background: `${color}10`,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${color}30`
                      }}>
                        {m.tier}
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
                      {m.description}
                    </p>

                    {/* Reliable Metrics Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      padding: '12px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '16px'
                    }}>
                      {(m.metrics || []).map((met, idx) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                            {met.label}
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                            {met.formatted || met.value.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Latest Activity Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                      <Clock size={13} color="var(--text-muted)" />
                      <span>Latest Recorded Activity: <strong>{formatTimestamp(m.latest_activity_timestamp)}</strong></span>
                    </div>
                  </div>

                  {/* View Records CTA Button */}
                  <div>
                    <button
                      onClick={() => setActiveTab(m.id)}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor: color,
                        borderColor: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>View {m.name} Records</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODULE 1: SUPER ADMIN AUDIT                                            */}
      {/* ========================================================================= */}
      {activeTab === 'super_admin' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Super Admin Audit Records
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                National Scheme Authorizations, Union Budget Ceilings, and Central Administrative Logs
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => exportCurrentRecords(superAdminData?.budget_allocations, 'super_admin_allocations')}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Download size={13} />
                <span>Export Allocations</span>
              </button>
            </div>
          </div>

          {/* Metrics summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL SANCTIONED CEILING</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: BLOCK_COLORS.super_admin, marginTop: '2px' }}>
                {superAdminData?.metrics?.total_sanctioned_formatted || '₹0.00'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>NATIONAL SCHEMES</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {superAdminData?.metrics?.schemes_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BUDGET ALLOCATIONS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {superAdminData?.metrics?.allocations_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ADMINISTRATIVE ACTIONS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {superAdminData?.metrics?.admin_logs_count || 0}
              </div>
            </div>
          </div>

          {/* Section: Budget Allocations */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Budget Allocations Sanctioned
            </h3>
            <DataTable
              columns={[
                { header: 'Allocation ID', accessor: 'allocation_id', render: (r) => <strong style={{ color: BLOCK_COLORS.super_admin }}>{r.allocation_id}</strong> },
                { header: 'Scheme Name', accessor: 'scheme_name' },
                { header: 'Department', accessor: 'department' },
                { header: 'FY', accessor: 'financial_year', render: (r) => <span className="badge badge-info">{r.financial_year}</span> },
                { header: 'Sanctioned Amount', accessor: 'amount', render: (r) => <strong>{formatAmount(r.amount)}</strong> },
                { header: 'Disbursed Amount', accessor: 'disbursed_amount', render: (r) => formatAmount(r.disbursed_amount || 0) },
                {
                  header: 'Status',
                  accessor: 'status',
                  render: (r) => (
                    <span className={`badge ${r.status === 'FULLY_DISBURSED' ? 'badge-success' : r.status === 'PARTIALLY_DISBURSED' ? 'badge-warning' : 'badge-primary'}`}>
                      {r.status}
                    </span>
                  )
                },
                { header: 'Sanctioned At', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) },
                {
                  header: 'Inspect',
                  accessor: 'action',
                  render: (r) => (
                    <button
                      onClick={() => setSelectedRecord({ title: `Allocation ${r.allocation_id}`, data: r })}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Details
                    </button>
                  )
                }
              ]}
              data={superAdminData?.budget_allocations || []}
              searchKeys={['allocation_id', 'scheme_name', 'department']}
              searchPlaceholder="Filter allocations..."
            />
          </div>

          {/* Section: National Schemes */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              National Schemes Created
            </h3>
            <DataTable
              columns={[
                { header: 'Scheme Code', accessor: 'code', render: (r) => <strong>{r.code}</strong> },
                { header: 'Scheme Name', accessor: 'name' },
                { header: 'Department', accessor: 'department_name' },
                { header: 'Target Budget', accessor: 'target_budget', render: (r) => formatAmount(r.target_budget) },
                { header: 'Financial Year', accessor: 'financial_year', render: (r) => <span className="badge badge-info">{r.financial_year}</span> },
                { header: 'Created Timestamp', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) }
              ]}
              data={superAdminData?.schemes || []}
              searchKeys={['code', 'name', 'department_name']}
              searchPlaceholder="Filter schemes..."
            />
          </div>

          {/* Section: Administrative Activity Logs */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Super Admin Administrative Activity Logs
            </h3>
            <DataTable
              columns={[
                { header: 'Audit ID', accessor: 'audit_id', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.audit_id}</span> },
                { header: 'Event Type', accessor: 'event_type', render: (r) => <span className="badge badge-primary">{r.event_type}</span> },
                { header: 'Action', accessor: 'action' },
                { header: 'Details', accessor: 'details' },
                { header: 'Target ID', accessor: 'target_id' },
                { header: 'Timestamp', accessor: 'timestamp', render: (r) => formatTimestamp(r.timestamp) }
              ]}
              data={superAdminData?.administrative_logs || []}
              searchKeys={['audit_id', 'event_type', 'details', 'target_id']}
              searchPlaceholder="Filter admin activity logs..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODULE 2: FINANCIAL DEPARTMENT AUDIT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'finance' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Financial Department Audit Records
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                State Treasury Fund Transfers, On-Chain Transaction Hashes, and Disbursal Reconciliations
              </div>
            </div>
            <button
              onClick={() => exportCurrentRecords(financeData?.state_transfers, 'finance_state_transfers')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Export Transfers</span>
            </button>
          </div>

          {/* Financial Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL DISBURSED TO STATES</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: BLOCK_COLORS.finance, marginTop: '2px' }}>
                {financeData?.metrics?.total_disbursed_formatted || '₹0.00'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>STATE TRANSFERS EXECUTED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {financeData?.metrics?.transfers_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BLOCKCHAIN VERIFIED TRANSFERS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                {financeData?.metrics?.completed_onchain_transfers || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>APPLICATION RECORDED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {financeData?.metrics?.app_recorded_transfers || 0}
              </div>
            </div>
          </div>

          {/* State Transfers Table with On-Chain Hashes */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Central Disbursals to State Treasuries
            </h3>
            <DataTable
              columns={[
                { header: 'Transfer ID', accessor: 'transfer_id', render: (r) => <strong style={{ color: BLOCK_COLORS.finance }}>{r.transfer_id}</strong> },
                { header: 'State', accessor: 'state_name', render: (r) => <span>{r.state_name} ({r.state_code})</span> },
                { header: 'Scheme Name', accessor: 'scheme_name' },
                { header: 'Amount Transferred', accessor: 'amount', render: (r) => <strong>{formatAmount(r.amount)}</strong> },
                {
                  header: 'Verification Type',
                  accessor: 'blockchain_tx_hash',
                  render: (r) => {
                    const hash = r.blockchain_tx_hash || r.blockchainTxHash;
                    if (hash && hash.startsWith('0x')) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>On-Chain Verified</span>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563EB', display: 'inline-flex', alignItems: 'center' }}
                            title="Inspect on Etherscan"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      );
                    }
                    return <span className="badge badge-secondary" style={{ fontSize: '10px' }}>Application Record</span>;
                  }
                },
                {
                  header: 'Blockchain Tx Hash',
                  accessor: 'blockchain_tx_hash',
                  render: (r) => {
                    const hash = r.blockchain_tx_hash || r.blockchainTxHash;
                    if (!hash) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Off-chain settlement</span>;
                    return (
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-main)' }}>
                        {hash.slice(0, 10)}...{hash.slice(-8)}
                      </span>
                    );
                  }
                },
                { header: 'Transferred By', accessor: 'transferred_by' },
                { header: 'Timestamp', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) },
                {
                  header: 'Inspect',
                  accessor: 'action',
                  render: (r) => (
                    <button
                      onClick={() => setSelectedRecord({ title: `State Transfer ${r.transfer_id}`, data: r })}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Details
                    </button>
                  )
                }
              ]}
              data={financeData?.state_transfers || []}
              searchKeys={['transfer_id', 'state_name', 'scheme_name', 'blockchain_tx_hash']}
              searchPlaceholder="Filter state transfers..."
            />
          </div>

          {/* Received Budget Allocations from Super Admin */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Budgets Approved for Disbursal
            </h3>
            <DataTable
              columns={[
                { header: 'Allocation ID', accessor: 'allocation_id', render: (r) => <strong>{r.allocation_id}</strong> },
                { header: 'Scheme Name', accessor: 'scheme_name' },
                { header: 'Sanctioned Budget', accessor: 'amount', render: (r) => formatAmount(r.amount) },
                { header: 'Disbursed to Date', accessor: 'disbursed_amount', render: (r) => formatAmount(r.disbursed_amount || 0) },
                { header: 'Remaining Unreleased', accessor: 'remaining', render: (r) => formatAmount(Math.max(0, (r.amount || 0) - (r.disbursed_amount || 0))) },
                { header: 'Status', accessor: 'status', render: (r) => <span className="badge badge-primary">{r.status}</span> },
                { header: 'Approved Date', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) }
              ]}
              data={financeData?.received_budgets || []}
              searchKeys={['allocation_id', 'scheme_name']}
              searchPlaceholder="Filter approved budgets..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODULE 3: STATE GOVERNMENT AUDIT & RECONCILIATION                      */}
      {/* ========================================================================= */}
      {activeTab === 'state' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                State Government Audit & Fund Reconciliation
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Comparison of Funds Received from Finance vs Transferred to Districts vs Recorded Balance
              </div>
            </div>
            <button
              onClick={() => exportCurrentRecords(stateData?.reconciliation_table, 'state_reconciliation')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Export Reconciliation</span>
            </button>
          </div>

          {/* CRITICAL FINANCIAL COMPARISON CARD */}
          <div className="card" style={{
            padding: '24px',
            marginBottom: '20px',
            background: 'var(--bg-surface)',
            borderLeft: '4px solid #0284C7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Scale size={18} color="#0284C7" />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Authoritative State Financial Comparison & Flow Equation
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Calculated using actual recorded transactions. Reconciles state treasury receipts with district project disbursements:
              <br />
              <strong>Funds Received from Finance → Funds Transferred to Districts → Remaining Recorded Balance</strong>
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              padding: '16px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>1. FUNDS RECEIVED FROM FINANCE</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0F766E', marginTop: '4px' }}>
                  {stateData?.reconciliation_summary?.total_funds_received_formatted || '₹0.00'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Verified Central Treasury Disbursals</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>2. TRANSFERRED TO DISTRICTS</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#7C3AED', marginTop: '4px' }}>
                  {stateData?.reconciliation_summary?.total_transferred_formatted || '₹0.00'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Dispatched to DRDAs & Collectorates</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>3. REMAINING RECORDED BALANCE</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284C7', marginTop: '4px' }}>
                  {stateData?.reconciliation_summary?.remaining_balance_formatted || '₹0.00'}
                </div>
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
                  Authoritative State Treasury Reserve
                </div>
              </div>
            </div>
          </div>

          {/* State-by-State Reconciliation Breakdown Table */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              State Treasury Reconciliation Breakdown
            </h3>
            <DataTable
              columns={[
                { header: 'State Code', accessor: 'state_code', render: (r) => <strong>{r.state_code}</strong> },
                { header: 'State Name', accessor: 'state_name' },
                { header: 'Funds Received (Finance)', accessor: 'funds_received', render: (r) => formatAmount(r.funds_received) },
                { header: 'Transferred (Districts)', accessor: 'funds_transferred_to_districts', render: (r) => formatAmount(r.funds_transferred_to_districts) },
                {
                  header: 'Remaining Recorded Balance',
                  accessor: 'remaining_recorded_balance',
                  render: (r) => <strong style={{ color: '#0284C7' }}>{formatAmount(r.remaining_recorded_balance)}</strong>
                },
                {
                  header: 'Status',
                  accessor: 'reconciliation_status',
                  render: (r) => (
                    <span className={`badge ${r.reconciliation_status === 'BALANCED' ? 'badge-success' : 'badge-danger'}`}>
                      {r.reconciliation_status}
                    </span>
                  )
                },
                { header: 'Transfer Count', accessor: 'transfers_received_count' }
              ]}
              data={stateData?.reconciliation_table || []}
              searchKeys={['state_code', 'state_name']}
              searchPlaceholder="Filter state reconciliations..."
            />
          </div>

          {/* District Allocations Records */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              State Allocations to District Offices
            </h3>
            <DataTable
              columns={[
                { header: 'District Alloc ID', accessor: 'district_alloc_id', render: (r) => <strong>{r.district_alloc_id}</strong> },
                { header: 'District', accessor: 'district_name' },
                { header: 'State', accessor: 'state_code' },
                { header: 'Scheme Name', accessor: 'scheme_name' },
                { header: 'Amount Allocated', accessor: 'amount', render: (r) => formatAmount(r.amount) },
                { header: 'Allocated By', accessor: 'allocated_by' },
                { header: 'Timestamp', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) }
              ]}
              data={stateData?.district_allocations || []}
              searchKeys={['district_alloc_id', 'district_name', 'scheme_name']}
              searchPlaceholder="Filter district allocations..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODULE 4: DISTRICT OFFICE AUDIT & VERIFICATION HISTORY                 */}
      {/* ========================================================================= */}
      {activeTab === 'district' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                District Office Audit & Verification History
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Clear separation between project workflow actions (evidence review) and actual financial transfers
              </div>
            </div>
            <button
              onClick={() => exportCurrentRecords(districtData?.verification_history, 'verification_history')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Export Proof Reviews</span>
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FUNDS FROM STATE</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284C7', marginTop: '2px' }}>
                {districtData?.metrics?.funds_received_formatted || '₹0.00'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ACTUALLY RELEASED TO VENDORS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                {districtData?.metrics?.funds_released_formatted || '₹0.00'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PROJECTS GOVERNED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {districtData?.metrics?.projects_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>EVIDENCE REVIEWS RECORDED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: BLOCK_COLORS.district, marginTop: '2px' }}>
                {districtData?.metrics?.evidence_reviews_count || 0}
              </div>
            </div>
          </div>

          {/* VERIFICATION HISTORY (CRITICAL AUDITOR REQUIREMENT) */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FileCheck2 size={18} color="#7C3AED" />
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Contractor Evidence Verification & Rejection History
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Records who submitted evidence, who reviewed it, date of review, approval/rejection outcome, and recorded reasons for rejection.
            </p>
            <DataTable
              columns={[
                { header: 'Evidence ID', accessor: 'evidence_id', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{r.evidence_id || r.evidenceId}</span> },
                { header: 'Project ID', accessor: 'project_id', render: (r) => <strong>{r.project_id || r.projectId}</strong> },
                { header: 'Milestone Phase', accessor: 'milestone_index', render: (r) => `Phase #${(r.milestone_index !== undefined ? r.milestone_index : 0) + 1}` },
                { header: 'Submitted By (Contractor)', accessor: 'contractor_name', render: (r) => r.contractor_name || r.contractor_id || 'Contractor' },
                { header: 'Reviewed By (District)', accessor: 'verified_by', render: (r) => r.verified_by || r.verifiedBy || 'Pending Review' },
                {
                  header: 'Outcome',
                  accessor: 'status',
                  render: (r) => (
                    <span className={`badge ${r.status === 'VERIFIED' ? 'badge-success' : r.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {r.status}
                    </span>
                  )
                },
                {
                  header: 'Rejection Reason / Notes',
                  accessor: 'rejection_reason',
                  render: (r) => r.rejection_reason || r.rejectionReason || r.description || <span style={{ color: 'var(--text-muted)' }}>None recorded</span>
                },
                { header: 'Review Date', accessor: 'verified_at', render: (r) => formatTimestamp(r.verified_at || r.verifiedAt || r.uploaded_at) }
              ]}
              data={districtData?.verification_history || []}
              searchKeys={['evidence_id', 'project_id', 'contractor_name', 'verified_by', 'status']}
              searchPlaceholder="Filter verification history..."
            />
          </div>

          {/* Actual Vendor Financial Payments */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Actual Financial Releases to Contractors
            </h3>
            <DataTable
              columns={[
                { header: 'Transaction ID', accessor: 'transaction_id', render: (r) => <strong>{r.transaction_id}</strong> },
                { header: 'Project Ref', accessor: 'related_project_id' },
                { header: 'Destination Entity', accessor: 'destination_entity_name' },
                { header: 'Released Amount', accessor: 'amount', render: (r) => <strong>{formatAmount(r.amount)}</strong> },
                { header: 'Status', accessor: 'status', render: (r) => <span className="badge badge-success">{r.status}</span> },
                {
                  header: 'On-Chain Tx Hash',
                  accessor: 'blockchain_tx_hash',
                  render: (r) => {
                    const hash = r.blockchain_tx_hash;
                    if (!hash) return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Local Bank Credit</span>;
                    return (
                      <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        {hash.slice(0, 10)}...{hash.slice(-8)}
                      </span>
                    );
                  }
                },
                { header: 'Payment Date', accessor: 'created_at', render: (r) => formatTimestamp(r.created_at) }
              ]}
              data={districtData?.contractor_payments || []}
              searchKeys={['transaction_id', 'related_project_id', 'destination_entity_name', 'blockchain_tx_hash']}
              searchPlaceholder="Filter vendor payments..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODULE 5: CONTRACTOR AUDIT                                             */}
      {/* ========================================================================= */}
      {activeTab === 'contractor' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Contractor Audit Records
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Statutory KYC Profiles (Masked Confidentials), Assigned Projects, and Verified Bank Credits
              </div>
            </div>
            <button
              onClick={() => exportCurrentRecords(contractorData?.contractor_profiles, 'contractor_profiles')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Export Profiles</span>
            </button>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL VERIFIED DISBURSED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: BLOCK_COLORS.contractor, marginTop: '2px' }}>
                {contractorData?.metrics?.total_verified_payments_formatted || '₹0.00'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>REGISTERED CONTRACTORS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {contractorData?.metrics?.registered_contractors_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CONTRACTS GOVERNED</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {contractorData?.metrics?.projects_assigned_count || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>VERIFIED BANK CREDITS</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                {contractorData?.metrics?.verified_payments_count || 0}
              </div>
            </div>
          </div>

          {/* Sanitized Contractor Profiles */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Contractor Onboarding & Statutory KYC Profiles
            </h3>
            <DataTable
              columns={[
                { header: 'Contractor ID', accessor: 'contractor_id', render: (r) => <strong>{r.contractor_id}</strong> },
                { header: 'Company Name', accessor: 'company_name' },
                { header: 'State / District', accessor: 'state_code', render: (r) => `${r.state_code || ''} • ${r.district_name || ''}` },
                { header: 'GSTIN', accessor: 'gst_number' },
                { header: 'PAN (Masked)', accessor: 'pan_masked' },
                { header: 'License Ref', accessor: 'license_number' },
                {
                  header: 'KYC Status',
                  accessor: 'kyc_status',
                  render: (r) => (
                    <span className={`badge ${r.kyc_status === 'APPROVED' ? 'badge-success' : r.kyc_status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {r.kyc_status}
                    </span>
                  )
                },
                {
                  header: 'State Dept Verified',
                  accessor: 'state_verified',
                  render: (r) => (r.state_verified ? <span className="badge badge-success">YES</span> : <span className="badge badge-secondary">NO</span>)
                },
                { header: 'Bank (Masked)', accessor: 'masked_account', render: (r) => `${r.bank_name || ''} (${r.masked_account || ''})` }
              ]}
              data={contractorData?.contractor_profiles || []}
              searchKeys={['contractor_id', 'company_name', 'gst_number', 'license_number']}
              searchPlaceholder="Filter contractor profiles..."
            />
          </div>

          {/* Assigned Projects */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
              Projects & Contracts Executed by Contractors
            </h3>
            <DataTable
              columns={[
                { header: 'Project ID', accessor: 'project_id', render: (r) => <strong>{r.project_id}</strong> },
                { header: 'Project Name', accessor: 'name' },
                { header: 'Contract Ref', accessor: 'contract_id' },
                { header: 'Assigned Contractor', accessor: 'contractor_id' },
                { header: 'Total Contract Budget', accessor: 'total_budget', render: (r) => formatAmount(r.total_budget) },
                { header: 'Released to Vendor', accessor: 'released_amount', render: (r) => formatAmount(r.released_amount || 0) },
                { header: 'Work Progress', accessor: 'progress_percentage', render: (r) => <span>{r.progress_percentage || 0}%</span> },
                { header: 'Status', accessor: 'status', render: (r) => <span className="badge badge-primary">{r.status}</span> }
              ]}
              data={contractorData?.assigned_projects || []}
              searchKeys={['project_id', 'name', 'contract_id', 'contractor_id']}
              searchPlaceholder="Filter contractor projects..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CENTRALIZED AUDIT LOG VIEW                                             */}
      {/* ========================================================================= */}
      {activeTab === 'central_log' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Centralized Multi-Tier Audit Trail
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Filter across all five departments, verify blockchain hashes, and inspect individual audit records.
              </div>
            </div>
            <button
              onClick={() => exportCurrentRecords(centralLogs, 'central_audit_logs')}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={13} />
              <span>Export Page JSON</span>
            </button>
          </div>

          {/* Filter Controls Card */}
          <div className="card" style={{ padding: '18px', marginBottom: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Department / Tier</label>
                <select
                  className="form-control form-select"
                  value={centralFilters.role}
                  onChange={(e) => setCentralFilters({ ...centralFilters, role: e.target.value })}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="ALL">All Departments</option>
                  <option value="SUPER_ADMIN">1. Super Admin</option>
                  <option value="FINANCE">2. Finance Department</option>
                  <option value="STATE">3. State Government</option>
                  <option value="DISTRICT">4. District Office</option>
                  <option value="CONTRACTOR">5. Contractor</option>
                  <option value="SYSTEM">System Automated</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Status</label>
                <select
                  className="form-control form-select"
                  value={centralFilters.status}
                  onChange={(e) => setCentralFilters({ ...centralFilters, status: e.target.value })}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Keyword Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ID, tx hash, scheme, actor..."
                  value={centralFilters.search}
                  onChange={(e) => setCentralFilters({ ...centralFilters, search: e.target.value })}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Sort Direction</label>
                <select
                  className="form-control form-select"
                  value={centralFilters.sort_dir}
                  onChange={(e) => setCentralFilters({ ...centralFilters, sort_dir: e.target.value })}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="desc">Newest First (Desc)</option>
                  <option value="asc">Oldest First (Asc)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', gap: '8px' }}>
              <button
                onClick={() => fetchCentralLogs(1)}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={centralLoading}
              >
                <Search size={13} />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* Centralized Records Table */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                Total Matching Records: <strong>{centralTotal.toLocaleString()}</strong>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {centralPage} of {centralPages}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Audit ID</th>
                    <th>Tier / Role</th>
                    <th>Event Type</th>
                    <th>Target Record</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Source Verification</th>
                    <th>Timestamp</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {centralLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No audit records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    centralLogs.map((log) => (
                      <tr key={log._id || log.audit_id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{log.audit_id}</span>
                        </td>
                        <td>
                          <span className={`badge ${
                            log.actor_role === 'SUPER_ADMIN' ? 'badge-primary' :
                            log.actor_role === 'FINANCE' ? 'badge-info' :
                            log.actor_role === 'STATE' ? 'badge-success' :
                            log.actor_role === 'DISTRICT' ? 'badge-warning' : 'badge-secondary'
                          }`}>
                            {log.actor_role || 'SYSTEM'}
                          </span>
                        </td>
                        <td>
                          <strong>{log.event_type}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.action}</div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace' }}>{log.target_id || 'N/A'}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.details ? log.details.slice(0, 40) + '...' : ''}</div>
                        </td>
                        <td>
                          {log.amount ? <strong>{formatAmount(log.amount)}</strong> : '—'}
                        </td>
                        <td>
                          <span className={`badge ${log.status === 'SUCCESS' || log.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>
                          {log.has_blockchain_record ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="badge badge-success" style={{ fontSize: '10px' }}>On-Chain</span>
                              {log.explorer_url && (
                                <a href={log.explorer_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '10px' }}>App DB</span>
                          )}
                        </td>
                        <td>{formatTimestamp(log.timestamp)}</td>
                        <td>
                          <button
                            onClick={() => setSelectedRecord({ title: `Audit Record ${log.audit_id}`, data: log })}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {centralPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => fetchCentralLogs(centralPage - 1)}
                  disabled={centralPage <= 1 || centralLoading}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  Page {centralPage} of {centralPages}
                </span>
                <button
                  onClick={() => fetchCentralLogs(centralPage + 1)}
                  disabled={centralPage >= centralPages || centralLoading}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. FIVE-TIER FUND JOURNEY TRACEABILITY ENGINE                           */}
      {/* ========================================================================= */}
      {activeTab === 'trace' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              5-Tier Fund Journey Traceability Engine
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Trace any fund allocation from the Central Secretariat all the way to contractor milestone execution:
              <br />
              <strong>Super Admin → Finance Department → State Government → District Office → Contractor</strong>
            </div>
          </div>

          {/* Search Card */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <form onSubmit={handleTraceFund} style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
                  placeholder="Enter Allocation ID (e.g. ALLOC-2027-28-UVQKHZ), Transfer ID, Project ID, or Scheme Code..."
                  value={traceId}
                  onChange={(e) => setTraceId(e.target.value)}
                  disabled={traceLoading}
                />
                <Hash size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0 20px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={traceLoading}
              >
                <Search size={15} />
                <span>{traceLoading ? 'Tracing...' : 'Trace Journey'}</span>
              </button>
            </form>

            {traceError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-danger)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={15} />
                <span>{traceError}</span>
              </div>
            )}
          </div>

          {/* Trace Results View */}
          {traceResult && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                    Trace Results for: <span style={{ color: '#0284C7' }}>{traceResult.identifier}</span>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Stages Discovered: <strong>{traceResult.stages_discovered} of 5 tiers</strong>
                  </div>
                </div>
                {traceResult.is_complete_chain ? (
                  <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 10px' }}>
                    Complete End-to-End Chain
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize: '11px', padding: '4px 10px' }}>
                    Partial Chain Detected
                  </span>
                )}
              </div>

              {/* Vertical Step Progress Flow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(traceResult.stages || []).map((stage, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '18px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `5px solid ${BLOCK_COLORS[stage.tier.toLowerCase()] || '#0F172A'}`,
                      background: 'var(--bg-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: BLOCK_COLORS[stage.tier.toLowerCase()] || '#0F172A',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {stage.tier}
                        </span>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                          {stage.tier_title}
                        </h4>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatTimestamp(stage.timestamp)}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px' }}>
                      {stage.scheme_name && <div>Scheme: <strong>{stage.scheme_name}</strong></div>}
                      {stage.amount !== undefined && <div>Amount: <strong style={{ color: '#059669' }}>{formatAmount(stage.amount)}</strong></div>}
                      {stage.actor && <div>Actor: <strong>{stage.actor}</strong></div>}
                      {stage.entity && <div>Authority: <strong>{stage.entity}</strong></div>}
                      {stage.district_name && <div>District: <strong>{stage.district_name}</strong></div>}
                      {stage.contractor_id && <div>Contractor Ref: <strong>{stage.contractor_id}</strong></div>}
                      {stage.status && <div>Status: <span className="badge badge-primary">{stage.status}</span></div>}
                    </div>

                    {stage.blockchain_tx_hash && (
                      <div style={{
                        marginTop: '10px',
                        padding: '6px 10px',
                        background: 'rgba(5, 150, 105, 0.08)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={14} color="#059669" />
                          <span>On-Chain Hash: <strong style={{ fontFamily: 'monospace' }}>{stage.blockchain_tx_hash}</strong></span>
                        </div>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${stage.blockchain_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563EB', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <span>Explorer</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD DETAIL MODAL                                                       */}
      {/* ========================================================================= */}
      {selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border-color)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={20} color="#059669" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  {selectedRecord.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <pre style={{
                background: 'var(--bg-subtle)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                overflowX: 'auto',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '1px solid var(--border-color)'
              }}>
                {JSON.stringify(selectedRecord.data, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditorDashboard;
