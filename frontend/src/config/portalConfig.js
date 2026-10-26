/**
 * Portal Deployment Configuration
 * Reads import.meta.env.VITE_PORTAL to dynamically configure the frontend for 4 distinct portal deployments.
 * Valid values: ADMIN | FIELD | CONTRACTOR | PUBLIC
 */

export const PORTAL_TYPES = {
  ADMIN: 'ADMIN',
  FIELD: 'FIELD',
  CONTRACTOR: 'CONTRACTOR',
  PUBLIC: 'PUBLIC'
};

export const VALID_PORTALS = Object.values(PORTAL_TYPES);

/**
 * Returns the currently active portal based on VITE_PORTAL environment variable.
 * Returns null if missing, 'INVALID' if unrecognized, or the valid uppercase portal name.
 */
export const getActivePortal = () => {
  if (typeof window !== 'undefined') {
    // 1. URL search param ?portal=CONTRACTOR
    const searchParams = new URLSearchParams(window.location.search);
    const queryPortal = searchParams.get('portal');
    if (queryPortal && VALID_PORTALS.includes(queryPortal.toUpperCase())) {
      const norm = queryPortal.toUpperCase();
      try { sessionStorage.setItem('VITE_PORTAL_ACTIVE', norm); } catch (e) {}
      return norm;
    }

    // 2. Direct path-based portal resolution
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/contractor') || path === '/register') {
      return PORTAL_TYPES.CONTRACTOR;
    }
    if (path.startsWith('/field') || path.startsWith('/district') || path.startsWith('/state') || path.startsWith('/department')) {
      return PORTAL_TYPES.FIELD;
    }
    if (path.startsWith('/public') || path.startsWith('/how-it-works') || path.startsWith('/verify')) {
      return PORTAL_TYPES.PUBLIC;
    }
    if (path.startsWith('/admin') || path.startsWith('/finance')) {
      return PORTAL_TYPES.ADMIN;
    }

    // 3. Session override if previously selected
    try {
      const saved = sessionStorage.getItem('VITE_PORTAL_ACTIVE');
      if (saved && VALID_PORTALS.includes(saved)) {
        return saved;
      }
    } catch (e) {}
  }

  const envVal = import.meta.env.VITE_PORTAL;
  if (!envVal || typeof envVal !== 'string' || !envVal.trim()) {
    // Default fallback to ADMIN (Super Admin & Finance) if VITE_PORTAL is not configured
    return PORTAL_TYPES.ADMIN;
  }
  const normalized = envVal.trim().toUpperCase();
  return VALID_PORTALS.includes(normalized) ? normalized : PORTAL_TYPES.ADMIN;
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
  }
};
