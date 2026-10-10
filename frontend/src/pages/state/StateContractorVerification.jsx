import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Building2, 
  FileText, 
  Check, 
  X, 
  Filter,
  ExternalLink,
  ShieldAlert,
  Award
} from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import DocumentHashViewer from '../../components/DocumentHashViewer';
import { useRealtimeSync } from '../../context/RealtimeContext';

const StateContractorVerification = ({ stateCode, stateName }) => {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVED');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadContractors = () => {
    API.get('/state/contractors')
      .then((res) => {
        if (res.success) {
          setContractors(res.contractors || []);
        }
      })
      .catch((err) => {
        console.error('Error loading state contractors:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContractors();
  }, []);

  useRealtimeSync(loadContractors, { interval: 5000 });

  const handleOpenReview = (c) => {
    setSelectedContractor(c);
    setReviewAction('APPROVED');
    const stName = stateName || c.state_name || 'State';
    setRemarks(`Statutory credentials, PWD Class-1 license, and GSTIN verified by ${stName} State Department of Finance & Infrastructure.`);
    setActionSuccess('');
    setActionError('');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedContractor) return;
    setSubmitting(true);
    setActionError('');

    const targetId = selectedContractor.user_id || selectedContractor.contractor_id || selectedContractor._id;
    try {
      const res = await API.post(`/state/contractor/${targetId}/kyc-review`, {
        action: reviewAction,
        remarks: remarks || `Statutory credentials reviewed by ${stateName || 'State'} Department.`
      });

      if (res.success) {
        setActionSuccess(`Contractor '${selectedContractor.company_name}' successfully ${reviewAction} by State Department!`);
        setSelectedContractor(null);
        loadContractors();
      } else {
        setActionError(res.message || 'Verification update failed.');
      }
    } catch (err) {
      setActionError(err.message || 'Verification submission error.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStCode = stateCode || (contractors[0]?.state_code) || 'State';
  const currentStName = stateName || (contractors[0]?.state_name) || 'State Department';

  // Metrics
  const totalCount = contractors.length;
  const pendingCount = contractors.filter(c => c.kyc_status === 'UNDER_REVIEW').length;
  const approvedCount = contractors.filter(c => c.kyc_status === 'APPROVED').length;
  const rejectedCount = contractors.filter(c => c.kyc_status === 'REJECTED').length;

  const filteredContractors = contractors.filter(c => {
    if (statusFilter === 'ALL') return true;
    return c.kyc_status === statusFilter;
  });

  const columns = [
    {
      header: 'Enterprise / Legal Entity',
      accessor: 'company_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>
            {r.company_name || 'Infrastructure Entity'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            ID: <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0284C7' }}>{r.contractor_id || r.user_id?.substring(0, 8)}</span>
            {r.contact_name && ` • Rep: ${r.contact_name}`}
          </div>
        </div>
      )
    },
    {
      header: 'State Jurisdiction',
      accessor: 'state_code',
      render: (r) => (
        <div>
          <span style={{ 
            background: '#EFF6FF', 
            color: '#1D4ED8', 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontWeight: '800', 
            fontSize: '11px',
            border: '1px solid #BFDBFE'
          }}>
            {r.state_name || currentStName} ({r.state_code || currentStCode})
          </span>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            {r.district_name || 'Statewide Eligibility'}
          </div>
        </div>
      )
    },
    {
      header: 'Tax & PWD Licensing',
      accessor: 'gst_number',
      render: (r) => (
        <div style={{ fontSize: '12px' }}>
          <div>GST: <strong style={{ fontFamily: 'monospace', color: '#334155' }}>{r.gst_number || '29AABCU9603R1ZM'}</strong></div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
            PWD: {r.license_number || 'Class-1 PWD'} ({r.experience_years || 5} yrs exp)
          </div>
        </div>
      )
    },
    {
      header: 'State KYC Status',
      accessor: 'kyc_status',
      render: (r) => {
        const isApp = r.kyc_status === 'APPROVED';
        const isRev = r.kyc_status === 'UNDER_REVIEW';
        return (
          <div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '800',
              background: isApp ? '#ECFDF5' : (isRev ? '#FEF3C7' : '#FEF2F2'),
              color: isApp ? '#047857' : (isRev ? '#B45309' : '#B91C1C'),
              border: `1px solid ${isApp ? '#A7F3D0' : (isRev ? '#FDE68A' : '#FECACA')}`
            }}>
              {isApp && <Check size={11} />}
              {isRev && <Clock size={11} />}
              {!isApp && !isRev && <X size={11} />}
              <span>{r.kyc_status || 'UNDER_REVIEW'}</span>
            </span>
            {r.verified_by && (
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '3px' }}>
                Verified by: {r.verified_by}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Statutory Action',
      accessor: 'action',
      render: (r) => (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => handleOpenReview(r)}
          style={{
            background: r.kyc_status === 'UNDER_REVIEW' ? '#C2410C' : '#0F766E',
            borderColor: r.kyc_status === 'UNDER_REVIEW' ? '#C2410C' : '#0F766E',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: '700'
          }}
        >
          <UserCheck size={13} />
          <span>{r.kyc_status === 'UNDER_REVIEW' ? 'Verify Credentials' : 'Re-verify Profile'}</span>
        </button>
      )
    }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.25s ease' }}>
      
      {/* Official Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
        color: '#FFFFFF',
        borderRadius: '10px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 4px 14px rgba(6, 78, 59, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <ShieldCheck size={15} />
              <span>State Department Jurisdiction • {currentStName} ({currentStCode})</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '900', margin: '6px 0 4px 0', letterSpacing: '-0.3px' }}>
              Contractor Registration & Statutory Verification
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.9, margin: 0, maxWidth: '720px', lineHeight: '1.5' }}>
              Review statutory credentials for infrastructure contractors registered in <strong>{currentStName}</strong>. 
              Once verified by your department, District Officers in {currentStName} will be authorized to allocate scheme projects to these contractors.
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '12px 18px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.85 }}>PENDING VERIFICATION</div>
            <div style={{ fontSize: '26px', fontWeight: '900', color: pendingCount > 0 ? '#FEF08A' : '#FFFFFF' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>Awaiting State Sanction</div>
          </div>
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div style={{
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: '8px',
          padding: '12px 18px',
          color: '#065F46',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          padding: '12px 18px',
          color: '#991B1B',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#DC2626" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top 4 Stat Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '22px' }}>
        <div 
          onClick={() => setStatusFilter('ALL')}
          style={{ 
            background: statusFilter === 'ALL' ? '#F0FDF4' : '#FFFFFF', 
            border: `2px solid ${statusFilter === 'ALL' ? '#059669' : '#E2E8F0'}`,
            borderRadius: '8px', 
            padding: '16px', 
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Registered in State</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>{totalCount}</div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px', fontWeight: '600' }}>All registered contractors</div>
        </div>

        <div 
          onClick={() => setStatusFilter('UNDER_REVIEW')}
          style={{ 
            background: statusFilter === 'UNDER_REVIEW' ? '#FFFBEB' : '#FFFFFF', 
            border: `2px solid ${statusFilter === 'UNDER_REVIEW' ? '#D97706' : '#E2E8F0'}`,
            borderRadius: '8px', 
            padding: '16px', 
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', textTransform: 'uppercase' }}>Under Review</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#B45309', marginTop: '4px' }}>{pendingCount}</div>
          <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px', fontWeight: '600' }}>Requires State Approval</div>
        </div>

        <div 
          onClick={() => setStatusFilter('APPROVED')}
          style={{ 
            background: statusFilter === 'APPROVED' ? '#ECFDF5' : '#FFFFFF', 
            border: `2px solid ${statusFilter === 'APPROVED' ? '#059669' : '#E2E8F0'}`,
            borderRadius: '8px', 
            padding: '16px', 
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>Approved & Eligible</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#047857', marginTop: '4px' }}>{approvedCount}</div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px', fontWeight: '600' }}>Eligible for District Projects</div>
        </div>

        <div 
          onClick={() => setStatusFilter('REJECTED')}
          style={{ 
            background: statusFilter === 'REJECTED' ? '#FEF2F2' : '#FFFFFF', 
            border: `2px solid ${statusFilter === 'REJECTED' ? '#DC2626' : '#E2E8F0'}`,
            borderRadius: '8px', 
            padding: '16px', 
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' }}>Rejected</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#B91C1C', marginTop: '4px' }}>{rejectedCount}</div>
          <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '2px', fontWeight: '600' }}>Ineligible for allocation</div>
        </div>
      </div>

      {/* Contractor Table Card */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {currentStName} Contractor Eligibility Roster
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              Showing {filteredContractors.length} contractors registered within {currentStName}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: statusFilter === st ? '1px solid #065F46' : '1px solid #E2E8F0',
                  background: statusFilter === st ? '#E6F4EA' : '#FFFFFF',
                  color: statusFilter === st ? '#065F46' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            Loading contractors in {currentStName}...
          </div>
        ) : filteredContractors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
            <Building2 size={36} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#334155', margin: 0 }}>No contractors found for filter: {statusFilter}</h4>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              New contractors who register and select <strong>{currentStName}</strong> will appear here for statutory verification.
            </p>
          </div>
        ) : (
          <DataTable columns={columns} data={filteredContractors} />
        )}
      </div>

      {/* Statutory Review & Verification Modal */}
      {selectedContractor && (
        <Modal 
          title={`State Department Statutory Verification: ${selectedContractor.company_name}`}
          isOpen={!!selectedContractor}
          onClose={() => setSelectedContractor(null)}
        >
          <form onSubmit={handleReviewSubmit}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Legal Entity Name:</span>
                  <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{selectedContractor.company_name}</div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>State of Operation:</span>
                  <div style={{ fontWeight: '800', color: '#1D4ED8', marginTop: '2px' }}>
                    {selectedContractor.state_name || currentStName} ({selectedContractor.state_code || currentStCode})
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>GSTIN Number:</span>
                  <div style={{ fontWeight: '800', fontFamily: 'monospace', color: '#0F172A', marginTop: '2px' }}>
                    {selectedContractor.gst_number || '29AABCU9603R1ZM'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>Company PAN:</span>
                  <div style={{ fontWeight: '800', fontFamily: 'monospace', color: '#0F172A', marginTop: '2px' }}>
                    {selectedContractor.pan_number || 'AABCU9603R'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>PWD Contractor License:</span>
                  <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                    {selectedContractor.license_number || 'PWD/CLASS-1'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64748B' }}>Infrastructure Track Record:</span>
                  <div style={{ fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                    {selectedContractor.experience_years || 5} Years Experience
                  </div>
                </div>
              </div>

              {selectedContractor.email && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', fontSize: '12px' }}>
                  <span style={{ color: '#64748B' }}>Corporate Contact: </span>
                  <strong style={{ color: '#0F172A' }}>{selectedContractor.email}</strong>
                  {selectedContractor.contact_name && ` (${selectedContractor.contact_name})`}
                </div>
              )}
            </div>

            {/* Verification Verdict Radios */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>
                State Department Verdict *
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${reviewAction === 'APPROVED' ? '#059669' : '#E2E8F0'}`,
                  background: reviewAction === 'APPROVED' ? '#ECFDF5' : '#FFFFFF',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="verdict"
                    value="APPROVED"
                    checked={reviewAction === 'APPROVED'}
                    onChange={() => setReviewAction('APPROVED')}
                    style={{ accentColor: '#059669' }}
                  />
                  <div>
                    <div style={{ fontWeight: '800', color: '#065F46', fontSize: '13px' }}>Approve Registration</div>
                    <div style={{ fontSize: '11px', color: '#047857' }}>Permits District Officers in {currentStName} to allocate projects</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${reviewAction === 'REJECTED' ? '#DC2626' : '#E2E8F0'}`,
                  background: reviewAction === 'REJECTED' ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="verdict"
                    value="REJECTED"
                    checked={reviewAction === 'REJECTED'}
                    onChange={() => setReviewAction('REJECTED')}
                    style={{ accentColor: '#DC2626' }}
                  />
                  <div>
                    <div style={{ fontWeight: '800', color: '#991B1B', fontSize: '13px' }}>Reject Registration</div>
                    <div style={{ fontSize: '11px', color: '#B91C1C' }}>Blocks project allocation in this state</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Official Remarks */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>
                State Department Verification Remarks / Statutory Endorsement
              </label>
              <textarea
                className="form-control"
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter verification notes, statutory compliance numbers, or rejection rationale..."
                required
                style={{ fontSize: '12px' }}
              />
            </div>

            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '11px',
              color: '#1E40AF',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldCheck size={16} color="#2563EB" />
              <span>
                Verifying grants eligibility exclusively within <strong>{currentStName}</strong>. District Officers in other states will not see this contractor.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedContractor(null)}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: reviewAction === 'APPROVED' ? '#065F46' : '#DC2626',
                  borderColor: reviewAction === 'APPROVED' ? '#065F46' : '#DC2626',
                  fontWeight: '800',
                  padding: '9px 20px'
                }}
                disabled={submitting}
              >
                <Award size={15} />
                <span>{submitting ? 'Submitting Verification...' : `Confirm ${reviewAction} by State Dept`}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default StateContractorVerification;
