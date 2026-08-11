import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle2, AlertCircle, Coins, TrendingUp, Layers, Check } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';

const FinancialYears = () => {
  const [fys, setFys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  
  const [formData, setFormData] = useState({
    year: '',
    title: '',
    total_budget: 5000000000,
    status: 'ACTIVE'
  });

  const loadFYs = () => {
    setLoading(true);
    API.get('/admin/financial-years')
      .then((res) => {
        if (res.success) {
          setFys(res.financial_years || []);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFYs();
  }, []);

  const openCreateModal = () => {
    setEditingYear(null);
    // Auto-calculate next logical year
    let nextYear = '2027-28';
    if (fys.length > 0) {
      const highestYear = fys[0]?.year; // e.g. "2026-27"
      if (highestYear && highestYear.includes('-')) {
        const start = parseInt(highestYear.split('-')[0], 10);
        if (!isNaN(start)) {
          const nextStart = start + 1;
          const nextEndSuffix = String(nextStart + 1).slice(-2);
          nextYear = `${nextStart}-${nextEndSuffix}`;
        }
      }
    }
    setFormData({
      year: nextYear,
      title: `Union Budget FY ${nextYear}`,
      total_budget: 6000000000,
      status: 'UPCOMING'
    });
    setShowModal(true);
  };

  const openEditModal = (fy) => {
    setEditingYear(fy.year);
    setFormData({
      year: fy.year,
      title: fy.title || `Union Budget FY ${fy.year}`,
      total_budget: fy.total_budget || 5000000000,
      status: fy.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setActionMsg('');
    try {
      const res = await API.post('/admin/financial-years', formData);
      if (res.success) {
        setActionMsg(`Financial Year ${formData.year} saved successfully!`);
        setShowModal(false);
        loadFYs();
      }
    } catch (e) {
      alert(e.message || 'Failed to save Financial Year');
    }
  };

  const handleSetActive = async (year) => {
    try {
      const res = await API.put(`/admin/financial-years/${year}/activate`, {});
      if (res.success) {
        setActionMsg(`Financial Year ${year} is now set as the active budget cycle.`);
        loadFYs();
      }
    } catch (e) {
      alert(e.message || 'Failed to activate Financial Year');
    }
  };

  const activeFY = fys.find((f) => f.status === 'ACTIVE') || fys[0];
  const totalSanctionedAcrossCycles = fys.reduce((acc, f) => acc + (f.total_budget || 0), 0);
  const totalAllocatedAcrossCycles = fys.reduce((acc, f) => acc + (f.allocated_amount || 0), 0);

  const columns = [
    {
      header: 'Financial Year',
      accessor: 'year',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong style={{ color: 'var(--color-primary)', fontSize: '14px', fontFamily: 'monospace' }}>
            FY {row.year}
          </strong>
          {row.status === 'ACTIVE' && (
            <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>
              CURRENT ACTIVE
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Budget Title',
      accessor: 'title',
      render: (row) => (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{row.title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Cycle: {row.start_date} to {row.end_date}
          </div>
        </div>
      )
    },
    {
      header: 'Sanctioned Ceiling',
      accessor: 'total_budget',
      render: (row) => (
        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
          {formatCurrency(row.total_budget)}
        </span>
      )
    },
    {
      header: 'Allocated to Schemes',
      accessor: 'allocated_amount',
      render: (row) => (
        <div>
          <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>
            {formatCurrency(row.allocated_amount || 0)}
          </span>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.allocations_count || 0} schemes assigned
          </div>
        </div>
      )
    },
    {
      header: 'Remaining Ceiling',
      accessor: 'remaining_budget',
      render: (row) => (
        <span style={{ fontWeight: '600', color: 'var(--color-info)' }}>
          {formatCurrency(row.remaining_budget != null ? row.remaining_budget : row.total_budget)}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`badge ${row.status === 'ACTIVE' ? 'badge-success' : row.status === 'UPCOMING' ? 'badge-info' : 'badge-secondary'}`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'action',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {row.status !== 'ACTIVE' ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleSetActive(row.year)}
              title="Set as current active financial year"
            >
              <Check size={12} />
              <span>Set Active</span>
            </button>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CheckCircle2 size={13} />
              <span>Active</span>
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            onClick={() => openEditModal(row)}
          >
            Edit
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar size={24} color="var(--color-primary)" />
            <span>Financial Years & Budget Cycles Management</span>
          </h1>
          <p className="page-subtitle">
            Configure multi-year national budget cycles, sanctioned expenditure limits, and historical cycle archives.
          </p>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={15} />
          <span>Provision New Financial Year</span>
        </button>
      </div>

      {actionMsg && (
        <div style={{
          background: 'var(--color-success-bg)',
          border: '1px solid var(--color-success-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 16px',
          color: 'var(--color-success)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="Active FY Sanctioned Ceiling"
          value={activeFY?.total_budget || 5000000000}
          icon={Coins}
          isCurrency={true}
          subtitle={`FY ${activeFY?.year || '2026-27'} Active Cycle`}
        />
        <StatCard
          title="Active FY Scheme Allocations"
          value={activeFY?.allocated_amount || 0}
          icon={TrendingUp}
          isCurrency={true}
          subtitle="Committed to National Schemes"
        />
        <StatCard
          title="Total Sanctioned (All Cycles)"
          value={totalSanctionedAcrossCycles}
          icon={Coins}
          isCurrency={true}
          subtitle="Multi-Year Total Ceilings"
        />
        <StatCard
          title="Recorded Budget Cycles"
          value={fys.length}
          icon={Layers}
          subtitle="Saved in Permanent Ledger"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Calendar size={18} color="var(--color-primary)" />
            <span>Recorded Financial Years</span>
          </div>
        </div>
        <DataTable columns={columns} data={fys} searchKey="year" searchPlaceholder="Search FY (e.g. 2026-27, 2027-28)..." />
      </div>

      {/* Provision / Edit Financial Year Modal */}
      <Modal
        title={editingYear ? `Edit Financial Year FY ${editingYear}` : "Provision New Financial Year"}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      >
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Financial Year (Format: YYYY-YY, e.g. 2027-28)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 2027-28"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              disabled={!!editingYear}
              required
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Standard Indian financial cycle: April 1st to March 31st of the subsequent year.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Budget Description / Title</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Union Budget FY 2027-2028"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Total Union Sanctioned Amount (INR)</label>
            <input
              type="number"
              className="form-control"
              value={formData.total_budget}
              onChange={(e) => setFormData({ ...formData, total_budget: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Initial Status</label>
            <select
              className="form-control form-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">ACTIVE (Current Live Budget Cycle)</option>
              <option value="UPCOMING">UPCOMING (Planned Future Cycle)</option>
              <option value="CLOSED">CLOSED (Historical Archived Cycle)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Financial Year
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FinancialYears;
