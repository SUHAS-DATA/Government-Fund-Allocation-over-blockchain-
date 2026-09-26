import React from 'react';
import { useAuth } from '../../context/AuthContext';
import DistrictDashboard from '../district/DistrictDashboard';
import StateDashboard from '../state/StateDashboard';

/**
 * DepartmentDashboard acts as an intelligent role dispatcher:
 * - If user has role 'STATE', renders the dedicated State Treasury Authority Hub.
 * - Otherwise (for 'DISTRICT' or generic department), renders the dedicated District Development Hub.
 */
const DepartmentDashboard = () => {
  const { user } = useAuth();

  if (user?.role === 'STATE') {
    return <StateDashboard />;
  }

  return <DistrictDashboard />;
};

export default DepartmentDashboard;
