import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, 
  FolderKanban, 
  Coins, 
  UserCheck, 
  MessageSquareWarning, 
  Plus, 
  ShieldCheck, 
  TrendingUp,
  MapPin,
  Lock,
  Layers,
  FileSpreadsheet,
  Activity,
  Send,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';
import { getAllStates, getDistrictsByState, getStateForDistrict, getState } from '../../config/statesDistrictsData';

// Sub-components for tabs
import ProjectsManagement from '../district/ProjectsManagement';
import ContractorKYCReview from '../district/ContractorKYCReview';
import GrievanceInbox from '../district/GrievanceInbox';
import AllocateToDistrict from '../state/AllocateToDistrict';
import StateReceivedFunds from '../state/StateReceivedFunds';

const DepartmentDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Request Fund Modal State
  const [showRequestFundModal, setShowRequestFundModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    scheme_name: '',
    department: user?.department || 'Rural Development & Infrastructure',
    amount_requested: '',
    purpose: '',
    justification: ''
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  const isDistrictOfficer = user?.role === 'DISTRICT';
  const isStateOfficer = user?.role === 'STATE';
  const assignedDistrict = user?.district_name || 'Belagavi';
  const assignedStateCode = user?.state_code || getStateForDistrict(assignedDistrict)?.code || 'KA';
  const assignedStateName = user?.state_name || getState(assignedStateCode)?.name || 'Karnataka';

  const [selectedState, setSelectedState] = useState(isDistrictOfficer ? assignedStateCode : (user?.state_code || 'KA'));
  const [selectedDistrict, setSelectedDistrict] = useState(isDistrictOfficer ? assignedDistrict : 'Belagavi');

  const loadDashboard = (district = selectedDistrict) => {
    setLoading(true);
    const targetDist = isDistrictOfficer ? assignedDistrict : district;
    const query = targetDist ? `?district=${encodeURIComponent(targetDist)}` : '';
    API.get(`/district/dashboard${query}`)
      .then((res) => {
        if (res.success) {
          setData(res);
          if (res.district_name && !selectedDistrict) {
            setSelectedDistrict(res.district_name);
          }
        }
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isDistrictOfficer) {
      setSelectedDistrict(assignedDistrict);
      setSelectedState(assignedStateCode);
      loadDashboard(assignedDistrict);
    } else {
      loadDashboard(selectedDistrict);
    }
  }, [selectedDistrict, user]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const handleRequestFundSubmit = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    try {
      // Simulate/submit fund request
      setTimeout(() => {
        setRequestSuccess(`Fund requisition of ${formatCurrency(Number(requestForm.amount_requested))} for ${requestForm.scheme_name} submitted successfully to State Treasury.`);
        setRequestSubmitting(false);
        setTimeout(() => {
          setShowRequestFundModal(false);
          setRequestSuccess('');
          setRequestForm({
            scheme_name: '',
            department: user?.department || 'Rural Development & Infrastructure',
            amount_requested: '',
            purpose: '',
            justification: ''
          });
        }, 2000);
      }, 700);
    } catch (err) {
      alert(err.message || 'Failed to submit fund requisition');
      setRequestSubmitting(false);
    }
  };

  const metrics = data?.metrics;
  const currentDistrictName = isDistrictOfficer ? assignedDistrict : (data?.district_name || selectedDistrict);

  return (
    <div>
      {/* Department Institutional Hero Banner */}
      <div className="gov-hero-banner" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div className="gov-hero-pill">
              <Building2 size={13} />
              <span>
                {isStateOfficer 
                  ? `State Planning & Treasury Directorate • ${assignedStateName}`
                  : `Department & District Development Authority • ${currentDistrictName}`
                }
              </span>
            </div>
            <h1 className="gov-hero-title">
              {isStateOfficer 
                ? `State Department & Treasury Portal (${assignedStateName})`
                : `Department Development Authority (${currentDistrictName})`
              }
            </h1>
            <p className="gov-hero-subtitle">
              Unified portal for department schemes, project execution, contractor verification, document hashing, and smart contract milestone fund utilization.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* If District Officer: Show Locked Jurisdiction Badge */}
            {isDistrictOfficer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <MapPin size={15} color="#0D5C3A" />
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#0D5C3A' }}>
                    Jurisdiction
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {assignedDistrict} ({assignedStateName})
                  </div>
                </div>
                <span className="badge badge-success" style={{ fontSize: '10px', marginLeft: '4px' }}>
                  <Lock size={10} /> Authorized
                </span>
              </div>
            ) : !isStateOfficer ? (
              /* Higher Authority Switcher */
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>STATE:</span>
                <select
                  className="form-control form-select"
                  style={{ width: 'auto', height: '30px', padding: '2px 24px 2px 6px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
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
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>DISTRICT:</span>
                <select
                  className="form-control form-select"
                  style={{ width: 'auto', height: '30px', padding: '2px 24px 2px 6px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                >
                  {getDistrictsByState(selectedState).map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Request Funds Button */}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowRequestFundModal(true)}
              style={{
                backgroundColor: '#F59E0B',
                color: '#0F172A',
                borderColor: '#F59E0B',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Send size={13} />
              <span>Request Funds</span>
            </button>

            {/* New Project Quick Link */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setTab('projects')}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: 'transparent', fontWeight: '700' }}
            >
              <Plus size={13} />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          type="button"
          onClick={() => setTab('overview')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'overview' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'overview' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <Building2 size={16} />
          <span>Department Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('projects')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'projects' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'projects' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'projects' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FolderKanban size={16} />
          <span>Department Projects ({data?.active_projects?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('schemes')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'schemes' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'schemes' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'schemes' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={16} />
          <span>Allocated Funds & Schemes ({data?.scheme_balances?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('contractors')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'contractors' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'contractors' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'contractors' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <UserCheck size={16} />
          <span>Contractor Verification</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('grievances')}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderBottom: activeTab === 'grievances' ? '3px solid var(--color-primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'grievances' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'grievances' ? '800' : '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquareWarning size={16} />
          <span>Grievance Inbox</span>
        </button>

        {isStateOfficer && (
          <button
            type="button"
            onClick={() => setTab('state_allocations')}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === 'state_allocations' ? '3px solid var(--color-primary)' : '3px solid transparent',
              background: 'none',
              color: activeTab === 'state_allocations' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'state_allocations' ? '800' : '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Send size={16} />
            <span>State District Allocations</span>
          </button>
        )}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Metrics Row */}
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Received Funds"
              value={metrics?.total_received || 0}
              icon={Coins}
              color="green"
              isCurrency={true}
              subtitle="From State Treasury (Escrow)"
            />
            <StatCard
              title="Committed to Projects"
              value={metrics?.total_committed || 0}
              icon={TrendingUp}
              color="blue"
              isCurrency={true}
              subtitle="Locked in Project Contracts"
            />
            <StatCard
              title="Available Balance"
              value={metrics?.total_available || 0}
              icon={Coins}
              color="teal"
              isCurrency={true}
              subtitle="Ready for New Projects"
            />
            <StatCard
              title="Monitored Projects"
              value={metrics?.active_projects_count || 0}
              icon={FolderKanban}
              color="orange"
              subtitle="In Active Execution"
            />
          </div>

          {/* Scheme Balances Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <div className="card-title">
                <FileSpreadsheet size={18} color="var(--color-primary)" />
                <span>Department Scheme Allocations & Balances</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTab('schemes')}
              >
                Manage Schemes
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Scheme Name</th>
                    <th>Department</th>
                    <th>Total Received</th>
                    <th>Committed</th>
                    <th>Available Balance</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.scheme_balances?.length > 0 ? (
                    data.scheme_balances.map((s, idx) => {
                      const utilRate = s.total_received > 0 ? Math.round((s.committed_budget / s.total_received) * 100) : 0;
                      return (
                        <tr key={idx}>
                          <td>
                            <strong style={{ color: 'var(--text-main)' }}>{s.scheme_name}</strong>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {s.department || 'Infrastructure & Works'}
                          </td>
                          <td>
                            <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(s.total_received)}</strong>
                          </td>
                          <td>
                            <span style={{ color: 'var(--color-primary)' }}>{formatCurrency(s.committed_budget)}</span>
                          </td>
                          <td>
                            <strong style={{ color: s.available_balance > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                              {formatCurrency(s.available_balance)}
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                <div style={{ width: `${Math.min(utilRate, 100)}%`, height: '100%', background: utilRate > 80 ? 'var(--color-primary)' : 'var(--color-success)', borderRadius: '3px' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '700', minWidth: '32px' }}>{utilRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No scheme allocations found for this jurisdiction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2-Column: Active Projects & Quick Action Links */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <FolderKanban size={18} color="var(--color-primary)" />
                  <span>Recent Active Department Projects</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTab('projects')}
                >
                  View All
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.active_projects?.length > 0 ? (
                  data.active_projects.slice(0, 5).map((p) => (
                    <div key={p.project_id} style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-primary)', fontWeight: '600' }}>{p.project_id}</span> • {p.scheme_name}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '13px' }}>
                          {formatCurrency(p.total_budget)}
                        </div>
                        <span className={`badge ${p.status === 'COMPLETED' ? 'badge-success' : p.status === 'FROZEN' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '10px', marginTop: '3px' }}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    No active projects registered for this department.
                    <div style={{ marginTop: '12px' }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('projects')}>
                        Create First Project
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={18} color="var(--color-primary)" />
                  <span>Quick Department Operations</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div 
                  onClick={() => setTab('projects')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderKanban size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Manage Projects & Milestones</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Inspect contractor work proofs, geotags, and release payments</div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>

                <div 
                  onClick={() => setShowRequestFundModal(true)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Coins size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Request Additional Funds</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Submit fund requisition to State Treasury for department schemes</div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>

                <div 
                  onClick={() => setTab('contractors')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Verify Registered Contractors</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Approve PWD licenses, GSTIN, and company profiles</div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>

                <div 
                  onClick={() => setTab('grievances')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquareWarning size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Citizen Grievances Inbox</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Resolve public complaints and issue site inspection reports</div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: Projects Management */}
      {activeTab === 'projects' && (
        <ProjectsManagement />
      )}

      {/* Tab 3: Schemes & Allocated Funds */}
      {activeTab === 'schemes' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileSpreadsheet size={18} color="var(--color-primary)" />
              <span>Allocated Schemes & Fund Tracking</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowRequestFundModal(true)}
            >
              <Send size={13} />
              <span>Request Scheme Allocation</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Scheme Name</th>
                  <th>Department</th>
                  <th>Total Allocated / Received</th>
                  <th>Committed to Works</th>
                  <th>Available Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.scheme_balances?.length > 0 ? (
                  data.scheme_balances.map((s, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{s.scheme_name}</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {s.department || 'Infrastructure & Works'}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(s.total_received)}</strong>
                      </td>
                      <td>
                        <span style={{ color: 'var(--color-primary)' }}>{formatCurrency(s.committed_budget)}</span>
                      </td>
                      <td>
                        <strong style={{ color: s.available_balance > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                          {formatCurrency(s.available_balance)}
                        </strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setRequestForm((prev) => ({ ...prev, scheme_name: s.scheme_name }));
                            setShowRequestFundModal(true);
                          }}
                        >
                          Request More Funds
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No schemes currently recorded for this department.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Contractor KYC Review */}
      {activeTab === 'contractors' && (
        <ContractorKYCReview />
      )}

      {/* Tab 5: Grievance Inbox */}
      {activeTab === 'grievances' && (
        <GrievanceInbox />
      )}

      {/* Tab 6: State Allocations (if state officer) */}
      {activeTab === 'state_allocations' && isStateOfficer && (
        <AllocateToDistrict />
      )}

      {/* Request Funds Modal */}
      {showRequestFundModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowRequestFundModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                  Department Fund Requisition
                </h3>
              </div>
              <button
                onClick={() => setShowRequestFundModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {requestSuccess ? (
              <div style={{
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                borderRadius: '8px',
                padding: '16px',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle2 size={20} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{requestSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleRequestFundSubmit}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Select Scheme</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. PM Gram Sadak Yojana"
                    value={requestForm.scheme_name}
                    onChange={(e) => setRequestForm({ ...requestForm, scheme_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Department / Agency</label>
                  <input
                    type="text"
                    className="form-control"
                    value={requestForm.department}
                    onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Amount Required (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 50000000"
                    value={requestForm.amount_requested}
                    onChange={(e) => setRequestForm({ ...requestForm, amount_requested: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label">Project Justification / Purpose</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Describe the regional works, target beneficiaries, and urgency of funds..."
                    value={requestForm.justification}
                    onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRequestFundModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={requestSubmitting}
                  >
                    {requestSubmitting ? 'Submitting to State...' : 'Submit Requisition'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentDashboard;
