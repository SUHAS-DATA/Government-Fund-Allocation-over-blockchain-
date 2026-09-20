import React from 'react';
import { formatCurrency } from '../services/blockchain';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'green', 
  subtitle, 
  isCurrency = false,
  progress = null 
}) => {
  const getColorStyles = () => {
    switch (color) {
      case 'blue':
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          iconColor: '#1D4ED8',
          accent: '#2563EB'
        };
      case 'orange':
      case 'saffron':
        return {
          bg: '#FFF7ED',
          border: '#FED7AA',
          iconColor: '#EA580C',
          accent: '#F97316'
        };
      case 'purple':
        return {
          bg: '#F5F3FF',
          border: '#DDD6FE',
          iconColor: '#7C3AED',
          accent: '#8B5CF6'
        };
      case 'red':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          iconColor: '#DC2626',
          accent: '#EF4444'
        };
      case 'teal':
        return {
          bg: '#F0FDFA',
          border: '#99F6E4',
          iconColor: '#0F766E',
          accent: '#14B8A6'
        };
      case 'gold':
        return {
          bg: '#FEFCE8',
          border: '#FEF08A',
          iconColor: '#CA8A04',
          accent: '#EAB308'
        };
      case 'green':
      default:
        return {
          bg: 'var(--color-primary-light)',
          border: 'var(--color-primary-border)',
          iconColor: 'var(--color-primary)',
          accent: '#10B981'
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

      {progress != null && (
        <div style={{ margin: '6px 0 8px 0' }}>
          <div style={{ height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${Math.min(100, Math.max(0, progress))}%`, 
                backgroundColor: c.accent,
                borderRadius: '2px',
                transition: 'width 0.4s ease'
              }} 
            />
          </div>
        </div>
      )}

      {subtitle && (
        <div className="stat-subtitle">
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: c.iconColor,
            flexShrink: 0
          }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
