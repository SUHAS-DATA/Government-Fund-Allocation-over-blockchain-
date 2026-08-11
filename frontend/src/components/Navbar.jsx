import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Shield, Menu, ExternalLink, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import API from '../services/api';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeFY, setActiveFY] = useState('2026-27');
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
          <div className="navbar-emblem">PF</div>
          <div>
            <div className="navbar-title">PFMS Blockchain Ledger</div>
            <div className="navbar-subtitle">Public Financial Management & Forensic Audit System</div>
          </div>
        </Link>
      </div>

      <div className="navbar-right">
        {/* Active Financial Year Indicator */}
        <Link to={user?.role === 'SUPER_ADMIN' ? "/admin/financial-years" : "#"} className="fy-pill" style={{ textDecoration: 'none', color: 'inherit' }} title="Current Active Financial Year Cycle">
          <Calendar size={13} />
          <span>FY {activeFY}</span>
        </Link>

        {user ? (
          <>
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

            <Link
              to="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-primary-bg)',
                border: '1px solid var(--color-primary-border)'
              }}
              title="Switch Government Portal Role"
            >
              <RefreshCw size={12} />
              <span>Switch Portal</span>
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
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/public/projects" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Public Tracking</span>
            </Link>
            <Link to="/district-login" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #DDD6FE', color: '#7C3AED', background: 'rgba(124, 58, 237, 0.05)' }}>
              <span>District Login</span>
            </Link>
            <Link to="/contractor-login" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #FED7AA', color: '#C2410C', background: 'rgba(194, 65, 12, 0.05)' }}>
              <span>Contractor Login</span>
            </Link>
            <Link to="/select-user-type" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>All Portals</span>
            </Link>
            <Link to="/login" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Login Gateway</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
