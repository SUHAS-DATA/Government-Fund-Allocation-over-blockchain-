import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Building, 
  Layers, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Zap,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PortalNavHeader from '../../components/PortalNavHeader';

const FIELD_ROLES = [
  {
    id: 'STATE',
    title: 'State Treasury',
    roleLabel: 'State Planning & Finance',
    badge: 'State Fund Management',
    icon: Building,
    accentColor: '#0284C7',
    lightBg: 'rgba(2, 132, 199, 0.08)',
    description: 'Receive central funds and allocate multi-tier budgets to District Development Offices (KA, MH, GJ, TN, UP).',
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
    roleLabel: 'District Office / Collectorate',
    badge: 'Project Planning & Execution',
    icon: Layers,
    accentColor: '#7C3AED',
    lightBg: 'rgba(124, 58, 237, 0.08)',
    description: 'Create development projects, assign contractors, inspect site progress, verify evidence, and release milestone payments.',
    jurisdictions: [
      { label: 'Belagavi DRDA (KA)', email: 'district.belagavi@govtfund.gov.in', pass: 'District@123' },
      { label: 'Bengaluru Urban DRDA (KA)', email: 'district.bengaluru@govtfund.gov.in', pass: 'District@123' },
      { label: 'Mysuru District DRDA (KA)', email: 'district.mysuru@govtfund.gov.in', pass: 'District@123' },
      { label: 'Pune District Collectorate (MH)', email: 'district@govtfund.gov.in', pass: 'District@123' },
      { label: 'Nagpur District Agency (MH)', email: 'district.nagpur@govtfund.gov.in', pass: 'District@123' },
      { label: 'Chennai District Agency (TN)', email: 'district.chennai@govtfund.gov.in', pass: 'District@123' },
      { label: 'Lucknow District Agency (UP)', email: 'district.lucknow@govtfund.gov.in', pass: 'District@123' }
    ]
  }
];

const FieldPortalPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState(FIELD_ROLES[0]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(FIELD_ROLES[0].jurisdictions[0]);
  const [email, setEmail] = useState(FIELD_ROLES[0].jurisdictions[0].email);
  const [password, setPassword] = useState(FIELD_ROLES[0].jurisdictions[0].pass);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to permitted dashboard or role home
  if (user) {
    if (user.role === 'STATE' || user.role === 'DISTRICT' || user.role === 'DEPARTMENT') {
      return <Navigate to="/department" replace />;
    }
    if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'FINANCE') return <Navigate to="/finance" replace />;
    if (user.role === 'CONTRACTOR') return <Navigate to="/contractor/dashboard" replace />;
    if (user.role === 'AUDITOR') return <Navigate to="/auditor" replace />;
    return <Navigate to="/public" replace />;
  }

  const handleRoleSelect = (roleObj) => {
    setActiveRole(roleObj);
    const firstJ = roleObj.jurisdictions[0];
    setSelectedJurisdiction(firstJ);
    setEmail(firstJ.email);
    setPassword(firstJ.pass);
    setError('');
  };

  const handleJurisdictionSelect = (jur) => {
    setSelectedJurisdiction(jur);
    setEmail(jur.email);
    setPassword(jur.pass);
    setError('');
  };

  const handleExecuteLogin = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const res = await login((loginEmail || email).trim(), loginPassword || password);
      if (res.success) {
        if (res.user.role === 'STATE' || res.user.role === 'DISTRICT' || res.user.role === 'DEPARTMENT') {
          navigate('/department');
        } else {
          // Unauthorized role on field portal
          if (res.user.role === 'SUPER_ADMIN') navigate('/admin');
          else if (res.user.role === 'FINANCE') navigate('/finance');
          else if (res.user.role === 'CONTRACTOR') navigate('/contractor/dashboard');
          else if (res.user.role === 'AUDITOR') navigate('/auditor');
          else navigate('/public');
        }
      }
    } catch (err) {
      setError(err.message || 'Field authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleExecuteLogin(email, password);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '30px auto', padding: '0 20px' }}>
      {/* Shared Portal Navigation Header with Back to Portals & Switcher */}
      <PortalNavHeader currentPortal="field" />

      {/* Portal Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(2, 132, 199, 0.08)',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          borderRadius: '999px',
          color: '#0284C7',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>
          <MapPin size={14} />
          <span>Regional & Territorial Gateway</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          Field Operations Portal
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Allowed Roles: State Treasury & District Development Agency Only
        </p>
      </div>

      {/* 2 Permitted Role Cards Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {FIELD_ROLES.map((r) => {
          const isSelected = activeRole.id === r.id;
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              onClick={() => handleRoleSelect(r)}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? `2px solid ${r.accentColor}` : '1px solid var(--border-color)',
                borderTop: `4px solid ${r.accentColor}`,
                background: isSelected ? r.lightBg : '#FFFFFF',
                boxShadow: isSelected ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: isSelected ? r.accentColor : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : r.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={18} />
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: r.accentColor,
                    backgroundColor: '#FFFFFF',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {r.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {r.title}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>
                  {r.roleLabel}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  {r.description}
                </p>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSelect(r);
                    handleExecuteLogin(r.jurisdictions[0].email, r.jurisdictions[0].pass);
                  }}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: r.accentColor,
                    borderColor: r.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  disabled={loading}
                >
                  <Zap size={12} fill="#FFFFFF" />
                  <span>1-Click {r.title} Login</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Login Form Card */}
      <div
        className="card"
        style={{
          padding: '28px',
          borderRadius: 'var(--radius-md)',
          borderTop: `4px solid ${activeRole.accentColor}`,
          boxShadow: 'var(--shadow-md)',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              Sign In to {activeRole.title}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {activeRole.roleLabel}
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: activeRole.accentColor, background: activeRole.lightBg, padding: '3px 8px', borderRadius: '4px' }}>
            {activeRole.badge}
          </span>
        </div>

        {/* Jurisdiction Selector Pills */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Select Jurisdiction Office ({activeRole.title}):
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {activeRole.jurisdictions.map((jur, idx) => {
              const isSelected = selectedJurisdiction?.email === jur.email;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleJurisdictionSelect(jur)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '11px',
                    fontWeight: isSelected ? '700' : '500',
                    border: isSelected ? `1.5px solid ${activeRole.accentColor}` : '1px solid var(--border-color)',
                    background: isSelected ? activeRole.lightBg : '#F8FAFC',
                    color: isSelected ? activeRole.accentColor : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MapPin size={11} color={isSelected ? activeRole.accentColor : 'var(--text-muted)'} />
                  <span>{jur.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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

        {/* Credentials Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Field Officer Email / Jurisdiction ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px' }}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                fontWeight: '700',
                backgroundColor: activeRole.accentColor,
                borderColor: activeRole.accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              disabled={loading}
            >
              <span>{loading ? 'Verifying...' : `Sign In as ${activeRole.title}`}</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700' }}
              onClick={() => handleExecuteLogin(selectedJurisdiction.email, selectedJurisdiction.pass)}
              disabled={loading}
              title="Fast Sign In with selected jurisdiction"
            >
              <Zap size={14} />
              <span>Fast Sign In</span>
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
          <span>Territorial Field Operations • Multi-Tier Public Ledger</span>
        </div>
      </div>
    </div>
  );
};

export default FieldPortalPage;
