import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import FundAmountInput from '../../components/FundAmountInput';

const Schemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    department_code: 'INFRA',
    department_name: 'Road Transport & Infrastructure',
    description: '',
    target_budget: 1000000000
  });

  const loadData = () => {
    API.get('/admin/schemes').then((res) => { if (res.success) setSchemes(res.schemes || []); });
    API.get('/admin/departments').then((res) => { if (res.success) setDepartments(res.departments || []); });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/schemes', formData);
      setShowModal(false);
      loadData();
    } catch (e) { alert(e.message); }
  };

  const columns = [
    { header: 'Scheme Code', accessor: 'code', render: (r) => <span className="badge badge-info">{r.code}</span> },
    { header: 'Scheme Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    { header: 'Parent Ministry', accessor: 'department_name' },
    { header: 'Sanctioned Target Ceiling', accessor: 'target_budget', render: (r) => <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(r.target_budget)}</span> }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileSpreadsheet size={24} color="var(--color-primary)" />
            <span>Government Schemes Governance</span>
          </h1>
          <p className="page-subtitle">Define national development programs and designated expenditure ceilings.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} />
          <span>Add Government Scheme</span>
        </button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={schemes} searchKey="name" searchPlaceholder="Search schemes..." />
      </div>

      <Modal title="Add Government Scheme" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Scheme Code (e.g. PMGSY, NHIM, JAL-JEEVAN)</label>
            <input
              type="text"
              className="form-control"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Scheme Full Title</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Parent Ministry / Department</label>
            <select
              className="form-control form-select"
              value={formData.department_code}
              onChange={(e) => {
                const d = departments.find((dept) => dept.code === e.target.value);
                setFormData({ ...formData, department_code: e.target.value, department_name: d?.name || '' });
              }}
            >
              {departments.map((d) => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <FundAmountInput
            label="Sanctioned Scheme Target Ceiling"
            value={formData.target_budget}
            onChange={(val) => setFormData({ ...formData, target_budget: val })}
            required={true}
            helperText="Sanctioned ceiling in Crores, Lakhs, or Thousands. Ex: 100 (Cr)."
          />

          <div className="form-group">
            <label className="form-label">Scheme Objectives & Description</label>
            <textarea
              className="form-control"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Scheme</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Schemes;
