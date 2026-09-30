import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Coins,
  MapPin,
  Clock,
  ExternalLink,
  QrCode,
  Download,
  FileCheck,
  Activity,
  Layers,
  ArrowLeft,
  Share2,
  Info,
  Calendar
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatTxHash } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';

const PublicVerificationPage = () => {
  const { qrId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!qrId) {
      setErrorMsg('No QR verification code provided in URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    API.get(`/public/qr/verify/${encodeURIComponent(qrId)}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Error verifying QR:', err);
        setErrorMsg(err.message || 'Failed to verify QR code with the National Blockchain Registry.');
        if (err.response?.data) {
          setData(err.response.data);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [qrId]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQr = () => {
    if (!data?.qr?.qr_image_data) return;
    const link = document.createElement('a');
    link.href = data.qr.qr_image_data;
    link.download = `${data.contract?.contract_id || qrId}_Verified_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          border: '4px solid #E2E8F0',
          borderTopColor: '#0284C7',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
          Verifying Official Public Record...
        </h3>
        <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px' }}>
          Validating QR identifier against the Government Decentralized Public Ledger and State Treasury records.
        </p>
      </div>
    );
  }

  // Case 1: Unrecognized or completely invalid QR
  if (!data || (!data.is_valid && data.status === 'UNRECOGNIZED')) {
    return (
      <div style={{ maxWidth: '640px', margin: '60px auto', padding: '0 20px' }}>
        <div className="card" style={{
          textAlign: 'center',
          padding: '40px 28px',
          borderTop: '5px solid #EF4444',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08)'
        }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: '#FEF2F2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto'
          }}>
            <XCircle size={38} />
          </div>
          <span className="badge badge-danger" style={{ fontSize: '12px', padding: '6px 14px', marginBottom: '12px' }}>
            TAMPER / UNREGISTERED QR ALERT
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991B1B', margin: '8px 0' }}>
            Unrecognized Government Identifier
          </h2>
          <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6', margin: '10px 0 24px 0' }}>
            The scanned QR code token (<code>{qrId}</code>) does not match any officially awarded and accepted project in the National Blockchain Ledger.
          </p>
          <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', fontSize: '12px', color: '#475569', marginBottom: '24px' }}>
            <strong>Security Advisory:</strong> Official public notices must be authenticated directly through registered public portals. Do not trust static printed data that cannot be verified on this registry.
          </div>
          <Link to="/public/projects" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} />
            <span>Browse Official Public Projects Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  // Case 2: Inactive or Invalidated QR (e.g. project declined or cancelled or frozen)
  if (!data.is_valid && data.status === 'INVALID') {
    return (
      <div style={{ maxWidth: '780px', margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{
          padding: '36px 30px',
          borderTop: '5px solid #F59E0B',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', marginBottom: '20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FFFBEB',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={32} />
            </div>
            <div>
              <span className="badge badge-warning" style={{ fontSize: '11px', padding: '4px 10px', fontWeight: '800' }}>
                STATUS: INACTIVE / INVALID QR
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#92400E', margin: '6px 0 4px 0' }}>
                Contract or Project Invalidation Notice
              </h2>
              <div style={{ fontSize: '13px', color: '#78350F' }}>
                This QR code was previously created, but the underlying project/contract has been revoked, declined, or invalidated.
              </div>
            </div>
          </div>

          <div style={{
            background: '#FEF3C7',
            border: '1.5px solid #FCD34D',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '24px'
          }}>
            <div style={{ fontWeight: '800', color: '#78350F', fontSize: '13px', marginBottom: '4px' }}>
              Official Invalidation Reason:
            </div>
            <div style={{ fontSize: '13px', color: '#92400E' }}>
              {data.invalidation_reason || 'Contractor declined assignment or project was administratively halted by District Authority.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Project ID:</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{data.project_id}</div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Contract ID:</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{data.contract_id || 'N/A'}</div>
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>District Jurisdiction:</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{data.district_name || 'District Authority'}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link to="/public/projects" className="btn btn-secondary">
              Return to Public Transparency Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Official Active & Verified Project!
  const { project, contract, contractor, finances, milestones, blockchain_transactions, qr } = data;

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '36px 20px 60px 20px' }}>
      
      {/* Top Navigation Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' }}>
        <Link to="/public/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
          <ArrowLeft size={15} />
          <span>National Public Transparency Directory</span>
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Share2 size={13} />
            <span>{copied ? 'Link Copied!' : 'Share Verification'}</span>
          </button>
          {qr?.qr_image_data && (
            <button className="btn btn-outline btn-sm" onClick={handleDownloadQr} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Download size={13} />
              <span>Save Official QR</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Government Verification Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '28px 32px',
        boxShadow: '0 20px 25px -5px rgba(5, 150, 105, 0.25)',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background seal decoration */}
        <div style={{
          position: 'absolute',
          right: '-20px',
          bottom: '-30px',
          opacity: 0.12,
          pointerEvents: 'none'
        }}>
          <ShieldCheck size={240} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '650px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', padding: '5px 14px', borderRadius: '24px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '14px' }}>
              <CheckCircle2 size={14} color="#A7F3D0" />
              <span>Officially Verified Public Contract • ACTIVE</span>
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 8px 0', lineHeight: 1.3, color: '#FFFFFF' }}>
              {project?.name}
            </h1>

            <div style={{ fontSize: '14px', color: '#D1FAE5', lineHeight: 1.6, marginBottom: '14px' }}>
              <strong>Scheme:</strong> {project?.scheme_name} • <strong>Jurisdiction:</strong> {project?.district_name}, {project?.state_name}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', fontSize: '12px', color: '#A7F3D0' }}>
              <div>Contract ID: <strong style={{ color: '#FFFFFF' }}>{contract?.contract_id}</strong></div>
              <div>Project ID: <strong style={{ color: '#FFFFFF' }}>{project?.project_id}</strong></div>
              <div>QR ID: <strong style={{ color: '#FFFFFF' }}>{qr?.qr_id}</strong></div>
            </div>
          </div>

          {/* Scanned QR Visual Thumbnail */}
          {qr?.qr_image_data && (
            <div style={{
              background: '#FFFFFF',
              padding: '10px',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}>
              <img
                src={qr.qr_image_data}
                alt="Verified QR Code"
                style={{ width: '105px', height: '105px', display: 'block', borderRadius: '6px' }}
              />
              <span style={{ fontSize: '9px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '6px', letterSpacing: '0.04em' }}>
                GENUINE QR SEAL
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3-Card Financial Transparency Summary */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid #0284C7' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Contract Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A', marginTop: '4px' }}>
            {formatCurrency(finances?.total_budget || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Sanctioned Public Budget
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid #16A34A' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Disbursed Funds
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#16A34A', marginTop: '4px' }}>
            {formatCurrency(finances?.released_amount || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Released against Audited Proofs
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid #6366F1' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Remaining Escrow Balance
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#4F46E5', marginTop: '4px' }}>
            {formatCurrency(finances?.remaining_balance || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Locked on Smart Contract
          </div>
        </div>
      </div>

      {/* Contractor & Public Acceptance Verification Card */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: '24px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>
                Awarded & Accepted Contractor
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                {contractor?.company_name || 'Registered Government Contractor'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                Concessionaire ID: <strong>{contractor?.contractor_id}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px' }}>
              <CheckCircle2 size={13} />
              <span>CONTRACT ACCEPTED BY CONTRACTOR</span>
            </span>
            {contract?.accepted_at && (
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Accepted on: {new Date(contract.accepted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Physical Work Progress Bar */}
      <div className="card" style={{ padding: '24px 26px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontWeight: '800', fontSize: '15px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#0284C7" />
            <span>Audited Physical Work Progress</span>
          </span>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0284C7' }}>
            {project?.progress_percentage || 0}% Completed
          </span>
        </div>

        <div style={{ height: '12px', background: '#E2E8F0', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{
            width: `${project?.progress_percentage || 0}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0284C7 0%, #10B981 100%)',
            transition: 'width 0.4s ease'
          }} />
        </div>

        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
          {project?.description || 'Government public infrastructure development under National Flagship Scheme.'}
        </div>
      </div>

      {/* 3-Phase Sequential Milestone Verification */}
      <div className="card" style={{ padding: '24px 26px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#0284C7" />
            <span>Milestone Stages & Verification Log ({milestones?.length || 0} Phases)</span>
          </h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            * Sequential 30% • 40% • 30% standardized execution
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {milestones && milestones.length > 0 ? (
            milestones.map((m, idx) => {
              const isCompleted = m.status === 'COMPLETED' || m.status === 'RELEASED';
              return (
                <div key={idx} style={{
                  background: isCompleted ? '#F0FDF4' : '#F8FAFC',
                  border: isCompleted ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                        Phase #{m.phase_number || idx + 1} ({m.percentage_share || (idx === 1 ? 40 : 30)}%)
                      </span>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{m.title}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {m.description}
                    </div>
                    {m.proof_document_hash && (
                      <div style={{ fontSize: '11px', color: '#0284C7', marginTop: '4px', fontFamily: 'monospace' }}>
                        Proof Hash: {m.proof_document_hash}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '15px' }}>
                      {formatCurrency(m.amount)}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      {isCompleted ? (
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>✓ WORK VERIFIED & PAID</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '11px' }}>{m.status?.replace(/_/g, ' ') || 'SCHEDULED'}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
              Standard milestone phases are being initialized.
            </div>
          )}
        </div>
      </div>

      {/* Immutable Blockchain Ledger Receipts */}
      <div className="card" style={{ padding: '24px 26px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#16A34A" />
            <span>Immutable Blockchain Ledger Verifications</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            Decentralized Proof of Work & Escrow
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {project?.escrow_tx_hash && (
            <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '12px', color: '#0F172A' }}>Smart Contract Escrow Anchor</strong>
                <div style={{ fontSize: '11px', color: '#64748B' }}>On-chain project treasury ceiling commitment</div>
              </div>
              <BlockchainBadge txHash={project.escrow_tx_hash} />
            </div>
          )}

          {blockchain_transactions && blockchain_transactions.length > 0 ? (
            blockchain_transactions.map((tx, idx) => (
              <div key={idx} style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '12px', color: '#0F172A' }}>{tx.operation_type?.replace(/_/g, ' ')}</strong>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{tx.details}</div>
                </div>
                <BlockchainBadge txHash={tx.tx_hash} blockNumber={tx.block_number} />
              </div>
            ))
          ) : (
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
              Blockchain milestone release receipts will be cryptographically anchored upon each phase audit.
            </div>
          )}
        </div>
      </div>

      {/* Citizen Grievance & Report Portal Callout */}
      <div style={{
        background: '#FEF3C7',
        border: '1.5px solid #FDE68A',
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontWeight: '800', color: '#92400E', fontSize: '14px', marginBottom: '2px' }}>
            Notice Any Discrepancy or Construction Delay?
          </div>
          <div style={{ fontSize: '12px', color: '#B45309' }}>
            Citizens have the constitutional right to file a direct grievance on any government funded project.
          </div>
        </div>

        <Link
          to={`/public/grievance?project_id=${project?.project_id}&district=${project?.district_name}`}
          className="btn btn-warning"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>File Public Grievance</span>
        </Link>
      </div>

    </div>
  );
};

export default PublicVerificationPage;
