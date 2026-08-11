import React, { useState, useEffect } from 'react';
import { Building2, Plus } from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    budget_share: 20,
    head: ''
  });

  const loadDepartments = () => {
    API.get('/admin/departments').then((res) => {
      if (res.success) setDepartments(res.departments || []);
    });
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/departments', formData);
      setShowModal(false);
      loadDepartments();
    } catch (e) {
      alert(e.message);
    }
  };

  const columns = [
    { header: 'Code', accessor: 'code', render: (r) => <span className="badge badge-info">{r.code}</span> },
    { header: 'Department Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    { header: 'Budget Share (%)', accessor: 'budget_share', render: (r) => `${r.budget_share}%` },
    { header: 'Department Head / Secretary', accessor: 'head' }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--color-primary)" />
            <span>Government Departments & Ministries</span>
          </h1>
          <p className="page-subtitle">Configure ministerial quotas and designated administrative authorities.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} />
          <span>Add Department</span>
        </button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={departments} searchKey="name" searchPlaceholder="Search departments..." />
      </div>

      <Modal title="Add Department" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Department Code (e.g. INFRA, HEALTH)</label>
            <input
              type="text"
              className="form-control"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Department Full Name</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Budget Share Percentage (%)</label>
            <input
              type="number"
              className="form-control"
              value={formData.budget_share}
              onChange={(e) => setFormData({ ...formData, budget_share: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Department Head / Secretary</label>
            <input
              type="text"
              className="form-control"
              value={formData.head}
              onChange={(e) => setFormData({ ...formData, head: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Department</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Departments;
