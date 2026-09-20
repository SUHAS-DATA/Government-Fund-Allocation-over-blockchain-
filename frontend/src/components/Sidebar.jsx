import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Building2, 
  MapPin, 
  FileSpreadsheet, 
  Coins, 
  Send, 
  Users, 
  Activity, 
  ShieldCheck, 
  Bell, 
  Settings, 
  FolderKanban, 
  UserCheck, 
  FileCheck, 
  CreditCard, 
  AlertTriangle, 
  Lock, 
  MessageSquareWarning, 
  FileSearch,
  LogOut,
  ShieldAlert,
  X,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ collapsed = false, mobileOpen = false, onCloseMobile }) => {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.role;

  const renderNavLinks = () => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <>
            <div className="sidebar-header">Core Operations</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/admin" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Dashboard">
                  <LayoutDashboard size={17} />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/schemes" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="National Schemes">
                  <FileSpreadsheet size={17} />
                  <span>Schemes</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/budget-allocation" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Fund Allocation">
                  <Coins size={17} />
                  <span>Fund Allocation</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/send-to-finance" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Approvals & Send to Finance">
                  <Send size={17} />
                  <span>Approvals</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/district/projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="National Projects Directory">
                  <FolderKanban size={17} />
                  <span>Projects</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Blockchain Ledger Explorer">
                  <Activity size={17} />
                  <span>Blockchain</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/audit-reports" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="CAG Forensic Reports & Audit Logs">
                  <ShieldAlert size={17} />
                  <span>Audit Logs & Reports</span>
                </NavLink>
              </li>
            </ul>

            <div className="sidebar-header">Master Data & Planning</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/admin/financial-years" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Financial Years">
                  <Calendar size={17} />
                  <span>Financial Years</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/departments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Ministries & Departments">
                  <Building2 size={17} />
                  <span>Departments</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/states-districts" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="States & Districts Hierarchy">
                  <MapPin size={17} />
                  <span>States & Districts</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/users" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="User Access Management">
                  <Users size={17} />
                  <span>Users & Access</span>
                </NavLink>
              </li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Notifications">
                  <Bell size={17} />
                  <span>Notifications</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Admin Profile & Settings">
                  <Settings size={17} />
                  <span>Settings</span>
                </NavLink>
              </li>
            </ul>
          </>
        );

      case 'FINANCE':
        return (
          <>
            <div className="sidebar-header">Financial Authority</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/finance" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Financial Overview">
                  <LayoutDashboard size={17} />
                  <span>Financial Overview</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/finance/received-budgets" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Pending Approvals & Budgets">
                  <Coins size={17} />
                  <span>Pending Approvals</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/finance/transfers" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Fund Allocation & Disbursal">
                  <Send size={17} />
                  <span>Fund Allocation</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/finance/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Disbursal History & Ledger">
                  <Activity size={17} />
                  <span>Transactions & History</span>
                </NavLink>
              </li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li>
                <NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Notifications">
                  <Bell size={17} />
                  <span>Notifications</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`} title="Profile & Settings">
                  <Settings size={17} />
                  <span>Settings</span>
                </NavLink>
              </li>
            </ul>
          </>
        );

      case 'STATE':
        return (
          <>
            <div className="sidebar-header">State Treasury ({user.state_name || user.state_code || 'State'})</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/department" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={17}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/state/received-funds" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={17}/><span>Received Funds</span></NavLink></li>
              <li><NavLink to="/state/allocations" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={17}/><span>District Allocation</span></NavLink></li>
              <li><NavLink to="/state/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={17}/><span>Allocation History</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={17}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={17}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'DISTRICT':
      case 'DEPARTMENT':
        return (
          <>
            <div className="sidebar-header">District Development Agency</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/department" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={17}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/district/projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={17}/><span>Projects & Funds</span></NavLink></li>
              <li><NavLink to="/district/contractors" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><UserCheck size={17}/><span>Contractor Verification</span></NavLink></li>
              <li><NavLink to="/district/grievances" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><MessageSquareWarning size={17}/><span>Complaints Inbox</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={17}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={17}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'CONTRACTOR':
        return (
          <>
            <div className="sidebar-header">Contractor Portal</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/contractor/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={17}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/contractor/my-projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={17}/><span>My Projects & 3 Phases</span></NavLink></li>
              <li><NavLink to="/contractor/kyc" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileCheck size={17}/><span>Business Profile & KYC</span></NavLink></li>
              <li><NavLink to="/contractor/payments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><CreditCard size={17}/><span>Payment Receipts</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={17}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={17}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'AUDITOR':
        return (
          <>
            <div className="sidebar-header">CAG Forensic Cell</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/auditor" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={17}/><span>Forensic Dashboard</span></NavLink></li>
              <li><NavLink to="/auditor/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={17}/><span>Blockchain Ledger</span></NavLink></li>
              <li><NavLink to="/auditor/document-audit" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileSearch size={17}/><span>Document Verification</span></NavLink></li>
              <li><NavLink to="/auditor/anomalies" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><AlertTriangle size={17}/><span>Forensic Anomaly Check</span></NavLink></li>
              <li><NavLink to="/auditor/fraud-freeze" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Lock size={17}/><span>Report Fraud & Freeze</span></NavLink></li>
              <li><NavLink to="/auditor/submit-report" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><ShieldCheck size={17}/><span>Submit CAG Report</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={17}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={17}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile-Only Header with Dismiss Button */}
      <div className="sidebar-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="navbar-emblem" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
            GOV
          </div>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
            PFMS Ledger
          </span>
        </div>
        <button
          onClick={onCloseMobile}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Close Navigation"
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, paddingBottom: '16px', overflowY: 'auto' }}>
        {renderNavLinks()}
      </div>

      {/* Official Status Dock at Bottom */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            boxShadow: '0 0 6px #10B981'
          }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Ledger Node Active
          </span>
        </div>

        <div style={{
          fontSize: '12px',
          fontWeight: '700',
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {user.name}
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
          {user.role?.replace(/_/g, ' ')}
        </div>

        <button
          onClick={logout}
          style={{
            marginTop: '12px',
            width: '100%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#FCA5A5',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.color = '#FCA5A5';
          }}
        >
          <LogOut size={13} />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
