import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import API from '../../services/api';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';

const AuditReportsReview = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/admin/audit-reports').then((res) => {
      if (res.success) setReports(res.audit_reports || []);
    }).finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      header: 'Audit ID',
      accessor: 'audit_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.audit_id}</strong>
    },
    { header: 'Project ID / Name', accessor: 'project_name', render: (r) => r.project_name || r.project_id },
    {
      header: 'Compliance Score',
      accessor: 'compliance_score',
      render: (r) => (
        <span style={{ fontWeight: '800', color: r.compliance_score >= 80 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {r.compliance_score}/100
        </span>
      )
    },
    {
      header: 'Audit Status',
      accessor: 'status',
      render: (r) => (
        <span className={`badge ${r.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
          {r.status}
        </span>
      )
    },
    { header: 'Forensic Auditor', accessor: 'auditor_name' },
    {
      header: 'Blockchain Tx',
      accessor: 'blockchain_tx_hash',
      render: (r) => <BlockchainBadge txHash={r.blockchain_tx_hash} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={24} color="var(--color-primary)" />
            <span>Forensic CAG Audit Reports Review</span>
          </h1>
          <p className="page-subtitle">
            Review formal forensic audit verdicts submitted by Comptroller & Auditor General division with on-chain proofs.
          </p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={reports} searchKey="project_name" />
      </div>
    </div>
  );
};

export default AuditReportsReview;
