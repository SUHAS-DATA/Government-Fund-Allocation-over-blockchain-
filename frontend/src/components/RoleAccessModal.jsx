import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  ExternalLink,
  Zap,
  Layers,
  ChevronRight,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { USER_ROLES_CONFIG } from './UserTypeSelector';

const RoleAccessModal = ({ isOpen, onClose }) => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loggingInRole, setLoggingInRole] = useState(null);

  if (!isOpen) return null;

  const handleQuickLogin = async (roleObj) => {
    if (roleObj.isPublic) {
      onClose();
      navigate('/public/projects');
      return;
    }
    setLoggingInRole(roleObj.id);
    try {
      const res = await login(roleObj.defaultEmail, roleObj.defaultPassword);
      onClose();
      if (res.success) {
        navigate(roleObj.dashboardTarget);
      } else {
        navigate(roleObj.loginTarget);
      }
    } catch {
      onClose();
      navigate(roleObj.loginTarget);
    } finally {
      setLoggingInRole(null);
    }
  };

  const handleManualLogin = (target) => {
    onClose();
    navigate(target);
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
          maxWidth: '1150px',
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
              backgroundColor: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.3px' }}>
                Government Fund Portals & Role Access
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Select any administrative tier or citizen role below for instant 1-Click Access or credential login.
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

        {/* Modal Body: Multi-column Role Cards */}
        <div style={{
          padding: '24px 28px',
          overflowY: 'auto',
          flex: 1
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {USER_ROLES_CONFIG.map((role) => {
              const IconComp = role.icon;
              const isCurrentRole = user && user.role === role.id;
              const isLoggingThis = loggingInRole === role.id;

              return (
                <div
                  key={role.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: `1.5px solid ${isCurrentRole ? role.accentColor : 'var(--border-color)'}`,
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isCurrentRole 
                      ? `0 4px 12px ${role.lightBg || 'rgba(0,0,0,0.05)'}`
                      : 'var(--shadow-sm)',
                    position: 'relative',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  {/* Top Bar: Icon + Badge */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: role.lightBg || 'rgba(0,0,0,0.04)',
                        border: `1px solid ${role.borderColor || '#E2E8F0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: role.accentColor
                      }}>
                        <IconComp size={20} />
                      </div>

                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: role.lightBg || '#F1F5F9',
                        color: role.accentColor,
                        border: `1px solid ${role.borderColor || '#E2E8F0'}`
                      }}>
                        {role.tier || role.badge}
                      </span>
                    </div>

                    {/* Role Title & Description */}
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                          {role.title}
                        </h3>
                        {isCurrentRole && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            backgroundColor: 'var(--color-success)',
                            color: '#FFFFFF',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: role.accentColor, marginTop: '2px' }}>
                        {role.roleLabel}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: '8px 0 0 0',
                        lineHeight: '1.45',
                        minHeight: '36px'
                      }}>
                        {role.description}
                      </p>
                    </div>

                    {/* Default Credentials Snippet (if non-public) */}
                    {!role.isPublic && (
                      <div style={{
                        background: '#F8FAFC',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginBottom: '14px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>ID: <strong>{role.defaultEmail.split('@')[0]}</strong></span>
                        <span>Pass: <strong>{role.defaultPassword}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Actions: 1-Click Login + Standard Link */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      onClick={() => handleQuickLogin(role)}
                      disabled={isLoggingThis}
                      style={{
                        flex: 1,
                        backgroundColor: role.accentColor,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Zap size={14} fill="#FFFFFF" />
                      <span>{isLoggingThis ? 'Accessing...' : role.isPublic ? 'Open Explorer' : '1-Click Login'}</span>
                    </button>

                    {!role.isPublic && (
                      <button
                        onClick={() => handleManualLogin(role.loginTarget)}
                        style={{
                          backgroundColor: '#FFFFFF',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = role.accentColor}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        title="Open Custom Login Screen"
                      >
                        <Lock size={13} />
                        <span>Portal</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleAccessModal;
