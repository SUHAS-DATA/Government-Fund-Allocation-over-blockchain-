import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Plus, Send, ShieldCheck, ArrowRight, Calendar, Filter, TrendingUp, Layers } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import BlockchainBadge from '../../components/BlockchainBadge';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FundAmountInput from '../../components/FundAmountInput';

const BudgetAllocation = () => {
  const [allocations, setAllocations] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [selectedFY, setSelectedFY] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    financial_year: '2026-27',
    department: 'Road Transport & Infrastructure',
    scheme_name: 'Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)',
    amount: 1000000000
  });

  const loadData = (fyFilter = selectedFY) => {
    setLoading(true);
    const query = fyFilter && fyFilter !== 'ALL' ? `?fy=${fyFilter}` : '';
    
    API.get(`/admin/allocations${query}`).then((res) => {
      if (res.success) setAllocations(res.allocations || []);
    }).finally(() => setLoading(false));

    API.get('/admin/financial-years').then((res) => {
      if (res.success && res.financial_years?.length > 0) {
        setFinancialYears(res.financial_years);
        const activeYear = res.financial_years.find(f => f.status === 'ACTIVE')?.year || res.financial_years[0].year;
        setFormData((prev) => ({
          ...prev,
          financial_year: prev.financial_year || activeYear
        }));
      }
    });

    API.get('/admin/departments').then((res) => {
      if (res.success) setDepartments(res.departments || []);
    });

    API.get('/admin/schemes').then((res) => {
      if (res.success) setSchemes(res.schemes || []);
    });
  };

  useEffect(() => {
    loadData(selectedFY);
  }, [selectedFY]);

  const handleAllocate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await API.post('/admin/budget/allocate', formData);
      if (res.success) {
        setShowModal(false);
        loadData(selectedFY);
      }
    } catch (err) {
      alert(err.message || 'Allocation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openAllocateModal = () => {
    const defaultFY = selectedFY !== 'ALL' ? selectedFY : (financialYears.find(f => f.status === 'ACTIVE')?.year || '2026-27');
    setFormData((prev) => ({
      ...prev,
      financial_year: defaultFY
    }));
    setShowModal(true);
  };

  // Selected FY metadata
  const currentFYDoc = selectedFY !== 'ALL' ? financialYears.find(f => f.year === selectedFY) : null;
  const activeFYDoc = financialYears.find(f => f.status === 'ACTIVE');
  
  const totalSanctionedInView = currentFYDoc 
    ? (currentFYDoc.total_budget || 0) 
    : financialYears.reduce((acc, f) => acc + (f.total_budget || 0), 0);

  const totalAllocatedInView = allocations.reduce((acc, a) => acc + (a.amount || 0), 0);
  const remainingCeilingInView = currentFYDoc 
    ? Math.max(0, currentFYDoc.total_budget - totalAllocatedInView) 
    : Math.max(0, totalSanctionedInView - totalAllocatedInView);

  const columns = [
    {
      header: 'Allocation ID',
      accessor: 'allocation_id',
      render: (r) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{r.allocation_id}</strong>
    },
    {
      header: 'Financial Year',
      accessor: 'financial_year',
      render: (r) => (
        <span className="badge badge-info" style={{ fontWeight: '700' }}>
          FY {r.financial_year}
        </span>
      )
    },
    { header: 'Department', accessor: 'department' },
    { header: 'Scheme Title', accessor: 'scheme_name' },
    {
      header: 'Sanctioned Amount',
      accessor: 'amount',
      render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.amount)}</span>
    },
    {
      header: 'Disbursed',
      accessor: 'disbursed_amount',
      render: (r) => formatCurrency(r.disbursed_amount || 0)
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => (
        <span className={`badge ${r.status === 'FULLY_DISBURSED' ? 'badge-success' : 'badge-info'}`}>
          {r.status?.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Blockchain Tx',
      accessor: 'blockchain_tx_hash',
      render: (r) => <BlockchainBadge txHash={r.blockchain_tx_hash} blockNumber={r.blockchain_block} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Coins size={24} color="var(--color-primary)" />
            <span>Central Budget Allocation</span>
          </h1>
          <p className="page-subtitle">
            Sanction union budget funds across national scheme programs with multi-year cycle tracking and blockchain anchoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={openAllocateModal}>
            <Plus size={15} />
            <span>New Budget Allocation</span>
          </button>
          <Link to="/admin/send-to-finance" className="btn btn-secondary">
            <Send size={15} />
            <span>Send to Finance Department</span>
          </Link>
        </div>
      </div>

      {/* Financial Year Cycle Summary Banner */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* FY Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={14} />
            <span>FILTER BY FY:</span>
          </span>

          <button
            type="button"
            className={`btn btn-sm ${selectedFY === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={() => setSelectedFY('ALL')}
          >
            All Cycles ({financialYears.length})
          </button>

          {financialYears.map((fy) => {
            const isSelected = selectedFY === fy.year;
            return (
              <button
                key={fy.year}
                type="button"
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => setSelectedFY(fy.year)}
              >
                <span>FY {fy.year}</span>
                {fy.status === 'ACTIVE' && <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.8 }}>(Active)</span>}
              </button>
            );
          })}
        </div>

        {/* Selected FY Financial Metrics Quick Summary */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Sanctioned Ceiling: </span>
            <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(totalSanctionedInView)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Allocated: </span>
            <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(totalAllocatedInView)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Remaining: </span>
            <strong style={{ color: 'var(--color-info)' }}>{formatCurrency(remainingCeilingInView)}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={allocations}
          searchKey="scheme_name"
          searchPlaceholder={`Search ${selectedFY !== 'ALL' ? `FY ${selectedFY}` : 'all'} allocations...`}
        />
      </div>

      <Modal title="Create Central Budget Allocation" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleAllocate}>
          <div className="form-group">
            <label className="form-label">Financial Year</label>
            <select
              className="form-control form-select"
              value={formData.financial_year}
              onChange={(e) => setFormData({ ...formData, financial_year: e.target.value })}
            >
              {financialYears.length > 0 ? (
                financialYears.map((fy) => (
                  <option key={fy.year} value={fy.year}>
                    FY {fy.year} ({fy.title || 'Union Budget'} — Ceiling: {formatCurrency(fy.total_budget)}) {fy.status === 'ACTIVE' ? '★ ACTIVE' : ''}
                  </option>
                ))
              ) : (
                <option value="2026-27">FY 2026-27 (Active Union Budget)</option>
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Ministry / Department</label>
            <select
              className="form-control form-select"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d.code} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Government Scheme</label>
            <select
              className="form-control form-select"
              value={formData.scheme_name}
              onChange={(e) => setFormData({ ...formData, scheme_name: e.target.value })}
            >
              {schemes.map((s) => (
                <option key={s.code} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <FundAmountInput
            label="Sanctioned Scheme Allocation Amount"
            value={formData.amount}
            onChange={(val) => setFormData({ ...formData, amount: val })}
            required={true}
            helperText="Specify scheme allocation in Crores, Lakhs, or Thousands. Ex: 100 (Cr)."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <ShieldCheck size={15} />
              <span>{submitting ? 'Executing On-Chain...' : 'Allocate on Blockchain'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BudgetAllocation;
