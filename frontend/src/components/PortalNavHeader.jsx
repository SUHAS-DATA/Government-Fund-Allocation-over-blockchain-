import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Landmark, 
  Building, 
  Briefcase, 
  Globe, 
  ShieldCheck
} from 'lucide-react';
import { getActivePortal, PORTAL_DETAILS } from '../config/portalConfig';

export const PORTALS_LIST = [
  {
    id: 'ADMIN',
    path: '/admin-portal',
    label: 'Admin Portal',
    sublabel: 'Super Admin & Finance',
    icon: Landmark,
    color: '#1E3A8A'
  },
  {
    id: 'FIELD',
    path: '/field-portal',
    label: 'Field Portal',
    sublabel: 'State & District',
    icon: Building,
    color: '#0284C7'
  },
  {
    id: 'CONTRACTOR',
    path: '/contractor-portal',
    label: 'Contractor Portal',
    sublabel: 'Registration & Login',
    icon: Briefcase,
    color: '#EA580C'
  },
  {
    id: 'PUBLIC',
    path: '/public',
    label: 'Public Portal',
    sublabel: 'Citizen Tracking • No Login',
    icon: Globe,
    color: '#059669'
  }
];

const PortalNavHeader = ({ currentPortal }) => {
  const location = useLocation();
  const activePortal = getActivePortal();

  // If running in a dedicated portal deployment, show only that portal's banner
  if (activePortal && activePortal !== 'INVALID') {
    const details = PORTAL_DETAILS[activePortal];
    const portalItem = PORTALS_LIST.find(p => p.id === activePortal) || PORTALS_LIST[0];
    const Icon = portalItem.icon;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '10px 18px',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-xs)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: `${portalItem.color}15`,
            color: portalItem.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={16} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main)' }}>
            {details?.title || portalItem.label}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            color: portalItem.color,
            backgroundColor: `${portalItem.color}10`,
            padding: '2px 8px',
            borderRadius: '10px',
            border: `1px solid ${portalItem.color}30`
          }}>
            {details?.badge}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Switch Portal:
          </span>
          {PORTALS_LIST.map((p) => {
            const isCur = activePortal === p.id;
            const PIcon = p.icon;
            return (
              <a
                key={p.id}
                href={`/?portal=${p.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  try { sessionStorage.setItem('VITE_PORTAL_ACTIVE', p.id); } catch (err) {}
                  window.location.href = `/?portal=${p.id}`;
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: isCur ? '800' : '600',
                  color: isCur ? '#FFFFFF' : p.color,
                  backgroundColor: isCur ? p.color : `${p.color}12`,
                  border: `1px solid ${isCur ? p.color : `${p.color}35`}`,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={`Switch to ${p.label}`}
              >
                <PIcon size={12} />
                <span>{p.label.replace(' Portal', '')}</span>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback if no specific portal is enforced
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '10px 16px',
      backgroundColor: '#FFFFFF',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-xs)',
      marginBottom: '24px'
    }}>
      <Link
        to="/portals"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--color-primary)',
          fontSize: '12px',
          fontWeight: '700',
          textDecoration: 'none',
          padding: '6px 12px',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary-border)',
          transition: 'all 0.15s ease'
        }}
        title="View All 5 Portals Directory"
      >
        <ArrowLeft size={14} />
        <span>Back to Portals</span>
      </Link>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
          Switch Portal:
        </span>
        {PORTALS_LIST.map((p) => {
          const isActive = location.pathname === p.path || currentPortal?.toUpperCase() === p.id;
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              to={p.path}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: isActive ? '800' : '600',
                textDecoration: 'none',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                backgroundColor: isActive ? p.color : '#F1F5F9',
                border: isActive ? `1px solid ${p.color}` : '1px solid var(--border-color)',
                transition: 'all 0.15s ease'
              }}
              title={`${p.label} (${p.sublabel})`}
            >
              <Icon size={12} />
              <span>{p.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default PortalNavHeader;
