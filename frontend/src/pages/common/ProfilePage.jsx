import React, { useState } from 'react';
import { User, Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

const ProfilePage = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSubmitting(true);
    setError('');
    setMsg('');

    try {
      const res = await API.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      if (res.success) {
        setMsg('Password updated successfully');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message || 'Password update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '10px 0 60px 0' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <User size={24} color="var(--color-primary)" />
            <span>Officer Identity & Account Security</span>
          </h1>
          <p className="page-subtitle">Manage your government credentials and session authorization privileges.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Shield size={18} color="var(--color-primary)" />
            <span>Official Profile Particulars</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Full Name:</div>
            <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>{user?.name}</strong>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>Official Email ID:</div>
            <strong style={{ color: 'var(--text-main)' }}>{user?.email}</strong>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>Assigned Role:</div>
            <span className="role-pill">{user?.role?.replace(/_/g, ' ')}</span>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>Jurisdiction / Department:</div>
            <strong style={{ color: 'var(--color-primary)' }}>{user?.state_name || user?.district_name || user?.department || 'National Secretariat'}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Lock size={18} color="var(--color-primary)" />
            <span>Change Security Password</span>
          </div>
        </div>

        {msg && (
          <div style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: 'var(--color-success)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px'
          }}>
            <CheckCircle2 size={16} />
            <span>{msg}</span>
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            color: 'var(--color-danger)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-control"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <span>{submitting ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
