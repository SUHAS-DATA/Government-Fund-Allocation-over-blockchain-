import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  Building, 
  Landmark, 
  FileSpreadsheet, 
  Briefcase, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Layers,
  Zap,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLE_PORTALS = [
  {
    id: 'SUPER_ADMIN',
    title: 'Super Admin',
    badge: 'Central Secretariat',
    icon: Landmark,
    accentColor: '#1E3A8A',
    lightBg: 'rgba(30, 58, 138, 0.08)',
    description: 'National budget approval, scheme setup, user account management, and audit reports.',
    defaultEmail: 'admin@govtfund.gov.in',
    defaultPassword: 'Admin@123',
    jurisdictions: [
      { label: 'National Central Secretariat', email: 'admin@govtfund.gov.in', pass: 'Admin@123' }
    ]
  },
  {
    id: 'FINANCE',
    title: 'Finance Dept',
    badge: 'Ministry of Finance',
    icon: FileSpreadsheet,
    accentColor: '#0F766E',
    lightBg: 'rgba(15, 118, 110, 0.08)',
    description: 'Check approved budgets, transfer funds to States, and track government payments.',
    defaultEmail: 'finance@govtfund.gov.in',
    defaultPassword: 'Finance@123',
    jurisdictions: [
      { label: 'Central Finance Authority', email: 'finance@govtfund.gov.in', pass: 'Finance@123' }
    ]
  },
  {
    id: 'STATE',
    title: 'State Treasury',
    badge: 'State Planning & Finance',
    icon: Building,
    accentColor: '#0369A1',
    lightBg: 'rgba(3, 105, 161, 0.08)',
    description: 'Receive central funds and allocate budgets to District Development Offices (KA, MH, GJ, TN, UP).',
    defaultEmail: 'karnataka@govtfund.gov.in',
    defaultPassword: 'State@123',
    jurisdictions: [
      { label: 'Karnataka State Treasury (KA)', email: 'karnataka@govtfund.gov.in', pass: 'State@123' },
      { label: 'Maharashtra State Treasury (MH)', email: 'state@govtfund.gov.in', pass: 'State@123' },
      { label: 'Gujarat State Treasury (GJ)', email: 'gujarat@govtfund.gov.in', pass: 'State@123' },
      { label: 'Tamil Nadu State Treasury (TN)', email: 'tamilnadu@govtfund.gov.in', pass: 'State@123' },
      { label: 'Uttar Pradesh State Treasury (UP)', email: 'up@govtfund.gov.in', pass: 'State@123' }
    ]
  },
  {
    id: 'DISTRICT',
    title: 'District Agency',
    badge: 'District Planning & DRDA',
    icon: Layers,
    accentColor: '#7C3AED',
    lightBg: 'rgba(124, 58, 237, 0.08)',
    description: 'Create development projects, assign contractors, inspect site progress, and release payments.',
    defaultEmail: 'district.belagavi@govtfund.gov.in',
    defaultPassword: 'District@123',
    jurisdictions: [
      { label: 'Belagavi DRDA (KA)', email: 'district.belagavi@govtfund.gov.in', pass: 'District@123' },
      { label: 'Bengaluru Urban DRDA (KA)', email: 'district.bengaluru@govtfund.gov.in', pass: 'District@123' },
      { label: 'Mysuru District DRDA (KA)', email: 'district.mysuru@govtfund.gov.in', pass: 'District@123' },
      { label: 'Pune District Collectorate (MH)', email: 'district@govtfund.gov.in', pass: 'District@123' },
      { label: 'Nagpur District Agency (MH)', email: 'district.nagpur@govtfund.gov.in', pass: 'District@123' },
      { label: 'Chennai District Agency (TN)', email: 'district.chennai@govtfund.gov.in', pass: 'District@123' },
      { label: 'Lucknow District Agency (UP)', email: 'district.lucknow@govtfund.gov.in', pass: 'District@123' }
    ]
  },
  {
    id: 'CONTRACTOR',
    title: 'Contractor',
    badge: 'Registered Contractors',
    icon: Briefcase,
    accentColor: '#C2410C',
    lightBg: 'rgba(194, 65, 12, 0.08)',
    description: 'Manage business profile, upload site work photos with digital proof, and claim milestone payments.',
    defaultEmail: 'contractor@buildcorp.in',
    defaultPassword: 'Contractor@123',
    jurisdictions: [
      { label: 'Apex Infrastructure & Civil Works Ltd', email: 'contractor@buildcorp.in', pass: 'Contractor@123' },
      { label: 'Karnataka Highway Infra Concessionaires', email: 'contractor.ka@infra.in', pass: 'Contractor@123' },
      { label: 'Southern Roads & Bridges Infrastructure', email: 'contractor.south@infra.in', pass: 'Contractor@123' }
    ]
  },
  {
    id: 'AUDITOR',
    title: 'Auditor & CAG',
    badge: 'Audit & Inspection Cell',
    icon: Search,
    accentColor: '#B91C1C',
    lightBg: 'rgba(185, 28, 28, 0.08)',
    description: 'Detect anomalies, freeze project funds if needed, and submit official audit reports.',
    defaultEmail: 'auditor@auditindia.gov.in',
    defaultPassword: 'Auditor@123',
    jurisdictions: [
      { label: 'CAG Central Audit Directorate', email: 'auditor@auditindia.gov.in', pass: 'Auditor@123' }
    ]
  }
];

const LoginPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  
  const matchedPortal = roleParam ? ROLE_PORTALS.find(p => p.id === roleParam.toUpperCase()) : null;
  const [activePortal, setActivePortal] = useState(matchedPortal || ROLE_PORTALS[0]);

  const [selectedJurisdiction, setSelectedJurisdiction] = useState(activePortal.jurisdictions[0]);
  const [email, setEmail] = useState(activePortal.defaultEmail);
  const [password, setPassword] = useState(activePortal.defaultPassword);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (roleParam) {
      const p = ROLE_PORTALS.find(item => item.id === roleParam.toUpperCase());
      if (p) {
        setActivePortal(p);
        const firstJ = p.jurisdictions[0];
        setSelectedJurisdiction(firstJ);
        setEmail(firstJ.email);
        setPassword(firstJ.pass);
        setError('');
      }
    }
  }, [roleParam]);

  const handleRoleChange = (portal) => {
    setActivePortal(portal);
    const firstJ = portal.jurisdictions[0];
    setSelectedJurisdiction(firstJ);
    setEmail(firstJ.email);
    setPassword(firstJ.pass);
    setError('');
    setSearchParams({ role: portal.id });
  };

  const handleJurisdictionSelect = (jur) => {
    setSelectedJurisdiction(jur);
    setEmail(jur.email);
    setPassword(jur.pass);
    setError('');
  };

  const executeLogin = async (loginEmail, loginPass) => {
    setError('');
    setLoading(true);
    try {
      const res = await login((loginEmail || email).trim(), loginPass || password);
      if (res.success) {
        const role = res.user.role;
        switch (role) {
          case 'SUPER_ADMIN':
            navigate('/admin/dashboard');
            break;
          case 'FINANCE':
            navigate('/finance/dashboard');
            break;
          case 'STATE':
            navigate('/state/dashboard');
            break;
          case 'DISTRICT':
            navigate('/district/dashboard');
            break;
          case 'CONTRACTOR':
            navigate('/contractor/dashboard');
            break;
          case 'AUDITOR':
            navigate('/auditor/dashboard');
            break;
          default:
            navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  const PortalIcon = activePortal.icon;

  return (
    <div style={{ maxWidth: '520px', margin: '36px auto', padding: '0 16px' }}>
      
      {/* Main Clean Login Card */}
      <div
        className="card"
        style={{
          padding: '30px',
          borderRadius: 'var(--radius-md)',
          borderTop: `4px solid ${activePortal.accentColor}`,
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.08)',
          backgroundColor: '#FFFFFF'
        }}
      >
        {/* Header Branding */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            background: activePortal.accentColor,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <PortalIcon size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              {activePortal.title} Portal Sign-In
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
              {activePortal.badge}
            </div>
          </div>
        </div>

        {/* Role Switcher Tabs */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Select Access Role:
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px'
          }}>
            {ROLE_PORTALS.map((p) => {
              const isSelected = activePortal.id === p.id;
              const PIcon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRoleChange(p)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: '6px',
                    border: isSelected ? `1.5px solid ${p.accentColor}` : '1px solid var(--border-color)',
                    background: isSelected ? p.lightBg : '#FFFFFF',
                    color: isSelected ? p.accentColor : 'var(--text-secondary)',
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <PIcon size={15} color={isSelected ? p.accentColor : 'var(--text-muted)'} />
                  <span>{p.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Jurisdiction / Profile Selector */}
        {activePortal.jurisdictions.length > 1 && (
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Regional Jurisdiction
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activePortal.jurisdictions.map((j, idx) => {
                const isJurSelected = selectedJurisdiction?.email === j.email;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleJurisdictionSelect(j)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: isJurSelected ? `1.5px solid ${activePortal.accentColor}` : '1px solid var(--border-color)',
                      background: isJurSelected ? activePortal.lightBg : '#FFFFFF',
                      color: isJurSelected ? activePortal.accentColor : 'var(--text-main)',
                      fontWeight: isJurSelected ? '700' : '500',
                      fontSize: '12px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{j.label}</span>
                    {isJurSelected && <CheckCircle2 size={14} color={activePortal.accentColor} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Fast Instant Login Button */}
        <button
          type="button"
          className="btn btn-primary"
          style={{
            width: '100%',
            background: activePortal.accentColor,
            borderColor: activePortal.accentColor,
            marginBottom: '16px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          disabled={loading}
          onClick={() => executeLogin(selectedJurisdiction?.email || email, selectedJurisdiction?.pass || password)}
        >
          <Zap size={15} fill="#FFFFFF" />
          <span>{loading ? 'Authenticating...' : `Instant 1-Click Sign-In (${activePortal.title})`}</span>
        </button>

        <div style={{ textAlign: 'center', margin: '12px 0', fontSize: '11px', color: 'var(--text-muted)', position: 'relative' }}>
          <span style={{ background: '#FFFFFF', padding: '0 8px', position: 'relative', zIndex: 1 }}>OR SIGN IN WITH CREDENTIALS</span>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border-color)' }}></div>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Email / Officer ID / Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder="e.g. admin@govtfund.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-outline"
            style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: '700' }}
            disabled={loading}
          >
            <span>{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
          <span>256-Bit SHA Encrypted Session • EVM Smart Contract Connected</span>
        </div>
      </div>

      {/* Extra Links: Contractor Registration & Public Tracking */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#FFFFFF',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
        fontSize: '12px'
      }}>
        <Link to="/register" style={{ fontWeight: '600', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <UserPlus size={14} />
          <span>Register New Contractor</span>
        </Link>
        <Link to="/public/projects" style={{ fontWeight: '600', color: 'var(--color-secondary)', textDecoration: 'none' }}>
          Public Tracking →
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
