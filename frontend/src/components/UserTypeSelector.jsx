import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Landmark,
  FileSpreadsheet,
  Building,
  Briefcase,
  Search,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Lock,
  Eye,
  Layers,
  ChevronRight,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const USER_ROLES_CONFIG = [
  {
    id: 'SUPER_ADMIN',
    title: 'Super Admin',
    roleLabel: 'Central Secretariat',
    badge: 'National Central Ceiling',
    icon: Landmark,
    accentColor: '#1E3A8A',
    lightBg: 'rgba(30, 58, 138, 0.05)',
    borderColor: '#93C5FD',
    description: 'National budget sanction, scheme master creation, user provisioning, and CAG forensic review.',
    loginTarget: '/login?role=SUPER_ADMIN',
    dashboardTarget: '/admin/dashboard',
    defaultEmail: 'admin@govtfund.gov.in',
    defaultPassword: 'Admin@123',
    tier: 'Tier 1 • Union Apex',
    tags: ['National Ceiling', 'Scheme Masters', 'User Roles']
  },
  {
    id: 'FINANCE',
    title: 'Finance Authority',
    roleLabel: 'Ministry of Finance',
    badge: 'Treasury Disbursal Authority',
    icon: FileSpreadsheet,
    accentColor: '#0F766E',
    lightBg: 'rgba(15, 118, 110, 0.05)',
    borderColor: '#99F6E4',
    description: 'Verify sanctioned union budgets, execute state treasury fund releases, and monitor macro disbursements.',
    loginTarget: '/login?role=FINANCE',
    dashboardTarget: '/finance/dashboard',
    defaultEmail: 'finance@govtfund.gov.in',
    defaultPassword: 'Finance@123',
    tier: 'Tier 2 • Treasury',
    tags: ['State Tranches', 'Disbursal Approval', 'Treasury Ledgers']
  },
  {
    id: 'STATE',
    title: 'State Treasury',
    roleLabel: 'State Planning & Finance',
    badge: 'State Disbursal Unit',
    icon: Building,
    accentColor: '#0369A1',
    lightBg: 'rgba(3, 105, 161, 0.05)',
    borderColor: '#BAE6FD',
    description: 'Receive central fund releases, allocate state scheme budgets to district agencies (KA, MH, GJ, TN, UP).',
    loginTarget: '/login?role=STATE',
    dashboardTarget: '/state/dashboard',
    defaultEmail: 'karnataka@govtfund.gov.in',
    defaultPassword: 'State@123',
    tier: 'Tier 3 • State Apex',
    tags: ['District Allocations', 'State Receipts', 'Regional Ledgers']
  },
  {
    id: 'DISTRICT',
    title: 'District Agency',
    roleLabel: 'District DRDA / Collectorate',
    badge: 'Implementation Agency',
    icon: Layers,
    accentColor: '#7C3AED',
    lightBg: 'rgba(124, 58, 237, 0.05)',
    borderColor: '#DDD6FE',
    description: 'Create infrastructure projects, bind contractors, deploy on-chain escrows, and inspect milestone proofs.',
    loginTarget: '/district-login',
    dashboardTarget: '/district/dashboard',
    defaultEmail: 'district.belagavi@govtfund.gov.in',
    defaultPassword: 'District@123',
    tier: 'Tier 4 • Grassroots Ops',
    tags: ['Project Escrows', 'Contractor KYC', 'Milestone Releases']
  },
  {
    id: 'CONTRACTOR',
    title: 'Contractor & Vendor',
    roleLabel: 'Approved Concessionaires',
    badge: 'Project Concessionaire',
    icon: Briefcase,
    accentColor: '#C2410C',
    lightBg: 'rgba(194, 65, 12, 0.05)',
    borderColor: '#FED7AA',
    description: 'Submit KYC documentation, upload photographic milestone proofs with SHA-256 digests, and claim payouts.',
    loginTarget: '/contractor-login',
    dashboardTarget: '/contractor/dashboard',
    defaultEmail: 'contractor@buildcorp.in',
    defaultPassword: 'Contractor@123',
    tier: 'Tier 5 • Concessionaire',
    tags: ['Proof Submission', 'Escrow Claims', 'KYC Compliance']
  },
  {
    id: 'AUDITOR',
    title: 'Auditor & Vigilance',
    roleLabel: 'CAG Forensic Directorate',
    badge: 'Independent Oversight',
    icon: Search,
    accentColor: '#B91C1C',
    lightBg: 'rgba(185, 28, 28, 0.05)',
    borderColor: '#FECACA',
    description: 'Automated AI/statistical anomaly detection, smart contract fund freeze triggers, and forensic audit reports.',
    loginTarget: '/login?role=AUDITOR',
    dashboardTarget: '/auditor/dashboard',
    defaultEmail: 'auditor@auditindia.gov.in',
    defaultPassword: 'Auditor@123',
    tier: 'Independent • Vigilance',
    tags: ['Anomaly Detection', 'Smart Contract Freeze', 'CAG Reports']
  },
  {
    id: 'PUBLIC',
    title: 'Public / Citizen',
    roleLabel: 'Citizen Transparency Portal',
    badge: 'Open Access • No Login Required',
    icon: Globe,
    accentColor: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.05)',
    borderColor: '#A7F3D0',
    description: 'Track live government projects in real-time, view verified blockchain transaction records, and file public grievances.',
    loginTarget: '/public/projects',
    dashboardTarget: '/public/projects',
    isPublic: true,
    tier: 'Public Transparency',
    tags: ['Public Project Tracking', 'Blockchain Explorer', 'Grievance Redressal']
  }
];

const UserTypeSelector = ({ compact = false, showDiagram = true }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [quickLoggingIn, setQuickLoggingIn] = useState(null);

  const handleQuickLogin = async (roleObj) => {
    if (roleObj.isPublic) {
      navigate('/public/projects');
      return;
    }
    setQuickLoggingIn(roleObj.id);
    try {
      const res = await login(roleObj.defaultEmail, roleObj.defaultPassword);
      if (res.success) {
        navigate(roleObj.dashboardTarget);
      } else {
        navigate(roleObj.loginTarget);
      }
    } catch {
      navigate(roleObj.loginTarget);
    } finally {
      setQuickLoggingIn(null);
    }
  };

  return (
    <div style={{ width: '100%', marginBottom: compact ? '20px' : '40px' }}>
      
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary-border)',
          borderRadius: '999px',
          color: 'var(--color-primary)',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>
          <ShieldCheck size={14} />
          <span>Role-Based Portal Gateway Architecture</span>
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          Select User Type & Access Portal
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '680px', margin: '6px auto 0', lineHeight: '1.5' }}>
          Direct role-based gateway for Government Officials, Concessionaires, CAG Auditors, and Public Citizen Transparency.
        </p>
      </div>

      {/* Interactive System Flow Map (Visual Diagram matching the requested architecture) */}
      {showDiagram && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 20px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto'
        }}>
          <div style={{ minWidth: '780px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Level 1: Main Website */}
            <div style={{
              background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
              color: '#FFFFFF',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Globe size={16} />
              <span>MAIN WEBSITE LINK (PFMS Live Portal)</span>
            </div>

            {/* Down Arrow */}
            <div style={{ height: '24px', width: '2px', background: 'var(--color-accent)', margin: '4px 0' }} />

            {/* Level 2: Select User Type Hub */}
            <div style={{
              background: '#FFFFFF',
              border: '2px solid var(--color-primary)',
              color: 'var(--color-primary)',
              padding: '8px 28px',
              borderRadius: '6px',
              fontWeight: '800',
              fontSize: '14px',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              SELECT USER TYPE
            </div>

            {/* Down Arrow Tree */}
            <div style={{ height: '20px', width: '2px', background: 'var(--color-accent)', margin: '4px 0 0 0' }} />
            
            {/* Horizontal Line connecting 7 channels */}
            <div style={{ width: '92%', height: '2px', background: 'var(--border-color)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-1px', left: '0%', width: '100%', height: '2px', background: 'linear-gradient(90deg, #1E3A8A, #0F766E, #0369A1, #7C3AED, #C2410C, #B91C1C, #059669)' }} />
            </div>

            {/* 7 Vertical branches */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginTop: '4px' }}>
              {USER_ROLES_CONFIG.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '2px', height: '16px', background: role.accentColor }} />
                    <div style={{
                      width: '100%',
                      background: role.lightBg,
                      border: `1.5px solid ${role.borderColor}`,
                      borderRadius: '6px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleQuickLogin(role)}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        background: role.accentColor,
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon size={15} />
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                        {role.title}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>
                        {role.isPublic ? 'Direct Access' : 'Login Flow'}
                      </div>
                      <div style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        color: role.accentColor,
                        padding: '2px 4px',
                        background: '#FFFFFF',
                        borderRadius: '3px',
                        border: `1px solid ${role.borderColor}`,
                        marginTop: '2px'
                      }}>
                        {role.isPublic ? 'Public Page' : 'Dashboard'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* Grid of 7 Comprehensive User Role Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {USER_ROLES_CONFIG.map((role) => {
          const Icon = role.icon;
          const isLogging = quickLoggingIn === role.id;
          const isSelected = selectedRole === role.id;

          return (
            <div
              key={role.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? `2px solid ${role.accentColor}` : '1px solid var(--border-color)',
                borderTop: `4px solid ${role.accentColor}`,
                background: '#FFFFFF',
                boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.08)' : 'var(--shadow-xs)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-sm)',
                    background: role.lightBg,
                    border: `1px solid ${role.borderColor}`,
                    color: role.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={20} />
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: role.lightBg,
                    color: role.accentColor,
                    border: `1px solid ${role.borderColor}`
                  }}>
                    {role.tier}
                  </span>
                </div>

                {/* Role Title & Dept */}
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {role.title}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px' }}>
                  {role.roleLabel}
                </div>

                {/* Description */}
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px', minHeight: '54px' }}>
                  {role.description}
                </p>

                {/* Flow Sequence Breadcrumbs */}
                <div style={{
                  background: 'var(--bg-subtle)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '14px'
                }}>
                  <span>Portal Entry</span>
                  <ChevronRight size={12} color="var(--text-muted)" />
                  <span style={{ color: role.accentColor, fontWeight: '700' }}>
                    {role.isPublic ? 'Direct Public Page' : 'Secure Login'}
                  </span>
                  <ChevronRight size={12} color="var(--text-muted)" />
                  <span>{role.isPublic ? 'Live Tracking' : 'Dashboard'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                {role.isPublic ? (
                  <Link
                    to="/public/projects"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      background: role.accentColor,
                      borderColor: role.accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '9px 14px',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    <Eye size={14} />
                    <span>Open Public Tracking Page</span>
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleQuickLogin(role)}
                      disabled={isLogging}
                      style={{
                        flex: 1,
                        background: role.accentColor,
                        borderColor: role.accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}
                    >
                      <Sparkles size={13} />
                      <span>{isLogging ? 'Entering...' : '1-Click Login'}</span>
                    </button>
                    <Link
                      to={role.loginTarget}
                      className="btn btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                      title="Manual Login Gateway"
                    >
                      <Lock size={13} />
                      <span>Portal</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserTypeSelector;
