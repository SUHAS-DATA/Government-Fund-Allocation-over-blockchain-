import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, Lock, ArrowRight } from 'lucide-react';
import API from '../../services/api';
import AnomalyAlertCard from '../../components/AnomalyAlertCard';

const AnomalyAnalytics = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/auditor/anomalies').then((res) => {
      if (res.success) setAnomalies(res.anomalies || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleAction = (anomaly) => {
    if (anomaly.project_id) {
      navigate(`/auditor/fraud-freeze?project_id=${anomaly.project_id}&reason=${encodeURIComponent(anomaly.title)}`);
    } else {
      navigate('/auditor/fraud-freeze');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <AlertTriangle size={24} color="var(--color-warning)" />
            <span>Forensic Anomaly & Fraud Risk Analytics</span>
          </h1>
          <p className="page-subtitle">
            Algorithmic detection of multi-level allocation variances, unassigned escrows, and contractor credential irregularities.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '14px' }}>
          Active High-Priority Forensic Risk Flags ({anomalies.length})
        </h3>

        {anomalies.length > 0 ? (
          anomalies.map((a, idx) => (
            <AnomalyAlertCard key={idx} anomaly={a} onAction={handleAction} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No forensic fraud anomalies detected. State and district allocations are 100% compliant.
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyAnalytics;
