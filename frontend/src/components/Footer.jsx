import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';
import { getContractAddress, formatAddress } from '../services/blockchain';

const Footer = () => {
  return (
    <footer style={{
      backgroundColor: '#FFFFFF',
      borderTop: '1px solid var(--border-color)',
      padding: '16px 24px',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={16} color="var(--color-success)" />
        <span><strong>Government Fund Allocation Tracking</strong> | Official Public Portal</span>
      </div>

      <div style={{ color: 'var(--text-muted)' }}>
        <span>© 2026 Government Fund Allocation Tracking System. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default Footer;
