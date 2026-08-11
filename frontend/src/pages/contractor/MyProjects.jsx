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
  RotateCcw
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const MyProjects = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals & Action States
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showFundRequestModal, setShowFundRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [fundRequestAmount, setFundRequestAmount] = useState(0);
  const [fundRequestNotes, setFundRequestNotes] = useState('');
  
  const [percentage, setPercentage] = useState(100);
  const [notes, setNotes] = useState('Groundwork, terrain leveling, and structural concrete culverts completed as per PWD specifications.');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadProjects = () => {
    setLoading(true);
    API.get('/contractor/projects')
      .then((res) => {
        if (res.success) {
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
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

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

  // --- 1. Accept Project Assignment (Generates 3 Phases: 30%, 40%, 30%) ---
  const handleAcceptProject = async (projectId) => {
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await API.post(`/contractor/projects/${projectId}/accept`);
      if (res.success) {
        setActionSuccess(`Project ${projectId} accepted! Automatically divided into 3 standardized phases (30%, 40%, 30%). Phase 1 is now ready for fund request.`);
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

  // --- 2. Reject Project Assignment ---
  const handleRejectProject = async () => {
    if (!selectedProject) return;
    setSubmitting(true);
    setActionError('');
    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/reject`, {
        rejection_reason: rejectReason || 'Contractor at maximum capacity.'
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

  // --- 3. Request Phase Funds from District Officer ---
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

  // --- 4. Upload Milestone Progress & Evidence (Photos, Docs, SHA-256) ---
  const handleOpenProgressUpload = (phase) => {
    setActivePhaseIndex(phase.milestone_index);
    setPercentage(100);
    setNotes(phase.rejection_reason ? `Resubmission with rectified work for Phase #${phase.milestone_index + 1}: All site items inspected.` : `Phase #${phase.milestone_index + 1} execution complete according to DPR specifications.`);
    setSelectedPhoto(null);
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
    if (selectedPhoto) {
      data.append('file', selectedPhoto);
    }

    try {
      const res = await API.post(`/contractor/projects/${selectedProject.project_id}/phases/${activePhaseIndex}/submit-milestone`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setActionSuccess(`Phase #${activePhaseIndex + 1} completion evidence uploaded! Cryptographic SHA-256 digest anchored on blockchain. Submitted for District Officer verification.`);
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
      header: 'Assignment Status',
      accessor: 'status',
      render: (r) => {
        if (r.status === 'ASSIGNED' || r.status === 'PENDING_ACCEPTANCE') {
          return <span className="badge badge-warning">NEW ASSIGNMENT</span>;
        }
        if (r.status === 'REJECTED_BY_CONTRACTOR') {
          return <span className="badge badge-danger">DECLINED</span>;
        }
        if (r.status === 'COMPLETED') {
          return <span className="badge badge-success">COMPLETED</span>;
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
              <span>{needsAccept ? 'View Details' : 'Manage 3 Phases'}</span>
            </button>
          </div>
        );
      }
    }
  ];

  const milestones = projectDetails?.milestones || selectedProject?.phases || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FolderKanban size={24} color="#C2410C" />
            <span>Assigned Projects & Phase Lifecycle Management</span>
          </h1>
          <p className="page-subtitle">
            Accept project assignments, execute standardized 3-phase progression (30%, 40%, 30%), request mobilization funds, and upload SHA-256 verified milestone proofs.
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

      {/* Selected Project 3-Phase Lifecycle Container */}
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
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contract Budget Ceiling:</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-success)' }}>
                {formatCurrency(selectedProject.total_budget)}
              </div>
            </div>
          </div>

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
                  ⚡ New Infrastructure Contract Assignment Received
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Accepting will automatically configure the project into 3 standardized execution phases (30%, 40%, 30%).
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-success"
                  onClick={() => handleAcceptProject(selectedProject.project_id)}
                  disabled={submitting}
                >
                  <CheckCircle2 size={15} />
                  <span>{submitting ? 'Configuring Phases...' : 'Accept Assignment'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowRejectModal(true)}
                  disabled={submitting}
                >
                  <XCircle size={15} />
                  <span>Decline</span>
                </button>
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
              {milestones.length > 0 ? (
                milestones.map((phase, idx) => {
                  const isLocked = phase.status === 'LOCKED' || phase.phase_status === 'LOCKED';
                  const isCompleted = phase.status === 'COMPLETED' || phase.status === 'RELEASED';
                  const isRejected = phase.status === 'REJECTED' || phase.phase_status === 'REJECTED';
                  const isSubmitted = phase.status === 'SUBMITTED' || phase.phase_status === 'SUBMITTED_FOR_VERIFICATION';
                  const isFundRequested = phase.status === 'FUND_REQUESTED' || phase.phase_status === 'FUND_REQUESTED';
                  const isApprovedForWork = phase.status === 'APPROVED_FOR_WORK' || phase.phase_status === 'APPROVED_FOR_WORK';
                  const isReadyForFund = phase.status === 'UNLOCKED' || phase.phase_status === 'READY_FOR_FUND_REQUEST';

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isLocked ? '#F8FAFC' : '#FFFFFF',
                        border: isCompleted 
                          ? '1.5px solid var(--color-success-border)' 
                          : isRejected 
                          ? '1.5px solid var(--color-danger-border)' 
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
                            {isCompleted && <span className="badge badge-success">✓ COMPLETED & DISBURSED</span>}
                            {isRejected && <span className="badge badge-danger">⚠️ REJECTED BY DISTRICT</span>}
                            {isSubmitted && <span className="badge badge-info">🔍 UNDER DISTRICT REVIEW</span>}
                            {isApprovedForWork && <span className="badge badge-warning">🔨 WORK IN PROGRESS</span>}
                            {isFundRequested && <span className="badge badge-info">⏳ FUND APPROVAL PENDING</span>}
                            {isReadyForFund && <span className="badge badge-primary">⚡ UNLOCKED</span>}
                            {isLocked && <span className="badge badge-secondary">🔒 LOCKED</span>}
                          </div>
                        </div>
                      </div>

                      {/* Rejection Reason Alert if Rejected */}
                      {isRejected && phase.rejection_reason && (
                        <div style={{
                          marginTop: '12px',
                          padding: '10px 14px',
                          background: 'var(--color-danger-bg)',
                          border: '1px solid var(--color-danger-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          color: 'var(--color-danger)'
                        }}>
                          <strong>District Officer Rejection Reason:</strong> {phase.rejection_reason}
                        </div>
                      )}

                      {/* On-Chain Receipt if Completed */}
                      {isCompleted && phase.blockchain_tx_hash && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>On-Chain Disbursal Tx:</span>
                          <BlockchainBadge txHash={phase.blockchain_tx_hash} />
                        </div>
                      )}

                      {/* Action Bar per Phase */}
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
                          {isCompleted && 'Milestone approved and 100% escrow disbursed.'}
                          {isSubmitted && 'Awaiting site verification & on-chain approval from District Officer.'}
                          {isApprovedForWork && 'Funds approved. Proceed with construction and upload completion photos.'}
                          {isFundRequested && 'Mobilization request submitted. Waiting for District Officer sign-off.'}
                          {isReadyForFund && 'Step 1: Request phase mobilization funds from District Authority.'}
                          {isRejected && 'Step 3: Upload revised photos and resubmit milestone deliverables.'}
                          {isLocked && 'Complete preceding phases to unlock this phase.'}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* Step 1: Request Funds */}
                          {isReadyForFund && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#C2410C', borderColor: '#C2410C' }}
                              onClick={() => handleOpenFundRequest(phase)}
                            >
                              <Coins size={13} />
                              <span>1. Request Phase Funds ({formatCurrency(phase.amount)})</span>
                            </button>
                          )}

                          {/* Step 3: Upload Milestone / Resubmit */}
                          {(isApprovedForWork || isRejected) && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#0F766E', borderColor: '#0F766E' }}
                              onClick={() => handleOpenProgressUpload(phase)}
                            >
                              <Upload size={13} />
                              <span>{isRejected ? 'Resubmit Milestone Evidence' : '3. Upload Milestone Evidence & Photos'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: 'rgba(194, 65, 12, 0.04)',
                  border: '2px dashed #FED7AA',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#C2410C', marginBottom: '6px' }}>
                    ⚡ Project Assignment Awaiting 3-Phase Initialization
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 18px auto', lineHeight: 1.5 }}>
                    Click below to accept this project assignment and automatically generate the standardized 3-phase execution lifecycle (Phase 1: 30%, Phase 2: 40%, Phase 3: 30%).
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-success"
                      style={{ padding: '10px 22px', fontSize: '13px', fontWeight: '700' }}
                      onClick={() => handleAcceptProject(selectedProject.project_id)}
                      disabled={submitting}
                    >
                      <CheckCircle2 size={16} />
                      <span>{submitting ? 'Initializing 3 Phases...' : 'Accept Assignment & Initialize 3 Phases (30%, 40%, 30%)'}</span>
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowRejectModal(true)}
                      disabled={submitting}
                    >
                      <XCircle size={15} />
                      <span>Decline Assignment</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Off-Chain Photo Evidence with SHA-256 */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '12px' }}>
              Uploaded Site Inspection Proofs & Cryptographic Digests
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
            <label className="form-label">Requested Amount (INR) — Max: {formatCurrency(milestones[activePhaseIndex]?.amount || 0)}</label>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowFundRequestModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#C2410C', borderColor: '#C2410C' }}>
              <Coins size={14} />
              <span>{submitting ? 'Submitting Request...' : 'Submit Phase Fund Request'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Upload Milestone Completion Proof */}
      <Modal title={`Upload Completion Proof: Phase #${activePhaseIndex + 1}`} isOpen={showProgressModal} onClose={() => setShowProgressModal(false)}>
        <form onSubmit={handleUploadProgress}>
          <div className="form-group">
            <label className="form-label">Milestone Phase</label>
            <input
              type="text"
              className="form-control"
              value={milestones[activePhaseIndex]?.title || `Phase #${activePhaseIndex + 1}`}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label">Execution Progress (%)</label>
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
            <label className="form-label">Upload Site Inspection Photo / Testing Certificate (JPEG/PNG/PDF)</label>
            <input
              type="file"
              className="form-control"
              onChange={(e) => setSelectedPhoto(e.target.files[0])}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quality Deliverables & Measurement Notes</label>
            <textarea
              className="form-control"
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowProgressModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#0F766E', borderColor: '#0F766E' }}>
              <Upload size={14} />
              <span>{submitting ? 'Anchoring SHA-256...' : 'Upload & Submit for Verification'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Decline Project Assignment */}
      <Modal title={`Decline Project Assignment: ${selectedProject?.name}`} isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}>
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
            <span>Confirm Decline</span>
          </button>
        </div>
      </Modal>

    </div>
  );
};

export default MyProjects;
