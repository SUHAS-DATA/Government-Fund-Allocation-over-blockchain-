import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ArrowRight, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const INDIAN_STATES = [
  { code: 'KA', name: 'Karnataka' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'UP', name: 'Uttar Pradesh' }
];

const RegisterPage = () => {
  const [formData, setFormData] = useState({
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

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await API.post('/auth/register', formData);
      if (res.success) {
        // Log in immediately
        await login(formData.email, formData.password);
        navigate('/contractor/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-primary)' }}>
          Contractor & Enterprise Registration
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Enroll for government infrastructure bidding and milestone payment eligibility
        </p>
      </div>

      <div className="card" style={{ padding: '24px 28px' }}>
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

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Authorized Representative Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rajesh Sharma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Official Email ID</label>
              <input
                type="email"
                className="form-control"
                placeholder="rajesh@company.in"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Enterprise / Company Legal Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Apex Infrastructure Contractors Pvt Ltd"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
            />
          </div>

          {/* State of Registration Selection */}
          <div className="form-group" style={{ background: '#FFF7ED', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #FFEDD5', marginBottom: '14px' }}>
            <label className="form-label" style={{ color: '#9A3412', fontWeight: '800' }}>
              State of Registration (Select Your State) *
            </label>
            <select
              className="form-control form-select"
              value={formData.state_code}
              onChange={(e) => {
                const sel = INDIAN_STATES.find(s => s.code === e.target.value) || { code: e.target.value, name: e.target.value };
                setFormData({
                  ...formData,
                  state_code: sel.code,
                  state_name: sel.name,
                  license_number: `PWD/${sel.code}/2026/001`
                });
              }}
              required
              style={{ fontWeight: '700', borderColor: '#EA580C', background: '#FFFFFF' }}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: '#7C2D12', marginTop: '6px' }}>
              * Registration is verified by the <strong>{formData.state_name} State Department</strong>. District Officers can only allocate projects to contractors verified in their state.
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input
                type="text"
                className="form-control"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company PAN</label>
              <input
                type="text"
                className="form-control"
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">PWD License Number</label>
            <input
              type="text"
              className="form-control"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            <span>{loading ? 'Creating Enterprise Account...' : 'Complete Contractor Registration'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '12px' }}>
          <span>Already registered? </span>
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: '600', textDecoration: 'none' }}>
            Officer / Contractor Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
