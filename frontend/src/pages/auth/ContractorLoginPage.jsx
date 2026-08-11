import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Briefcase, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowLeft,
  Building,
  HardHat,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const CONTRACTOR_PROFILES = [
  {
    company_name: 'Apex Infrastructure & Civil Works Ltd.',
    contractor_id: 'CON-KA-APEX',
    username: 'contractor.apex',
    email: 'contractor@buildcorp.in',
    state: 'Karnataka (KA)',
    district: 'Belagavi',
    gst_number: '29AABCU9603R1ZM',
    pwd_license: 'PWD/KA/CLASS-1/2024/089',
    experience: '14 Years PWD Class-1',
    password: 'Contractor@123'
  },
  {
    company_name: 'Karnataka Highway Infra Concessionaires Pvt Ltd',
    contractor_id: 'CON-KA-HIGHWAY',
    username: 'contractor.ka',
    email: 'contractor.ka@infra.in',
    state: 'Karnataka (KA)',
    district: 'Bengaluru Urban',
    gst_number: '29AAACK1234F1Z5',
    pwd_license: 'PWD/KA/ROADS/2023/114',
    experience: '18 Years Highway Concessionaire',
    password: 'Contractor@123'
  },
  {
    company_name: 'Maharashtra Infrastructure & Expressway Works Ltd.',
    contractor_id: 'CON-MH-INFRA',
    username: 'contractor.mh',
    email: 'contractor.mh@infra.in',
    state: 'Maharashtra (MH)',
    district: 'Pune',
    gst_number: '27AAACM9988P1ZZ',
    pwd_license: 'PWD/MH/CLASS-1/2023/512',
    experience: '15 Years Expressway Works',
    password: 'Contractor@123'
  },
  {
    company_name: 'Southern Roads & Bridges Infrastructure Ltd',
    contractor_id: 'CON-TN-SOUTHERN',
    username: 'contractor.south',
    email: 'contractor.south@infra.in',
    state: 'Tamil Nadu (TN)',
    district: 'Chennai',
    gst_number: '33AABCS5544K1ZR',
    pwd_license: 'PWD/TN/BRIDGES/2022/045',
    experience: '12 Years Bridges & Expressways',
    password: 'Contractor@123'
  }
];

const ContractorLoginPage = () => {
  const [selectedContractor, setSelectedContractor] = useState(CONTRACTOR_PROFILES[0]);
  const [identifier, setIdentifier] = useState(CONTRACTOR_PROFILES[0].contractor_id);
  const [password, setPassword] = useState(CONTRACTOR_PROFILES[0].password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSelectContractor = (con) => {
    setSelectedContractor(con);
    setIdentifier(con.contractor_id);
    setPassword(con.password);
    setError('');
  };

  const handleLogin = async (loginIdentifier, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const credId = (loginIdentifier || identifier).trim();
      const credPass = loginPassword || password;
      const res = await login(credId, credPass);
      if (res.success) {
        if (res.user.role !== 'CONTRACTOR' && res.user.role !== 'SUPER_ADMIN') {
          throw new Error('Access Denied: Only registered Contractors/Vendors are permitted to log in via this portal.');
        }
        navigate('/contractor/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Contractor authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(identifier, password);
  };

  return (
    <div style={{ maxWidth: '980px', margin: '30px auto', padding: '0 20px' }}>
      
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link
          to="/select-user-type"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <ArrowLeft size={14} />
          <span>All Portals Hub</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={16} color="var(--color-success)" />
          <span>Smart Contract Bound Concessionaire Gateway</span>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Approved Concessionaires Directory */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(194, 65, 12, 0.1)',
              color: '#C2410C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <HardHat size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Approved Concessionaires & Enterprises
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Select an empanelled contractor to auto-fill Contractor ID credentials
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {CONTRACTOR_PROFILES.map((con, idx) => {
              const isSelected = selectedContractor?.contractor_id === con.contractor_id;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectContractor(con)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid #C2410C' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(194, 65, 12, 0.05)' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '13px', color: isSelected ? '#C2410C' : 'var(--text-main)' }}>
                        {con.company_name}
                      </strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ID: <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{con.contractor_id}</span> • {con.district}, {con.state}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px', marginRight: '6px' }}>Verified PWD</span>
                      GST: {con.gst_number}
                    </div>
                  </div>

                  {isSelected ? (
                    <CheckCircle2 size={18} color="#C2410C" style={{ flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: '11px', color: '#C2410C', fontWeight: '700', flexShrink: 0 }}>Select →</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '14px',
            padding: '10px 12px',
            background: 'rgba(194, 65, 12, 0.05)',
            border: '1px solid #FED7AA',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: '#C2410C',
            lineHeight: 1.4
          }}>
            <strong>Project Escrow Protocol:</strong> Contractors can review assigned projects, accept or reject assignments, request phase-wise funds, and upload photographic milestone evidence with SHA-256 integrity digests.
          </div>
        </div>

        {/* Right: Login Card */}
        <div
          className="card"
          style={{
            padding: '28px',
            borderTop: '4px solid #C2410C',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              background: '#C2410C',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Briefcase size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Contractor Portal Login
              </h1>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                Concessionaire & Enterprise Gateway
              </div>
            </div>
          </div>

          {/* Active Selected Contractor Summary Badge */}
          {selectedContractor && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              background: 'rgba(194, 65, 12, 0.06)',
              border: '1px solid #FED7AA',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#C2410C', marginBottom: '2px' }}>
                Active Concessionaire Profile:
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                {selectedContractor.company_name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ID: <code style={{ color: '#C2410C', fontWeight: '700' }}>{selectedContractor.contractor_id}</code>
              </div>
            </div>
          )}

          {/* Error Banner */}
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
              background: '#C2410C',
              borderColor: '#C2410C',
              marginBottom: '14px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '700'
            }}
            disabled={loading}
            onClick={() => handleLogin(selectedContractor.contractor_id, selectedContractor.password)}
          >
            <Sparkles size={15} />
            <span>{loading ? 'Authenticating...' : `1-Click Sign-In as ${selectedContractor.company_name.split(' ')[0]}`}</span>
          </button>

          <div style={{ textAlign: 'center', margin: '12px 0', fontSize: '11px', color: 'var(--text-muted)', position: 'relative' }}>
            <span style={{ background: '#FFFFFF', padding: '0 8px', position: 'relative', zIndex: 1 }}>OR ENTER CREDENTIALS</span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Contractor ID / Username / Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '36px', fontSize: '13px' }}
                  placeholder="e.g. CON-KA-APEX or contractor@buildcorp.in"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
              <span>{loading ? 'Verifying Concessionaire...' : 'Authenticate & Enter Dashboard'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
            <span>256-Bit SHA Encrypted • Smart Contract Escrow Bound</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ContractorLoginPage;
