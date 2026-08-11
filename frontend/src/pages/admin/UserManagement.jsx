import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = () => {
    API.get('/admin/users')
      .then((res) => {
        if (res.success) setUsers(res.users || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await API.put(`/admin/users/${userId}/role`, { role: newRole });
      loadUsers();
    } catch (e) { alert(e.message); }
  };

  const handleToggleStatus = async (userId, currentActive) => {
    try {
      await API.put(`/admin/users/${userId}/status`, { is_active: !currentActive });
      loadUsers();
    } catch (e) { alert(e.message); }
  };

  const columns = [
    {
      header: 'Officer / Representative Name',
      accessor: 'name',
      render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong>
    },
    { header: 'Email Address', accessor: 'email' },
    {
      header: 'Assigned Role',
      accessor: 'role',
      render: (r) => (
        <select
          className="form-control form-select"
          style={{ width: '150px', padding: '4px 8px', fontSize: '11px' }}
          value={r.role}
          onChange={(e) => handleRoleChange(r._id, e.target.value)}
        >
          <option value="SUPER_ADMIN">SUPER ADMIN</option>
          <option value="FINANCE">FINANCE</option>
          <option value="STATE">STATE OFFICER</option>
          <option value="DISTRICT">DISTRICT OFFICER</option>
          <option value="CONTRACTOR">CONTRACTOR</option>
          <option value="AUDITOR">AUDITOR</option>
        </select>
      )
    },
    {
      header: 'Status',
      accessor: 'is_active',
      render: (r) => (
        <span className={`badge ${r.is_active !== false ? 'badge-success' : 'badge-danger'}`}>
          {r.is_active !== false ? 'Active' : 'Suspended'}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (r) => (
        <button
          className={`btn btn-sm ${r.is_active !== false ? 'btn-danger' : 'btn-success'}`}
          style={{ fontSize: '11px', padding: '4px 8px' }}
          onClick={() => handleToggleStatus(r._id, r.is_active !== false)}
        >
          {r.is_active !== false ? 'Suspend' : 'Activate'}
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={24} color="var(--color-primary)" />
            <span>User & Role-Based Access Control</span>
          </h1>
          <p className="page-subtitle">Manage government officers, contractors, and forensic auditor authorization privileges.</p>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={users} searchKey="email" searchPlaceholder="Search users by email or name..." />
      </div>
    </div>
  );
};

export default UserManagement;
