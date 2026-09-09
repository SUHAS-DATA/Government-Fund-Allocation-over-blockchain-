import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Unlock, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const FraudFreeze = () => {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [freezeAction, setFreezeAction] = useState('FREEZE');
  const [reason, setReason] = useState(searchParams.get('reason') || 'Material variance detected in milestone site evidence. Escrow halted pending CAG review.');
  
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const loadProjects = () => {
    API.get('/auditor/projects').then((res) => {
      if (res.success) {
        setProjects(res.projects || []);
        const preselect = searchParams.get('project_id');
        if (preselect) {
          const p = res.projects?.find((x) => x.project_id === preselect);
          if (p) {
            setSelectedProject(p);
            setFreezeAction(p.is_frozen ? 'UNFREEZE' : 'FREEZE');
          }
        }
      }
    });
  };

  useEffect(() => {
    loadProjects();
  }, [searchParams]);

  const handleExecuteFreeze = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setActionSuccess('');

    try {
      const endpoint = freezeAction === 'FREEZE' ? '/auditor/freeze-project' : '/auditor/unfreeze-project';
      const res = await API.post(endpoint, {
        project_id: selectedProject.project_id,
        reason
      });

      if (res.success) {
        setActionSuccess(`Project ${selectedProject.project_id} ${freezeAction} executed on Ethereum: ${res.blockchain?.tx_hash}`);
        setSelectedProject(null);
        loadProjects();
      }
    } catch (err) {
      alert(err.message || 'Freeze action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Project ID',
      accessor: 'project_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.project_id}</strong>
    },
    { header: 'Project Name', accessor: 'name' },
    {
      header: 'Total Budget',
      accessor: 'total_budget',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.total_budget)}</span>
    },
    {
      header: 'Freeze Status',
      accessor: 'is_frozen',
      render: (r) => (
        <span className={`badge ${r.is_frozen ? 'badge-danger' : 'badge-success'}`}>
          {r.is_frozen ? 'FROZEN ON-CHAIN' : 'ACTIVE ESCROW'}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        <button
          className={`btn btn-sm ${r.is_frozen ? 'btn-success' : 'btn-danger'}`}
          onClick={() => {
            setSelectedProject(r);
            setFreezeAction(r.is_frozen ? 'UNFREEZE' : 'FREEZE');
            setReason(r.is_frozen ? 'Forensic rectification verified. Escrow unfreezing permitted.' : 'Material variance detected in milestone site evidence.');
          }}
        >
          {r.is_frozen ? <Unlock size={12} /> : <Lock size={12} />}
          <span>{r.is_frozen ? 'Unfreeze Escrow' : 'Freeze Project'}</span>
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Lock size={24} color="var(--color-danger)" />
            <span>Emergency Project Fund Freeze</span>
          </h1>
          <p className="page-subtitle">
            Temporarily pause payments in cases of serious fraud, work quality failures, or verified citizen complaints.
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: 'var(--color-success)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '500',
          fontSize: '13px'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={projects} searchKey="name" searchPlaceholder="Search projects..." />
      </div>

      <Modal title={`${freezeAction === 'FREEZE' ? 'Freeze' : 'Unfreeze'} Project: ${selectedProject?.project_id}`} isOpen={!!selectedProject} onClose={() => setSelectedProject(null)}>
        {selectedProject && (
          <div>
            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', fontSize: '13px' }}>
              <div>Project: <strong>{selectedProject.name}</strong></div>
              <div>Budget: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedProject.total_budget)}</strong></div>
              <div>Current Status: <span className={`badge ${selectedProject.is_frozen ? 'badge-danger' : 'badge-success'}`}>{selectedProject.is_frozen ? 'FROZEN' : 'ACTIVE'}</span></div>
            </div>

            <form onSubmit={handleExecuteFreeze}>
              <div className="form-group">
                <label className="form-label">Reason for Action & Verification Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedProject(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${freezeAction === 'FREEZE' ? 'btn-danger' : 'btn-success'}`}
                  disabled={submitting}
                >
                  {freezeAction === 'FREEZE' ? <Lock size={14} /> : <Unlock size={14} />}
                  <span>{submitting ? 'Executing On-Chain...' : `Confirm ${freezeAction} on Ethereum`}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FraudFreeze;
