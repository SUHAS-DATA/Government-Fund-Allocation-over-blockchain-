import React from 'react';
import { formatCurrency } from '../services/blockchain';

const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, isCurrency = false }) => {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {Icon && <Icon size={18} color="var(--color-primary)" />}
      </div>
      <div className="stat-value">
        {isCurrency ? formatCurrency(value) : value}
      </div>
      {subtitle && (
        <div className="stat-subtitle">{subtitle}</div>
      )}
    </div>
  );
};

export default StatCard;
