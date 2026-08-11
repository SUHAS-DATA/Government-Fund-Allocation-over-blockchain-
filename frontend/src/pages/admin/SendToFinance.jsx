import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const SendToFinance = () => {
  const [allocations, setAllocations] = useState([]);
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [notes, setNotes] = useState('Sanctioned by Principal Secretary. Forwarded to Finance Disbursal Authority.');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadAllocations = () => {
    API.get('/admin/allocations').then((res) => {
      if (res.success) setAllocations(res.allocations || []);
    });
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const handleSend = async (allocationId) => {
    setSending(true);
    setSuccessMsg('');
    try {
      const res = await API.post('/admin/budget/send-to-finance', {
        allocation_id: allocationId,
        notes
      });
      if (res.success) {
        setSuccessMsg(`Budget ${allocationId} successfully forwarded to Finance Department.`);
        setSelectedAlloc(null);
        loadAllocations();
      }
    } catch (e) {
      alert(e.message || 'Error forwarding to Finance');
    } finally {
      setSending(false);
    }
  };

  const columns = [
    {
      header: 'Allocation ID',
      accessor: 'allocation_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.allocation_id}</strong>
    },
    { header: 'Department', accessor: 'department' },
    { header: 'Scheme Name', accessor: 'scheme_name' },
    {
      header: 'Allocated Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span className={`badge ${r.status === 'SENT_TO_FINANCE' ? 'badge-success' : 'badge-warning'}`}>
          {r.status?.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        r.status === 'SENT_TO_FINANCE' ? (
          <span style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <CheckCircle2 size={13} />
            <span>Forwarded</span>
          </span>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setSelectedAlloc(r)}
          >
            <Send size={13} />
            <span>Send to Finance</span>
          </button>
        )
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Send size={24} color="var(--color-primary)" />
            <span>Send Budget to Finance Department</span>
          </h1>
          <p className="page-subtitle">
            Validate central budget allocations and forward to the Public Fund Disbursal Authority for state treasury transfers.
          </p>
        </div>
      </div>

      {successMsg && (
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
          <span>{successMsg}</span>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={allocations} searchKey="scheme_name" />
      </div>

      <Modal title="Forward Budget Allocation to Finance" isOpen={!!selectedAlloc} onClose={() => setSelectedAlloc(null)}>
        {selectedAlloc && (
          <div>
            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Allocation ID:</span>
                <strong style={{ fontFamily: 'monospace' }}>{selectedAlloc.allocation_id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scheme:</span>
                <span style={{ fontWeight: '600' }}>{selectedAlloc.scheme_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>
                <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedAlloc.amount)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sign-Off & Forwarding Notes</label>
              <textarea
                className="form-control"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedAlloc(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSend(selectedAlloc.allocation_id)}
                disabled={sending}
              >
                <Send size={14} />
                <span>{sending ? 'Forwarding...' : 'Confirm Forwarding'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SendToFinance;
