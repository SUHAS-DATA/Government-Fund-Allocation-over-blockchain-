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
  HelpCircle,
  FileSearch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const renderNavLinks = () => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <>
            <div className="sidebar-header">Super Admin Controls</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/admin/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/admin/financial-years" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Calendar size={16}/><span>Financial Years</span></NavLink></li>
              <li><NavLink to="/admin/departments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Building2 size={16}/><span>Departments</span></NavLink></li>
              <li><NavLink to="/admin/states-districts" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><MapPin size={16}/><span>States & Districts</span></NavLink></li>
              <li><NavLink to="/admin/schemes" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileSpreadsheet size={16}/><span>Schemes</span></NavLink></li>
              <li><NavLink to="/admin/budget-allocation" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Budget Allocation</span></NavLink></li>
              <li><NavLink to="/admin/send-to-finance" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>Send to Finance</span></NavLink></li>
              <li><NavLink to="/admin/users" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Users size={16}/><span>Users & Roles</span></NavLink></li>
              <li><NavLink to="/admin/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Blockchain Explorer</span></NavLink></li>
              <li><NavLink to="/admin/audit-reports" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><ShieldCheck size={16}/><span>Audit Reports</span></NavLink></li>
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'FINANCE':
        return (
          <>
            <div className="sidebar-header">Finance Disbursal Authority</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/finance/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/finance/received-budgets" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Received Budgets</span></NavLink></li>
              <li><NavLink to="/finance/transfers" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>Fund Transfers</span></NavLink></li>
              <li><NavLink to="/finance/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Transaction History</span></NavLink></li>
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'STATE':
        return (
          <>
            <div className="sidebar-header">State Treasury ({user.state_name || 'Maharashtra'})</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/state/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/state/received-funds" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Coins size={16}/><span>Received Funds</span></NavLink></li>
              <li><NavLink to="/state/allocations" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Send size={16}/><span>District Allocation</span></NavLink></li>
              <li><NavLink to="/state/history" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Allocation History</span></NavLink></li>
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'DISTRICT':
        return (
          <>
            <div className="sidebar-header">District Development Agency</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/district/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/district/projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={16}/><span>Projects & Escrow</span></NavLink></li>
              <li><NavLink to="/district/contractors" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><UserCheck size={16}/><span>Contractor KYC Review</span></NavLink></li>
              <li><NavLink to="/district/grievances" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><MessageSquareWarning size={16}/><span>Grievance Inbox</span></NavLink></li>
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
              <li><NavLink to="/contractor/my-projects" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FolderKanban size={16}/><span>My Projects & Progress</span></NavLink></li>
              <li><NavLink to="/contractor/kyc" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileCheck size={16}/><span>KYC Credentials</span></NavLink></li>
              <li><NavLink to="/contractor/payments" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><CreditCard size={16}/><span>Payment Receipts</span></NavLink></li>
              <li><NavLink to="/notifications" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Bell size={16}/><span>Notifications</span></NavLink></li>
              <li><NavLink to="/profile" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Settings size={16}/><span>Settings</span></NavLink></li>
            </ul>
          </>
        );

      case 'AUDITOR':
        return (
          <>
            <div className="sidebar-header">Forensic CAG Audit Cell</div>
            <ul className="sidebar-menu">
              <li><NavLink to="/auditor/dashboard" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><LayoutDashboard size={16}/><span>Dashboard</span></NavLink></li>
              <li><NavLink to="/auditor/blockchain-explorer" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Activity size={16}/><span>Blockchain Explorer</span></NavLink></li>
              <li><NavLink to="/auditor/document-audit" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><FileSearch size={16}/><span>Document SHA-256 Audit</span></NavLink></li>
              <li><NavLink to="/auditor/anomalies" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><AlertTriangle size={16}/><span>Anomaly Analytics</span></NavLink></li>
              <li><NavLink to="/auditor/fraud-freeze" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><Lock size={16}/><span>Fraud Reports & Freeze</span></NavLink></li>
              <li><NavLink to="/auditor/submit-report" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}><ShieldCheck size={16}/><span>Submit Audit Report</span></NavLink></li>
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
      {renderNavLinks()}
    </aside>
  );
};

export default Sidebar;
