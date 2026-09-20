/**
 * Portal Deployment Configuration
 * Reads import.meta.env.VITE_PORTAL to dynamically configure the frontend for 5 distinct portal deployments.
 * Valid values: ADMIN | FIELD | CONTRACTOR | PUBLIC | AUDITOR
 */

export const PORTAL_TYPES = {
  ADMIN: 'ADMIN',
  FIELD: 'FIELD',
  CONTRACTOR: 'CONTRACTOR',
  PUBLIC: 'PUBLIC',
  AUDITOR: 'AUDITOR'
};

export const VALID_PORTALS = Object.values(PORTAL_TYPES);

/**
 * Returns the currently active portal based on VITE_PORTAL environment variable.
 * Returns null if missing, 'INVALID' if unrecognized, or the valid uppercase portal name.
 */
export const getActivePortal = () => {
  const envVal = import.meta.env.VITE_PORTAL;
  if (!envVal || typeof envVal !== 'string' || !envVal.trim()) return null;
  const normalized = envVal.trim().toUpperCase();
  return VALID_PORTALS.includes(normalized) ? normalized : 'INVALID';
};

export const PORTAL_DETAILS = {
  ADMIN: {
    id: 'ADMIN',
    title: 'Admin Portal',
    badge: 'Central Secretariat & Finance',
    description: 'Central budget ceiling management and treasury fund release.',
    allowedRoles: ['SUPER_ADMIN', 'FINANCE'],
    homePath: (role) => (role === 'FINANCE' ? '/finance' : '/admin'),
    loginPath: '/'
  },
  FIELD: {
    id: 'FIELD',
    title: 'Field Operations Portal',
    badge: 'State Treasury & District Agency',
    description: 'Regional fund allocation and district project execution.',
    allowedRoles: ['STATE', 'DISTRICT', 'DEPARTMENT'],
    homePath: () => '/department',
    loginPath: '/'
  },
  CONTRACTOR: {
    id: 'CONTRACTOR',
    title: 'Contractor & Vendor Portal',
    badge: 'Registered Concessionaires & Vendors',
    description: 'Contractor registration, login, milestone claims, and work verification.',
    allowedRoles: ['CONTRACTOR'],
    homePath: () => '/contractor/dashboard',
    loginPath: '/'
  },
  PUBLIC: {
    id: 'PUBLIC',
    title: 'Public Transparency Portal',
    badge: 'Citizen Access • No Login Required',
    description: 'Open public ledger for tracking projects, schemes, and funds.',
    allowedRoles: [],
    homePath: () => '/public',
    loginPath: '/public'
  },
  AUDITOR: {
    id: 'AUDITOR',
    title: 'Auditor & Inspection Portal',
    badge: 'CAG Statutory Oversight',
    description: 'Independent audit, anomaly analytics, and emergency fund freeze.',
    allowedRoles: ['AUDITOR'],
    homePath: () => '/auditor',
    loginPath: '/'
  }
};
