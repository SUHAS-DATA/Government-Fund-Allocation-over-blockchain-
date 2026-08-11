import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, 
  Coins, 
  UserCheck, 
  MessageSquareWarning, 
  Plus, 
  ShieldCheck, 
  TrendingUp,
  MapPin,
  Building
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency } from '../../services/blockchain';
import StatCard from '../../components/StatCard';
import BlockchainBadge from '../../components/BlockchainBadge';
import { useAuth } from '../../context/AuthContext';

import { getAllStates, getDistrictsByState, getStateForDistrict, getState } from '../../config/statesDistrictsData';

const DistrictDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const initialDistrict = user?.district_name || 'Belagavi';
  const initialDistrictState = getStateForDistrict(initialDistrict)?.code || user?.state_code || 'KA';

  const isDistrictOfficer = user?.role === 'DISTRICT';
  const assignedDistrict = user?.district_name || 'Belagavi';
  const assignedStateCode = user?.state_code || getStateForDistrict(assignedDistrict)?.code || 'KA';
  const assignedStateName = user?.state_name || getState(assignedStateCode)?.name || 'Karnataka';

  const [selectedState, setSelectedState] = useState(isDistrictOfficer ? assignedStateCode : initialDistrictState);
  const [selectedDistrict, setSelectedDistrict] = useState(isDistrictOfficer ? assignedDistrict : initialDistrict);

  const loadDashboard = (district = selectedDistrict) => {
    setLoading(true);
    const targetDist = isDistrictOfficer ? assignedDistrict : district;
    const query = targetDist ? `?district=${encodeURIComponent(targetDist)}` : '';
    API.get(`/district/dashboard${query}`)
      .then((res) => {
        if (res.success) {
          setData(res);
          if (res.district_name && !selectedDistrict) {
            setSelectedDistrict(res.district_name);
          }
        }
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isDistrictOfficer) {
      setSelectedDistrict(assignedDistrict);
      setSelectedState(assignedStateCode);
      loadDashboard(assignedDistrict);
    } else {
      loadDashboard(selectedDistrict);
    }
  }, [selectedDistrict, user]);

  const metrics = data?.metrics;
  const availableDistricts = getDistrictsByState(selectedState);

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 className="page-title">
            <FolderKanban size={24} color="var(--color-primary)" />
            <span>District Development Authority Dashboard ({isDistrictOfficer ? assignedDistrict : (data?.district_name || selectedDistrict)})</span>
          </h1>
          <p className="page-subtitle">
            Local project creation, contractor KYC verification, smart contract escrow funding, and milestone payment releases.
          </p>
        </div>

        {/* District Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* If District Officer: Show Locked Jurisdiction Badge */}
          {isDistrictOfficer ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(124, 58, 237, 0.08)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid #DDD6FE',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <MapPin size={16} color="#7C3AED" />
              <div>
                <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#7C3AED' }}>
                  Assigned District Jurisdiction
                </div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                  {assignedDistrict} ({assignedStateName})
                </div>
              </div>
              <span className="badge badge-success" style={{ fontSize: '10px', marginLeft: '6px' }}>
                🔒 Authorized
              </span>
            </div>
          ) : (
            /* Super Admin / Higher Authority Switcher */
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#FFFFFF',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>STATE:</span>
              <select
                className="form-control form-select"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
                value={selectedState}
                onChange={(e) => {
                  const newSt = e.target.value;
                  setSelectedState(newSt);
                  const dists = getDistrictsByState(newSt);
                  if (dists.length > 0) {
                    setSelectedDistrict(dists[0].name);
                  }
                }}
              >
                {getAllStates().map((s) => (
                  <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>

              <span style={{ color: 'var(--border-color)' }}>|</span>

              <MapPin size={14} color="var(--color-primary)" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>DISTRICT:</span>
              <select
                className="form-control form-select"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', fontWeight: '700', border: 'none', background: 'transparent' }}
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                {availableDistricts.map((d, idx) => (
                  <option key={`${d.name}-${idx}`} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link to={`/district/projects`} className="btn btn-primary btn-sm">
            <Plus size={14} />
            <span>New Local Project</span>
          </Link>
          <Link to="/district/contractors" className="btn btn-secondary btn-sm">
            <UserCheck size={14} />
            <span>Review KYC</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard
          title="District Funds Received"
          value={metrics?.total_funds_received || 0}
          icon={Coins}
          isCurrency={true}
          subtitle={`Allocated to ${data?.district_name || selectedDistrict}`}
        />
        <StatCard
          title="Active Projects in District"
          value={metrics?.active_projects_count || 0}
          icon={FolderKanban}
          subtitle={`${metrics?.total_projects_count || 0} Total Projects in ${data?.district_name || selectedDistrict}`}
        />
        <StatCard
          title="Milestones Released"
          value={metrics?.total_payments_released || 0}
          icon={TrendingUp}
          isCurrency={true}
          subtitle="Smart Contract Escrow Releases"
        />
        <StatCard
          title="Pending Contractor KYC"
          value={metrics?.pending_kyc_count || 0}
          icon={UserCheck}
          subtitle="Verification Required"
        />
      </div>

      {/* 2-Column: Recent Projects & Received State Funds */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FolderKanban size={18} color="var(--color-primary)" />
              <span>Active Projects in {data?.district_name || selectedDistrict}</span>
            </div>
            <Link to={`/district/projects?district=${encodeURIComponent(selectedDistrict)}`} className="btn btn-secondary btn-sm">
              View All
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.recent_projects?.length > 0 ? (
              data.recent_projects.map((p) => (
                <div key={p.project_id} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ID: <span style={{ fontFamily: 'monospace' }}>{p.project_id}</span> | Scheme: {p.scheme_name}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '14px' }}>
                      {formatCurrency(p.total_budget)}
                    </div>
                    {p.escrow_tx_hash && <BlockchainBadge txHash={p.escrow_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No projects created for {data?.district_name || selectedDistrict} yet.
                <div style={{ marginTop: '8px' }}>
                  <Link to={`/district/projects?district=${encodeURIComponent(selectedDistrict)}`} className="btn btn-primary btn-sm">
                    Create Project for {data?.district_name || selectedDistrict}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Coins size={18} color="var(--color-primary)" />
              <span>Received State Allocations ({data?.district_name || selectedDistrict})</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data?.received_funds?.length > 0 ? (
              data.received_funds.map((f, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '13px' }}>{f.scheme_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ID: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{f.district_alloc_id}</span> | {f.department}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--color-success)', fontSize: '14px' }}>
                      {formatCurrency(f.amount)}
                    </div>
                    {f.blockchain_tx_hash && <BlockchainBadge txHash={f.blockchain_tx_hash} />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No state treasury allocations found for {data?.district_name || selectedDistrict}.
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  State Finance Department can allocate funds via the State Treasury Portal.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistrictDashboard;
