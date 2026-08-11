import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import Modal from '../../components/Modal';

const ContractorKYCReview = () => {
  const [contractors, setContractors] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVED');
  const [remarks, setRemarks] = useState('All government documents, GST, PAN, and PWD license verified successfully.');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const loadContractors = () => {
    API.get('/district/contractors').then((res) => {
      if (res.success) setContractors(res.contractors || []);
    });
  };

  useEffect(() => {
    loadContractors();
  }, []);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedContractor) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/contractor/${selectedContractor.user_id}/kyc-review`, {
        action: reviewAction,
        remarks
      });
      if (res.success) {
        setActionSuccess(`Contractor ${selectedContractor.company_name} status updated to ${reviewAction}`);
        setSelectedContractor(null);
        loadContractors();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Company / Legal Name',
      accessor: 'company_name',
      render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.company_name}</strong>
    },
    { header: 'GSTIN', accessor: 'gst_number' },
    { header: 'Company PAN', accessor: 'pan_number' },
    { header: 'PWD License No.', accessor: 'license_number' },
    {
      header: 'KYC Status',
      accessor: 'kyc_status',
      render: (r) => (
        <span className={`badge ${r.kyc_status === 'APPROVED' ? 'badge-success' : r.kyc_status === 'UNDER_REVIEW' ? 'badge-warning' : 'badge-danger'}`}>
          {r.kyc_status}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setSelectedContractor(r); setReviewAction('APPROVED'); }}
        >
          <UserCheck size={13} />
          <span>Review KYC</span>
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <UserCheck size={24} color="var(--color-primary)" />
            <span>Contractor KYC & Statutory Credential Review</span>
          </h1>
          <p className="page-subtitle">
            Inspect off-chain uploaded GST, PAN, and PWD credentials, verify cryptographic SHA-256 digests, and approve bidding eligibility.
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
        <DataTable columns={columns} data={contractors} searchKey="company_name" searchPlaceholder="Search contractors..." />
      </div>

      <Modal title={`Review KYC Credentials: ${selectedContractor?.company_name}`} isOpen={!!selectedContractor} onClose={() => setSelectedContractor(null)} maxWidth="750px">
        {selectedContractor && (
          <div>
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '13px' }}>
              <div className="grid-2">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>GSTIN: </span>
                  <strong>{selectedContractor.gst_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>PAN: </span>
                  <strong>{selectedContractor.pan_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>License: </span>
                  <strong>{selectedContractor.license_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Experience: </span>
                  <strong style={{ color: 'var(--color-primary)' }}>{selectedContractor.experience_years || 5} Years</strong>
                </div>
              </div>
            </div>

            {/* KYC Documents with Hash Verification */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '10px' }}>
                Uploaded Credential Documents & Cryptographic Hashes
              </h4>

              {selectedContractor.kyc_documents?.length > 0 ? (
                selectedContractor.kyc_documents.map((doc, idx) => (
                  <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
                ))
              ) : (
                <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-xs)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Contractor submitted digital declaration with auto-anchored Ethereum wallet address.
                </div>
              )}
            </div>

            {/* Review Form */}
            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Review Decision</label>
                <select
                  className="form-control form-select"
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                >
                  <option value="APPROVED">APPROVED (Activate Bidding & Escrow Eligibility)</option>
                  <option value="REJECTED">REJECTED (Disqualify Enterprise)</option>
                  <option value="RESUBMISSION_REQUIRED">RESUBMISSION REQUIRED (Request Additional Proofs)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Officer Verification Remarks</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedContractor(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <ShieldCheck size={15} />
                  <span>{submitting ? 'Updating...' : 'Submit Verification Verdict'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ContractorKYCReview;
