import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  FileCheck2,
  Scale,
  Building2,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import API, { testBackendHealth } from '../../services/api';
import ThemeToggle from '../../components/ThemeToggle';

const AuditorPortalPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');

  // If already logged in as AUDITOR, redirect directly to dashboard
  useEffect(() => {
    if (user && user.role === 'AUDITOR') {
      navigate('/auditor/dashboard');
    }
  }, [user, navigate]);

  // Check URL query parameters for session expired notices
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('session_expired')) {
      setSessionNotice('Your auditor session has expired. For audit integrity, please sign in again.');
    } else if (params.get('logged_out')) {
      setSessionNotice('You have been securely logged out of the Auditor Portal.');
    }
    // Background health ping
    testBackendHealth().catch(() => {});
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setSessionNotice('');
    setLoading(true);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError('Please provide your Auditor Email / Officer ID and password.');
      setLoading(false);
      return;
    }

    try {
      // Direct call to dedicated /auth/auditor/login endpoint enforcing strict role verification
      const res = await API.post('/auth/auditor/login', {
        identifier: cleanId,
        email: cleanId,
        username: cleanId,
        officer_id: cleanId,
        password: password
      });

      if (res.success && res.token && res.user) {
        if (res.user.role !== 'AUDITOR') {
          setError(`Access Denied: Account '${res.user.email}' has role '${res.user.role}'. Only authorized accounts with the AUDITOR role can access this portal.`);
          return;
        }

        // Store JWT token and user profile
        localStorage.setItem('govtfund_token', res.token);
        localStorage.setItem('govtfund_user', JSON.stringify(res.user));

        // Navigate to the 5-block Auditor Dashboard
        navigate('/auditor/dashboard');
        // Force state reload if needed
        window.location.reload();
      } else {
        setError(res.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      const rawMsg = (typeof err === 'string' ? err : err?.message) || '';
      if (err?.isNetworkError || rawMsg.toLowerCase().includes('network') || rawMsg.toLowerCase().includes('failed to fetch')) {
        setError('Unable to reach government audit backend server. Please check local connectivity on port 5000.');
      } else {
        setError(rawMsg || 'Authentication failed. Please check credentials or contact Super Administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '840px', margin: '30px auto', padding: '0 20px' }}>
      {/* Top Header with Theme Switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <ThemeToggle showLabel={true} />
      </div>

      {/* Official Government Auditor Portal Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          background: 'rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(15, 23, 42, 0.2)',
          borderRadius: '999px',
          color: 'var(--text-main)',
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '12px'
        }}>
          <Scale size={14} color="#059669" />
          <span>Statutory Financial Audit & Independent Oversight</span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
          National Auditor Portal
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto' }}>
          Authorized Comptroller & Auditor General (CAG) inspection gateway providing read-only cross-examination across Central Secretariat, Finance, State Treasury, District Agencies, and Concessionaires.
        </p>
      </div>

      {/* 3 Overview Pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <div style={{
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderTop: '3px solid #0F172A',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} color="#0F172A" />
            </div>
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Strictly Read-Only</strong>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Auditor privileges are strictly non-transactional. Direct modification of financial ledgers is locked out.
          </p>
        </div>

        <div style={{
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderTop: '3px solid #059669',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(5, 150, 105, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck2 size={16} color="#059669" />
            </div>
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Five Tier Scope</strong>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Full multi-tier inspection: Super Admin, Finance, State Government, District Office, and Contractor.
          </p>
        </div>

        <div style={{
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderTop: '3px solid #0284C7',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(2, 132, 199, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} color="#0284C7" />
            </div>
            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>On-Chain Verification</strong>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Direct cryptographic verification of transaction receipts, block numbers, and smart contract event logs.
          </p>
        </div>
      </div>

      {/* Main Login Card */}
      <div
        className="card"
        style={{
          padding: '30px',
          borderRadius: 'var(--radius-md)',
          borderTop: '4px solid #0F172A',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
              Sign In to Auditor Portal
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Statutory Auditor & CAG Oversight Authority
            </div>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#0F172A',
            background: 'rgba(15, 23, 42, 0.08)',
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid rgba(15, 23, 42, 0.2)'
          }}>
            ROLE: AUDITOR ONLY
          </span>
        </div>

        {/* Session Notice Alert */}
        {sessionNotice && (
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: 'var(--text-main)',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldCheck size={16} color="#059669" />
            <span>{sessionNotice}</span>
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
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: '700' }}>
              Auditor Email / Officer ID / Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
                placeholder="e.g. auditor@cag.gov.in or auditor_officer"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                required
                autoComplete="username"
              />
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Only accounts designated with the <strong>AUDITOR</strong> role can access this portal.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: '700' }}>
              Auditor Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
                placeholder="Enter statutory auditor password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: '700',
              backgroundColor: '#0F172A',
              borderColor: '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            disabled={loading}
          >
            <span>{loading ? 'Verifying Statutory Credentials...' : 'Authenticate & Enter Auditor Dashboard'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {/* Security and Access Policy Notice */}
        <div style={{
          marginTop: '20px',
          padding: '12px 14px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
            <ShieldAlert size={14} color="#0F172A" />
            <span>Statutory Access Control Policy</span>
          </div>
          Super Admin, Finance Department, State Treasury, District Office, and Contractor logins are rejected by this portal. Accounts can only be provisioned by the Central Super Administrator in accordance with government audit rules.
        </div>
      </div>
    </div>
  );
};

export default AuditorPortalPage;
