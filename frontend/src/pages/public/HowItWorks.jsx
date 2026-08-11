import React from 'react';
import { ShieldCheck, Cpu, Coins, Lock, Activity, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  const steps = [
    {
      num: '01',
      title: 'Central Union Budget Allocation',
      desc: 'Super Admin and National Planning Authority establish financial year limits and sanction budget ceilings to ministerial departments with cryptographic block registration.'
    },
    {
      num: '02',
      title: 'Finance Disbursal to State Treasury',
      desc: 'Ministry of Finance verifies allocation ceilings, prevents double-spending, and executes on-chain transfer orders directly to designated State Treasury wallets.'
    },
    {
      num: '03',
      title: 'Regional Distribution to District Agencies',
      desc: 'State Treasury allocates regional quotas to District Development Agencies (DRDA), ensuring allocations do not exceed received state balances.'
    },
    {
      num: '04',
      title: 'Smart Contract Escrow & Contractor KYC',
      desc: 'District officers review statutory GSTN, PAN, and PWD credentials off-chain, anchor cryptographic digests, and deploy escrow contracts on Ethereum.'
    },
    {
      num: '05',
      title: 'Milestone Disbursal & SHA-256 Proofs',
      desc: 'Contractors upload site progress photos with calculated SHA-256 digests. District inspection triggers smart contract payment release directly to contractor wallet.'
    },
    {
      num: '06',
      title: 'CAG Forensic Audit & Fraud Safeguards',
      desc: 'Comptroller & Auditor General cell audits transactions, matches document hashes in real-time, executes emergency fund freezes if needed, and files audit reports.'
    }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Cpu size={24} color="var(--color-primary)" />
            <span>How the Blockchain Fund Allocation System Operates</span>
          </h1>
          <p className="page-subtitle">
            A comprehensive overview of cryptographic multi-tier governance, smart contract escrows, and forensic auditing.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {steps.map((s, idx) => (
          <div key={idx} className="card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '0.5px', marginBottom: '6px' }}>
              STEP {s.num}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
              {s.title}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-subtle)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '8px' }}>
          Explore the Live Transparency Platform
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Inspect ongoing grassroots projects or review confirmed Ethereum blockchain transaction receipts.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
          <Link to="/public/projects" className="btn btn-primary">
            <span>Browse Projects</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/public/explorer" className="btn btn-secondary">
            <span>View Blockchain Ledger</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
