import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Shield, Menu, ExternalLink, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import API from '../services/api';
import RoleAccessModal from './RoleAccessModal';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeFY, setActiveFY] = useState('2026-27');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/public/financial-years')
      .then((res) => {
        if (res.success && res.financial_years?.length > 0) {
          const act = res.financial_years.find((f) => f.status === 'ACTIVE') || res.financial_years[0];
          if (act) setActiveFY(act.year);
        }
      })
      .catch(() => {});
  }, [user]);

  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'SUPER_ADMIN': return '/admin/dashboard';
      case 'FINANCE': return '/finance/dashboard';
      case 'STATE': return '/state/dashboard';
      case 'DISTRICT': return '/district/dashboard';
      case 'CONTRACTOR': return '/contractor/dashboard';
      case 'AUDITOR': return '/auditor/dashboard';
      default: return '/';
    }
  };

  const getJurisdictionTag = () => {
    if (!user) return null;
    if (user.district_name) return user.district_name;
    if (user.state_code) return user.state_name || user.state_code;
    return null;
  };

  return (
    <>
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <button
              onClick={onToggleSidebar}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              title="Toggle Navigation Menu"
            >
              <Menu size={20} />
            </button>
          )}

          <Link to={getDashboardPath()} className="navbar-brand">
            <div className="navbar-emblem">GF</div>
            <div>
              <div className="navbar-title">Government Fund Allocation Tracking</div>
            </div>
          </Link>
        </div>

        <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && (
            <>
              {/* Active Financial Year Indicator */}
              <Link to={user?.role === 'SUPER_ADMIN' ? "/admin/financial-years" : "#"} className="fy-pill" style={{ textDecoration: 'none', color: 'inherit' }} title="Current Active Financial Year Cycle">
                <Calendar size={13} />
                <span>FY {activeFY}</span>
              </Link>

              <Link to="/notifications" style={{ position: 'relative', color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    background: 'var(--color-danger)',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: '800',
                    borderRadius: '10px',
                    padding: '1px 5px',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>

              <span className="role-pill">
                {user.role?.replace(/_/g, ' ')}
              </span>

              {getJurisdictionTag() && (
                <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {getJurisdictionTag()}
                </span>
              )}

              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: '600' }}>
                <User size={16} color="var(--color-primary)" />
                <span>{user.name?.split(' ')[0]}</span>
              </Link>

              <button
                onClick={logout}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                title="Sign Out of Session"
              >
                <LogOut size={16} />
                <span>Exit</span>
              </button>
            </>
          )}

          {/* Top-Right 3-Line Hamburger Menu Button to Access All Roles in Columns */}
          <button
            onClick={() => setShowRoleModal(true)}
            style={{
              background: '#FFFFFF',
              border: '1.5px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '700',
              fontSize: '13px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-primary-bg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
            title="Access All Roles & Portals"
          >
            <Menu size={20} strokeWidth={2.5} />
            <span style={{ fontSize: '12px' }}>Portals</span>
          </button>
        </div>
      </header>

      {/* Roles & Portals Mega-Modal */}
      <RoleAccessModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </>
  );
};

export default Navbar;
