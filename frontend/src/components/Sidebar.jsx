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
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.role;

  const renderNavLinks = () => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <>
            <div className="sidebar-header">Planning & Master Data</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/admin" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/admin/financial-years" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Calendar size={16}/><span>Financial Years</span></NavLink></li>
              <li><NavLink to="/admin/departments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Building2 size={16}/><span>Departments</span></NavLink></li>
              <li><NavLink to="/admin/states-districts" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><MapPin size={16}/><span>States & Districts</span></NavLink></li>
              <li><NavLink to="/admin/schemes" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileSpreadsheet size={16}/><span>National Schemes</span></NavLink></li>
            </ul>

            <div className="sidebar-header">Fund Allocation & Movement</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/admin/budget-allocation" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Budget Allocation</span></NavLink></li>
              <li><NavLink to="/admin/send-to-finance" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>Send to Finance</span></NavLink></li>
            </ul>

            <div className="sidebar-header">Security & Blockchain</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/admin/users" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Users size={16}/><span>Users & Access</span></NavLink></li>
              <li><NavLink to="/admin/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Blockchain Explorer</span></NavLink></li>
              <li><NavLink to="/admin/audit-reports" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><ShieldCheck size={16}/><span>CAG Audit Reports</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'FINANCE':
        return (
          <>
            <div className="sidebar-header">Disbursal Operations</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/finance" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/finance/received-budgets" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Received Budgets</span></NavLink></li>
              <li><NavLink to="/finance/transfers" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>State Disbursals</span></NavLink></li>
              <li><NavLink to="/finance/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Disbursal History</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'STATE':
        return (
          <>
            <div className="sidebar-header">State Treasury ({user.state_name || user.state_code || 'State'})</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/department" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/state/received-funds" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Received Funds</span></NavLink></li>
              <li><NavLink to="/state/allocations" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>District Allocation</span></NavLink></li>
              <li><NavLink to="/state/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Allocation History</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'DISTRICT':
      case 'DEPARTMENT':
        return (
          <>
            <div className="sidebar-header">District Development Agency</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/department" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/district/projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={16}/><span>Projects & Funds</span></NavLink></li>
              <li><NavLink to="/district/contractors" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><UserCheck size={16}/><span>Contractor Verification</span></NavLink></li>
              <li><NavLink to="/district/grievances" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><MessageSquareWarning size={16}/><span>Complaints Inbox</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'CONTRACTOR':
        return (
          <>
            <div className="sidebar-header">Contractor Portal</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/contractor/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/contractor/my-projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={16}/><span>My Projects & 3 Phases</span></NavLink></li>
              <li><NavLink to="/contractor/kyc" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileCheck size={16}/><span>Business Profile & KYC</span></NavLink></li>
              <li><NavLink to="/contractor/payments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><CreditCard size={16}/><span>Payment Receipts</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'AUDITOR':
        return (
          <>
            <div className="sidebar-header">CAG Forensic Cell</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/auditor" end className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/auditor/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Blockchain Ledger</span></NavLink></li>
              <li><NavLink to="/auditor/document-audit" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileSearch size={16}/><span>Document Verification</span></NavLink></li>
              <li><NavLink to="/auditor/anomalies" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><AlertTriangle size={16}/><span>Forensic Anomaly Check</span></NavLink></li>
              <li><NavLink to="/auditor/fraud-freeze" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Lock size={16}/><span>Report Fraud & Freeze</span></NavLink></li>
              <li><NavLink to="/auditor/submit-report" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><ShieldCheck size={16}/><span>Submit CAG Report</span></NavLink></li>
            </ul>

            <div className="sidebar-header">System</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <aside className="sidebar">
      <div style={{ flex: 1, paddingBottom: '16px' }}>
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
