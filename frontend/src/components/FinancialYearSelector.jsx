import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useFinancialYear } from '../context/FinancialYearContext';

const FinancialYearSelector = ({ compact = false, showLabel = true, className = '' }) => {
  const { selectedFY, setSelectedFY, financialYears } = useFinancialYear();

  const activeObj = financialYears.find((f) => f.year === selectedFY);
  const isCurrentFY = activeObj ? !!activeObj.is_current : false;

  return (
    <div
      className={`financial-year-selector ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: compact ? '4px 8px' : '6px 12px',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        backdropFilter: 'blur(8px)',
        fontSize: compact ? '12px' : '13px',
        fontWeight: '500',
        color: 'inherit',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Calendar size={compact ? 14 : 16} style={{ color: '#F59E0B' }} />
        {showLabel && (
          <span style={{ opacity: 0.85, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            FY:
          </span>
        )}
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          id="fy-selector-dropdown"
          value={selectedFY}
          onChange={(e) => setSelectedFY(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'inherit',
            fontWeight: '600',
            fontSize: compact ? '12px' : '13px',
            cursor: 'pointer',
            paddingRight: '18px',
            margin: 0
          }}
          aria-label="Select Financial Year"
        >
          {financialYears.length === 0 ? (
            <option
              value=""
              style={{
                background: '#0F172A',
                color: '#94A3B8',
                padding: '8px'
              }}
            >
              No Active FY
            </option>
          ) : (
            financialYears.map((fy) => (
              <option
                key={fy.year}
                value={fy.year}
                style={{
                  background: '#0F172A',
                  color: '#F8FAFC',
                  padding: '8px'
                }}
              >
                FY {fy.year} {fy.is_current ? '(Active)' : '(Historical)'}
              </option>
            ))
          )}
        </select>
        <ChevronDown
          size={12}
          style={{
            position: 'absolute',
            right: 0,
            pointerEvents: 'none',
            opacity: 0.75
          }}
        />
      </div>

      {financialYears.length > 0 && selectedFY && (
        isCurrentFY ? (
          <span
            title="Current Active Financial Year"
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}
          >
            LIVE
          </span>
        ) : (
          <span
            title="Historical Financial Year Records"
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}
          >
            HISTORICAL
          </span>
        )
      )}
    </div>
  );
};

export default FinancialYearSelector;
