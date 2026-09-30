import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  AlertCircle,
  Lock,
  Unlock,
  Layers,
  ArrowRight,
  Sparkles,
  XCircle,
  FileText,
  Camera,
  Video,
  FileArchive,
  RotateCcw,
  Ban,
  Building2,
  Receipt,
  QrCode,
  Download,
  ExternalLink,
  Eye
} from 'lucide-react';
import API, { getApiBaseUrl } from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useRealtimeSync } from '../../context/RealtimeContext';

const MyProjects = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals & Action States
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showFundRequestModal, setShowFundRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidencePhaseIndex, setEvidencePhaseIndex] = useState(0);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [previewEvidence, setPreviewEvidence] = useState(null);

  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [fundRequestAmount, setFundRequestAmount] = useState(0);
  const [fundRequestNotes, setFundRequestNotes] = useState('');

  // Multi-Proof Submission Form States (Flowchart Deliverables)
  const [percentage, setPercentage] = useState(100);
  const [notes, setNotes] = useState('Groundwork, terrain leveling, and structural concrete culverts completed as per PWD specifications.');
  const [materialBillsNotes, setMaterialBillsNotes] = useState('Cement, TMT Steel 500D, and Crushed Aggregate Invoices');
  const [materialBillsFile, setMaterialBillsFile] = useState(null);
  const [progressPhotoFile, setProgressPhotoFile] = useState(null);
  const [progressVideoFile, setProgressVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [otherDocFile, setOtherDocFile] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadProjects = (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    API.get('/contractor/projects')
      .then((res) => {
        if (res.success) {
          setActionError('');
          setProjects(res.projects || []);
          if (selectedProject) {
            const updated = res.projects.find(p => p.project_id === selectedProject.project_id);
            if (updated) openProjectDetails(updated);
          }
        }
      })
      .catch((err) => {
        setActionError(err.message || 'Failed to load projects');
      })
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects(true);
  }, []);

  useRealtimeSync(() => loadProjects(false), { interval: 6000 });

  const openProjectDetails = async (p) => {
    setSelectedProject(p);
    setActionError('');
    try {
      const res = await API.get(`/contractor/projects/${p.project_id}`);
      if (res.success) {
        setProjectDetails(res);
      }
    } catch (e) {
      setActionError(e.message || 'Failed to load project details');
    }
  };

  // --- Accept Project Assignment (Generates 3 Phases: 30%, 40%, 30%) ---
  const handleAcceptProject = async (projectId) => {
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await API.post(`/contractor/projects/${projectId}/accept`);
      if (res.success) {
        setActionSuccess(`Project ${projectId} Accepted! Contract ${res.contract_id || ''} confirmed and unique QR code automatically generated.`);
        const detailsRes = await API.get(`/contractor/projects/${projectId}`);
        if (detailsRes.success) {
          setSelectedProject(detailsRes.project);
          setProjectDetails(detailsRes);
        }
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to accept project assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadContractorQr = () => {
    const qrData = projectDetails?.qr_code?.qr_image_data || selectedProject?.qr_code?.qr_image_data;
    if (!qrData) return;
    const link = document.createElement('a');
    link.href = qrData;
    link.download = `${selectedProject?.contract_id || selectedProject?.project_id}_Official_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Reject Project Assignment ---
  const handleRejectProject = async () => {
    if (!selectedProject) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/reject`, {
        rejection_reason: rejectReason || 'Contractor at maximum operational capacity.'
      });
      if (res.success) {
        setActionSuccess(`Project assignment for ${selectedProject.project_id} has been declined.`);
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedProject(null);
        setProjectDetails(null);
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to decline project.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Request Phase Funds from District Officer ---
  const handleOpenFundRequest = (phase) => {
    setActivePhaseIndex(phase.milestone_index);
    setFundRequestAmount(phase.amount);
    setFundRequestNotes(`Mobilization and materials advance for Phase #${phase.milestone_index + 1}: ${phase.title}`);
    setShowFundRequestModal(true);
  };

  const handleSubmitFundRequest = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/phases/${activePhaseIndex}/request-funds`, {
        requested_amount: Number(fundRequestAmount),
        notes: fundRequestNotes
      });
      if (res.success) {
        setActionSuccess(`Fund request for Phase #${activePhaseIndex + 1} (INR ${Number(fundRequestAmount).toLocaleString('en-IN')}) submitted to District Officer!`);
        setShowFundRequestModal(false);
        openProjectDetails(selectedProject);
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to submit fund request');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Acknowledge Received Allocated Funds & Start Execution ---
  const handleAcknowledgeFunds = async (phaseIndex) => {
    if (!selectedProject) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/phases/${phaseIndex}/receive-funds`);
      if (res.success) {
        setActionSuccess(`Allocated funds acknowledged! Phase #${phaseIndex + 1} execution initiated.`);
        openProjectDetails(selectedProject);
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to acknowledge funds');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Upload Multi-Proof Completion Deliverables (Bills, Photos, Videos, Documents) ---
  const handleOpenProgressUpload = (phase) => {
    setActivePhaseIndex(phase.milestone_index);
    setPercentage(100);
    setNotes(phase.rejection_reason ? `Rectified deliverables for Phase #${phase.milestone_index + 1}: Inspected items corrected as per feedback.` : `Phase #${phase.milestone_index + 1} execution complete according to DPR specifications.`);
    setMaterialBillsNotes('Invoices: Cement (500 Bags), Steel TMT (12 MT), Asphalt & Base Bitumen (40 Drums)');
    setMaterialBillsFile(null);
    setProgressPhotoFile(null);
    setProgressVideoFile(null);
    setVideoUrl('');
    setOtherDocFile(null);
    setShowProgressModal(true);
  };

  const handleUploadProgress = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');

    const data = new FormData();
    data.append('milestone_index', activePhaseIndex);
    data.append('percentage', percentage);
    data.append('notes', notes);
    data.append('material_bills_notes', materialBillsNotes);
    data.append('video_url', videoUrl);

    if (materialBillsFile) data.append('material_bills_file', materialBillsFile);
    if (progressPhotoFile) data.append('progress_photo_file', progressPhotoFile);
    if (progressVideoFile) data.append('progress_video_file', progressVideoFile);
    if (otherDocFile) data.append('other_doc_file', otherDocFile);

    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/phases/${activePhaseIndex}/submit-milestone`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setActionSuccess(`Completion proof (Material Bills, Photos, Videos, Docs) anchored on blockchain with SHA-256 digests and submitted to District Officer!`);
        setShowProgressModal(false);
        openProjectDetails(selectedProject);
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Progress upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Upload Work Evidence (Photos, Progress Images, PDFs, Completion Docs) ---
  const handleOpenEvidenceModal = (phase) => {
    setEvidencePhaseIndex(phase.milestone_index);
    setEvidenceFile(null);
    setEvidenceDescription(phase.rejection_reason ? `Rectified work evidence for Phase #${phase.milestone_index + 1}` : `Completed work evidence for Phase #${phase.milestone_index + 1}`);
    setShowEvidenceModal(true);
  };

  const handleSubmitEvidence = async (e) => {
    e.preventDefault();
    if (!selectedProject || !evidenceFile) return;
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');

    const formData = new FormData();
    formData.append('file', evidenceFile);
    formData.append('description', evidenceDescription);

    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/milestones/${evidencePhaseIndex}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setActionSuccess(`Work evidence submitted successfully! Evidence Status: Pending Verification.`);
        setShowEvidenceModal(false);
        setEvidenceFile(null);
        setEvidenceDescription('');
        openProjectDetails(selectedProject);
        loadProjects();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to upload work evidence.');
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
    { header: 'Project Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    {
      header: 'District Jurisdiction',
      accessor: 'district_name',
      render: (r) => <span>{r.district_name} ({r.state_code || 'KA'})</span>
    },
    {
      header: 'Total Contract Value',
      accessor: 'total_budget',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.total_budget)}</span>
    },
    {
      header: 'Lifecycle Status',
      accessor: 'status',
      render: (r) => {
        if (r.status === 'CLOSED') {
          return <span className="badge badge-secondary">CLOSED</span>;
        }
        if (r.status === 'FINAL_PROJECT_COMPLETED') {
          return <span className="badge badge-success">COMPLETED</span>;
        }
        if (r.status === 'ASSIGNED' || r.status === 'PENDING_ACCEPTANCE') {
          return <span className="badge badge-warning">ASSIGNMENT RECEIVED</span>;
        }
        if (r.status === 'REJECTED_BY_CONTRACTOR' || r.status === 'PROJECT_REJECTED') {
          return <span className="badge badge-danger">DECLINED</span>;
        }
        return <span className="badge badge-info">IN PROGRESS</span>;
      }
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => {
        const needsAccept = !r.phases || r.phases.length === 0 || r.status === 'ASSIGNED' || r.status === 'PENDING_ACCEPTANCE' || r.assignment_status !== 'ACCEPTED';
        return (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {needsAccept && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => handleAcceptProject(r.project_id)}
                disabled={submitting}
              >
                <CheckCircle2 size={12} />
                <span>Accept</span>
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => openProjectDetails(r)}>
              <span>{needsAccept ? 'View Assignment' : 'Manage 3 Phases'}</span>
            </button>
          </div>
        );
      }
    }
  ];

  const milestones = projectDetails?.milestones || selectedProject?.phases || [];
  const projData = projectDetails?.project || selectedProject;
  const isBankDeactivated = projData?.bank_account_status === 'DEACTIVATED' || projData?.contractor_bank_account?.is_active === false;
  const isProjectClosed = projData?.status === 'CLOSED' || projData?.is_closed;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FolderKanban size={24} color="#C2410C" />
            <span>Contractor: Assigned Projects & 3-Phase Execution</span>
          </h1>
          <p className="page-subtitle">
            Accept project assignments, request mobilization funds, receive bank disbursals, and upload 4-category completion proofs.
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

      {actionError && (
        <div style={{
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: 'var(--color-danger)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '500',
          fontSize: '13px'
        }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={projects} searchKey="name" searchPlaceholder="Search my assigned projects..." />
      </div>

      {/* Selected Project Lifecycle Container */}
      {selectedProject && (
        <div className="card" style={{ marginTop: '24px', borderTop: '4px solid #C2410C' }}>

          {/* Project Header */}
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                PROJECT: <strong style={{ color: 'var(--color-primary)' }}>{selectedProject.project_id}</strong> • Jurisdiction: <strong>{selectedProject.district_name}</strong>
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', margin: '2px 0 0 0' }}>
                {selectedProject.name}
              </h3>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Contract Budget Ceiling:</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-success)' }}>
                {formatCurrency(selectedProject.total_budget)}
              </div>
            </div>
          </div>

          {/* Deactivated Bank Account Banner */}
          {isBankDeactivated && (
            <div style={{
              margin: '16px 0',
              padding: '16px 20px',
              background: '#FEF2F2',
              border: '2px solid #F87171',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <Ban size={28} color="#DC2626" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#991B1B' }}>
                  🚫 Account Not Available to Contractor (Project Bank Account Deactivated)
                </div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  The District Development Authority has completed quality audits and closed this project. The designated project bank account/escrow facility is now deactivated and no further fund requests or evidence submissions are permitted.
                </div>
              </div>
            </div>
          )}

          {/* Pending Assignment Alert Banner */}
          {(milestones.length === 0 || selectedProject.status === 'ASSIGNED' || selectedProject.status === 'PENDING_ACCEPTANCE' || selectedProject.assignment_status !== 'ACCEPTED') && (
            <div style={{
              margin: '16px 0',
              padding: '16px',
              background: 'rgba(194, 65, 12, 0.06)',
              border: '1.5px solid #FED7AA',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '14px', color: '#C2410C', marginBottom: '2px' }}>
                  Notification: New Project Assigned by District Authority
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Choose to <strong>Accept Project</strong> (initializes 3 standardized phases: 30%, 40%, 30%) or <strong>Reject Project</strong>.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-success"
                  onClick={() => handleAcceptProject(selectedProject.project_id)}
                  disabled={submitting}
                >
                  <CheckCircle2 size={15} />
                  <span>{submitting ? 'Initializing...' : 'Accept Project'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--color-danger)' }}
                  onClick={() => setShowRejectModal(true)}
                  disabled={submitting}
                >
                  <XCircle size={15} />
                  <span>Reject Project (End)</span>
                </button>
              </div>
            </div>
          )}

          {/* QR Verification Section for Accepted Project / Contract */}
          {(selectedProject.assignment_status === 'ACCEPTED' || selectedProject.contract_status === 'ACCEPTED' || selectedProject.status === 'IN_PROGRESS' || projectDetails?.qr_code || selectedProject.qr_code) && (
            <div style={{
              margin: '16px 0 24px 0',
              padding: '22px 24px',
              background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
              border: '2px solid #86EFAC',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                      <CheckCircle2 size={13} />
                      <span>Project Accepted</span>
                    </span>
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                      <CheckCircle2 size={13} />
                      <span>Contract Accepted</span>
                    </span>
                    <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                      <QrCode size={13} />
                      <span>QR Generated</span>
                    </span>
                  </div>

                  <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#166534', margin: '4px 0 6px 0' }}>
                    QR Verification & Official Contract Stamp
                  </h4>

                  <div style={{ fontSize: '13px', color: '#15803D', lineHeight: 1.5, marginBottom: '14px' }}>
                    Contract ID: <strong>{projectDetails?.qr_code?.contract_id || selectedProject.contract_id || 'CON-ACCEPTED'}</strong> • QR Status: <strong style={{ color: '#16A34A' }}>ACTIVE</strong>
                    <br />
                    Citizens and government inspectors can scan this official QR code at the construction site to verify permitted project milestones, financial commitments, and blockchain transaction receipts without requiring a login.
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleDownloadContractorQr}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', borderColor: '#16A34A', color: '#166534', fontWeight: '700' }}
                    >
                      <Download size={14} />
                      <span>Download QR</span>
                    </button>

                    <a
                      href={`/verify/${projectDetails?.qr_code?.qr_id || selectedProject.qr_id || `QR-${selectedProject.contract_id}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} />
                      <span>View Verification</span>
                    </a>
                  </div>
                </div>

                {/* QR Code Visual Display Card */}
                {(projectDetails?.qr_code?.qr_image_data || selectedProject.qr_code?.qr_image_data) && (
                  <div style={{
                    background: '#FFFFFF',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1.5px solid #86EFAC',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                    textAlign: 'center'
                  }}>
                    <img
                      src={projectDetails?.qr_code?.qr_image_data || selectedProject.qr_code?.qr_image_data}
                      alt="Verified Project QR Code"
                      style={{ width: '115px', height: '115px', display: 'block', borderRadius: '4px' }}
                    />
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#166534', display: 'block', marginTop: '6px', letterSpacing: '0.04em' }}>
                      SCAN TO VERIFY
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3-PHASE SEQUENTIAL LIFECYCLE CARDS */}
          <div style={{ marginTop: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={18} color="#C2410C" />
                <span>3-Phase Sequential Milestone Execution (30% • 40% • 30%)</span>
              </h4>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                * Strict sequential unlock: Phases cannot be skipped.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {milestones.map((phase, idx) => {
                const isLocked = phase.status === 'LOCKED' || phase.phase_status === 'LOCKED';
                const isCompleted = phase.status === 'COMPLETED';
                const isRejectedProof = phase.status === 'REJECTED_NEEDS_RECTIFICATION' || phase.status === 'REJECTED';
                const isFundRejected = phase.status === 'FUND_REQUEST_REJECTED';
                const isSubmitted = phase.status === 'SUBMITTED' || phase.phase_status === 'SUBMITTED_FOR_VERIFICATION';
                const isFundRequested = phase.status === 'FUND_REQUESTED' || phase.phase_status === 'FUND_REQUESTED';
                const isFundsTransferred = phase.status === 'FUNDS_TRANSFERRED' || phase.phase_status === 'FUNDS_TRANSFERRED';
                const isApprovedForWork = phase.status === 'APPROVED_FOR_WORK' || phase.phase_status === 'EXECUTING_WORK';
                const isReadyForFund = phase.status === 'UNLOCKED' || phase.phase_status === 'READY_FOR_FUND_REQUEST' || isFundRejected;

                return (
                  <div
                    key={idx}
                    style={{
                      background: isLocked ? '#F8FAFC' : '#FFFFFF',
                      border: isCompleted
                        ? '1.5px solid var(--color-success-border)'
                        : isRejectedProof || isFundRejected
                          ? '1.5px solid var(--color-danger-border)'
                          : isFundsTransferred
                            ? '1.5px solid #86EFAC'
                            : isApprovedForWork
                              ? '1.5px solid #FED7AA'
                              : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '18px 20px',
                      boxShadow: isLocked ? 'none' : 'var(--shadow-xs)',
                      opacity: isLocked ? 0.7 : 1
                    }}
                  >
                    {/* Phase Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="badge badge-primary" style={{ fontSize: '11px', background: '#C2410C', color: '#FFF' }}>
                            {phase.percentage_share || (idx === 1 ? 40 : 30)}% Share
                          </span>
                          <h5 style={{ fontSize: '14px', fontWeight: '800', color: isLocked ? 'var(--text-muted)' : 'var(--text-main)', margin: 0 }}>
                            {phase.title}
                          </h5>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px 0', maxWidth: '650px' }}>
                          {phase.description}
                        </p>
                      </div>

                      {/* Amount & Status Badge */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-success)' }}>
                          {formatCurrency(phase.amount)}
                        </div>
                        <div style={{ marginTop: '4px' }}>
                          {isCompleted && <span className="badge badge-success">✓ COMPLETED & AUDITED</span>}
                          {isRejectedProof && <span className="badge badge-danger">⚠️ RECTIFICATION REQUIRED</span>}
                          {isFundRejected && <span className="badge badge-danger">⚠️ FUND REQUEST REJECTED</span>}
                          {isSubmitted && <span className="badge badge-info">UNDER DISTRICT VERIFICATION</span>}
                          {isFundsTransferred && <span className="badge badge-success">FUNDS RECEIVED IN BANK</span>}
                          {isApprovedForWork && <span className="badge badge-warning">EXECUTING WORK</span>}
                          {isFundRequested && <span className="badge badge-info">FUND APPROVAL PENDING</span>}
                          {isReadyForFund && <span className="badge badge-primary">⚡ UNLOCKED</span>}
                          {isLocked && <span className="badge badge-secondary">🔒 LOCKED</span>}
                        </div>
                      </div>
                    </div>

                    {/* Received Funds Banner */}
                    {isFundsTransferred && !isBankDeactivated && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px 16px',
                        background: '#F0FDF4',
                        border: '1.5px solid #86EFAC',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: '#166534' }}>
                            ✓ Allocated Funds ({formatCurrency(phase.amount)}) Received in Bank Account
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            District Authority transferred mobilization funds to your registered bank account. Click below to acknowledge and start physical work.
                          </div>
                        </div>

                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleAcknowledgeFunds(phase.milestone_index)}
                          disabled={submitting}
                        >
                          <CheckCircle2 size={13} />
                          <span>Acknowledge & Start Execution</span>
                        </button>
                      </div>
                    )}

                    {/* Rejection Remarks Alert */}
                    {isRejectedProof && phase.rejection_reason && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        color: '#B91C1C'
                      }}>
                        <strong>District Officer Inspection Feedback:</strong> {phase.rejection_reason}
                      </div>
                    )}

                    {isFundRejected && phase.fund_rejection_reason && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        color: '#B91C1C'
                      }}>
                        <strong>Fund Request Rejection Reason:</strong> {phase.fund_rejection_reason}
                      </div>
                    )}

                    {/* On-Chain Receipt if Completed */}
                    {isCompleted && phase.blockchain_tx_hash && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>On-Chain Disbursal Tx:</span>
                        <BlockchainBadge txHash={phase.blockchain_tx_hash} />
                      </div>
                    )}

                    {/* Phase Work Evidence Deliverables (Contractor -> District Verification) */}
                    {(() => {
                      const pEvidence = (projectDetails?.evidence || []).filter(
                        (e) => e.milestone_index === phase.milestone_index || e.milestoneId === phase._id || e.milestoneId === `MS-${selectedProject.project_id}-${phase.milestone_index + 1}`
                      );
                      if (pEvidence.length === 0) return null;

                      return (
                        <div style={{ marginTop: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={15} color="#0284C7" />
                              <span>Uploaded Work Evidence ({pEvidence.length})</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Deliverables for District Department Verification
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pEvidence.map((ev, evIdx) => {
                              const isImg = ev.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(ev.file_name || '');
                              const isPdfOrDoc = ev.file_type?.includes('pdf') || /\.(pdf|doc|docx)$/i.test(ev.file_name || '');
                              const token = localStorage.getItem('govtfund_token') || '';
                              const fileViewUrl = `${getApiBaseUrl()}/evidence/${ev.evidence_id || ev.evidenceId}/file?token=${token}`;
                              const fileDownloadUrl = `${fileViewUrl}&download=1`;
                              const isEvVerified = ev.status === 'VERIFIED';
                              const isEvRejected = ev.status === 'REJECTED';
                              const isEvPending = ev.status === 'SUBMITTED' || ev.status === 'DRAFT' || ev.status === 'PENDING';

                              return (
                                <div
                                  key={ev.evidence_id || evIdx}
                                  style={{
                                    background: '#FFFFFF',
                                    border: isEvVerified ? '1.5px solid #86EFAC' : isEvRejected ? '1.5px solid #FCA5A5' : '1px solid #CBD5E1',
                                    borderRadius: '6px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                                    <div>
                                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{ev.file_name || `Evidence #${evIdx + 1}`}</strong>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        Uploaded: {ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleString('en-IN') : 'Recently'}
                                      </div>
                                    </div>

                                    <div>
                                      {isEvVerified && (
                                        <span className="badge badge-success" style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontWeight: '700' }}>
                                          ✓ VERIFIED
                                        </span>
                                      )}
                                      {isEvRejected && (
                                        <span className="badge badge-danger" style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', fontWeight: '700' }}>
                                          ⚠️ REJECTED
                                        </span>
                                      )}
                                      {isEvPending && (
                                        <span className="badge badge-warning" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', fontWeight: '700' }}>
                                          ⏳ Pending Verification
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {ev.description && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      {ev.description}
                                    </div>
                                  )}

                                  {/* Inline Preview for Image; View / Download for PDFs & Docs */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    {isImg && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div
                                          style={{ width: '80px', height: '55px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #CBD5E1', cursor: 'pointer', background: '#F1F5F9' }}
                                          onClick={() => setPreviewEvidence({ ...ev, url: fileViewUrl })}
                                          title="Click to view image preview"
                                        >
                                          <img src={fileViewUrl} alt={ev.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                        </div>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '11px', padding: '3px 8px' }}
                                          onClick={() => setPreviewEvidence({ ...ev, url: fileViewUrl })}
                                        >
                                          <Eye size={12} />
                                          <span>View Image</span>
                                        </button>
                                      </div>
                                    )}

                                    {isPdfOrDoc && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <a
                                          href={fileViewUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '11px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <Eye size={12} />
                                          <span>View</span>
                                        </a>
                                        <a
                                          href={fileDownloadUrl}
                                          download={ev.file_name}
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '11px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <Download size={12} />
                                          <span>Download</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Rejection Alert Box */}
                                  {isEvRejected && (ev.rejection_reason || ev.rejectionReason) && (
                                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '8px 10px', fontSize: '12px', color: '#B91C1C', marginTop: '4px' }}>
                                      <strong>Rejection Reason:</strong> {ev.rejection_reason || ev.rejectionReason}
                                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#7F1D1D' }}>
                                        District Officer requires rectification. Click "[Upload Work Evidence]" below to upload corrected deliverables.
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Action Bar per Phase */}
                    {!isBankDeactivated && (
                      <div style={{
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {isCompleted && 'Milestone verified and completed.'}
                          {isSubmitted && 'Awaiting site verification from District Officer.'}
                          {isApprovedForWork && 'Physical work in progress. Upload Material Bills, Photos, Videos & Docs.'}
                          {isFundsTransferred && 'Allocated funds available in bank account.'}
                          {isFundRequested && 'Mobilization fund request submitted. Waiting for District Officer approval.'}
                          {isReadyForFund && 'Request phase mobilization funds from District Officer.'}
                          {isRejectedProof && 'Rectify work and resubmit proof deliverables.'}
                          {isLocked && 'Complete preceding phases to unlock this phase.'}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Request Funds */}
                          {isReadyForFund && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#C2410C', borderColor: '#C2410C' }}
                              onClick={() => handleOpenFundRequest(phase)}
                            >
                              <Coins size={13} />
                              <span>Request Phase Funds ({formatCurrency(phase.amount)})</span>
                            </button>
                          )}

                          {/* Upload Work Evidence Button */}
                          {!isLocked && !isCompleted && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: '#0284C7', color: '#0284C7', background: '#F0F9FF', display: 'flex', alignItems: 'center', gap: '5px' }}
                              onClick={() => handleOpenEvidenceModal(phase)}
                            >
                              <Camera size={13} />
                              <span>Upload Work Evidence</span>
                            </button>
                          )}

                          {/* Submit Completion Proof / Resubmit */}
                          {(isApprovedForWork || isRejectedProof) && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#0F766E', borderColor: '#0F766E' }}
                              onClick={() => handleOpenProgressUpload(phase)}
                            >
                              <Upload size={13} />
                              <span>{isRejectedProof ? 'Resubmit Rectified Proof' : 'Submit Completion Proof (Bills, Photos, Videos)'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Off-Chain Photo & File Evidence with SHA-256 */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '12px' }}>
              Uploaded Site Inspection Proofs & Cryptographic SHA-256 Digests
            </h4>
            {projectDetails?.documents?.length > 0 ? (
              projectDetails.documents.map((doc, idx) => (
                <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                No site inspection files uploaded yet for this project.
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL 1: Request Phase Funds */}
      <Modal title={`Request Funds for Phase #${activePhaseIndex + 1}`} isOpen={showFundRequestModal} onClose={() => setShowFundRequestModal(false)}>
        <form onSubmit={handleSubmitFundRequest}>
          <div className="form-group">
            <label className="form-label">Phase Target</label>
            <input
              type="text"
              className="form-control"
              value={milestones[activePhaseIndex]?.title || `Phase #${activePhaseIndex + 1}`}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label">Requested Amount (INR) — Max Limit: {formatCurrency(milestones[activePhaseIndex]?.amount || 0)}</label>
            <input
              type="number"
              className="form-control"
              max={milestones[activePhaseIndex]?.amount || 0}
              value={fundRequestAmount}
              onChange={(e) => setFundRequestAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobilization & Material Purchase Justification Notes</label>
            <textarea
              className="form-control"
              rows="3"
              value={fundRequestNotes}
              onChange={(e) => setFundRequestNotes(e.target.value)}
              required
            ></textarea>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: '11px', marginBottom: '16px' }}>
            Funds will be transferred directly by District Officer to your designated contractor bank account upon verification.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowFundRequestModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#C2410C', borderColor: '#C2410C' }}>
              <Coins size={14} />
              <span>{submitting ? 'Submitting Request...' : `Submit Phase #${activePhaseIndex + 1} Fund Request`}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Submit 4-Category Completion Proof */}
      <Modal title={`Submit Phase #${activePhaseIndex + 1} Completion Proof`} isOpen={showProgressModal} onClose={() => setShowProgressModal(false)} maxWidth="750px">
        <form onSubmit={handleUploadProgress}>

          <div style={{ background: 'rgba(15, 118, 110, 0.06)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #CCFBF1', marginBottom: '16px', fontSize: '12px', color: '#0F766E' }}>
            <strong>Flowchart Deliverables:</strong> Please provide proof across all 4 statutory categories: Material Bills, Progress Photos, Progress Videos, and Quality Test Documents.
          </div>

          {/* 1. Material Bills */}
          <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Receipt size={16} color="var(--color-primary)" />
              <span>1. Material Bills & Vouchers</span>
            </div>
            <div className="grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Upload Material Bills File (PDF/Image)</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => setMaterialBillsFile(e.target.files[0])}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Bill Items & Invoice Numbers</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Inv #8812 - 500 Bags UltraTech Cement, 10T TMT"
                  value={materialBillsNotes}
                  onChange={(e) => setMaterialBillsNotes(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Progress Photos */}
          <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={16} color="var(--color-primary)" />
              <span>2. Progress Photos (Geotagged Site Images)</span>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={(e) => setProgressPhotoFile(e.target.files[0])}
                required
              />
            </div>
          </div>

          {/* 3. Progress Videos */}
          <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Video size={16} color="var(--color-primary)" />
              <span>3. Progress Videos (Site Walkthrough / Footage)</span>
            </div>
            <div className="grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Upload Video File (MP4/WebM/AVI)</label>
                <input
                  type="file"
                  className="form-control"
                  accept="video/*"
                  onChange={(e) => setProgressVideoFile(e.target.files[0])}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Or Video Stream / Cloud Link URL</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://drive.google.com/site-video-proof"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 4. Other Documents */}
          <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileArchive size={16} color="var(--color-primary)" />
              <span>4. Other Documents (Quality Lab Reports & Engineer Certificates)</span>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <input
                type="file"
                className="form-control"
                onChange={(e) => setOtherDocFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Execution Notes & % */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Physical Execution Progress (%)</label>
              <input
                type="number"
                className="form-control"
                min="1"
                max="100"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Site Measurement Summary & Notes</label>
              <input
                type="text"
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowProgressModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#0F766E', borderColor: '#0F766E' }}>
              <Upload size={14} />
              <span>{submitting ? 'Anchoring SHA-256...' : 'Submit Phase Completion Proof'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Decline Project Assignment */}
      <Modal title={`Reject Project Assignment: ${selectedProject?.name}`} isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
        <div className="form-group">
          <label className="form-label">Reason for Declining</label>
          <textarea
            className="form-control"
            rows="3"
            placeholder="Please specify reasons (e.g. equipment constraint, geographical limitation, full capacity)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
          ></textarea>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={handleRejectProject} disabled={submitting}>
            <span>Confirm Reject Project (End)</span>
          </button>
        </div>
      </Modal>

      {/* MODAL 4: Upload Work Evidence */}
      <Modal title={`Upload Work Evidence — Phase #${evidencePhaseIndex + 1}`} isOpen={showEvidenceModal} onClose={() => setShowEvidenceModal(false)}>
        <form onSubmit={handleSubmitEvidence}>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '12px', color: '#1E40AF' }}>
            Upload site photographs, progress images, PDF completion certificates, or quality test documents for District Department verification.
          </div>

          <div className="form-group">
            <label className="form-label">Evidence Deliverable File (Images: JPG, PNG, WEBP • Docs: PDF, DOC, DOCX)</label>
            <input
              type="file"
              className="form-control"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => setEvidenceFile(e.target.files[0])}
              required
            />
            {evidenceFile && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Selected: <strong>{evidenceFile.name}</strong> ({(evidenceFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Evidence Description / Work Remarks</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="e.g. Geotagged site photograph showing foundation reinforced concrete curing..."
              value={evidenceDescription}
              onChange={(e) => setEvidenceDescription(e.target.value)}
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEvidenceModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !evidenceFile} style={{ background: '#0284C7', borderColor: '#0284C7' }}>
              <Upload size={14} />
              <span>{submitting ? 'Uploading & Anchoring...' : 'Submit Evidence'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Evidence Full Image Preview */}
      <Modal title={`Evidence Preview: ${previewEvidence?.file_name || 'Work Image'}`} isOpen={!!previewEvidence} onClose={() => setPreviewEvidence(null)} maxWidth="700px">
        {previewEvidence && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewEvidence.url}
              alt={previewEvidence.file_name}
              style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '8px', border: '1px solid #E2E8F0', objectFit: 'contain' }}
            />
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left', background: 'var(--bg-subtle)', padding: '10px', borderRadius: '6px' }}>
              <div><strong>File:</strong> {previewEvidence.file_name}</div>
              {previewEvidence.description && <div><strong>Description:</strong> {previewEvidence.description}</div>}
              {previewEvidence.sha256_hash && <div style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '4px' }}>SHA-256: {previewEvidence.sha256_hash}</div>}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default MyProjects;
