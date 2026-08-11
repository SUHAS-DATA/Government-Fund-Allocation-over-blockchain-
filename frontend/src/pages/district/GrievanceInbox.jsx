import React, { useState, useEffect } from 'react';
import { MessageSquareWarning, ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const GrievanceInbox = () => {
  const [grievances, setGrievances] = useState([]);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [status, setStatus] = useState('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('Site inspection conducted by District Engineer. Quality test passed and corrective measures certified.');
  const [submitting, setSubmitting] = useState(false);

  const loadGrievances = () => {
    API.get('/district/grievances').then((res) => {
      if (res.success) setGrievances(res.grievances || []);
    });
  };

  useEffect(() => {
    loadGrievances();
  }, []);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedGrievance) return;
    setSubmitting(true);
    try {
      await API.put(`/district/grievances/${selectedGrievance.reference_id}/update-status`, {
        status,
        resolution_notes: resolutionNotes
      });
      setSelectedGrievance(null);
      loadGrievances();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Reference ID',
      accessor: 'reference_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.reference_id}</strong>
    },
    { header: 'Citizen Name', accessor: 'citizen_name' },
    { header: 'Category', accessor: 'category' },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span className={`badge ${r.status === 'RESOLVED' ? 'badge-success' : r.status === 'INVESTIGATING' ? 'badge-warning' : 'badge-info'}`}>
          {r.status}
        </span>
      )
    },
    {
      header: 'Date Filed',
      accessor: 'created_at',
      render: (r) => new Date(r.created_at).toLocaleDateString()
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setSelectedGrievance(r); setStatus(r.status || 'RESOLVED'); }}
        >
          <span>Inspect & Resolve</span>
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MessageSquareWarning size={24} color="var(--color-primary)" />
            <span>District Grievance & Citizen Complaints Inbox</span>
          </h1>
          <p className="page-subtitle">Review public complaints, conduct site investigations, and publish verifiable resolutions.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={grievances} searchKey="reference_id" searchPlaceholder="Search by reference ID or citizen..." />
      </div>

      <Modal title={`Inspect Grievance: ${selectedGrievance?.reference_id}`} isOpen={!!selectedGrievance} onClose={() => setSelectedGrievance(null)}>
        {selectedGrievance && (
          <div>
            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', fontSize: '13px' }}>
              <div>Citizen: <strong>{selectedGrievance.citizen_name}</strong></div>
              <div>Category: <span style={{ color: 'var(--color-primary)' }}>{selectedGrievance.category}</span></div>
              <div style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                "{selectedGrievance.description}"
              </div>
            </div>

            <form onSubmit={handleUpdateStatus}>
              <div className="form-group">
                <label className="form-label">Investigation Status</label>
                <select
                  className="form-control form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="INVESTIGATING">INVESTIGATING (Site Inspection in Progress)</option>
                  <option value="RESOLVED">RESOLVED (Action Taken & Verified)</option>
                  <option value="REJECTED">REJECTED (Invalid / False Claim)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Official Resolution Notes (Publicly Visible)</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedGrievance(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={submitting}>
                  <ShieldCheck size={15} />
                  <span>{submitting ? 'Updating...' : 'Publish Official Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GrievanceInbox;
