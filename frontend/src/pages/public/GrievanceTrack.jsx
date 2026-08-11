import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquareWarning, CheckCircle2, Clock, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import API from '../../services/api';

const GrievanceTrack = () => {
  const { refId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/public/grievance/${refId}`)
      .then((res) => {
        if (res.success) setComplaint(res.complaint);
      })
      .finally(() => setLoading(false));
  }, [refId]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center' }}>Searching grievance records...</div>;
  }

  if (!complaint) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-danger)' }}>Grievance Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 20px 0' }}>
          No grievance record found with Reference ID: <strong>{refId}</strong>.
        </p>
        <Link to="/public/grievance" className="btn btn-secondary">Submit New Complaint</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/public/grievance" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px' }}>
          <ArrowLeft size={14} />
          <span>Back to Grievance Portal</span>
        </Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Reference ID</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace' }}>{complaint.reference_id}</div>
          </div>

          <span className={`badge ${complaint.status === 'RESOLVED' ? 'badge-success' : complaint.status === 'INVESTIGATING' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '12px', padding: '6px 12px' }}>
            STATUS: {complaint.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13px', marginBottom: '20px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Citizen Name:</div>
            <strong style={{ color: 'var(--text-main)' }}>{complaint.citizen_name}</strong>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>District Jurisdiction:</div>
            <strong style={{ color: 'var(--text-main)' }}>{complaint.district_name}</strong>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>Complaint Category:</div>
            <strong style={{ color: 'var(--color-primary)' }}>{complaint.category}</strong>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)' }}>Filing Date:</div>
            <span style={{ color: 'var(--text-main)' }}>{new Date(complaint.created_at).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '13px' }}>
          <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>Original Complaint Details:</div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>"{complaint.description}"</p>
        </div>

        {/* Resolution Notes Box */}
        {complaint.resolution_notes ? (
          <div style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            color: 'var(--color-success)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', marginBottom: '6px' }}>
              <ShieldCheck size={18} />
              <span>Official District Resolution Statement</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
              {complaint.resolution_notes}
            </p>
            {complaint.resolved_by && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Resolved by: {complaint.resolved_by} on {new Date(complaint.resolved_at).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px',
            color: 'var(--color-warning)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={16} />
            <span>Site inspection underway by District Development Engineers. Resolution notes will appear here once finalized.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrievanceTrack;
