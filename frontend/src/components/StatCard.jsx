import React from 'react';
import { formatCurrency } from '../services/blockchain';

const StatCard = ({ title, value, icon: Icon, color = 'green', subtitle, isCurrency = false }) => {
  const getColorStyles = () => {
    switch (color) {
      case 'blue':
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          iconColor: '#1D4ED8'
        };
      case 'orange':
      case 'saffron':
        return {
          bg: '#FFF7ED',
          border: '#FED7AA',
          iconColor: '#EA580C'
        };
      case 'purple':
        return {
          bg: '#F5F3FF',
          border: '#DDD6FE',
          iconColor: '#7C3AED'
        };
      case 'red':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          iconColor: '#DC2626'
        };
      case 'teal':
        return {
          bg: '#F0FDFA',
          border: '#99F6E4',
          iconColor: '#0F766E'
        };
      case 'green':
      default:
        return {
          bg: 'var(--color-primary-light)',
          border: 'var(--color-primary-border)',
          iconColor: 'var(--color-primary)'
        };
    }
  };

  const c = getColorStyles();

  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {Icon && (
          <div 
            className="stat-icon-wrapper" 
            style={{ 
              backgroundColor: c.bg, 
              borderColor: c.border,
              color: c.iconColor 
            }}
          >
            <Icon size={18} color={c.iconColor} />
          </div>
        )}
      </div>

      <div className="stat-value">
        {isCurrency ? formatCurrency(value) : value}
      </div>

      {subtitle && (
        <div className="stat-subtitle">
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: c.iconColor
          }} />
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
