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
  MapPin,
  Coins,
  CreditCard,
  AlertCircle,
  XCircle,
  Eye,
  FileText,
  Camera,
  Video,
  FileArchive,
  PowerOff,
  Ban,
  QrCode,
  Download,
  ExternalLink
} from 'lucide-react';
import API, { getApiBaseUrl } from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FundAmountInput from '../../components/FundAmountInput';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../context/RealtimeContext';
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
  const [schemeBalances, setSchemeBalances] = useState([]);
  const [districtFundSummary, setDistrictFundSummary] = useState({ total_received: 0, total_committed: 0, total_available: 0 });
  const [submittingProject, setSubmittingProject] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [modalMode, setModalMode] = useState(''); // 'ASSIGN', 'DETAILS'
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalData, setQrModalData] = useState(null);

  const handleOpenQrModal = (proj) => {
    setQrModalData(proj);
    setShowQrModal(true);
  };

  // Forms
  const [createForm, setFormData] = useState({
    name: '',
    scheme_code: '',
    scheme_name: '',
    department: '',
    state_code: isDistrictOfficer ? assignedStateCode : initialDistrictState,
    district_name: isDistrictOfficer ? assignedDistrict : initialDistrict,
    total_budget: 0,
    description: '',
    timeline_months: 12
  });

  const [assignContractorId, setAssignContractorId] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const normalizeScheme = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const loadData = (district = selectedDistrict, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const targetDist = isDistrictOfficer ? assignedDistrict : district;
    const query = targetDist ? `?district=${encodeURIComponent(targetDist)}` : '';

    API.get(`/district/projects${query}`).then((res) => {
      if (res.success) {
        setProjects(res.projects || []);
        if (res.scheme_balances) {
          setSchemeBalances(res.scheme_balances);
        }
        if (res.summary) {
          setDistrictFundSummary(res.summary);
        }
      }
    }).finally(() => {
      if (showSpinner) setLoading(false);
    });

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
      if (res.success && res.schemes) {
        setSchemes(res.schemes);
      }
    }).catch(() => {
      API.get('/district/schemes').then((res) => {
        if (res.success && res.schemes) setSchemes(res.schemes);
      });
    });
  };

  useEffect(() => {
    loadData(selectedDistrict, true);
    setFormData((prev) => ({ ...prev, district_name: selectedDistrict }));
  }, [selectedDistrict]);

  useRealtimeSync(() => {
    loadData(selectedDistrict, false);
  }, { interval: 6000 });

  // Merge schemeBalances and all known schemes so every scheme can be selected
  const displaySchemes = React.useMemo(() => {
    const list = [...schemeBalances];
    schemes.forEach(sc => {
      if (!list.some(sb => normalizeScheme(sb.scheme_name) === normalizeScheme(sc.name))) {
        list.push({
          scheme_name: sc.name,
          scheme_code: sc.code,
          department: sc.department,
          total_received: 0,
          committed_budget: 0,
          available_balance: 0
        });
      }
    });
    // Sort so schemes that have allocated funds appear at the top
    return list.sort((a, b) => (b.available_balance || 0) - (a.available_balance || 0));
  }, [schemeBalances, schemes]);

  // Current scheme info for active form
  const currentSchemeData = React.useMemo(() => {
    return schemeBalances.find(
      sb => normalizeScheme(sb.scheme_name) === normalizeScheme(createForm.scheme_name)
    ) || {
      scheme_name: createForm.scheme_name,
      total_received: 0,
      committed_budget: 0,
      available_balance: 0
    };
  }, [schemeBalances, createForm.scheme_name]);

  // Open modal with smart pre-selection
  const openCreateModal = () => {
    const targetDist = isDistrictOfficer ? assignedDistrict : selectedDistrict;
    const targetState = isDistrictOfficer ? assignedStateCode : selectedState;

    // Find scheme with available balance first, or default to first display scheme
    const topScheme = displaySchemes.find(sb => sb.available_balance > 0) || displaySchemes[0] || {
      scheme_name: 'Education Upto 12 Grade',
      scheme_code: 'MOE',
      department: 'School Education & Literacy',
      available_balance: 0
    };

    const sName = topScheme.scheme_name;
    const sCode = topScheme.scheme_code || 'SCHEME';
    const sDept = topScheme.department || 'Public Infrastructure';
    const avail = topScheme.available_balance || 0;
    const defaultBudget = avail > 0 ? Math.min(10000000, avail) : 0;

    setFormData({
      name: `${targetDist} ${sCode} Infrastructure Initiative`,
      scheme_code: sCode,
      scheme_name: sName,
      department: sDept,
      state_code: targetState,
      district_name: targetDist,
      total_budget: defaultBudget,
      description: `Public works and community development implementation under ${sName} in ${targetDist} district.`,
      timeline_months: 12
    });
    setShowCreateModal(true);
  };

  // Create Project under Scheme with strict balance validation
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (currentSchemeData.available_balance <= 0) {
      alert(`Cannot create project: No funds available for scheme '${createForm.scheme_name}' in ${isDistrictOfficer ? assignedDistrict : selectedDistrict}. Please request State Treasury allocation first.`);
      return;
    }
    if (createForm.total_budget > currentSchemeData.available_balance) {
      alert(`Project budget of ${formatCurrency(createForm.total_budget)} exceeds available district fund ceiling of ${formatCurrency(currentSchemeData.available_balance)} for '${createForm.scheme_name}'.`);
      return;
    }
    setSubmittingProject(true);
    try {
      const res = await API.post('/district/projects', createForm);
      if (res.success) {
        setShowCreateModal(false);
        setActionSuccess(`Project '${createForm.name}' created successfully under scheme ${createForm.scheme_name}!`);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Error creating project');
    } finally {
      setSubmittingProject(false);
    }
  };

  // Assign Contractor
  const handleAssignContractor = async () => {
    if (!selectedProject || !assignContractorId) return;
    try {
      const res = await API.post(`/district/projects/${selectedProject.project_id}/assign-contractor`, {
        contractor_id: assignContractorId
      });
      if (res.success) {
        setActionSuccess(res.message + " (Notification Sent to Contractor)");
        setModalMode('');
        loadData();
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const openProjectDetails = async (p) => {
    const res = await API.get(`/district/projects/${p.project_id}`);
    if (res.success) {
      setSelectedProject({
        ...res.project,
        qr_code: res.qr_code || res.project?.qr_code
      });
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
    { header: 'Government Scheme', accessor: 'scheme_name' },
    {
      header: 'Total Budget',
      accessor: 'total_budget',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.total_budget)}</span>
    },
    {
      header: 'Assigned Contractor',
      accessor: 'contractor_name',
      render: (r) => r.contractor_name ? (
        <div>
          <div style={{ fontWeight: '600' }}>{r.contractor_name}</div>
          {r.bank_account_status === 'DEACTIVATED' ? (
            <span className="badge badge-danger" style={{ fontSize: '10px' }}>Bank A/C Deactivated</span>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bank A/C Active</span>
          )}
        </div>
      ) : (
        <span style={{ color: 'var(--color-warning)', fontSize: '11px', fontWeight: '700' }}>Pending Assignment</span>
      )
    },
    {
      header: 'Contract & QR',
      accessor: 'contract_status',
      render: (r) => {
        const isAccepted = r.contract_status === 'ACCEPTED' || r.assignment_status === 'ACCEPTED' || r.status === 'IN_PROGRESS' || r.status === 'COMPLETED' || r.qr_id || r.qr_code;
        if (isAccepted) {
          return (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                {r.contract_id || (r.qr_code?.contract_id) || 'CON-ACCEPTED'}
              </div>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', marginTop: '2px' }}>
                <CheckCircle2 size={10} />
                <span>ACCEPTED</span>
              </span>
            </div>
          );
        }
        if (r.contractor_name) {
          return (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.contract_id || 'CON-PENDING'}</div>
              <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '2px' }}>PENDING ACCEPT</span>
            </div>
          );
        }
        return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unassigned</span>;
      }
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
        if (r.status === 'REJECTED_BY_CONTRACTOR' || r.status === 'PROJECT_REJECTED') {
          return <span className="badge badge-danger">DECLINED</span>;
        }
        if (r.status === 'ASSIGNED') {
          return <span className="badge badge-warning">ASSIGNED</span>;
        }
        return (
          <span className={`badge ${r.is_frozen ? 'badge-danger' : r.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>
            {r.is_frozen ? 'FROZEN' : r.status}
          </span>
        );
      }
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
              <span>Assign Contractor</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={() => openProjectDetails(r)}
          >
            <Eye size={12} />
            <span>Manage Lifecycle</span>
          </button>

          {(r.contract_status === 'ACCEPTED' || r.assignment_status === 'ACCEPTED' || r.status === 'IN_PROGRESS' || r.status === 'COMPLETED' || r.qr_id || r.qr_code) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleOpenQrModal(r)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: '#16A34A', color: '#166534' }}
              title="View QR Verification"
            >
              <QrCode size={12} />
              <span>View QR</span>
            </button>
          )}
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
            <span>District Officer: Project Lifecycle & Contractor Oversight ({isDistrictOfficer ? assignedDistrict : selectedDistrict})</span>
          </h1>
          <p className="page-subtitle">
            Manage government projects under approved schemes: Assign contractors, disburse phase funds to bank accounts, inspect proof submissions, and close completed projects.
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
                  Jurisdiction Authority
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

          {/* Create Project Button */}
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Plus size={14} />
            <span>Create Project under Scheme</span>
          </button>
        </div>
      </div>

      {/* District Fund Ceiling & Allocation Overview Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(30, 58, 138, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Coins size={20} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              State Sanction Received
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-primary)' }}>
              {formatCurrency(districtFundSummary.total_received)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CreditCard size={20} color="var(--color-warning)" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Committed to Projects
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-warning)' }}>
              {formatCurrency(districtFundSummary.total_committed)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: districtFundSummary.total_available > 0 ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={20} color={districtFundSummary.total_available > 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              District Available Balance
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: districtFundSummary.total_available > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {formatCurrency(districtFundSummary.total_available)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderKanban size={20} color="var(--color-accent)" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Sanctioned Projects
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
              {projects.length} Projects
            </div>
          </div>
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
        <DataTable columns={columns} data={projects} searchKey="name" searchPlaceholder="Search projects by name, ID or scheme..." />
      </div>

      {/* MODAL: Create Project under Scheme */}
      <Modal title={`Create Project in ${isDistrictOfficer ? assignedDistrict : selectedDistrict}`} isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <form onSubmit={handleCreateProject}>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Select Government Scheme</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {displaySchemes.filter(s => s.available_balance > 0).length} of {displaySchemes.length} Funded
              </span>
            </div>
            <select
              className="form-control form-select"
              value={createForm.scheme_name}
              onChange={(e) => {
                const chosenName = e.target.value;
                const matchScheme = displaySchemes.find(s => normalizeScheme(s.scheme_name || s.name) === normalizeScheme(chosenName));
                const sCode = matchScheme ? (matchScheme.scheme_code || matchScheme.code || 'SCHEME') : 'SCHEME';
                const sDept = matchScheme ? (matchScheme.department || 'Public Infrastructure') : 'Public Infrastructure';
                const avail = matchScheme ? (matchScheme.available_balance || 0) : 0;
                setFormData(prev => ({
                  ...prev,
                  scheme_name: chosenName,
                  scheme_code: sCode,
                  department: sDept,
                  total_budget: avail > 0 ? Math.min(prev.total_budget || 10000000, avail) : 0
                }));
              }}
              required
            >
              {displaySchemes.map((s, idx) => {
                const sName = s.scheme_name || s.name;
                const sCode = s.scheme_code || s.code;
                const avail = s.available_balance || 0;
                return (
                  <option key={`${sName}-${idx}`} value={sName}>
                    {sName} ({sCode}) — {avail > 0 ? `Available: ${formatCurrency(avail)}` : 'No State Allocation (₹0)'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Real-Time District Scheme Fund Pool Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '14px'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>State Sanction</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-primary)' }}>
                {formatCurrency(currentSchemeData.total_received)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Committed</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-warning)' }}>
                {formatCurrency(currentSchemeData.committed_budget)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: currentSchemeData.available_balance > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '700', textTransform: 'uppercase' }}>
                District Available
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: currentSchemeData.available_balance > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(currentSchemeData.available_balance)}
              </div>
            </div>
          </div>

          {/* Warning Banner if No Balance */}
          {currentSchemeData.available_balance <= 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-danger)',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '14px'
            }}>
              <AlertCircle size={16} />
              <span>
                {currentSchemeData.total_received === 0
                  ? `No funds have been transferred by State Treasury to ${isDistrictOfficer ? assignedDistrict : selectedDistrict} for '${createForm.scheme_name}' yet.`
                  : `100% of received funds for '${createForm.scheme_name}' in this district are already allocated to existing projects.`
                }
              </span>
            </div>
          )}

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

          <FundAmountInput
            label="Total Contract Budget"
            value={createForm.total_budget}
            onChange={(val) => setFormData({ ...createForm, total_budget: val })}
            max={currentSchemeData.available_balance}
            maxLabel="District Available Ceiling"
            required={true}
            disabled={currentSchemeData.available_balance <= 0}
            helperText={
              currentSchemeData.available_balance > 0
                ? `Contract budget must be within the district's available ceiling of ${formatCurrency(currentSchemeData.available_balance)}.`
                : "Cannot allocate: Zero funds available under this scheme."
            }
          />

          <div className="form-group">
            <label className="form-label">Timeline (Months)</label>
            <input
              type="number"
              className="form-control"
              value={createForm.timeline_months}
              onChange={(e) => setFormData({ ...createForm, timeline_months: Number(e.target.value) })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Scope & Technical Specifications</label>
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submittingProject ||
                currentSchemeData.available_balance <= 0 ||
                createForm.total_budget <= 0 ||
                createForm.total_budget > currentSchemeData.available_balance
              }
            >
              <Plus size={14} />
              <span>{submittingProject ? 'Sanctioning Project...' : 'Create Project'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Assign Contractor */}
      <Modal title={`Select & Assign Contractor to ${selectedProject?.project_id}`} isOpen={modalMode === 'ASSIGN' && !!selectedProject} onClose={() => setModalMode('')}>
        <div className="form-group">
          <label className="form-label">Select KYC-Approved Contractor Enterprise</label>
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
                    {c.company_name || c.name || 'Contractor'} (GST: {c.gst_number || '29AABCU9603R1ZM'} • Bank: {c.bank_name || 'SBI'})
                  </option>
                );
              })
            )}
          </select>
        </div>

        <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', marginBottom: '16px' }}>
          <div>Project: <strong>{selectedProject?.name}</strong></div>
          <div>Scheme: <strong>{selectedProject?.scheme_name}</strong></div>
          <div>Budget: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedProject?.total_budget)}</strong></div>
          <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>
            * Assigning sends a real-time notification to the contractor to <strong>Accept or Reject</strong> the assignment.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setModalMode('')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssignContractor}>
            <UserCheck size={14} />
            <span>Assign & Notify Contractor</span>
          </button>
        </div>
      </Modal>

      {/* MODAL 4: Manage Project Details, Fund Requests, Verifications, and Closure */}
      {modalMode === 'DETAILS' && selectedProject && (
        <ProjectManageModal
          project={selectedProject}
          onClose={() => setModalMode('')}
          onRefresh={() => loadData()}
          onOpenQrModal={handleOpenQrModal}
        />
      )}

      {/* MODAL 5: View Official Project QR Code */}
      <Modal title={`QR Verification: ${qrModalData?.project_id || ''}`} isOpen={showQrModal && !!qrModalData} onClose={() => setShowQrModal(false)}>
        {qrModalData && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', color: '#166534', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', marginBottom: '16px', border: '1px solid #86EFAC' }}>
              <CheckCircle2 size={14} />
              <span>OFFICIALLY VERIFIED CONTRACT QR • ACTIVE</span>
            </div>

            <div style={{
              background: '#FFFFFF',
              display: 'inline-block',
              padding: '16px',
              borderRadius: '16px',
              border: '2px solid #E2E8F0',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
              marginBottom: '16px'
            }}>
              {(qrModalData.qr_code?.qr_image_data || qrModalData.qr_image_data) ? (
                <img
                  src={qrModalData.qr_code?.qr_image_data || qrModalData.qr_image_data}
                  alt="Official Project QR"
                  style={{ width: '210px', height: '210px', display: 'block', margin: '0 auto' }}
                />
              ) : (
                <div style={{ width: '210px', height: '210px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
                  <QrCode size={80} color="#94A3B8" />
                </div>
              )}
            </div>

            <div style={{ background: '#F8FAFC', padding: '14px 18px', borderRadius: '10px', textAlign: 'left', marginBottom: '20px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Project:</span>
                <strong>{qrModalData.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Contract ID:</span>
                <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>{qrModalData.contract_id || qrModalData.qr_code?.contract_id || 'CON-ACCEPTED'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>Contractor:</span>
                <strong>{qrModalData.contractor_name || 'Accepted Contractor'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#64748B' }}>QR Status:</span>
                <strong style={{ color: '#16A34A' }}>ACTIVE</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Public Verification:</span>
                <a
                  href={`/verify/${qrModalData.qr_code?.qr_id || qrModalData.qr_id || `QR-${qrModalData.contract_id}`}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#0284C7', textDecoration: 'none', fontWeight: '700' }}
                >
                  Open Verification Page ↗
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {(qrModalData.qr_code?.qr_image_data || qrModalData.qr_image_data) && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrModalData.qr_code?.qr_image_data || qrModalData.qr_image_data;
                    link.download = `${qrModalData.contract_id || qrModalData.project_id}_Official_QR.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={14} />
                  <span>Download QR PNG</span>
                </button>
              )}

              <button
                className="btn btn-secondary"
                onClick={() => setShowQrModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ProjectManageModal = ({ project, onClose, onRefresh, onOpenQrModal }) => {
  const [details, setDetails] = useState(null);
  const [fundRejectModalPhase, setFundRejectModalPhase] = useState(null);
  const [fundRejectReason, setFundRejectReason] = useState('');
  const [proofRejectModalPhase, setProofRejectModalPhase] = useState(null);
  const [proofRejectReason, setProofRejectReason] = useState('');
  const [evidenceRejectModalItem, setEvidenceRejectModalItem] = useState(null);
  const [evidenceRejectReason, setEvidenceRejectReason] = useState('');
  const [previewEvidence, setPreviewEvidence] = useState(null);
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

  useRealtimeSync(loadDetails, { interval: 5000 });

  // Allocate & Transfer Funds to Contractor Bank Account
  const handleApproveFundRequest = async (milestoneIndex) => {
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${milestoneIndex}/verify-fund-request`, {
        action: 'APPROVE'
      });
      if (res.success) {
        setActionMsg(res.message);
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Fund Request
  const handleRejectFundRequest = async () => {
    if (fundRejectModalPhase === null) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${fundRejectModalPhase}/verify-fund-request`, {
        action: 'REJECT',
        remarks: fundRejectReason || 'Fund mobilization estimate requires revision.'
      });
      if (res.success) {
        setActionMsg(`Phase #${fundRejectModalPhase + 1} fund request rejected. Reason logged.`);
        setFundRejectModalPhase(null);
        setFundRejectReason('');
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Milestone Proof Submission
  const handleApproveProofSubmission = async (milestoneIndex) => {
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${milestoneIndex}/verify`, {
        action: 'APPROVE'
      });
      if (res.success) {
        setActionMsg(res.message);
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Proof Submission -> Loops back to Execute Work
  const handleRejectProofSubmission = async () => {
    if (proofRejectModalPhase === null) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/projects/${project.project_id}/phases/${proofRejectModalPhase}/verify`, {
        action: 'REJECT',
        remarks: proofRejectReason || 'Site inspection failed specifications. Rectification required.'
      });
      if (res.success) {
        setActionMsg(`Phase #${proofRejectModalPhase + 1} deliverables rejected. Loop back to Execute Work triggered.`);
        setProofRejectModalPhase(null);
        setProofRejectReason('');
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Close Project
  const handleCloseProject = async () => {
    if (!window.confirm("Are you sure you want to formally close this project?")) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/projects/${project.project_id}/close-project`);
      if (res.success) {
        setActionMsg(res.message);
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Deactivate Contractor Bank Account
  const handleDeactivateBankAccount = async () => {
    if (!window.confirm("Confirm deactivating contractor project bank account? Status will become: Account Not Available to Contractor.")) return;
    setSubmitting(true);
    try {
      const res = await API.post(`/district/projects/${project.project_id}/deactivate-bank-account`, {
        reason: "Project closed and verified. Contractor project account closed."
      });
      if (res.success) {
        setActionMsg("Contractor Project Bank Account Deactivated! Account Not Available to Contractor.");
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Verify Work Evidence
  const handleVerifyEvidence = async (evidenceId) => {
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await API.post(`/district/evidence/${evidenceId}/verify`);
      if (res.success) {
        setActionMsg(`Work evidence ${evidenceId} verified successfully! Status: VERIFIED.`);
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message || 'Failed to verify evidence');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reject Evidence Modal
  const handleOpenRejectEvidenceModal = (ev) => {
    setEvidenceRejectModalItem(ev);
    setEvidenceRejectReason('Uploaded evidence does not clearly show completion of the milestone.');
  };

  // Confirm Reject Evidence
  const handleConfirmRejectEvidence = async () => {
    if (!evidenceRejectModalItem) return;
    if (!evidenceRejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await API.post(`/district/evidence/${evidenceRejectModalItem.evidence_id || evidenceRejectModalItem.evidenceId}/reject`, {
        rejection_reason: evidenceRejectReason.trim()
      });
      if (res.success) {
        setActionMsg(`Work evidence rejected. Status: REJECTED. Contractor notified with reason.`);
        setEvidenceRejectModalItem(null);
        setEvidenceRejectReason('');
        loadDetails();
        onRefresh();
      }
    } catch (e) {
      alert(e.message || 'Failed to reject evidence');
    } finally {
      setSubmitting(false);
    }
  };

  const projData = details?.project || project;
  const milestones = details?.milestones || [];
  const docs = details?.documents || [];
  const bankAcc = projData.contractor_bank_account;
  const isBankDeactivated = projData.bank_account_status === 'DEACTIVATED' || bankAcc?.is_active === false;
  const isProjectClosed = projData.status === 'CLOSED' || projData.is_closed;
  const isAllPhasesCompleted = milestones.length > 0 && milestones.every(m => m.status === 'COMPLETED');

  const maskAccount = (accNum) => {
    if (!accNum) return 'XXXX XXXX 1234';
    const clean = String(accNum).replace(/[\s-]/g, '');
    if (clean.length <= 4) return `XXXX XXXX ${clean}`;
    return `XXXX XXXX ${clean.slice(-4)}`;
  };

  return (
    <Modal title={`Project Lifecycle Management: ${projData.name}`} isOpen={true} onClose={onClose} maxWidth="900px">
      {/* Overview Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Project ID: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{projData.project_id}</strong></div>
          <div style={{ fontSize: '13px', fontWeight: '700' }}>{projData.scheme_name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Contract Value:</div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-success)' }}>{formatCurrency(projData.total_budget)}</div>
        </div>
      </div>

      {/* Contractor & Bank Account Card */}
      {projData.contractor_name && (
        <div style={{ background: isBankDeactivated ? '#FEF2F2' : '#F0FDF4', border: isBankDeactivated ? '1.5px solid #F87171' : '1.5px solid #86EFAC', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color={isBankDeactivated ? '#DC2626' : '#16A34A'} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: isBankDeactivated ? '#991B1B' : '#166534' }}>
                  Contractor: {projData.contractor_name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Bank: <strong>{bankAcc?.bank_name || 'State Bank of India'}</strong> • A/C: <code style={{ fontWeight: '700' }}>{maskAccount(bankAcc?.account_number)}</code> • IFSC: {bankAcc?.ifsc_code || 'SBIN0001234'}
                </div>
              </div>
            </div>

            <div>
              {isBankDeactivated ? (
                <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <Ban size={12} />
                  <span>🚫 Account Not Available to Contractor (Deactivated)</span>
                </span>
              ) : (
                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                  ✓ Bank Account Active & Linked
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* District QR Verification Section (Requirement 12) */}
      {projData.contractor_name && (
        <div style={{
          background: (projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code)
            ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)'
            : '#F8FAFC',
          border: (projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code)
            ? '1.5px solid #86EFAC'
            : '1px solid #E2E8F0',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>
                  Contract Status:
                </span>
                {(projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code) ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                    <CheckCircle2 size={12} />
                    <span>ACCEPTED</span>
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: '800' }}>
                    PENDING CONTRACTOR ACCEPTANCE
                  </span>
                )}

                {(projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code) && (
                  <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                    <QrCode size={12} />
                    <span>QR Verification: ACTIVE</span>
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                Contract ID: <span style={{ fontFamily: 'monospace' }}>{projData.contract_id || details?.qr_code?.contract_id || 'PENDING'}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                {(projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code)
                  ? 'Official QR code is active and verifiable by citizens and field audit officers.'
                  : 'QR code will automatically generate immediately once the contractor accepts this contract.'}
              </div>
            </div>

            {(projData.contract_status === 'ACCEPTED' || projData.assignment_status === 'ACCEPTED' || details?.qr_code || projData.qr_code) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {(details?.qr_code?.qr_image_data || projData.qr_code?.qr_image_data) && (
                  <img
                    src={details?.qr_code?.qr_image_data || projData.qr_code?.qr_image_data}
                    alt="QR"
                    style={{ width: '46px', height: '46px', borderRadius: '4px', border: '1px solid #86EFAC', background: '#FFF' }}
                  />
                )}
                {onOpenQrModal && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenQrModal({ ...projData, qr_code: details?.qr_code || projData.qr_code })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <QrCode size={14} />
                    <span>View QR</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* 3-PHASE EXECUTION LIFECYCLE */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Sequential 3-Phase Execution & Fund Disbursals</span>
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {milestones.map((m, idx) => {
            const isCompleted = m.status === 'COMPLETED' || m.status === 'RELEASED';
            const isSubmitted = !isCompleted && (m.status === 'SUBMITTED' || m.phase_status === 'SUBMITTED_FOR_VERIFICATION');
            const isFundRequested = !isCompleted && (m.status === 'FUND_REQUESTED' || m.phase_status === 'FUND_REQUESTED');
            const isFundsTransferred = !isCompleted && (m.status === 'FUNDS_TRANSFERRED' || m.phase_status === 'FUNDS_TRANSFERRED');
            const isWorkInProgress = !isCompleted && (m.status === 'APPROVED_FOR_WORK' || m.phase_status === 'EXECUTING_WORK');
            const isRejectedProof = !isCompleted && (m.status === 'REJECTED_NEEDS_RECTIFICATION' || m.status === 'REJECTED');
            const isFundRejected = !isCompleted && (m.status === 'FUND_REQUEST_REJECTED');
            const isLocked = !isCompleted && (m.status === 'LOCKED' || m.phase_status === 'LOCKED');

            return (
              <div key={idx} style={{
                background: isLocked ? '#F8FAFC' : '#FFFFFF',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: isCompleted ? '1.5px solid var(--color-success-border)' : isRejectedProof || isFundRejected ? '1.5px solid var(--color-danger-border)' : '1px solid var(--border-color)',
                opacity: isLocked ? 0.6 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'gap', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-main)' }}>
                      Phase #{idx + 1}: {m.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {m.description}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(m.amount)}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      {isCompleted && <span className="badge badge-success">✓ COMPLETED</span>}
                      {isSubmitted && <span className="badge badge-primary">VERIFICATION PENDING</span>}
                      {isFundsTransferred && <span className="badge badge-success">FUNDS TRANSFERRED TO BANK</span>}
                      {isWorkInProgress && <span className="badge badge-warning">EXECUTING WORK</span>}
                      {isFundRequested && <span className="badge badge-info">FUND REQUEST RECEIVED</span>}
                      {isFundRejected && <span className="badge badge-danger">FUND REQUEST REJECTED</span>}
                      {isRejectedProof && <span className="badge badge-danger">RECTIFICATION REQUIRED</span>}
                      {isLocked && <span className="badge badge-secondary">LOCKED</span>}
                    </div>
                  </div>
                </div>

                {/* Fund Request Details */}
                {isFundRequested && (
                  <div style={{ background: '#EFF6FF', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #BFDBFE', fontSize: '12px', margin: '10px 0' }}>
                    <div style={{ fontWeight: '700', color: '#1E40AF', marginBottom: '2px' }}>
                      Contractor Fund Mobilization Request Received
                    </div>
                    <div>Requested Amount: <strong>{formatCurrency(m.fund_requested_amount || m.amount)}</strong></div>
                    <div>Justification Notes: <em>{m.fund_request_notes || 'Mobilization advance'}</em></div>
                    <div>Target Bank Account: <strong>{bankAcc?.bank_name || 'Contractor Commercial Bank'} (A/C: {maskAccount(bankAcc?.account_number)})</strong></div>
                  </div>
                )}

                {/* Work Evidence Inspection & Verification Deliverables */}
                {(() => {
                  const mEvidence = (details?.evidence || []).filter(
                    (e) => e.milestone_index === m.milestone_index || e.milestoneId === m._id || e.milestoneId === `MS-${project.project_id}-${m.milestone_index + 1}`
                  );

                  if (mEvidence.length > 0) {
                    return (
                      <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid #CBD5E1', margin: '12px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileCheck size={16} color="var(--color-primary)" />
                            <span>Work Evidence Submissions ({mEvidence.length}) — Phase #{idx + 1}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Project: <strong>{projData.name}</strong> • Contractor: <strong>{projData.contractor_name}</strong>
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {mEvidence.map((ev, evIdx) => {
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
                                  padding: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                  <div>
                                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                                      {ev.file_name || `Evidence #${evIdx + 1}`}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      Upload Date: {ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleString('en-IN') : 'Recently'} • Milestone: Phase #{idx + 1}
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
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: '4px' }}>
                                    <strong>Evidence Description:</strong> {ev.description}
                                  </div>
                                )}

                                {/* Evidence Files Display */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  {isImg && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div
                                        style={{
                                          width: '120px',
                                          height: '80px',
                                          borderRadius: '6px',
                                          overflow: 'hidden',
                                          border: '1px solid #CBD5E1',
                                          cursor: 'pointer',
                                          background: '#F1F5F9'
                                        }}
                                        onClick={() => setPreviewEvidence({ ...ev, url: fileViewUrl })}
                                        title="Click to view full size preview without downloading"
                                      >
                                        <img
                                          src={fileViewUrl}
                                          alt={ev.file_name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                          onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ fontSize: '11px', padding: '4px 8px' }}
                                        onClick={() => setPreviewEvidence({ ...ev, url: fileViewUrl })}
                                      >
                                        <Eye size={12} />
                                        <span>View Preview</span>
                                      </button>
                                    </div>
                                  )}

                                  {isPdfOrDoc && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '6px 10px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                                        <FileText size={15} color="var(--color-primary)" />
                                        <span>{ev.file_name}</span>
                                      </div>
                                      <a
                                        href={fileViewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary btn-sm"
                                        style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Eye size={12} />
                                        <span>View</span>
                                      </a>
                                      <a
                                        href={fileDownloadUrl}
                                        download={ev.file_name}
                                        className="btn btn-secondary btn-sm"
                                        style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Download size={12} />
                                        <span>Download</span>
                                      </a>
                                    </div>
                                  )}

                                  {ev.sha256_hash && (
                                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                      SHA-256: {ev.sha256_hash.slice(0, 16)}...
                                    </div>
                                  )}
                                </div>

                                {/* Rejection Reason Callout */}
                                {isEvRejected && (ev.rejection_reason || ev.rejectionReason) && (
                                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '8px 10px', fontSize: '12px', color: '#B91C1C' }}>
                                    <strong>Rejection Reason:</strong> {ev.rejection_reason || ev.rejectionReason}
                                  </div>
                                )}

                                {/* Action Buttons: [Verify Evidence] & [Reject Evidence] */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #E2E8F0' }}>
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    style={{ fontSize: '11px', padding: '5px 12px' }}
                                    onClick={() => handleVerifyEvidence(ev.evidence_id || ev.evidenceId)}
                                    disabled={submitting || isEvVerified}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>{isEvVerified ? 'Evidence Verified ✓' : 'Verify Evidence'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '11px', padding: '5px 12px', color: 'var(--color-danger)' }}
                                    onClick={() => handleOpenRejectEvidenceModal(ev)}
                                    disabled={submitting}
                                  >
                                    <XCircle size={13} />
                                    <span>Reject Evidence</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (isSubmitted) {
                    return (
                      <div style={{ background: '#F0FDF4', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #BBF7D0', margin: '10px 0', fontSize: '12px' }}>
                        <div style={{ fontWeight: '800', color: '#166534', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileCheck size={16} />
                          <span>Verify Contractor Completion Proof Submission (Phase #{idx + 1})</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '8px' }}>
                          <div style={{ background: '#FFF', padding: '8px 10px', borderRadius: '4px', border: '1px solid #DCFCE7' }}>
                            <div style={{ fontWeight: '700', color: '#15803D' }}>📄 Material Bills:</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.material_bills_notes || 'Uploaded invoice vouchers'}</div>
                          </div>

                          <div style={{ background: '#FFF', padding: '8px 10px', borderRadius: '4px', border: '1px solid #DCFCE7' }}>
                            <div style={{ fontWeight: '700', color: '#15803D' }}>📸 Progress Photos:</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Geotagged site images attached</div>
                          </div>

                          <div style={{ background: '#FFF', padding: '8px 10px', borderRadius: '4px', border: '1px solid #DCFCE7' }}>
                            <div style={{ fontWeight: '700', color: '#15803D' }}>🎥 Progress Videos:</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.video_url ? <a href={m.video_url} target="_blank" rel="noreferrer">View Site Video</a> : 'Video recording attached'}</div>
                          </div>

                          <div style={{ background: '#FFF', padding: '8px 10px', borderRadius: '4px', border: '1px solid #DCFCE7' }}>
                            <div style={{ fontWeight: '700', color: '#15803D' }}>📑 Other Documents:</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Quality lab test reports verified</div>
                          </div>
                        </div>

                        {m.proof_document_hash && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Cryptographic SHA-256 Digest: <code style={{ color: 'var(--color-primary)' }}>{m.proof_document_hash}</code>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Rejection Notes */}
                {(isRejectedProof && m.rejection_reason) && (
                  <div style={{ background: '#FEF2F2', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '12px', margin: '8px 0' }}>
                    <strong>Inspection Rejection Reason:</strong> {m.rejection_reason} (Contractor executing rectification)
                  </div>
                )}

                {/* Actions per Phase */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  {/* Verify Fund Request */}
                  {isFundRequested && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveFundRequest(m.milestone_index)}
                        disabled={submitting}
                      >
                        <Coins size={13} />
                        <span>Allocate & Transfer Funds to Bank Account</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => { setFundRejectModalPhase(m.milestone_index); setFundRejectReason(''); }}
                        disabled={submitting}
                      >
                        <XCircle size={13} />
                        <span>Reject Request</span>
                      </button>
                    </>
                  )}

                  {/* Verify Submission Proof */}
                  {isSubmitted && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApproveProofSubmission(m.milestone_index)}
                        disabled={submitting}
                      >
                        <ShieldCheck size={13} />
                        <span>Approve Submission (Phase #{idx + 1} Completed)</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => { setProofRejectModalPhase(m.milestone_index); setProofRejectReason(''); }}
                        disabled={submitting}
                      >
                        <XCircle size={13} />
                        <span>Reject & Require Rectification</span>
                      </button>
                    </>
                  )}

                  {isCompleted && m.blockchain_tx_hash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700' }}>Disbursed on Ethereum</span>
                      <BlockchainBadge txHash={m.blockchain_tx_hash} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FINAL COMPLETION, PROJECT CLOSURE & BANK DEACTIVATION */}
      {(isAllPhasesCompleted || projData.status === 'FINAL_PROJECT_COMPLETED' || isProjectClosed) && (
        <div style={{
          background: isProjectClosed ? '#F8FAFC' : '#F0FDF4',
          border: isProjectClosed ? '1.5px solid var(--border-color)' : '1.5px solid #86EFAC',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: isProjectClosed ? 'var(--text-main)' : '#166534' }}>
                {isProjectClosed ? '✓ Project Formally Closed' : '🎉 Final Project Completed!'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {isBankDeactivated ? 'Contractor Project Bank Account Deactivated (Account Not Available to Contractor).' : 'Proceed to Close Project and Deactivate Contractor Bank Account.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isProjectClosed && (
                <button className="btn btn-primary btn-sm" onClick={handleCloseProject} disabled={submitting}>
                  <FolderKanban size={13} />
                  <span>Close Project</span>
                </button>
              )}

              {!isBankDeactivated && (
                <button className="btn btn-danger btn-sm" onClick={handleDeactivateBankAccount} disabled={submitting}>
                  <PowerOff size={13} />
                  <span>Deactivate Contractor Bank Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Off-Chain Documents List */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '10px' }}>
          Uploaded Project Proof Files & SHA-256 Records
        </h4>
        {docs.length > 0 ? (
          docs.map((doc, idx) => (
            <DocumentHashViewer key={idx} document={doc} showVerifyButton={true} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No documents uploaded yet.
          </div>
        )}
      </div>

      {/* Reject Fund Modal */}
      {fundRejectModalPhase !== null && (
        <Modal title={`Reject Phase #${fundRejectModalPhase + 1} Fund Request`} isOpen={true} onClose={() => setFundRejectModalPhase(null)}>
          <div className="form-group">
            <label className="form-label">Fund Rejection Reason</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="State reason for declining fund request..."
              value={fundRejectReason}
              onChange={(e) => setFundRejectReason(e.target.value)}
              required
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setFundRejectModalPhase(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleRejectFundRequest} disabled={submitting}>
              <span>Confirm Reject Request</span>
            </button>
          </div>
        </Modal>
      )}

      {/* Reject Proof Modal */}
      {proofRejectModalPhase !== null && (
        <Modal title={`Reject Phase #${proofRejectModalPhase + 1} Completion Proof`} isOpen={true} onClose={() => setProofRejectModalPhase(null)}>
          <div className="form-group">
            <label className="form-label">Quality Inspection Deficiency Remarks</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="State reasons for deficiency (e.g. concrete quality test failed, asphalt thickness short, re-work required)..."
              value={proofRejectReason}
              onChange={(e) => setProofRejectReason(e.target.value)}
              required
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setProofRejectModalPhase(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleRejectProofSubmission} disabled={submitting}>
              <span>Confirm Rejection & Require Rectification</span>
            </button>
          </div>
        </Modal>
      )}

      {/* Reject Evidence Modal */}
      {evidenceRejectModalItem !== null && (
        <Modal title={`Reject Work Evidence: ${evidenceRejectModalItem.file_name || evidenceRejectModalItem.evidence_id}`} isOpen={true} onClose={() => setEvidenceRejectModalItem(null)}>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#B91C1C' }}>
            Enter a clear rejection reason. This feedback will be displayed to the contractor so they can rectify the work and upload corrected evidence.
          </div>
          <div className="form-group">
            <label className="form-label">Rejection Reason (Mandatory)</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="e.g. Uploaded evidence does not clearly show completion of the milestone."
              value={evidenceRejectReason}
              onChange={(e) => setEvidenceRejectReason(e.target.value)}
              required
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setEvidenceRejectModalItem(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleConfirmRejectEvidence} disabled={submitting || !evidenceRejectReason.trim()}>
              <span>{submitting ? 'Rejecting...' : 'Confirm Reject Evidence'}</span>
            </button>
          </div>
        </Modal>
      )}

      {/* Evidence Full Image Preview Modal */}
      {previewEvidence !== null && (
        <Modal title={`Work Evidence Preview: ${previewEvidence.file_name || 'Site Image'}`} isOpen={true} onClose={() => setPreviewEvidence(null)} maxWidth="750px">
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewEvidence.url}
              alt={previewEvidence.file_name}
              style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '8px', border: '1px solid #E2E8F0', objectFit: 'contain' }}
            />
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left', background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '6px' }}>
              <div><strong>File Name:</strong> {previewEvidence.file_name}</div>
              {previewEvidence.description && <div><strong>Description:</strong> {previewEvidence.description}</div>}
              {previewEvidence.sha256_hash && <div style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '4px' }}>SHA-256 Digest: {previewEvidence.sha256_hash}</div>}
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default ProjectsManagement;
