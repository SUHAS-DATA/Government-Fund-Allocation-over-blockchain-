import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { 
  Briefcase, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  AlertTriangle,
  Clock,
  XCircle,
  Zap,
  Building,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PortalNavHeader from '../../components/PortalNavHeader';
import ThemeToggle from '../../components/ThemeToggle';

const INDIAN_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'UP', name: 'Uttar Pradesh' }
];

const CONTRACTOR_PROFILES = [
  {
    company_name: 'Apex Infrastructure & Civil Works Ltd.',
    contractor_id: 'CON-KA-APEX',
    email: 'contractor@buildcorp.in',
    state: 'Karnataka (KA)',
    district: 'Belagavi',
    password: 'Contractor@123'
  },
  {
    company_name: 'Karnataka Highway Infra Concessionaires',
    contractor_id: 'CON-KA-HIGHWAY',
    email: 'contractor.ka@infra.in',
    state: 'Karnataka (KA)',
    district: 'Bengaluru Urban',
    password: 'Contractor@123'
  },
  {
    company_name: 'Southern Roads & Bridges Infrastructure',
    contractor_id: 'CON-TN-SOUTHERN',
    email: 'contractor.south@infra.in',
    state: 'Tamil Nadu (TN)',
    district: 'Chennai',
    password: 'Contractor@123'
  }
];

const ContractorPortalPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const wantsRegister = location.pathname === '/register' || searchParams.get('tab') === 'register';
  const [activeTab, setActiveTab] = useState(wantsRegister ? 'register' : 'login');

  useEffect(() => {
    if (location.pathname === '/register' || searchParams.get('tab') === 'register') {
      setActiveTab('register');
    }
  }, [location.pathname, location.search]);

  // Login Form State
  const [selectedProfile, setSelectedProfile] = useState(CONTRACTOR_PROFILES[0]);
  const [loginEmail, setLoginEmail] = useState(CONTRACTOR_PROFILES[0].email);
  const [loginPassword, setLoginPassword] = useState(CONTRACTOR_PROFILES[0].password);
  const [loginError, setLoginError] = useState('');
  const [loginKycStatus, setLoginKycStatus] = useState(''); // 'REJECTED' | 'UNDER_REVIEW' | ''
  const [loginKycRemarks, setLoginKycRemarks] = useState('');
  const [loginKycState, setLoginKycState] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Form State
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CONTRACTOR',
    state_code: 'KA',
    state_name: 'Karnataka',
    company_name: '',
    gst_number: '29AABCU9603R1ZM',
    pan_number: 'AABCU9603R',
    license_number: 'PWD/KA/2026/001',
    experience_years: 5
  });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState(null);

  // If already logged in, redirect to permitted dashboard or role home
  if (user) {
    if (user.role === 'CONTRACTOR') return <Navigate to="/contractor/dashboard" replace />;
    if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'FINANCE') return <Navigate to="/finance" replace />;
    if (user.role === 'STATE' || user.role === 'DISTRICT' || user.role === 'DEPARTMENT') return <Navigate to="/department" replace />;
    return <Navigate to="/public" replace />;
  }

  const handleSelectProfile = (p) => {
    setSelectedProfile(p);
    setLoginEmail(p.email);
    setLoginPassword(p.password);
    setLoginError('');
    setLoginKycStatus('');
  };

  const handleExecuteLogin = async (emailToUse, passToUse) => {
    setLoginError('');
    setLoginKycStatus('');
    setLoginKycRemarks('');
    setLoginKycState('');
    setLoginLoading(true);
    try {
      const res = await login((emailToUse || loginEmail).trim(), passToUse || loginPassword);
      if (res.success) {
        if (res.user.role === 'CONTRACTOR') {
          navigate('/contractor/dashboard');
        } else {
          // Unauthorized role on contractor portal
          if (res.user.role === 'SUPER_ADMIN') navigate('/admin');
          else if (res.user.role === 'FINANCE') navigate('/finance');
          else if (res.user.role === 'STATE' || res.user.role === 'DISTRICT' || res.user.role === 'DEPARTMENT') navigate('/department');
          else navigate('/public');
        }
      }
    } catch (err) {
      const msg = err.message || (typeof err === 'string' ? err : '');
      const kycStatus = err.kyc_status || err.response?.data?.kyc_status || '';
      const remarks = err.remarks || err.verification_remarks || err.response?.data?.remarks || '';
      const stateName = err.state_name || err.response?.data?.state_name || '';

      if (kycStatus === 'REJECTED' || msg.includes('REJECTED') || msg.toLowerCase().includes('rejected')) {
        setLoginKycStatus('REJECTED');
        setLoginKycRemarks(remarks);
        setLoginKycState(stateName);
      } else if (kycStatus === 'UNDER_REVIEW' || msg.includes('UNDER REVIEW') || msg.toLowerCase().includes('under review') || msg.toLowerCase().includes('pending')) {
        setLoginKycStatus('UNDER_REVIEW');
        setLoginKycState(stateName);
      }
      setLoginError(msg || 'Contractor authentication failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    handleExecuteLogin(loginEmail, loginPassword);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    try {
      const res = await API.post('/auth/register', regForm);
      if (res.success) {
        setRegisteredData({ ...regForm });
        setRegSuccess(true);
        // DO NOT auto-login! Contractors must wait for State Department verification.
      } else {
        setRegError(res.message || 'Registration failed. Please check form details.');
      }
    } catch (err) {
      setRegError(err.message || 'Registration failed. Email or GSTIN may already be registered.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
      {/* Top Header with Theme Switcher */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <ThemeToggle showLabel={true} />
      </div>

      {/* Portal Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(234, 88, 12, 0.08)',
          border: '1px solid rgba(234, 88, 12, 0.25)',
          borderRadius: '999px',
          color: '#EA580C',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>
          <Briefcase size={14} />
          <span>Registered Vendors & Concessionaires Gateway</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          Contractor & Vendor Portal
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Allowed Operations: Contractor Registration & Contractor Login Only
        </p>
      </div>

      {/* Contractor Role Summary Card */}
      <div style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        borderTop: '4px solid #EA580C',
        background: 'var(--bg-surface)',
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
            background: 'rgba(234, 88, 12, 0.08)',
            color: '#EA580C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Briefcase size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Contractor & Vendor
              </h3>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#EA580C', backgroundColor: 'rgba(234, 88, 12, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                Tier 5 • Contractor
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Submit business profile, upload site work photos, and receive milestone payments.
            </p>
          </div>
        </div>

        {/* 1-Click Login Shortcut */}
        <button
          type="button"
          onClick={() => handleExecuteLogin(selectedProfile.email, selectedProfile.password)}
          className="btn btn-primary"
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            backgroundColor: '#EA580C',
            borderColor: '#EA580C',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          disabled={loginLoading}
        >
          <Zap size={14} fill="#FFFFFF" />
          <span>1-Click Contractor Login</span>
        </button>
      </div>

      {/* Main Container with 2 Tabs: Contractor Login vs Contractor Registration */}
      <div
        className="card"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: 'var(--bg-surface)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-subtle)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === 'login' ? '3px solid #EA580C' : '3px solid transparent',
              background: activeTab === 'login' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'login' ? '#EA580C' : 'var(--text-secondary)',
              fontWeight: activeTab === 'login' ? '800' : '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <Lock size={15} />
            <span>Contractor Login</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === 'register' ? '3px solid #EA580C' : '3px solid transparent',
              background: activeTab === 'register' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'register' ? '#EA580C' : 'var(--text-secondary)',
              fontWeight: activeTab === 'register' ? '800' : '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={15} />
            <span>Contractor Registration</span>
          </button>
        </div>

        {/* Tab 1: Contractor Login */}
        {activeTab === 'login' && (
          <div style={{ padding: '24px 28px' }}>
            {/* Prominent New Contractor Registration CTA */}
            <div style={{
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: '#FFF7ED',
              border: '1.5px solid #FDBA74',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#9A3412' }}>
                  Need to Register a New Contractor Entity?
                </div>
                <div style={{ fontSize: '11px', color: '#C2410C', marginTop: '2px' }}>
                  Select your state, provide enterprise credentials, and apply for State Department verification.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '12px',
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <UserPlus size={14} />
                <span>Open Registration Form →</span>
              </button>
            </div>

            {/* Verified Concessionaires Quick Picker */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Select Registered Contractor Profile:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {CONTRACTOR_PROFILES.map((p, idx) => {
                  const isSelected = selectedProfile.email === p.email;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectProfile(p)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-xs)',
                        border: isSelected ? '1.5px solid #EA580C' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(234, 88, 12, 0.05)' : '#F8FAFC',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                          {p.company_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {p.contractor_id} • {p.district}, {p.state}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#EA580C', fontWeight: '700' }}>
                        {p.email}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rejection / Under Review / Generic Error Alert */}
            {loginError && (
              <div style={{
                background: loginKycStatus === 'REJECTED' ? '#FEF2F2' : loginKycStatus === 'UNDER_REVIEW' ? '#FFFBEB' : 'var(--color-danger-bg)',
                border: `1.5px solid ${loginKycStatus === 'REJECTED' ? '#F87171' : loginKycStatus === 'UNDER_REVIEW' ? '#FCD34D' : 'var(--color-danger-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                color: loginKycStatus === 'REJECTED' ? '#991B1B' : loginKycStatus === 'UNDER_REVIEW' ? '#92400E' : 'var(--color-danger)',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', marginBottom: '6px' }}>
                  {loginKycStatus === 'REJECTED' ? (
                    <>
                      <XCircle size={18} color="#DC2626" />
                      <span style={{ color: '#DC2626' }}>REGISTRATION REJECTED BY STATE DEPARTMENT</span>
                    </>
                  ) : loginKycStatus === 'UNDER_REVIEW' ? (
                    <>
                      <Clock size={18} color="#D97706" />
                      <span style={{ color: '#D97706' }}>VERIFICATION PENDING ({loginKycState || 'STATE'} DEPT)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      <span>AUTHENTICATION FAILED</span>
                    </>
                  )}
                </div>
                <div style={{ lineHeight: '1.4' }}>
                  {loginError}
                </div>
                {loginKycRemarks && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#FFFFFF', borderRadius: '4px', border: '1px solid #FECACA', fontSize: '11px', color: '#991B1B' }}>
                    <strong>State Department Remarks:</strong> {loginKycRemarks}
                  </div>
                )}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Contractor Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-control"
                    style={{ paddingLeft: '36px' }}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
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
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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
                    backgroundColor: '#EA580C',
                    borderColor: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  disabled={loginLoading}
                >
                  <span>{loginLoading ? 'Authenticating...' : 'Sign In as Contractor'}</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700' }}
                  onClick={() => handleExecuteLogin(selectedProfile.email, selectedProfile.password)}
                  disabled={loginLoading}
                >
                  <Zap size={14} />
                  <span>Fast Sign In</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Contractor Registration */}
        {activeTab === 'register' && (
          <div style={{ padding: '24px 28px' }}>
            {regSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '32px 24px',
                background: '#FFFBEB',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid #FCD34D'
              }}>
                <Clock size={44} color="#D97706" style={{ margin: '0 auto 12px' }} />
                <div style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(217, 119, 6, 0.12)',
                  color: '#B45309',
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}>
                  Status: Pending State Department Verification
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#92400E', margin: '0 0 8px 0' }}>
                  Contractor Registration Submitted!
                </h3>
                <p style={{ fontSize: '13px', color: '#78350F', maxWidth: '520px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
                  Your application for <strong>{(registeredData || regForm).company_name}</strong> in <strong>{(registeredData || regForm).state_name} ({(registeredData || regForm).state_code})</strong> has been submitted to the <strong>{(registeredData || regForm).state_name} State Department</strong>.
                </p>
                
                <div style={{
                  background: '#FFFFFF',
                  padding: '16px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid #FDE68A',
                  maxWidth: '480px',
                  margin: '0 auto 20px auto',
                  textAlign: 'left',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Corporate Email:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{(registeredData || regForm).email}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>State Jurisdiction:</span>
                    <strong style={{ color: '#EA580C' }}>{(registeredData || regForm).state_name} State Department</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>GST / License:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{(registeredData || regForm).gst_number}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FEF3C7', paddingTop: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Statutory Requirement:</span>
                    <span style={{ color: '#B45309', fontWeight: '800' }}>State Officer Review & Approval</span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#92400E', marginBottom: '22px', maxWidth: '500px', margin: '0 auto 22px auto', lineHeight: '1.4' }}>
                  🔒 <em>Per governance rules, you cannot log into the Contractor Portal or receive project allocations until the <strong>{(registeredData || regForm).state_name} State Department</strong> reviews and approves your KYC credentials.</em>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRegSuccess(false);
                    setActiveTab('login');
                    setLoginEmail((registeredData || regForm).email);
                    setLoginPassword((registeredData || regForm).password);
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontSize: '13px',
                    fontWeight: '700',
                    backgroundColor: '#EA580C',
                    borderColor: '#EA580C',
                    cursor: 'pointer'
                  }}
                >
                  Return to Contractor Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                {regError && (
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
                    <span>{regError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Authorized Representative Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Rajesh Kumar"
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Registered Entity / Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Kumar Infra Projects Pvt Ltd"
                      value={regForm.company_name}
                      onChange={(e) => setRegForm({ ...regForm, company_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Corporate Email ID</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. director@kumarinfra.com"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>Account Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Min 6 characters"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* State of Registration Selection (Mandatory for State Department Verification) */}
                <div className="form-group" style={{ marginBottom: '14px', background: '#FFF7ED', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #FFEDD5' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '800', color: '#9A3412', marginBottom: '6px' }}>
                    State of Registration (Select the state you are in) *
                  </label>
                  <select
                    className="form-control form-select"
                    value={regForm.state_code}
                    onChange={(e) => {
                      const sel = INDIAN_STATES.find(s => s.code === e.target.value) || { code: e.target.value, name: e.target.value };
                      setRegForm({
                        ...regForm,
                        state_code: sel.code,
                        state_name: sel.name,
                        license_number: `PWD/${sel.code}/2026/001`
                      });
                    }}
                    required
                    style={{ fontSize: '13px', fontWeight: '700', borderColor: '#EA580C', background: '#FFFFFF' }}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '11px', color: '#7C2D12', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="#EA580C" />
                    <span>
                      Your registration will be routed to the <strong>{regForm.state_name || 'State'} State Department</strong> for statutory verification. Only contractors verified in this state can be allocated projects by District Officers.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>GSTIN Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={regForm.gst_number}
                      onChange={(e) => setRegForm({ ...regForm, gst_number: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>PAN Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={regForm.pan_number}
                      onChange={(e) => setRegForm({ ...regForm, pan_number: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '12px' }}>PWD Contractor License No.</label>
                    <input
                      type="text"
                      className="form-control"
                      value={regForm.license_number}
                      onChange={(e) => setRegForm({ ...regForm, license_number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '11px',
                    fontSize: '13px',
                    fontWeight: '700',
                    backgroundColor: '#EA580C',
                    borderColor: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  disabled={regLoading}
                >
                  <UserPlus size={15} />
                  <span>{regLoading ? 'Registering Contractor...' : 'Submit Contractor Registration'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', padding: '12px', background: '#F8FAFC', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
          <span>Contractor Portal • Verified Credentials & Milestone Payments</span>
        </div>
      </div>
    </div>
  );
};

export default ContractorPortalPage;
