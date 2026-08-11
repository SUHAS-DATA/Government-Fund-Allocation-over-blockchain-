import React, { useState, useEffect } from 'react';
import { FileCheck, ShieldCheck, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import API from '../../services/api';
import DocumentHashViewer from '../../components/DocumentHashViewer';

const ContractorKYC = () => {
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    company_name: '',
    gst_number: '',
    pan_number: '',
    license_number: '',
    experience_years: 5
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('PWD_CLASS1_LICENSE');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadKyc = () => {
    API.get('/contractor/kyc-status').then((res) => {
      if (res.success) {
        setKycData(res);
        setFormData({
          company_name: res.company_name || '',
          gst_number: res.gst_number || '',
          pan_number: res.pan_number || '',
          license_number: res.license_number || '',
          experience_years: res.experience_years || 5
        });
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleUpdateKyc = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');

    const data = new FormData();
    data.append('company_name', formData.company_name);
    data.append('gst_number', formData.gst_number);
    data.append('pan_number', formData.pan_number);
    data.append('license_number', formData.license_number);
    data.append('experience_years', formData.experience_years);
    data.append('doc_type', docType);
    if (selectedFile) {
      data.append('file', selectedFile);
    }

    try {
      const res = await API.post('/contractor/kyc-submit', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setSuccessMsg('KYC credentials and cryptographic SHA-256 digest submitted successfully.');
        loadKyc();
      }
    } catch (err) {
      alert(err.message || 'KYC submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '10px 0 60px 0' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileCheck size={24} color="var(--color-primary)" />
            <span>Statutory Contractor KYC & Licensing</span>
          </h1>
          <p className="page-subtitle">
            Submit verified legal credentials, upload inspection certificates, and anchor SHA-256 digests on blockchain.
          </p>
        </div>

        <span className={`badge ${kycData?.kyc_status === 'APPROVED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
          STATUS: {kycData?.kyc_status || 'UNDER_REVIEW'}
        </span>
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
        <form onSubmit={handleUpdateKyc}>
          <div className="form-group">
            <label className="form-label">Enterprise / Company Registered Name</label>
            <input
              type="text"
              className="form-control"
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

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">PWD / CPWD License Number</label>
              <input
                type="text"
                className="form-control"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Years of Infrastructure Experience</label>
              <input
                type="number"
                className="form-control"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Off-Chain Document Upload with Hash Anchor */}
          <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-sm)', marginTop: '10px', marginBottom: '20px' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>
              Upload Official Statutory Credential Document (PDF / Image)
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Document Classification</label>
                <select
                  className="form-control form-select"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="PWD_CLASS1_LICENSE">PWD Class-1 Contractor License</option>
                  <option value="GST_REGISTRATION">GST Registration Certificate</option>
                  <option value="BANK_SOLVENCY">Bank Solvency & Net Worth Certificate</option>
                  <option value="COMPLETION_CERT">Past Major Project Completion Certificate</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select File from System</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting}>
            <ShieldCheck size={16} />
            <span>{submitting ? 'Anchoring SHA-256 Digest on Blockchain...' : 'Update KYC Credentials & Anchor Hash'}</span>
          </button>
        </form>
      </div>

      {/* Uploaded Documents List */}
      <div className="card">
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
          Uploaded Off-Chain Credentials & Cryptographic SHA-256 Hashes
        </h3>

        {kycData?.kyc_documents?.length > 0 ? (
          kycData.kyc_documents.map((doc, idx) => (
            <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No uploaded credential files found. Select a file above and click Update KYC.
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractorKYC;
