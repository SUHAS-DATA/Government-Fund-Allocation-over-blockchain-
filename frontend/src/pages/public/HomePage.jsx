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
  Cpu,
  Lock,
  CheckCircle2,
  Layers,
  Sparkles
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatAddress, getContractAddress } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';
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
    }).catch(() => {});
    API.get('/public/hierarchy').then((res) => {
      if (res.success) setHierarchy(res);
    }).catch(() => {});
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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Hero Banner with Official Government Aesthetic */}
      <div className="gov-hero-banner" style={{ marginBottom: '32px', padding: '36px 36px 32px 36px' }}>
        <div style={{ maxWidth: '850px', marginBottom: '24px' }}>
          <div className="gov-hero-pill">
            <ShieldCheck size={13} />
            <span>Official Digital Governance Portal • Government of India</span>
          </div>
          <h1 className="gov-hero-title" style={{ fontSize: '30px', lineHeight: '1.2' }}>
            National Public Financial Management & Blockchain Fund Allocation Ledger
          </h1>
          <p className="gov-hero-subtitle" style={{ fontSize: '14px', marginTop: '8px' }}>
            Transparent Allocation. Accountable Governance. Cryptographic Integrity. Trace every rupee sanctioned by the Union Ministry through State Treasuries and District Offices down to verified milestone releases.
          </p>
        </div>

        {/* Multi-Tier Search Form */}
        <form onSubmit={handleSearch} style={{
          background: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr) auto',
          gap: '14px',
          alignItems: 'center',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
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
            <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-main)' }}>3. Ministry / Dept</label>
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
            <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-main)' }}>4. Project Keyword</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rural Roads, Bridge..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ height: '40px', padding: '0 24px', fontWeight: '800' }}
            >
              <Search size={15} />
              <span>Search</span>
            </button>
          </div>
        </form>
      </div>

      {/* Running Active Schemes Marquee Ticker */}
      {hierarchy?.schemes && hierarchy.schemes.length > 0 && (
        <div className="schemes-marquee-wrapper">
          <div className="schemes-marquee-badge">
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981' }}></span>
            <span>Active Schemes</span>
          </div>

          <div className="schemes-marquee-track-container">
            <div className="schemes-marquee-track">
              {hierarchy.schemes.concat(hierarchy.schemes).map((scheme, idx) => (
                <Link
                  key={idx}
                  to={`/public/projects?scheme=${encodeURIComponent(scheme.name)}`}
                  className="schemes-marquee-item"
                  title={`View active projects under ${scheme.name}`}
                >
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-primary-bg)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-border)',
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>
                    {scheme.code}
                  </span>

                  <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                    {scheme.name}
                  </span>

                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    ({scheme.department_name || scheme.department_code || 'National'})
                  </span>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: 'var(--color-success)',
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {formatCurrency(scheme.target_budget || scheme.budget_allocated || 0)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Approved National Budget"
          value={stats?.total_allocated_budget ?? 0}
          icon={Coins}
          color="green"
          isCurrency={true}
          subtitle="National Sanctions Pool"
        />
        <StatCard
          title="Total Payments Released"
          value={stats?.total_disbursed_funds ?? 0}
          icon={TrendingUp}
          color="teal"
          isCurrency={true}
          subtitle="Verified Blockchain Releases"
        />
        <StatCard
          title="Active Local Projects"
          value={stats?.total_projects_count ?? 0}
          icon={Building2}
          color="blue"
          subtitle="Community Infrastructure"
        />
        <StatCard
          title="Blockchain Transactions"
          value={stats?.blockchain_transactions_count ?? 0}
          icon={Activity}
          color="orange"
          subtitle="100% Permanently Recorded"
        />
      </div>

      {/* 2-Column: Key Features & Transparency Link */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span>Multi-Level Fund Flow Architecture</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
            Funds flow step-by-step from the Central Ministry through State Treasuries and District Offices to project milestone payments, with every step cryptographically verified:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: '600' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #0D5C3A' }}>
              1. Central Super Admin → Approves scheme budget limits & national program ceilings
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #1D4ED8' }}>
              2. Finance Ministry → Releases approved funds to State Treasuries on Ethereum ledger
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #EA580C' }}>
              3. State Treasury → Disburses allocations to District Development Agencies
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #059669' }}>
              4. District Officer → Deploys local projects, verifies KYC & approves smart contract releases
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="var(--color-primary)" />
              <span>Public Tracking & Citizen Redressal</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
            Citizens can track live project spending, inspect geo-tagged site evidence, verify document records on the blockchain, and report any anomalies directly to district vigilance officers.
          </p>

          <div style={{
            background: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Lock size={20} color="var(--color-primary)" />
            <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: '600' }}>
              All transactions are permanently etched onto the Ethereum blockchain ledger with zero possibility of retroactive tampering or falsification.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
            <Link to="/public/projects" className="btn btn-primary" style={{ flex: 1 }}>
              <span>Browse Public Projects</span>
              <ArrowRight size={14} />
            </Link>
            <Link to="/public/grievance" className="btn btn-secondary" style={{ flex: 1 }}>
              <span>Report Issue / Complaint</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
