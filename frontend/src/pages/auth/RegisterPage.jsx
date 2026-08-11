import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ArrowRight, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
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
          Enroll for government infrastructure bidding and smart contract escrow eligibility
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
