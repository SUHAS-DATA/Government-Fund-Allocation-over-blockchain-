import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FolderKanban, 
  Plus, 
  UserCheck, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileCheck,
  MapPin
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import StateDistrictSelector from '../../components/StateDistrictSelector';
import { getAllStates, getDistrictsByState, getStateForDistrict, getState } from '../../config/statesDistrictsData';

const ProjectsManagement = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialDistrict = searchParams.get('district') || user?.district_name || 'Belagavi';
  const initialDistrictState = getStateForDistrict(initialDistrict)?.code || user?.state_code || 'KA';

  const isDistrictOfficer = user?.role === 'DISTRICT';
  const assignedDistrict = user?.district_name || 'Belagavi';
  const assignedStateCode = user?.state_code || getStateForDistrict(assignedDistrict)?.code || 'KA';
  const assignedStateName = user?.state_name || getState(assignedStateCode)?.name || 'Karnataka';

  const [selectedState, setSelectedState] = useState(isDistrictOfficer ? assignedStateCode : initialDistrictState);
  const [selectedDistrict, setSelectedDistrict] = useState(isDistrictOfficer ? assignedDistrict : initialDistrict);

  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [modalMode, setModalMode] = useState(''); // 'ASSIGN', 'ESCROW', 'MILESTONES', 'DETAILS'

  // Forms
  const [createForm, setFormData] = useState({
    name: `${isDistrictOfficer ? assignedDistrict : initialDistrict} Rural Concrete Road & Drainage Network`,
    scheme_code: 'PMGSY',
    scheme_name: 'Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)',
    department: 'Road Transport & Infrastructure',
    state_code: isDistrictOfficer ? assignedStateCode : initialDistrictState,
    district_name: isDistrictOfficer ? assignedDistrict : initialDistrict,
    total_budget: 150000000, // 15 Crores
    description: `Upgrading 35 kilometers of rural agrarian roads connecting 6 habitations to national highways in ${isDistrictOfficer ? assignedDistrict : initialDistrict} district.`,
    timeline_months: 12
  });

  const [assignContractorId, setAssignContractorId] = useState('');
  
  const [milestonesForm, setMilestonesForm] = useState([
    { title: 'Phase 1: Groundwork & Drainage Culverts', amount: 50000000, description: 'Clearing terrain, base leveling, and foundation drainage culvert construction.' },
    { title: 'Phase 2: Heavy Concrete Paving & Asphalt Layer', amount: 60000000, description: 'Laying reinforced cement concrete sub-base and grade-A bitumen surfacing.' },
    { title: 'Phase 3: Final Road Signage & Public Quality Audit', amount: 40000000, description: 'Road safety markings, solar streetlights, guardrails, and final inspection.' }
  ]);

  const [releasingIndex, setReleasingIndex] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = (district = selectedDistrict) => {
    setLoading(true);
    const targetDist = isDistrictOfficer ? assignedDistrict : district;
    const query = targetDist ? `?district=${encodeURIComponent(targetDist)}` : '';
    API.get(`/district/projects${query}`).then((res) => {
      if (res.success) {
        setProjects(res.projects || []);
      }
    }).finally(() => setLoading(false));

    API.get('/district/contractors').then((res) => {
      if (res.success && res.contractors) {
        const approved = res.contractors.filter((c) => c.kyc_status === 'APPROVED');
        const listToUse = approved.length > 0 ? approved : res.contractors;
        setContractors(listToUse);
        if (listToUse.length > 0) {
          setAssignContractorId(listToUse[0].user_id || listToUse[0]._id);
        }
      }
    });

    API.get('/admin/schemes').then((res) => {
      if (res.success) setSchemes(res.schemes || []);
    });
  };

  useEffect(() => {
    loadData(selectedDistrict);
    setFormData((prev) => ({ ...prev, district_name: selectedDistrict }));
  }, [selectedDistrict]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/district/projects', createForm);
      if (res.success) {
        setShowCreateModal(false);
        setActionSuccess(`Project '${createForm.name}' created successfully!`);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Error creating project');
    }
  };

  const handleAssignContractor = async () => {
    if (!selectedProject || !assignContractorId) return;
    try {
      const res = await API.post(`/district/projects/${selectedProject.project_id}/assign-contractor`, {
        contractor_id: assignContractorId
      });
      if (res.success) {
        setActionSuccess(res.message);
        setModalMode('');
        loadData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCreateEscrow = async () => {
    if (!selectedProject) return;
    try {
      const res = await API.post(`/district/projects/${selectedProject.project_id}/create-escrow`);
      if (res.success) {
        setActionSuccess(`Smart contract escrow created on Ethereum: ${res.blockchain?.tx_hash}`);
        setModalMode('');
        loadData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSaveMilestones = async () => {
    if (!selectedProject) return;
    try {
      const res = await API.post(`/district/projects/${selectedProject.project_id}/milestones`, {
        milestones: milestonesForm
      });
      if (res.success) {
        setActionSuccess(res.message);
        setModalMode('');
        loadData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleApproveAndReleaseMilestone = async (projectId, milestoneIndex) => {
    setReleasingIndex(milestoneIndex);
    try {
      const res = await API.post(`/district/projects/${projectId}/milestones/${milestoneIndex}/approve-release`);
      if (res.success) {
        setActionSuccess(`Milestone released via smart contract! Tx: ${res.blockchain?.tx_hash}`);
        const refreshed = await API.get(`/district/projects/${projectId}`);
        setSelectedProject(refreshed.project);
        loadData();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setReleasingIndex(null);
    }
  };

  const openProjectDetails = async (p) => {
    const res = await API.get(`/district/projects/${p.project_id}`);
    if (res.success) {
      setSelectedProject(res.project);
      setModalMode('DETAILS');
    }
  };

  const columns = [
    {
      header: 'Project ID',
      accessor: 'project_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.project_id}</strong>
    },
    { header: 'Project Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    { header: 'Scheme', accessor: 'scheme_name' },
    {
      header: 'Total Budget',
      accessor: 'total_budget',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.total_budget)}</span>
    },
    {
      header: 'Assigned Contractor',
      accessor: 'contractor_name',
      render: (r) => r.contractor_name || <span style={{ color: 'var(--color-warning)', fontSize: '11px' }}>Unassigned</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span className={`badge ${r.is_frozen ? 'badge-danger' : r.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
          {r.is_frozen ? 'FROZEN' : r.status}
        </span>
      )
    },
    {
      header: 'Workflow Actions',
      accessor: 'action',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {!r.contractor_name && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSelectedProject(r);
                if (contractors.length > 0) {
                  setAssignContractorId(contractors[0].user_id || contractors[0]._id);
                }
                setModalMode('ASSIGN');
              }}
            >
              <UserCheck size={12} />
              <span>Assign</span>
            </button>
          )}

          {r.contractor_name && !r.escrow_onchain && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => { setSelectedProject(r); setModalMode('ESCROW'); }}
            >
              <Lock size={12} />
              <span>Escrow</span>
            </button>
          )}

          {r.escrow_onchain && r.milestones_count === 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSelectedProject(r); setModalMode('MILESTONES'); }}
            >
              <Clock size={12} />
              <span>Milestones</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={() => openProjectDetails(r)}
          >
            <span>Manage</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 className="page-title">
            <FolderKanban size={24} color="var(--color-primary)" />
            <span>District Projects & Smart Contract Escrow ({isDistrictOfficer ? assignedDistrict : selectedDistrict})</span>
          </h1>
          <p className="page-subtitle">
            Create infrastructure projects, assign KYC-approved contractors, configure smart contract escrows, and disburse verified milestones.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isDistrictOfficer ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(124, 58, 237, 0.08)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid #DDD6FE',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <MapPin size={16} color="#7C3AED" />
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#7C3AED' }}>
                  Assigned District Jurisdiction
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                  {assignedDistrict} ({assignedStateName})
                </div>
              </div>
              <span className="badge badge-success" style={{ fontSize: '10px', marginLeft: '6px' }}>
                🔒 Authorized
              </span>
            </div>
          ) : (
            /* Super Admin Switcher */
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#FFFFFF',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>STATE:</span>
              <select
                className="form-control form-select"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
                value={selectedState}
                onChange={(e) => {
                  const newSt = e.target.value;
                  setSelectedState(newSt);
                  const dists = getDistrictsByState(newSt);
                  if (dists.length > 0) {
                    setSelectedDistrict(dists[0].name);
                  }
                }}
              >
                {getAllStates().map((s) => (
                  <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>

              <span style={{ color: 'var(--border-color)' }}>|</span>

              <MapPin size={14} color="var(--color-primary)" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>DISTRICT:</span>
              <select
                className="form-control form-select"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {getDistrictsByState(selectedState).map((d, idx) => (
                  <option key={`${d.name}-${idx}`} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            <span>Create Project in {isDistrictOfficer ? assignedDistrict : selectedDistrict}</span>
          </button>
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
        <DataTable columns={columns} data={projects} searchKey="name" searchPlaceholder="Search projects by name or ID..." />
      </div>

      {/* 1. Modal: Create Project */}
      <Modal title={`Create Project in ${isDistrictOfficer ? assignedDistrict : selectedDistrict}`} isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <form onSubmit={handleCreateProject}>
          <div className="form-group">
            <label className="form-label">Project Title</label>
            <input
              type="text"
              className="form-control"
              value={createForm.name}
              onChange={(e) => setFormData({ ...createForm, name: e.target.value })}
              required
            />
          </div>

          {isDistrictOfficer ? (
            <div style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(124, 58, 237, 0.06)',
              border: '1px solid #DDD6FE',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#7C3AED', marginBottom: '2px' }}>
                Jurisdiction Authority (Locked to Assigned District)
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                {assignedDistrict} District, {assignedStateName} ({assignedStateCode})
              </div>
            </div>
          ) : (
            <StateDistrictSelector
              selectedState={createForm.state_code || selectedState}
              selectedDistrict={createForm.district_name || selectedDistrict}
              onStateChange={(st) => {
                const dists = getDistrictsByState(st);
                setFormData((prev) => ({
                  ...prev,
                  state_code: st,
                  district_name: dists.length > 0 ? dists[0].name : ''
                }));
              }}
              onDistrictChange={(dist) => {
                setFormData((prev) => ({ ...prev, district_name: dist }));
              }}
              stateLabel="State Jurisdiction"
              districtLabel="District Jurisdiction"
              stateRequired={true}
              districtRequired={true}
            />
          )}

          <div className="form-group">
            <label className="form-label">Government Scheme</label>
            <select
              className="form-control form-select"
              value={createForm.scheme_name}
              onChange={(e) => setFormData({ ...createForm, scheme_name: e.target.value })}
            >
              {schemes.map((s) => (
                <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Total Budget (INR)</label>
              <input
                type="number"
                className="form-control"
                value={createForm.total_budget}
                onChange={(e) => setFormData({ ...createForm, total_budget: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timeline (Months)</label>
              <input
                type="number"
                className="form-control"
                value={createForm.timeline_months}
                onChange={(e) => setFormData({ ...createForm, timeline_months: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project Scope & Description</label>
            <textarea
              className="form-control"
              rows="3"
              value={createForm.description}
              onChange={(e) => setFormData({ ...createForm, description: e.target.value })}
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Project</button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Assign Contractor */}
      <Modal title={`Assign Approved Contractor to ${selectedProject?.project_id}`} isOpen={modalMode === 'ASSIGN' && !!selectedProject} onClose={() => setModalMode('')}>
        <div className="form-group">
          <label className="form-label">Select KYC-Approved Contractor</label>
          <select
            className="form-control form-select"
            value={assignContractorId}
            onChange={(e) => setAssignContractorId(e.target.value)}
          >
            {contractors.length === 0 ? (
              <option value="">No registered contractors found</option>
            ) : (
              contractors.map((c) => {
                const cId = c.user_id || c._id;
                return (
                  <option key={cId} value={cId}>
                    {c.company_name || c.name || 'Contractor'} (GST: {c.gst_number || '29AABCU9603R1ZM'}) — {c.kyc_status === 'APPROVED' ? 'Verified PWD' : 'Under Review'}
                  </option>
                );
              })
            )}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setModalMode('')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssignContractor}>Confirm Assignment</button>
        </div>
      </Modal>

      {/* 3. Modal: Deploy Escrow */}
      <Modal title="Deploy Smart Contract Escrow on Ethereum" isOpen={modalMode === 'ESCROW' && !!selectedProject} onClose={() => setModalMode('')}>
        <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '18px', fontSize: '13px' }}>
          <div>Project: <strong>{selectedProject?.name}</strong></div>
          <div>Contractor: <strong style={{ color: 'var(--color-primary)' }}>{selectedProject?.contractor_name}</strong></div>
          <div>Total Budget Ceiling: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedProject?.total_budget)}</strong></div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Deploying the smart contract escrow locks the project budget ceiling and establishes cryptographic milestone disbursals on-chain.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setModalMode('')}>Cancel</button>
          <button className="btn btn-success" onClick={handleCreateEscrow}>
            <Lock size={15} />
            <span>Execute On-Chain Escrow</span>
          </button>
        </div>
      </Modal>

      {/* 4. Modal: Set Milestones */}
      <Modal title={`Define Milestones for ${selectedProject?.name}`} isOpen={modalMode === 'MILESTONES' && !!selectedProject} onClose={() => setModalMode('')} maxWidth="750px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {milestonesForm.map((m, idx) => (
            <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div className="grid-2" style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Milestone Title"
                  value={m.title}
                  onChange={(e) => {
                    const copy = [...milestonesForm];
                    copy[idx].title = e.target.value;
                    setMilestonesForm(copy);
                  }}
                />
                <input
                  type="number"
                  className="form-control"
                  placeholder="Amount (INR)"
                  value={m.amount}
                  onChange={(e) => {
                    const copy = [...milestonesForm];
                    copy[idx].amount = Number(e.target.value);
                    setMilestonesForm(copy);
                  }}
                />
              </div>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Milestone Deliverables & Criteria"
                value={m.description}
                onChange={(e) => {
                  const copy = [...milestonesForm];
                  copy[idx].description = e.target.value;
                  setMilestonesForm(copy);
                }}
              ></textarea>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>
            Total: <span style={{ color: 'var(--color-success)' }}>{formatCurrency(milestonesForm.reduce((a, b) => a + Number(b.amount || 0), 0))}</span> / {formatCurrency(selectedProject?.total_budget)}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setModalMode('')}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveMilestones}>Anchor Milestones</button>
          </div>
        </div>
      </Modal>

      {/* 5. Modal: Manage Project Details & Release */}
      {modalMode === 'DETAILS' && selectedProject && (
        <ProjectManageModal
          project={selectedProject}
          onClose={() => setModalMode('')}
          onRelease={handleApproveAndReleaseMilestone}
          releasingIndex={releasingIndex}
        />
      )}
    </div>
  );
};

const ProjectManageModal = ({ project, onClose, onRelease, releasingIndex }) => {
  const [details, setDetails] = useState(null);
  const [rejectModalPhase, setRejectModalPhase] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDetails = () => {
    API.get(`/district/projects/${project.project_id}`).then((res) => {
      if (res.success) setDetails(res);
    });
  };

  useEffect(() => {
    loadDetails();
  }, [project.project_id]);

  const handleApproveFunds = async (milestoneIndex) => {
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${milestoneIndex}/approve-funds`);
      if (res.success) {
        setActionMsg(`Funds approved for Phase #${milestoneIndex + 1}! Contractor authorized to execute.`);
        loadDetails();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectMilestone = async () => {
    if (rejectModalPhase === null) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${rejectModalPhase}/verify`, {
        action: 'REJECT',
        remarks: rejectionReason || 'Site inspection failed specifications. Rectification required.'
      });
      if (res.success) {
        setActionMsg(`Phase #${rejectModalPhase + 1} rejected. Rejection reason recorded.`);
        setRejectModalPhase(null);
        setRejectionReason('');
        loadDetails();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const milestones = details?.milestones || [];
  const docs = details?.documents || [];

  return (
    <Modal title={project.name} isOpen={true} onClose={onClose} maxWidth="850px">
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        ID: <span style={{ fontFamily: 'monospace' }}>{project.project_id}</span> | Escrow Total: {formatCurrency(project.total_budget)} | Contractor: <strong>{project.contractor_name || 'Assigned'}</strong>
      </div>

      {actionMsg && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          color: 'var(--color-success)',
          marginBottom: '16px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {actionMsg}
        </div>
      )}

      {/* 3 Standardized Phases / Milestones Approval & Escrow Release */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '12px' }}>
          3-Phase Sequential Milestone Progression & Escrow Releases
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {milestones.length > 0 ? (
            milestones.map((m, idx) => {
              const isCompleted = m.status === 'COMPLETED' || m.status === 'RELEASED';
              const isSubmitted = m.status === 'SUBMITTED' || m.phase_status === 'SUBMITTED_FOR_VERIFICATION';
              const isFundRequested = m.status === 'FUND_REQUESTED' || m.phase_status === 'FUND_REQUESTED';
              const isApprovedForWork = m.status === 'APPROVED_FOR_WORK' || m.phase_status === 'APPROVED_FOR_WORK';
              const isRejected = m.status === 'REJECTED' || m.phase_status === 'REJECTED';
              const isLocked = m.status === 'LOCKED' || m.phase_status === 'LOCKED';

              return (
                <div key={idx} style={{
                  background: isLocked ? '#F8FAFC' : 'var(--bg-subtle)',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: isCompleted ? '1.5px solid var(--color-success-border)' : isRejected ? '1.5px solid var(--color-danger-border)' : '1px solid var(--border-color)',
                  opacity: isLocked ? 0.65 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                      Phase #{idx + 1}: {m.title}
                    </div>
                    <span className={`badge ${
                      isCompleted ? 'badge-success' :
                      isRejected ? 'badge-danger' :
                      isSubmitted ? 'badge-info' :
                      isApprovedForWork ? 'badge-warning' :
                      isFundRequested ? 'badge-primary' : 'badge-secondary'
                    }`}>
                      {isCompleted ? 'COMPLETED & RELEASED' :
                       isRejected ? 'REJECTED (PENDING RESUBMISSION)' :
                       isSubmitted ? 'SUBMITTED FOR VERIFICATION' :
                       isApprovedForWork ? 'WORK IN PROGRESS' :
                       isFundRequested ? 'FUND REQUEST PENDING' : m.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {m.description}
                  </div>

                  {/* Contractor Submission Details */}
                  {m.progress_notes && (
                    <div style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '11px', marginBottom: '8px' }}>
                      <strong>Contractor Progress Notes:</strong> {m.progress_notes}
                      {m.proof_document_hash && (
                        <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>
                          Proof SHA-256: <code style={{ color: 'var(--color-primary)' }}>{m.proof_document_hash}</code>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection Alert */}
                  {isRejected && m.rejection_reason && (
                    <div style={{ background: 'var(--color-danger-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', fontSize: '11px', marginBottom: '8px' }}>
                      <strong>Rejection Reason:</strong> {m.rejection_reason}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '13px' }}>{formatCurrency(m.amount)}</div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Step 1: Fund Approval */}
                      {isFundRequested && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApproveFunds(m.milestone_index)}
                          disabled={submitting}
                        >
                          <Coins size={12} />
                          <span>Approve Phase Funds</span>
                        </button>
                      )}

                      {/* Step 4: Milestone Verification (Approve / Reject) */}
                      {isSubmitted && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => onRelease(project.project_id, m.milestone_index)}
                            disabled={releasingIndex === m.milestone_index || submitting}
                          >
                            <ShieldCheck size={13} />
                            <span>{releasingIndex === m.milestone_index ? 'Releasing on Blockchain...' : '✓ Approve & Release Payment'}</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}
                            onClick={() => { setRejectModalPhase(m.milestone_index); setRejectionReason(''); }}
                            disabled={submitting}
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>Released on-chain</span>
                          {m.blockchain_tx_hash && <BlockchainBadge txHash={m.blockchain_tx_hash} />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              No milestones configured for this project.
            </div>
          )}
        </div>
      </div>

      {/* Off-Chain Documents Hashing */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '12px' }}>
          Off-Chain Project Files & Cryptographic Proofs
        </h4>
        {docs.length > 0 ? (
          docs.map((doc, idx) => (
            <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            No documents uploaded yet.
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectModalPhase !== null && (
        <Modal title={`Reject Phase #${rejectModalPhase + 1} Deliverables`} isOpen={true} onClose={() => setRejectModalPhase(null)}>
          <div className="form-group">
            <label className="form-label">Inspection & Rejection Remarks (Required)</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="State reason for rejection (e.g. concrete cube test strength insufficient, asphalt thickness deficient, photographic proof blurry)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-secondary" onClick={() => setRejectModalPhase(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleRejectMilestone} disabled={submitting}>
              <span>Confirm Rejection & Notify Contractor</span>
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default ProjectsManagement;
