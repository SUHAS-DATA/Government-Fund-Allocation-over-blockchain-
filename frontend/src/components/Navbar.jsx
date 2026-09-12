import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, LogOut, User, Shield, Menu, ExternalLink, Calendar, RefreshCw, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import API from '../services/api';
import RoleAccessModal from './RoleAccessModal';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [activeFY, setActiveFY] = useState('2026-27');
  const [financialYears, setFinancialYears] = useState([]);
  const [showFyDropdown, setShowFyDropdown] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [activatingYear, setActivatingYear] = useState(null);
  const fyDropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchActiveFY = () => {
    API.get('/public/financial-years')
      .then((res) => {
        if (res.success && res.financial_years?.length > 0) {
          setFinancialYears(res.financial_years);
          const act = res.financial_years.find((f) => String(f.status).toUpperCase() === 'ACTIVE')
                   || res.financial_years[0];
          if (act && act.year) {
            setActiveFY(act.year);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchActiveFY();
  }, [user, location.pathname]);

  useEffect(() => {
    const handleFyUpdate = (e) => {
      if (e.detail?.year) {
        setActiveFY(e.detail.year);
      }
      fetchActiveFY();
    };

    window.addEventListener('active-fy-updated', handleFyUpdate);
    window.addEventListener('focus', fetchActiveFY);

    const handleClickOutside = (e) => {
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(e.target)) {
        setShowFyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('active-fy-updated', handleFyUpdate);
      window.removeEventListener('focus', fetchActiveFY);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleQuickActivateFY = async (year) => {
    if (user?.role !== 'SUPER_ADMIN') return;
    setActivatingYear(year);
    try {
      const res = await API.put(`/admin/financial-years/${year}/activate`, {});
      if (res.success) {
        setActiveFY(year);
        window.dispatchEvent(new CustomEvent('active-fy-updated', { detail: { year } }));
        fetchActiveFY();
        setShowFyDropdown(false);
      }
    } catch (e) {
      alert(e.message || 'Failed to activate financial year');
    } finally {
      setActivatingYear(null);
    }
  };

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
              {/* Active Financial Year Indicator & Quick Switcher */}
              <div style={{ position: 'relative' }} ref={fyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowFyDropdown(!showFyDropdown)}
                  className="fy-pill"
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-primary)',
                    fontWeight: '700',
                    fontSize: '12px'
                  }}
                  title="Current Active Financial Year Cycle (Click to view/switch)"
                >
                  <Calendar size={13} color="var(--color-primary)" />
                  <span>FY {activeFY}</span>
                  <ChevronDown size={12} color="var(--text-muted)" style={{ transform: showFyDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                </button>

                {showFyDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '300px',
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          National Budget Cycle
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                          Active: <span style={{ color: 'var(--color-primary)' }}>FY {activeFY}</span>
                        </div>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>ACTIVE</span>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {financialYears.map((fy) => {
                        const isActive = fy.year === activeFY;
                        return (
                          <div
                            key={fy.year}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                              border: isActive ? '1px solid var(--color-accent)' : '1px solid transparent'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: isActive ? 'var(--color-primary)' : 'var(--text-main)' }}>
                                FY {fy.year}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {fy.title || 'Budget Cycle'}
                              </div>
                            </div>

                            {isActive ? (
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Check size={12} /> Active
                              </span>
                            ) : (
                              user?.role === 'SUPER_ADMIN' && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickActivateFY(fy.year)}
                                  disabled={activatingYear === fy.year}
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: '10px', padding: '2px 6px', height: '24px' }}
                                >
                                  {activatingYear === fy.year ? '...' : 'Set Active'}
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {user?.role === 'SUPER_ADMIN' && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                        <Link
                          to="/admin/financial-years"
                          onClick={() => setShowFyDropdown(false)}
                          style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>Manage All Financial Years</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
