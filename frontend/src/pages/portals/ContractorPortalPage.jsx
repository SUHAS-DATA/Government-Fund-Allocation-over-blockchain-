import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Briefcase, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  Zap,
  Building,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PortalNavHeader from '../../components/PortalNavHeader';

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
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'

  // Login Form State
  const [selectedProfile, setSelectedProfile] = useState(CONTRACTOR_PROFILES[0]);
  const [loginEmail, setLoginEmail] = useState(CONTRACTOR_PROFILES[0].email);
  const [loginPassword, setLoginPassword] = useState(CONTRACTOR_PROFILES[0].password);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Form State
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CONTRACTOR',
    company_name: '',
    gst_number: '27AABCU9603R1ZM',
    pan_number: 'AABCU9603R',
    license_number: 'PWD/MH/2024/001',
    experience_years: 5
  });
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // If already logged in, redirect to permitted dashboard or role home
  if (user) {
    if (user.role === 'CONTRACTOR') return <Navigate to="/contractor/dashboard" replace />;
    if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'FINANCE') return <Navigate to="/finance" replace />;
    if (user.role === 'STATE' || user.role === 'DISTRICT' || user.role === 'DEPARTMENT') return <Navigate to="/department" replace />;
    if (user.role === 'AUDITOR') return <Navigate to="/auditor" replace />;
    return <Navigate to="/public" replace />;
  }

  const handleSelectProfile = (p) => {
    setSelectedProfile(p);
    setLoginEmail(p.email);
    setLoginPassword(p.password);
    setLoginError('');
  };

  const handleExecuteLogin = async (emailToUse, passToUse) => {
    setLoginError('');
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
          else if (res.user.role === 'AUDITOR') navigate('/auditor');
          else navigate('/public');
        }
      }
    } catch (err) {
      setLoginError(err.message || 'Contractor authentication failed. Please verify credentials.');
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
        setRegSuccess(true);
        // Auto-login after registration
        setTimeout(async () => {
          try {
            await login(regForm.email, regForm.password);
            navigate('/contractor/dashboard');
          } catch {
            setActiveTab('login');
            setLoginEmail(regForm.email);
            setLoginPassword(regForm.password);
          }
        }, 1200);
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
      {/* Shared Portal Navigation Header with Back to Portals & Switcher */}
      <PortalNavHeader currentPortal="contractor" />

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
              Submit business profile, upload site work photos with blockchain proof, and claim milestone payments.
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
          backgroundColor: '#FFFFFF',
          overflow: 'hidden'
        }}
      >
        {/* Navigation Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderBottom: '1px solid var(--border-color)',
          background: '#F8FAFC'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === 'login' ? '3px solid #EA580C' : '3px solid transparent',
              background: activeTab === 'login' ? '#FFFFFF' : 'transparent',
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
              background: activeTab === 'register' ? '#FFFFFF' : 'transparent',
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

            {/* Error Alert */}
            {loginError && (
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
                <span>{loginError}</span>
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
                padding: '24px',
                background: 'rgba(5, 150, 105, 0.08)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-success)'
              }}>
                <CheckCircle2 size={36} color="var(--color-success)" style={{ margin: '0 auto 8px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-success)', margin: 0 }}>
                  Contractor Registration Successful!
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Logging into your Contractor Dashboard...
                </p>
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
          <span>Contractor Portal • KYC & Smart Contract Escrow Payments</span>
        </div>
      </div>
    </div>
  );
};

export default ContractorPortalPage;
