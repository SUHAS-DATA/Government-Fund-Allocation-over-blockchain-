import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Layers, 
  Lock, 
  User, 
  MapPin, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Building2, 
  ArrowLeft,
  Building,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DISTRICT_OFFICERS = [
  {
    state_name: 'Karnataka',
    state_code: 'KA',
    district_name: 'Belagavi',
    officer_id: 'DIST-KA-BELAGAVI',
    username: 'district.belagavi',
    email: 'district.belagavi@govtfund.gov.in',
    department: 'District Rural Development Agency (DRDA), Belagavi',
    password: 'District@123'
  },
  {
    state_name: 'Karnataka',
    state_code: 'KA',
    district_name: 'Bengaluru Urban',
    officer_id: 'DIST-KA-BENGALURU',
    username: 'district.bengaluru',
    email: 'district.bengaluru@govtfund.gov.in',
    department: 'District Rural Development Agency, Bengaluru',
    password: 'District@123'
  },
  {
    state_name: 'Karnataka',
    state_code: 'KA',
    district_name: 'Mysuru',
    officer_id: 'DIST-KA-MYSURU',
    username: 'district.mysuru',
    email: 'district.mysuru@govtfund.gov.in',
    department: 'District Planning & Rural Development, Mysuru',
    password: 'District@123'
  },
  {
    state_name: 'Maharashtra',
    state_code: 'MH',
    district_name: 'Pune',
    officer_id: 'DIST-MH-PUNE',
    username: 'district.pune',
    email: 'district@govtfund.gov.in',
    department: 'District Rural Development Agency (DRDA), Pune',
    password: 'District@123'
  },
  {
    state_name: 'Maharashtra',
    state_code: 'MH',
    district_name: 'Nagpur',
    officer_id: 'DIST-MH-NAGPUR',
    username: 'district.nagpur',
    email: 'district.nagpur@govtfund.gov.in',
    department: 'District Planning Council, Nagpur',
    password: 'District@123'
  },
  {
    state_name: 'Gujarat',
    state_code: 'GJ',
    district_name: 'Ahmedabad',
    officer_id: 'DIST-GJ-AHMEDABAD',
    username: 'district.ahmedabad',
    email: 'district.ahmedabad@govtfund.gov.in',
    department: 'District Rural Development Agency, Ahmedabad',
    password: 'District@123'
  },
  {
    state_name: 'Tamil Nadu',
    state_code: 'TN',
    district_name: 'Chennai',
    officer_id: 'DIST-TN-CHENNAI',
    username: 'district.chennai',
    email: 'district.chennai@govtfund.gov.in',
    department: 'District Project Implementation Agency, Chennai',
    password: 'District@123'
  },
  {
    state_name: 'Uttar Pradesh',
    state_code: 'UP',
    district_name: 'Lucknow',
    officer_id: 'DIST-UP-LUCKNOW',
    username: 'district.lucknow',
    email: 'district.lucknow@govtfund.gov.in',
    department: 'District Rural Development Agency, Lucknow',
    password: 'District@123'
  }
];

const DistrictLoginPage = () => {
  const [selectedOfficer, setSelectedOfficer] = useState(DISTRICT_OFFICERS[0]);
  const [identifier, setIdentifier] = useState(DISTRICT_OFFICERS[0].officer_id);
  const [password, setPassword] = useState(DISTRICT_OFFICERS[0].password);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSelectOfficer = (officer) => {
    setSelectedOfficer(officer);
    setIdentifier(officer.officer_id);
    setPassword(officer.password);
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
        if (res.user.role !== 'DISTRICT' && res.user.role !== 'SUPER_ADMIN') {
          throw new Error('Access Denied: Only designated District Officers are permitted to log in via this portal.');
        }
        navigate('/district/dashboard');
      }
    } catch (err) {
      setError(err.message || 'District Officer authentication failed. Please verify credentials.');
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
          <span>Role-Based District Access Control (RBAC)</span>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: District Selection & Jurisdiction Directory */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(124, 58, 237, 0.1)',
              color: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MapPin size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Assigned District Jurisdictions
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Select your assigned district to auto-fill Officer ID credentials
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {DISTRICT_OFFICERS.map((off, idx) => {
              const isSelected = selectedOfficer?.officer_id === off.officer_id;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelectOfficer(off)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid #7C3AED' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(124, 58, 237, 0.05)' : '#FFFFFF',
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
                      <strong style={{ fontSize: '13px', color: isSelected ? '#7C3AED' : 'var(--text-main)' }}>
                        {off.district_name}
                      </strong>
                      <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {off.state_name} ({off.state_code})
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ID: <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{off.officer_id}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {off.department}
                    </div>
                  </div>

                  {isSelected ? (
                    <CheckCircle2 size={18} color="#7C3AED" style={{ flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: '11px', color: '#7C3AED', fontWeight: '700', flexShrink: 0 }}>Select →</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '14px',
            padding: '10px 12px',
            background: 'rgba(3, 105, 161, 0.05)',
            border: '1px solid #BAE6FD',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: '#0369A1',
            lineHeight: 1.4
          }}>
            <strong>Security Isolation Note:</strong> Each District Officer is cryptographically bound to one specific district. You cannot query or approve projects outside your assigned jurisdiction.
          </div>
        </div>

        {/* Right: Login Card */}
        <div
          className="card"
          style={{
            padding: '28px',
            borderTop: '4px solid #7C3AED',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              background: '#7C3AED',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                District Officer Login
              </h1>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                District Rural Development Agency (DRDA)
              </div>
            </div>
          </div>

          {/* Active Selected Officer Summary Badge */}
          {selectedOfficer && (
            <div style={{
              marginBottom: '16px',
              padding: '10px 12px',
              background: 'rgba(124, 58, 237, 0.06)',
              border: '1px solid #DDD6FE',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#7C3AED', marginBottom: '2px' }}>
                Active Jurisdiction Target:
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                {selectedOfficer.district_name} District, {selectedOfficer.state_name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Officer ID: <code style={{ color: '#7C3AED', fontWeight: '700' }}>{selectedOfficer.officer_id}</code>
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
              background: '#7C3AED',
              borderColor: '#7C3AED',
              marginBottom: '14px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '700'
            }}
            disabled={loading}
            onClick={() => handleLogin(selectedOfficer.officer_id, selectedOfficer.password)}
          >
            <Sparkles size={15} />
            <span>{loading ? 'Authenticating...' : `1-Click Sign-In as ${selectedOfficer.district_name} Officer`}</span>
          </button>

          <div style={{ textAlign: 'center', margin: '12px 0', fontSize: '11px', color: 'var(--text-muted)', position: 'relative' }}>
            <span style={{ background: '#FFFFFF', padding: '0 8px', position: 'relative', zIndex: 1 }}>OR ENTER CREDENTIALS</span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>District Officer ID / Username / Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '36px', fontSize: '13px' }}
                  placeholder="e.g. DIST-KA-BELAGAVI or district.belagavi"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Officer Password</label>
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
              <span>{loading ? 'Verifying Jurisdiction...' : 'Authenticate & Enter Dashboard'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-success)' }} />
            <span>Strict District Bounded Session • 256-Bit Encrypted</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DistrictLoginPage;
