import React from 'react';
import { AlertTriangle, ShieldAlert, Terminal, CheckCircle2 } from 'lucide-react';
import { VALID_PORTALS } from '../config/portalConfig';

const PortalConfigError = ({ detectedValue }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F8FAFC',
      padding: '24px',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '36px 32px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        textAlign: 'center'
      }}>
        {/* Warning Icon Badge */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FEE2E2',
          color: '#DC2626',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <AlertTriangle size={28} />
        </div>

        {/* Required Title */}
        <h1 style={{
          fontSize: '22px',
          fontWeight: '800',
          color: '#0F172A',
          letterSpacing: '-0.4px',
          marginBottom: '10px'
        }}>
          Portal configuration is missing or invalid.
        </h1>

        <p style={{
          fontSize: '13px',
          color: '#64748B',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          This application requires the Vite environment variable <code style={{ backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#0F172A', fontWeight: '700' }}>VITE_PORTAL</code> to determine which of the 5 dedicated governance portals to activate.
        </p>

        {/* Detected Environment Variable Box */}
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <Terminal size={14} />
            <span>Environment Diagnostic</span>
          </div>

          <div style={{ fontSize: '13px', color: '#0F172A', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>
            <span style={{ color: '#64748B' }}>Detected value: </span>
            <span style={{ fontWeight: '700', color: detectedValue ? '#DC2626' : '#94A3B8' }}>
              {detectedValue !== undefined && detectedValue !== null ? `"${detectedValue}"` : '<not set / undefined>'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#475569', borderTop: '1px dashed #CBD5E1', paddingTop: '10px', marginTop: '10px' }}>
            <div style={{ fontWeight: '700', marginBottom: '6px', color: '#0F172A' }}>
              Valid values are ONLY:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {VALID_PORTALS.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    fontFamily: "'JetBrains Mono', monospace",
                    backgroundColor: '#EFF6FF',
                    color: '#1E40AF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '4px',
                    padding: '2px 8px'
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '8px',
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: '12px',
          color: '#166534',
          marginBottom: '24px'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '4px' }}>How to set locally:</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#14532D' }}>
            Create or edit <code>frontend/.env</code>:
            <div style={{ backgroundColor: '#DCFCE7', padding: '6px 10px', borderRadius: '4px', marginTop: '4px', fontWeight: '700' }}>
              VITE_PORTAL=ADMIN
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
          Government Fund Allocation Tracking System • Multi-Portal Architecture
        </div>
      </div>
    </div>
  );
};

export default PortalConfigError;
