import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Landmark, 
  Building, 
  Briefcase, 
  Globe, 
  ShieldCheck
} from 'lucide-react';
import { getActivePortal, PORTAL_DETAILS } from '../config/portalConfig';

export const PORTALS_LIST = [
  {
    id: 'ADMIN',
    path: '/admin-portal',
    label: 'Admin Portal',
    sublabel: 'Super Admin & Finance',
    icon: Landmark,
    color: '#1E3A8A'
  },
  {
    id: 'FIELD',
    path: '/field-portal',
    label: 'Field Portal',
    sublabel: 'State & District',
    icon: Building,
    color: '#0284C7'
  },
  {
    id: 'CONTRACTOR',
    path: '/contractor-portal',
    label: 'Contractor Portal',
    sublabel: 'Registration & Login',
    icon: Briefcase,
    color: '#EA580C'
  },
  {
    id: 'PUBLIC',
    path: '/public',
    label: 'Public Portal',
    sublabel: 'Citizen Tracking • No Login',
    icon: Globe,
    color: '#059669'
  }
];

const PortalNavHeader = () => {
  return null;
};

export default PortalNavHeader;
