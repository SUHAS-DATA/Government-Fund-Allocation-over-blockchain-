import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Search, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Zap,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PortalNavHeader from '../../components/PortalNavHeader';

const AuditorPortalPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('auditor@auditindia.gov.in');
  const [password, setPassword] = useState('Auditor@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to permitted dashboard or role home
  if (user) {
    if (user.role === 'AUDITOR') return <Navigate to="/auditor" replace />;
    if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'FINANCE') return <Navigate to="/finance" replace />;
    if (user.role === 'STATE' || user.role === 'DISTRICT' || user.role === 'DEPARTMENT') return <Navigate to="/department" replace />;
    if (user.role === 'CONTRACTOR') return <Navigate to="/contractor/dashboard" replace />;
    return <Navigate to="/public" replace />;
  }

  const handleExecuteLogin = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const res = await login((loginEmail || email).trim(), loginPassword || password);
      if (res.success) {
        if (res.user.role === 'AUDITOR') {
          navigate('/auditor');
        } else {
          // Unauthorized role on auditor portal
          if (res.user.role === 'SUPER_ADMIN') navigate('/admin');
          else if (res.user.role === 'FINANCE') navigate('/finance');
          else if (res.user.role === 'STATE' || res.user.role === 'DISTRICT' || res.user.role === 'DEPARTMENT') navigate('/department');
          else if (res.user.role === 'CONTRACTOR') navigate('/contractor/dashboard');
          else navigate('/public');
        }
      }
    } catch (err) {
      setError(err.message || 'Auditor authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleExecuteLogin(email, password);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '30px auto', padding: '0 20px' }}>
      {/* Shared Portal Navigation Header with Back to Portals & Switcher */}
      <PortalNavHeader currentPortal="auditor" />

      {/* Portal Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
          borderRadius: '999px',
          color: '#DC2626',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>
          <ShieldAlert size={14} />
          <span>Statutory CAG Oversight Gateway</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          Auditor & Inspection Portal
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Allowed Role: Auditor Only • Comptroller and Auditor General of India
        </p>
      </div>

      {/* Auditor Role Card */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        borderTop: '4px solid #DC2626',
        background: '#FFFFFF',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(220, 38, 38, 0.08)',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Search size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Auditor & Inspection
              </h3>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#DC2626', backgroundColor: 'rgba(220, 38, 38, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                Independent • Auditor
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Automatic fraud & anomaly detection, emergency fund freeze actions, and official audit reports.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleExecuteLogin('auditor@auditindia.gov.in', 'Auditor@123')}
          className="btn btn-primary"
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            backgroundColor: '#DC2626',
            borderColor: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          disabled={loading}
        >
          <Zap size={14} fill="#FFFFFF" />
          <span>1-Click Auditor Login</span>
        </button>
      </div>

      {/* Main Login Form Card */}
      <div
        className="card"
        style={{
          padding: '28px',
          borderRadius: 'var(--radius-md)',
          borderTop: '4px solid #DC2626',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              Auditor Sign In
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Audit & Inspection Cell • CAG Oversight
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', background: 'rgba(220, 38, 38, 0.08)', padding: '3px 8px', borderRadius: '4px' }}>
            CAG Official ID
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
            <label className="form-label" style={{ fontSize: '12px' }}>CAG Officer Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
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
                backgroundColor: '#DC2626',
                borderColor: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
              disabled={loading}
            >
              <span>{loading ? 'Verifying...' : 'Sign In as CAG Auditor'}</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700' }}
              onClick={() => handleExecuteLogin('auditor@auditindia.gov.in', 'Auditor@123')}
              disabled={loading}
            >
              <Zap size={14} />
              <span>Fast Sign In</span>
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
          <span>Statutory Audit Portal • Smart Contract Freeze Powers</span>
        </div>
      </div>
    </div>
  );
};

export default AuditorPortalPage;
