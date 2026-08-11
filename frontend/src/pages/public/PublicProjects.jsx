import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, MapPin, Building2, Coins, ArrowRight, ShieldCheck, Filter } from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import DataTable from '../../components/DataTable';

import StateDistrictSelector from '../../components/StateDistrictSelector';

const PublicProjects = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState(searchParams.get('state') || '');
  const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('district') || '');

  const loadProjects = (state = selectedState, district = selectedDistrict) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (district) params.append('district', district);
    if (searchParams.get('department')) params.append('department', searchParams.get('department'));
    if (searchParams.get('search')) params.append('search', searchParams.get('search'));

    API.get(`/public/projects?${params.toString()}`)
      .then((res) => {
        if (res.success) setProjects(res.projects || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects(selectedState, selectedDistrict);
  }, [selectedState, selectedDistrict, searchParams]);

  const handleStateFilterChange = (st) => {
    setSelectedState(st);
    setSelectedDistrict('');
    const newParams = new URLSearchParams(searchParams);
    if (st) newParams.set('state', st);
    else newParams.delete('state');
    newParams.delete('district');
    setSearchParams(newParams);
  };

  const handleDistrictFilterChange = (dist) => {
    setSelectedDistrict(dist);
    const newParams = new URLSearchParams(searchParams);
    if (dist) newParams.set('district', dist);
    else newParams.delete('district');
    setSearchParams(newParams);
  };

  const columns = [
    {
      header: 'Project ID',
      accessor: 'project_id',
      render: (row) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{row.project_id}</strong>
    },
    {
      header: 'Project Title & Scheme',
      accessor: 'name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{row.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.scheme_name}</div>
        </div>
      )
    },
    {
      header: 'District',
      accessor: 'district_name',
      render: (row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <MapPin size={12} color="var(--text-muted)" />
          <span>{row.district_name}</span>
        </span>
      )
    },
    {
      header: 'Sanctioned Budget',
      accessor: 'total_budget',
      render: (row) => <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(row.total_budget)}</span>
    },
    {
      header: 'Released from Escrow',
      accessor: 'released_amount',
      render: (row) => (
        <div>
          <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{formatCurrency(row.released_amount || 0)}</span>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Progress: {row.progress_percentage || 0}%
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`badge ${row.is_frozen ? 'badge-danger' : row.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>
          {row.is_frozen ? 'FROZEN' : row.status?.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Audit & Details',
      accessor: 'action',
      render: (row) => (
        <Link to={`/public/projects/${row.project_id}`} className="btn btn-secondary btn-sm">
          <span>Inspect</span>
          <ArrowRight size={12} />
        </Link>
      )
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Building2 size={24} color="var(--color-primary)" />
            <span>Public Infrastructure Projects Directory</span>
          </h1>
          <p className="page-subtitle">
            Transparent public register of ongoing and completed government development initiatives.
          </p>
        </div>
      </div>

      {/* Dependent State & District Filter Card */}
      <div className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
            <Filter size={15} color="var(--color-primary)" />
            <span>Filter Projects by Jurisdiction</span>
          </div>
          {(selectedState || selectedDistrict) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedState('');
                setSelectedDistrict('');
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('state');
                newParams.delete('district');
                setSearchParams(newParams);
              }}
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              Reset Regional Filter
            </button>
          )}
        </div>

        <StateDistrictSelector
          selectedState={selectedState}
          selectedDistrict={selectedDistrict}
          onStateChange={handleStateFilterChange}
          onDistrictChange={handleDistrictFilterChange}
          showAllOption={true}
          allStatesLabel="All States / UTs"
          allDistrictsLabel="All Districts in State"
          stateLabel="Filter State Treasury"
          districtLabel="Filter District Agency"
          layout="grid"
        />
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={projects}
          searchKey="name"
          searchPlaceholder="Filter projects by title or ID..."
        />
      </div>
    </div>
  );
};

export default PublicProjects;
