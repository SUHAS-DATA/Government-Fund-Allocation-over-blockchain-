import React from 'react';
import { ShieldCheck, Cpu, Coins, Lock, Activity, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  const steps = [
    {
      num: '01',
      title: 'Central National Budget Allocation',
      desc: 'Central Admin sets the yearly budget limits and approves funds for each national ministry and government scheme.'
    },
    {
      num: '02',
      title: 'Finance Ministry Releases Funds to States',
      desc: 'Ministry of Finance verifies the approved limits and transfers funds directly to State Treasury accounts on the blockchain.'
    },
    {
      num: '03',
      title: 'State Treasury Sends Funds to Districts',
      desc: 'State Treasury divides the received funds and sends budgets to District Development Offices for local work.'
    },
    {
      num: '04',
      title: 'District Creates Project & Assigns Contractor',
      desc: 'District officers check contractor credentials (GST, PAN, licenses) and lock project funds safely on the blockchain.'
    },
    {
      num: '05',
      title: 'Work Completed & Milestone Payment Released',
      desc: 'Contractors upload photos of completed work with digital verification. Officers inspect the site and release payments directly to the contractor.'
    },
    {
      num: '06',
      title: 'Audit Inspection & Fraud Protection',
      desc: 'Auditors continuously check records, verify documents, freeze funds if any irregularity is detected, and file public audit reports.'
    }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Cpu size={24} color="var(--color-primary)" />
            <span>How the Government Fund Tracking System Works</span>
          </h1>
          <p className="page-subtitle">
            A simple step-by-step guide showing how public funds flow transparently from the central government to local projects.
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
          Explore the Public Transparency Platform
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Check ongoing local projects or review confirmed blockchain payment records.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
          <Link to="/public/projects" className="btn btn-primary">
            <span>Browse Projects</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/public/explorer" className="btn btn-secondary">
            <span>View Blockchain Records</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
