import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Layers, 
  Globe,
  Landmark,
  Building,
  Briefcase,
  Search,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PORTALS_DIRECTORY } from './UserTypeSelector';

const RoleAccessModal = ({ isOpen, onClose }) => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loggingInRole, setLoggingInRole] = useState(null);

  if (!isOpen) return null;

  const handleQuickLogin = async (roleObj) => {
    if (roleObj.isPublic) {
      onClose();
      navigate('/public');
      return;
    }
    setLoggingInRole(roleObj.id);
    try {
      const res = await login(roleObj.defaultEmail, roleObj.defaultPassword);
      onClose();
      if (res.success) {
        navigate(roleObj.targetDashboard || roleObj.dashboardTarget);
      } else {
        navigate(roleObj.portalUrl || roleObj.loginTarget);
      }
    } catch {
      onClose();
      navigate(roleObj.portalUrl || roleObj.loginTarget);
    } finally {
      setLoggingInRole(null);
    }
  };

  const handleOpenPortal = (url) => {
    onClose();
    navigate(url);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '1100px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tricolor Accent Stripe on Modal */}
        <div className="tricolor-stripe" />

        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary-border)'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.3px' }}>
                5 Government Portals Directory
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Direct entry points for each governance level. Each portal displays only its permitted roles.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#E2E8F0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#F1F5F9'}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: 5 Portal Cards */}
        <div style={{
          padding: '24px 28px',
          overflowY: 'auto',
          flex: 1
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '16px'
          }}>
            {PORTALS_DIRECTORY.map((portal) => {
              const IconComp = portal.icon;

              return (
                <div
                  key={portal.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderTop: `4px solid ${portal.accentColor}`,
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)',
                    position: 'relative',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  <div>
                    {/* Top Bar: Icon + Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: portal.lightBg,
                        border: `1px solid ${portal.borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: portal.accentColor
                      }}>
                        <IconComp size={20} />
                      </div>

                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: portal.lightBg,
                        color: portal.accentColor,
                        border: `1px solid ${portal.borderColor}`
                      }}>
                        {portal.badge}
                      </span>
                    </div>

                    {/* Portal Title & Description */}
                    <div style={{ marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                        {portal.portalName}
                      </h3>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: portal.accentColor, marginTop: '2px' }}>
                        {portal.portalUrl}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: '8px 0 0 0',
                        lineHeight: '1.45',
                        minHeight: '36px'
                      }}>
                        {portal.description}
                      </p>
                    </div>

                    {/* Allowed Roles in Portal */}
                    <div style={{
                      background: '#F8FAFC',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginBottom: '14px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {portal.isPublic ? 'Public Features:' : 'Allowed Roles:'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {portal.allowedRoles?.map((r) => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-main)', fontWeight: '600' }}>
                            <span>• {r.name}</span>
                            <button
                              type="button"
                              onClick={() => handleQuickLogin(r)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: portal.accentColor,
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '1px 4px',
                                borderRadius: '3px'
                              }}
                              disabled={loggingInRole === r.id}
                            >
                              {loggingInRole === r.id ? 'Logging in...' : '1-Click'}
                            </button>
                          </div>
                        ))}
                        {portal.features?.slice(0, 3).map((f, i) => (
                          <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            • {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Open Portal Link */}
                  <button
                    type="button"
                    onClick={() => handleOpenPortal(portal.portalUrl)}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      backgroundColor: portal.accentColor,
                      borderColor: portal.accentColor,
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Open {portal.portalName}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="var(--color-success)" />
            <span>Strict Role-Based Routing & Session Isolation</span>
          </div>

          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            style={{ fontSize: '12px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleAccessModal;
