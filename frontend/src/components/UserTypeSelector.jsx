import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Landmark,
  FileSpreadsheet,
  Building,
  Briefcase,
  Search,
  Globe,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActivePortal } from '../config/portalConfig';

export const PORTALS_DIRECTORY = [
  {
    id: 'admin',
    portalUrl: '/admin-portal',
    portalName: 'Admin Portal',
    badge: 'Central Secretariat & Finance',
    tagline: 'Union Level Budget & Approvals',
    icon: Landmark,
    accentColor: '#1E3A8A',
    lightBg: 'rgba(30, 58, 138, 0.05)',
    borderColor: '#93C5FD',
    allowedRoles: [
      {
        id: 'SUPER_ADMIN',
        name: 'Super Admin',
        dept: 'Central Secretariat',
        defaultEmail: 'admin@govtfund.gov.in',
        defaultPassword: 'Admin@123',
        targetDashboard: '/admin'
      },
      {
        id: 'FINANCE',
        name: 'Finance Department',
        dept: 'Ministry of Finance',
        defaultEmail: 'finance@govtfund.gov.in',
        defaultPassword: 'Finance@123',
        targetDashboard: '/finance'
      }
    ],
    description: 'National budget ceiling sanctioning, scheme setup, multi-tier treasury fund releases, and central administrative oversight.'
  },
  {
    id: 'field',
    portalUrl: '/field-portal',
    portalName: 'Field Portal',
    badge: 'State Treasury & District Agency',
    tagline: 'Territorial Fund Execution',
    icon: Building,
    accentColor: '#0284C7',
    lightBg: 'rgba(2, 132, 199, 0.05)',
    borderColor: '#7DD3FC',
    allowedRoles: [
      {
        id: 'STATE',
        name: 'State Treasury',
        dept: 'State Planning & Finance (KA, MH, GJ, TN, UP)',
        defaultEmail: 'karnataka@govtfund.gov.in',
        defaultPassword: 'State@123',
        targetDashboard: '/department'
      },
      {
        id: 'DISTRICT',
        name: 'District Agency',
        dept: 'District Development Office (Belagavi, Bengaluru, etc.)',
        defaultEmail: 'district.belagavi@govtfund.gov.in',
        defaultPassword: 'District@123',
        targetDashboard: '/department'
      }
    ],
    description: 'Receive central allocations, allocate budgets to district development agencies, supervise projects, and disburse milestone funds.'
  },
  {
    id: 'contractor',
    portalUrl: '/contractor-portal',
    portalName: 'Contractor Portal',
    badge: 'Contractor & Vendor Only',
    tagline: 'Vendor Registration & Milestone Claims',
    icon: Briefcase,
    accentColor: '#EA580C',
    lightBg: 'rgba(234, 88, 12, 0.05)',
    borderColor: '#FDBA74',
    allowedRoles: [
      {
        id: 'CONTRACTOR',
        name: 'Contractor & Vendor',
        dept: 'Registered Concessionaires & EPC Builders',
        defaultEmail: 'contractor@buildcorp.in',
        defaultPassword: 'Contractor@123',
        targetDashboard: '/contractor/dashboard'
      }
    ],
    operations: ['Contractor Registration (GSTIN, PAN, PWD License)', 'Contractor Secure Sign-In', 'Milestone Evidence Upload'],
    description: 'Concessionaire onboarding, contractor registration with GSTIN/PAN verification, work proof upload with geo-tagging, and invoice claims.'
  },
  {
    id: 'public',
    portalUrl: '/public',
    portalName: 'Public Portal',
    badge: 'Open Citizen Access',
    tagline: 'Direct Transparency • No Login Required',
    icon: Globe,
    accentColor: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.05)',
    borderColor: '#6EE7B7',
    isPublic: true,
    features: [
      'Project Tracking',
      'Scheme Tracking',
      'Fund Tracking',
      'QR Verification',
      'Blockchain Ledger',
      'Citizen Grievance Redressal'
    ],
    description: 'Open public transparency ledger: trace sanctioned funds to local projects, verify milestone evidence, and report irregularities.'
  },
  {
    id: 'auditor',
    portalUrl: '/auditor-portal',
    portalName: 'Auditor Portal',
    badge: 'Auditor & Inspection Only',
    tagline: 'CAG Statutory Oversight',
    icon: Search,
    accentColor: '#DC2626',
    lightBg: 'rgba(220, 38, 38, 0.05)',
    borderColor: '#FCA5A5',
    allowedRoles: [
      {
        id: 'AUDITOR',
        name: 'Auditor & Inspection',
        dept: 'Comptroller & Auditor General (CAG) Cell',
        defaultEmail: 'auditor@auditindia.gov.in',
        defaultPassword: 'Auditor@123',
        targetDashboard: '/auditor'
      }
    ],
    description: 'Independent forensic audit, automated anomaly detection, smart contract verification, and emergency fund freeze powers.'
  }
];

// Reusable individual role configuration exported for legacy or modal compatibility
export const USER_ROLES_CONFIG = [
  {
    id: 'SUPER_ADMIN',
    title: 'Super Admin',
    roleLabel: 'Central Secretariat',
    badge: 'Central Budget Authority',
    icon: Landmark,
    accentColor: '#1E3A8A',
    lightBg: '#F0F9FF',
    borderColor: '#BAE6FD',
    description: 'National budget approval, scheme setup, user accounts management, and audit reports.',
    portalUrl: '/admin-portal',
    loginTarget: '/admin-portal',
    dashboardTarget: '/admin',
    defaultEmail: 'admin@govtfund.gov.in',
    defaultPassword: 'Admin@123',
    tier: 'Tier 1 • Central Level'
  },
  {
    id: 'FINANCE',
    title: 'Finance Dept',
    roleLabel: 'Ministry of Finance',
    badge: 'Treasury Fund Release',
    icon: FileSpreadsheet,
    accentColor: '#0F766E',
    lightBg: '#F0FDFA',
    borderColor: '#99F6E4',
    description: 'Check approved budgets, release funds to State Treasuries, and track government payments.',
    portalUrl: '/admin-portal',
    loginTarget: '/admin-portal',
    dashboardTarget: '/finance',
    defaultEmail: 'finance@govtfund.gov.in',
    defaultPassword: 'Finance@123',
    tier: 'Tier 2 • Finance Dept'
  },
  {
    id: 'STATE',
    title: 'State Treasury',
    roleLabel: 'State Planning & Finance',
    badge: 'State Fund Management',
    icon: Building,
    accentColor: '#0284C7',
    lightBg: '#F0F9FF',
    borderColor: '#BAE6FD',
    description: 'Receive central funds and allocate budgets to District Development Offices (KA, MH, GJ, TN, UP).',
    portalUrl: '/field-portal',
    loginTarget: '/field-portal',
    dashboardTarget: '/department',
    defaultEmail: 'karnataka@govtfund.gov.in',
    defaultPassword: 'State@123',
    tier: 'Tier 3 • State Level'
  },
  {
    id: 'DISTRICT',
    title: 'District Agency',
    roleLabel: 'District Office / Collectorate',
    badge: 'Project Planning & Execution',
    icon: Layers,
    accentColor: '#7C3AED',
    lightBg: '#F5F3FF',
    borderColor: '#DDD6FE',
    description: 'Create development projects, assign contractors, check site work, and release milestone payments.',
    portalUrl: '/field-portal',
    loginTarget: '/field-portal',
    dashboardTarget: '/department',
    defaultEmail: 'district.belagavi@govtfund.gov.in',
    defaultPassword: 'District@123',
    tier: 'Tier 4 • District Level'
  },
  {
    id: 'CONTRACTOR',
    title: 'Contractor & Vendor',
    roleLabel: 'Registered Contractors',
    badge: 'Project Contractor',
    icon: Briefcase,
    accentColor: '#EA580C',
    lightBg: '#FFF7ED',
    borderColor: '#FED7AA',
    description: 'Submit business profile, upload site work photos with blockchain proof, and claim milestone payments.',
    portalUrl: '/contractor-portal',
    loginTarget: '/contractor-portal',
    dashboardTarget: '/contractor/dashboard',
    defaultEmail: 'contractor@buildcorp.in',
    defaultPassword: 'Contractor@123',
    tier: 'Tier 5 • Contractor'
  },
  {
    id: 'AUDITOR',
    title: 'Auditor & Inspection',
    roleLabel: 'Audit & Inspection Cell',
    badge: 'Independent Oversight',
    icon: Search,
    accentColor: '#DC2626',
    lightBg: '#FEF2F2',
    borderColor: '#FECACA',
    description: 'Automatic fraud & anomaly detection, emergency fund freeze actions, and official audit reports.',
    portalUrl: '/auditor-portal',
    loginTarget: '/auditor-portal',
    dashboardTarget: '/auditor',
    defaultEmail: 'auditor@auditindia.gov.in',
    defaultPassword: 'Auditor@123',
    tier: 'Independent • Auditor'
  },
  {
    id: 'PUBLIC',
    title: 'Public / Citizen',
    roleLabel: 'Citizen Public Portal',
    badge: 'Open Access • No Login Required',
    icon: Globe,
    accentColor: '#059669',
    lightBg: 'rgba(5, 150, 105, 0.05)',
    borderColor: '#A7F3D0',
    description: 'Track live government projects, check verified blockchain records, and report issues / complaints.',
    portalUrl: '/public',
    loginTarget: '/public',
    dashboardTarget: '/public',
    isPublic: true,
    tier: 'Public Tracking'
  }
];

const UserTypeSelector = ({ compact = false, showDiagram = true, filterPortal = null }) => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [quickLoggingIn, setQuickLoggingIn] = useState(null);

  const handleQuickLoginRole = async (role) => {
    if (role.isPublic) {
      navigate('/public');
      return;
    }
    setQuickLoggingIn(role.id);
    try {
      const res = await login(role.defaultEmail, role.defaultPassword);
      if (res.success) {
        navigate(role.targetDashboard || role.dashboardTarget);
      } else {
        navigate(role.portalUrl || role.loginTarget);
      }
    } catch {
      navigate(role.portalUrl || role.loginTarget);
    } finally {
      setQuickLoggingIn(null);
    }
  };

  const activePortal = getActivePortal();

  // If a specific portal filter is passed, or if activePortal environment variable is set
  const effectivePortal = (activePortal && activePortal !== 'INVALID') 
    ? activePortal.toLowerCase() 
    : (filterPortal ? filterPortal.toLowerCase() : null);

  // If a specific portal filter is active, show only that portal's roles/card
  const portalsToDisplay = effectivePortal 
    ? PORTALS_DIRECTORY.filter(p => p.id.toLowerCase() === effectivePortal)
    : PORTALS_DIRECTORY;

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
          <span>5-Tier Frontend Portal Architecture</span>
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
          {filterPortal ? `${portalsToDisplay[0]?.portalName} Access` : 'Government Portal Directory'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '680px', margin: '6px auto 0', lineHeight: '1.5' }}>
          Select the dedicated portal for your operational authority. Each portal strictly enforces permitted roles and workflows.
        </p>
      </div>

      {/* Grid of 5 Distinct Portal Entry Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {portalsToDisplay.map((portal) => {
          const Icon = portal.icon;

          return (
            <div
              key={portal.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                borderTop: `4px solid ${portal.accentColor}`,
                background: '#FFFFFF',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-sm)',
                    background: portal.lightBg,
                    border: `1.5px solid ${portal.borderColor}`,
                    color: portal.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={22} />
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: portal.lightBg,
                    color: portal.accentColor,
                    border: `1px solid ${portal.borderColor}`
                  }}>
                    {portal.badge}
                  </span>
                </div>

                {/* Portal Title & Tagline */}
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '2px' }}>
                  {portal.portalName}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '12px' }}>
                  {portal.tagline}
                </div>

                {/* Description */}
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.55', marginBottom: '16px' }}>
                  {portal.description}
                </p>

                {/* Permitted Roles / Features Pills */}
                <div style={{
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {portal.isPublic ? 'Available Public Features:' : 'Allowed Roles in this Portal:'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {portal.allowedRoles?.map((r) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: portal.accentColor }} />
                          {r.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.dept?.split(' ')[0]}</span>
                      </div>
                    ))}
                    {portal.features?.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
                        <CheckCircle2 size={12} color={portal.accentColor} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Portal Entry Button */}
              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <Link
                  to={portal.portalUrl}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    background: portal.accentColor,
                    borderColor: portal.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: '700'
                  }}
                >
                  <span>Open {portal.portalName}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserTypeSelector;
