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
        <span><strong>PFMS Blockchain Transparency Network</strong> | National Public Finance Oversight</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={14} color="var(--color-accent)" />
          <span>Smart Contract: <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{formatAddress(getContractAddress())}</code></span>
        </div>
        <span>Hardhat Local EVM (Chain ID 31337)</span>
      </div>
    </footer>
  );
};

export default Footer;
