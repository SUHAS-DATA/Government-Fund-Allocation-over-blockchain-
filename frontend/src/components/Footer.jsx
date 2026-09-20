import React from 'react';
import { ShieldCheck, Lock, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer style={{
      backgroundColor: '#FFFFFF',
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto',
      fontSize: '12px'
    }}>
      {/* Tricolor Accent Stripe */}
      <div className="tricolor-stripe" style={{ height: '2px' }} />

      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 32px 18px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontWeight: '800', color: 'var(--color-gov-navy)', fontSize: '13px' }}>
              Public Financial Management & Blockchain Ledger System
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Digital Governance Initiative • National Expenditure Oversight
            </div>
          </div>
        </div>

        {/* Center: Essential Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>
          <Link to="/public/projects" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}>
            Public Projects
          </Link>
          <span style={{ color: 'var(--border-color)' }}>•</span>
          <Link to="/public/explorer" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}>
            Ledger Explorer
          </Link>
          <span style={{ color: 'var(--border-color)' }}>•</span>
          <Link to="/public/grievance" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}>
            Grievance Redressal
          </Link>
          <span style={{ color: 'var(--border-color)' }}>•</span>
          <Link to="/how-it-works" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'inherit'}>
            Architecture
          </Link>
        </div>

        {/* Right: Security Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          color: '#166534',
          fontWeight: '700'
        }}>
          <Lock size={12} color="#16A34A" />
          <span>256-Bit SHA Encryption & On-Chain Audit</span>
        </div>
      </div>

      {/* Bottom Sub-bar */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '10px 32px',
        backgroundColor: '#F8FAFC',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '11px'
      }}>
        <span>© 2026 Government Fund Allocation Tracking System. Designed for transparent public financial governance and multi-tier statutory compliance.</span>
      </div>
    </footer>
  );
};

export default Footer;
