import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, Lock } from 'lucide-react';

const AnomalyAlertCard = ({ anomaly, onAction }) => {
  if (!anomaly) return null;

  const isCritical = anomaly.severity === 'CRITICAL' || anomaly.severity === 'HIGH';

  return (
    <div style={{
      background: isCritical ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
      border: `1px solid ${isCritical ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isCritical ? (
          <ShieldAlert size={22} color="var(--color-danger)" />
        ) : (
          <AlertTriangle size={22} color="var(--color-warning)" />
        )}

        <div>
          <div style={{ fontWeight: '700', fontSize: '13px', color: isCritical ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            [{anomaly.severity}] {anomaly.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {anomaly.description}
          </div>
        </div>
      </div>

      {onAction && (
        <button
          onClick={() => onAction(anomaly)}
          className={`btn btn-sm ${isCritical ? 'btn-danger' : 'btn-warning'}`}
          style={{ flexShrink: 0 }}
        >
          <Lock size={12} />
          <span>Investigate / Freeze</span>
        </button>
      )}
    </div>
  );
};

export default AnomalyAlertCard;
