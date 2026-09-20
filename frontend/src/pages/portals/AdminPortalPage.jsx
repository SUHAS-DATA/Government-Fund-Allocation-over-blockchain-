import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Landmark, 
  FileSpreadsheet, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Zap 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PortalNavHeader from '../../components/PortalNavHeader';

const ADMIN_ROLES = [
  {
    id: 'SUPER_ADMIN',
    title: 'Super Admin',
    roleLabel: 'Central Secretariat',
    badge: 'Central Budget Authority',
    icon: Landmark,
    accentColor: '#1E3A8A',
    lightBg: 'rgba(30, 58, 138, 0.08)',
    description: 'National budget ceiling management, multi-year national schemes, user access control, and audit reports.',
    defaultEmail: 'admin@govtfund.gov.in',
    defaultPassword: 'Admin@123',
    targetDashboard: '/admin'
  },
  {
    id: 'FINANCE',
    title: 'Finance Dept',
    roleLabel: 'Ministry of Finance',
    badge: 'Treasury Fund Release',
    icon: FileSpreadsheet,
    accentColor: '#0F766E',
    lightBg: 'rgba(15, 118, 110, 0.08)',
    description: 'Sanction central budget allocations, execute state treasury transfers, and monitor Ethereum ledger disbursals.',
    defaultEmail: 'finance@govtfund.gov.in',
    defaultPassword: 'Finance@123',
    targetDashboard: '/finance'
  }
];

const AdminPortalPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState(ADMIN_ROLES[0]);
  const [email, setEmail] = useState(ADMIN_ROLES[0].defaultEmail);
  const [password, setPassword] = useState(ADMIN_ROLES[0].defaultPassword);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to permitted dashboard or role home
  if (user) {
    if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'FINANCE') return <Navigate to="/finance" replace />;
    if (user.role === 'STATE' || user.role === 'DISTRICT' || user.role === 'DEPARTMENT') return <Navigate to="/department" replace />;
    if (user.role === 'CONTRACTOR') return <Navigate to="/contractor/dashboard" replace />;
    if (user.role === 'AUDITOR') return <Navigate to="/auditor" replace />;
    return <Navigate to="/public" replace />;
  }

  const handleRoleSelect = (roleObj) => {
    setActiveRole(roleObj);
    setEmail(roleObj.defaultEmail);
    setPassword(roleObj.defaultPassword);
    setError('');
  };

  const handleExecuteLogin = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const res = await login((loginEmail || email).trim(), loginPassword || password);
      if (res.success) {
        if (res.user.role === 'SUPER_ADMIN') {
          navigate('/admin');
        } else if (res.user.role === 'FINANCE') {
          navigate('/finance');
        } else {
          // Unauthorized role on admin portal -> redirect to their permitted dashboard
          if (res.user.role === 'STATE' || res.user.role === 'DISTRICT' || res.user.role === 'DEPARTMENT') {
            navigate('/department');
          } else if (res.user.role === 'CONTRACTOR') {
            navigate('/contractor/dashboard');
          } else if (res.user.role === 'AUDITOR') {
            navigate('/auditor');
          } else {
            navigate('/public');
          }
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
    handleExecuteLogin(email, password);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
      {/* Shared Portal Navigation Header with Back to Portals & Switcher */}
      <PortalNavHeader currentPortal="admin" />

      {/* Portal Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary-border)',
          borderRadius: '999px',
          color: 'var(--color-primary)',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>
          <ShieldCheck size={14} />
          <span>Central Administrative Gateway</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          Admin Portal
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Allowed Roles: Super Admin & Finance Department Only
        </p>
      </div>

      {/* 2 Permitted Role Cards Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {ADMIN_ROLES.map((r) => {
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
                    handleExecuteLogin(r.defaultEmail, r.defaultPassword);
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

      {/* Main Login Form Card for the Selected Role */}
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
            <label className="form-label" style={{ fontSize: '12px' }}>Officer Email / ID</label>
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
              onClick={() => handleExecuteLogin(activeRole.defaultEmail, activeRole.defaultPassword)}
              disabled={loading}
              title="Quick test login with default credentials"
            >
              <Zap size={14} />
              <span>Fast Fill & Sign In</span>
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
          <span>Central Administrative Portal • EVM Multi-Tier Ledger</span>
        </div>
      </div>
    </div>
  );
};

export default AdminPortalPage;
