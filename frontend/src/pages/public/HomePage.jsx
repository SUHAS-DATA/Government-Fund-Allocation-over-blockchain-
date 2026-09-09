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
        <div style={{ maxWidth: '800px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '-0.5px', margin: 0 }}>
            National Public Financial Management & Blockchain Fund Allocation
          </h1>
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

      {/* Running Active Schemes Marquee Ticker */}
      <div className="schemes-marquee-wrapper">
        <div className="schemes-marquee-badge">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981' }}></span>
          <span>Active Schemes</span>
        </div>

        <div className="schemes-marquee-track-container">
          <div className="schemes-marquee-track">
            {((hierarchy?.schemes && hierarchy.schemes.length > 0) ? hierarchy.schemes : [
              { code: 'PMGSY', name: 'Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)', department_name: 'Road Transport & Infrastructure', target_budget: 1200000000 },
              { code: 'JAL-JEEVAN', name: 'National Jal Jeevan Mission (Functional Tap Water)', department_name: 'Jal Shakti & Rural Water Supply', target_budget: 1000000000 },
              { code: 'NHIM', name: 'National Health Infrastructure Mission (Trauma Hospitals)', department_name: 'Health & Family Welfare', target_budget: 800000000 },
              { code: 'SAMAGRA-SHIKSHA', name: 'Samagra Shiksha Digital Classroom Infrastructure', department_name: 'Primary & Secondary Education', target_budget: 500000000 },
              { code: 'PM-KISAN-INFRA', name: 'Agriculture Infrastructure Fund & Cold Storage Mission', department_name: 'Agriculture & Farmer Welfare', target_budget: 450000000 }
            ]).concat((hierarchy?.schemes && hierarchy.schemes.length > 0) ? hierarchy.schemes : [
              { code: 'PMGSY', name: 'Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)', department_name: 'Road Transport & Infrastructure', target_budget: 1200000000 },
              { code: 'JAL-JEEVAN', name: 'National Jal Jeevan Mission (Functional Tap Water)', department_name: 'Jal Shakti & Rural Water Supply', target_budget: 1000000000 },
              { code: 'NHIM', name: 'National Health Infrastructure Mission (Trauma Hospitals)', department_name: 'Health & Family Welfare', target_budget: 800000000 },
              { code: 'SAMAGRA-SHIKSHA', name: 'Samagra Shiksha Digital Classroom Infrastructure', department_name: 'Primary & Secondary Education', target_budget: 500000000 },
              { code: 'PM-KISAN-INFRA', name: 'Agriculture Infrastructure Fund & Cold Storage Mission', department_name: 'Agriculture & Farmer Welfare', target_budget: 450000000 }
            ]).map((scheme, idx) => (
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
                  fontFamily: 'monospace'
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
                  fontWeight: '700',
                  color: 'var(--color-success)',
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {formatCurrency(scheme.target_budget || scheme.budget_allocated || 1000000000)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Approved National Budget"
          value={stats?.total_allocated_budget || 4000000000}
          icon={Coins}
          isCurrency={true}
          subtitle="FY 2026-27 Active Cycle"
        />
        <StatCard
          title="Total Payments Released"
          value={stats?.total_disbursed_funds || 1250000000}
          icon={TrendingUp}
          isCurrency={true}
          subtitle="Verified Blockchain Transfers"
        />
        <StatCard
          title="Active Local Projects"
          value={stats?.total_projects_count || 12}
          icon={Building2}
          subtitle="Community Infrastructure"
        />
        <StatCard
          title="Blockchain Transactions"
          value={stats?.blockchain_transactions_count || 32}
          icon={Activity}
          subtitle="100% Permanently Recorded"
        />
      </div>

      {/* 2-Column: Key Features & Transparency Link */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={18} color="var(--color-primary)" />
              <span>Multi-Level Fund Flow</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
            Funds flow step-by-step from the Central Ministry through State Treasuries and District Offices to project milestone payments:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: '500' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-primary)' }}>
              1. Central Admin → Approves scheme budget limits & national programs
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-accent)' }}>
              2. Finance Ministry → Releases approved funds to State Treasuries
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-warning)' }}>
              3. State Treasury → Sends funds to District Development Offices
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)', borderLeft: '3px solid var(--color-success)' }}>
              4. District Officer → Sets up projects, assigns contractors & approves milestone payments
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={18} color="var(--color-primary)" />
              <span>Public Tracking & Citizen Complaints</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
            Citizens can track live project spending, view work photos, verify document records on the blockchain, and report any problems directly.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
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
