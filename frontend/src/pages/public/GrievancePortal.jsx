import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MessageSquareWarning, CheckCircle2, ShieldAlert, ArrowRight, Search } from 'lucide-react';
import API from '../../services/api';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import { getStateForDistrict } from '../../config/statesDistrictsData';

const GrievancePortal = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramDistrict = searchParams.get('district') || '';
  const paramState = searchParams.get('state') || (paramDistrict ? getStateForDistrict(paramDistrict)?.code : 'KA') || 'KA';

  const [selectedState, setSelectedState] = useState(paramState);
  const [formData, setFormData] = useState({
    citizen_name: '',
    email: '',
    project_id: searchParams.get('project_id') || '',
    state_code: paramState,
    district_name: paramDistrict || 'Belagavi',
    category: 'CONSTRUCTION_QUALITY',
    description: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [successRefId, setSuccessRefId] = useState('');
  const [trackRefInput, setTrackRefInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await API.post('/public/grievance', formData);
      if (res.success) {
        setSuccessRefId(res.reference_id);
      }
    } catch (err) {
      alert(err.message || 'Grievance submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (trackRefInput.trim()) {
      navigate(`/public/grievance/track/${trackRefInput.trim()}`);
    }
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MessageSquareWarning size={24} color="var(--color-warning)" />
            <span>Report an Issue & Citizen Complaint Portal</span>
          </h1>
          <p className="page-subtitle">
            Report problems with project construction, delays, or work quality directly to government officers.
          </p>
        </div>
      </div>

      {/* Tracker Box */}
      <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '28px', padding: '18px 24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
          Already have a Complaint Tracking ID?
        </h3>
        <form onSubmit={handleTrackSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Enter Tracking ID (e.g. GRV-2026-369964)"
            value={trackRefInput}
            onChange={(e) => setTrackRefInput(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>
            <Search size={14} />
            <span>Check Status</span>
          </button>
        </form>
      </div>

      {successRefId ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <CheckCircle2 size={32} color="var(--color-success)" />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            Complaint Submitted Successfully
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px' }}>
            Your complaint has been forwarded to the District Development Officer for investigation.
          </p>

          <div style={{
            background: '#FFFFFF',
            border: '2px dashed var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '24px',
            display: 'inline-block'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Your Tracking Reference ID</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', marginTop: '4px' }}>
              {successRefId}
            </div>
          </div>

          <div>
            <Link to={`/public/grievance/track/${successRefId}`} className="btn btn-primary">
              <span>Track Complaint Status</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Citizen Name"
                  value={formData.citizen_name}
                  onChange={(e) => setFormData({ ...formData, citizen_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project ID (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. PRJ-BEL-8X9Y2A or leave blank"
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              />
            </div>

            <StateDistrictSelector
              selectedState={selectedState}
              selectedDistrict={formData.district_name}
              onStateChange={(st) => {
                setSelectedState(st);
                setFormData((prev) => ({ ...prev, state_code: st, district_name: '' }));
              }}
              onDistrictChange={(dist) => {
                setFormData((prev) => ({ ...prev, district_name: dist }));
              }}
              stateLabel="State"
              districtLabel="District"
              stateRequired={true}
              districtRequired={true}
            />

            <div className="form-group">
              <label className="form-label">Problem Category</label>
              <select
                className="form-control form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="CONSTRUCTION_QUALITY">Poor Work & Construction Quality</option>
                <option value="PROJECT_DELAY">Work Stopped or Delayed</option>
                <option value="FINANCIAL_CORRUPTION">Suspected Corruption or Over-Charging</option>
                <option value="SAFETY_VIOLATION">Public Safety Hazard</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Complaint Details & Observations</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Describe what is wrong, the location, and what you noticed..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              <span>{submitting ? 'Submitting Complaint...' : 'Submit Complaint to Officers'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default GrievancePortal;
