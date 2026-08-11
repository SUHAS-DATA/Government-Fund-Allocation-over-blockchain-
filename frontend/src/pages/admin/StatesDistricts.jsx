import React, { useState, useEffect } from 'react';
import { MapPin, Plus } from 'lucide-react';
import API from '../../services/api';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatAddress } from '../../services/blockchain';

const StatesDistricts = () => {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);

  const [stateForm, setStateForm] = useState({ code: '', name: '', treasury_address: '' });
  const [districtForm, setDistrictForm] = useState({ state_code: 'MH', state_name: 'Maharashtra', name: '', treasury_address: '' });

  const loadData = () => {
    API.get('/admin/states').then((res) => { if (res.success) setStates(res.states || []); });
    API.get('/admin/districts').then((res) => { if (res.success) setDistricts(res.districts || []); });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateState = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/states', stateForm);
      setShowStateModal(false);
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleCreateDistrict = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/districts', districtForm);
      setShowDistrictModal(false);
      loadData();
    } catch (e) { alert(e.message); }
  };

  const stateCols = [
    { header: 'Code', accessor: 'code', render: (r) => <span className="badge badge-info">{r.code}</span> },
    { header: 'State Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    { header: 'Treasury Wallet', accessor: 'treasury_address', render: (r) => <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{formatAddress(r.treasury_address)}</code> }
  ];

  const districtCols = [
    { header: 'State', accessor: 'state_name' },
    { header: 'District Name', accessor: 'name', render: (r) => <strong style={{ color: 'var(--text-main)' }}>{r.name}</strong> },
    { header: 'District Treasury', accessor: 'treasury_address', render: (r) => <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{formatAddress(r.treasury_address)}</code> }
  ];

  const [filterState, setFilterState] = useState('');

  const filteredDistricts = filterState
    ? districts.filter((d) => d.state_code === filterState)
    : districts;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MapPin size={24} color="var(--color-primary)" />
            <span>States & Districts Treasury Network</span>
          </h1>
          <p className="page-subtitle">Configure regional treasury wallets and jurisdiction hierarchies.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowStateModal(true)}>
            <Plus size={15} />
            <span>Add State</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowDistrictModal(true)}>
            <Plus size={15} />
            <span>Add District</span>
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">States Network ({states.length})</div>
          </div>
          <DataTable columns={stateCols} data={states} searchKey="name" />
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div className="card-title">Districts Network ({filteredDistricts.length})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>STATE:</span>
              <select
                className="form-control form-select"
                style={{ width: 'auto', padding: '3px 8px', fontSize: '11px' }}
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
              >
                <option value="">All States ({districts.length})</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>
          <DataTable columns={districtCols} data={filteredDistricts} searchKey="name" searchPlaceholder="Search districts..." />
        </div>
      </div>

      <Modal title="Add State" isOpen={showStateModal} onClose={() => setShowStateModal(false)}>
        <form onSubmit={handleCreateState}>
          <div className="form-group">
            <label className="form-label">State Code (e.g. MH, KA, GJ)</label>
            <input
              type="text"
              className="form-control"
              value={stateForm.code}
              onChange={(e) => setStateForm({ ...stateForm, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">State Full Name</label>
            <input
              type="text"
              className="form-control"
              value={stateForm.name}
              onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">State Treasury Wallet Address</label>
            <input
              type="text"
              className="form-control"
              placeholder="0x..."
              value={stateForm.treasury_address}
              onChange={(e) => setStateForm({ ...stateForm, treasury_address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowStateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save State</button>
          </div>
        </form>
      </Modal>

      <Modal title="Add District" isOpen={showDistrictModal} onClose={() => setShowDistrictModal(false)}>
        <form onSubmit={handleCreateDistrict}>
          <div className="form-group">
            <label className="form-label">State</label>
            <select
              className="form-control form-select"
              value={districtForm.state_code}
              onChange={(e) => {
                const st = states.find((s) => s.code === e.target.value);
                setDistrictForm({ ...districtForm, state_code: e.target.value, state_name: st?.name || '' });
              }}
            >
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">District Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Pune, Nagpur"
              value={districtForm.name}
              onChange={(e) => setDistrictForm({ ...districtForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">District Treasury Wallet Address</label>
            <input
              type="text"
              className="form-control"
              placeholder="0x..."
              value={districtForm.treasury_address}
              onChange={(e) => setDistrictForm({ ...districtForm, treasury_address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowDistrictModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save District</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StatesDistricts;
