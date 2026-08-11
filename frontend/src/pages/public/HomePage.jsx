import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Coins, 
  MapPin, 
  Search, 
  ShieldCheck, 
  Activity, 
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress, getContractAddress } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';
import UserTypeSelector from '../../components/UserTypeSelector';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import { getAllStates, getDistrictsByState } from '../../config/statesDistrictsData';

const HomePage = () => {
  const [stats, setStats] = useState(null);
  const [hierarchy, setHierarchy] = useState(null);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/public/stats').then((res) => {
      if (res.success) setStats(res.stats);
    });
    API.get('/public/hierarchy').then((res) => {
      if (res.success) setHierarchy(res);
    });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedState) params.append('state', selectedState);
    if (selectedDistrict) params.append('district', selectedDistrict);
    if (selectedDept) params.append('department', selectedDept);
    if (searchKeyword) params.append('search', searchKeyword);
    navigate(`/public/projects?${params.toString()}`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Hero Banner */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '36px 32px',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-success">ETH-COMPATIBLE LIVE LEDGER</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hardhat EVM (31337)</span>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            National Public Financial Management & Blockchain Fund Allocation
          </h1>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            End-to-end multi-tier tracking of union and state financial allocations from the Central Secretariat to grassroots infrastructure projects with smart contract escrows and cryptographic SHA-256 document audits.
          </p>
        </div>

        {/* Multi-Tier Search Form */}
        <form onSubmit={handleSearch} style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr) auto',
          gap: '12px',
          alignItems: 'center'
        }}>
          <StateDistrictSelector
            selectedState={selectedState}
            selectedDistrict={selectedDistrict}
            onStateChange={(st) => setSelectedState(st)}
            onDistrictChange={(dist) => setSelectedDistrict(dist)}
            showAllOption={true}
            allStatesLabel="All States / UTs"
            allDistrictsLabel="All Districts"
            stateLabel="1. State Treasury"
            districtLabel="2. District Agency"
            showIcons={false}
            layout="bare"
          />

          <div>
            <label className="form-label" style={{ fontSize: '11px' }}>3. Ministry / Dept</label>
            <select
              className="form-control form-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {hierarchy?.departments?.map((d) => (
                <option key={d.code} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '11px' }}>4. Project Keyword</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rural Roads, Bridge..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 20px' }}>
              <Search size={15} />
              <span>Search</span>
            </button>
          </div>
        </form>
      </div>

      {/* Interactive Select User Type & Role-Based Gateway Section */}
      <UserTypeSelector showDiagram={true} />

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Sanctioned Union Budget"
          value={stats?.total_allocated_budget || 4000000000}
          icon={Coins}
          isCurrency={true}
          subtitle="FY 2026-27 Active Cycle"
        />
        <StatCard
          title="Total Treasury Disbursals"
          value={stats?.total_disbursed_funds || 1250000000}
          icon={TrendingUp}
          isCurrency={true}
          subtitle="On-Chain State Releases"
        />
        <StatCard
          title="Monitored Local Projects"
          value={stats?.total_projects_count || 12}
          icon={Building2}
          subtitle="Grassroots Infrastructure"
        />
        <StatCard
          title="Blockchain Transactions"
          value={stats?.blockchain_transactions_count || 32}
          icon={Activity}
          subtitle="100% Cryptographically Logged"
        />
      </div>

      {/* 2-Column: Key Features & Transparency Link */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span>Multi-Level Hierarchical Governance</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
            Funds flow sequentially from the Central Union Ministry through State Treasury accounts and District Development Agencies to escrow-locked project milestones:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: '500' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-primary)' }}>
              1. Central Super Admin → Sanctions ministerial ceilings & national schemes
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-accent)' }}>
              2. Finance Authority → Verifies allocations & transfers to State Treasuries
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-warning)' }}>
              3. State Treasury → Disburses allocations to District Development Agencies
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-success)' }}>
              4. District Collector → Creates projects, binds contractor escrow & releases milestone funds
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="var(--color-primary)" />
              <span>Public Citizen Transparency & Oversight</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
            Citizens and civic watchdogs can inspect live budget expenditure, review photographic milestone progress, verify off-chain document SHA-256 hashes against Ethereum blocks, and file grievances.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
            <Link to="/public/projects" className="btn btn-primary" style={{ flex: 1 }}>
              <span>Browse Public Projects</span>
              <ArrowRight size={14} />
            </Link>
            <Link to="/public/grievance" className="btn btn-secondary" style={{ flex: 1 }}>
              <span>File Citizen Grievance</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
