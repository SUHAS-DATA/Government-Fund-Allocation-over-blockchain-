import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Laptop,
  Cloud,
  Check,
  Zap,
  Info
} from 'lucide-react';
import {
  getApiConnectionDetails,
  setApiHost,
  resetApiHost,
  testBackendHealth,
  DEFAULT_LOCAL_BACKEND,
  DEFAULT_CLOUD_BACKEND
} from '../services/api';

export const ApiConnectionModal = ({ isOpen, onClose }) => {
  const [details, setDetails] = useState(getApiConnectionDetails());
  const [selectedTarget, setSelectedTarget] = useState(details.currentHost);
  const [customInput, setCustomInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getApiConnectionDetails();
      setDetails(current);
      setSelectedTarget(current.currentHost);
      if (current.mode === 'CUSTOM') {
        setCustomInput(current.currentHost);
      }
      setSavedSuccess(false);
      // Run quick auto-ping when opened
      runHealthCheck(current.currentHost);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runHealthCheck = async (targetToTest) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testBackendHealth(targetToTest);
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleApply = (targetUrl) => {
    const finalUrl = targetUrl || selectedTarget;
    if (finalUrl === DEFAULT_CLOUD_BACKEND) {
      resetApiHost();
    } else {
      setApiHost(finalUrl);
    }
    const updated = getApiConnectionDetails();
    setDetails(updated);
    setSelectedTarget(updated.currentHost);
    setSavedSuccess(true);
    runHealthCheck(updated.currentHost);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetToDefault = () => {
    resetApiHost();
    const updated = getApiConnectionDetails();
    setDetails(updated);
    setSelectedTarget(DEFAULT_CLOUD_BACKEND);
    setSavedSuccess(true);
    runHealthCheck(DEFAULT_CLOUD_BACKEND);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const isLocalSelected = selectedTarget === DEFAULT_LOCAL_BACKEND || selectedTarget.includes('127.0.0.1') || selectedTarget.includes('localhost');
  const isCloudSelected = selectedTarget === DEFAULT_CLOUD_BACKEND || selectedTarget.includes('onrender.com');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981'
              }}
            >
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                  Backend API & Blockchain Network Settings
                </h2>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Safely route transactions between the deployed Vercel frontend and your local Ganache blockchain
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#94A3B8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Status Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              border: details.isLocalTarget ? '1px solid #A7F3D0' : '1px solid #BAE6FD',
              backgroundColor: details.isLocalTarget ? '#ECFDF5' : '#F0F9FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: details.isLocalTarget ? '#065F46' : '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CURRENT ACTIVE CONNECTION
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{details.currentBaseUrl}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: details.isLocalTarget ? '#10B981' : '#0284C7',
                    color: '#FFFFFF'
                  }}
                >
                  {details.isLocalTarget ? 'LOCAL GANACHE TARGET' : 'CLOUD BACKEND'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => runHealthCheck(details.currentHost)}
              disabled={testing}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={13} className={testing ? 'spin' : ''} />
              <span>{testing ? 'Testing...' : 'Test Ping'}</span>
            </button>
          </div>

          {/* Health Diagnostics Output */}
          {testResult && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '10px',
                backgroundColor: testResult.success ? '#F0FDF4' : '#FEF2F2',
                border: testResult.success ? '1px solid #BBF7D0' : '1px solid #FECACA',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: testResult.success ? '#166534' : '#991B1B' }}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>
                  {testResult.success
                    ? `Backend Connected (${testResult.latency}ms) • Status: ${testResult.data?.status || 'HEALTHY'}`
                    : `Connection Failed: ${testResult.error}`}
                </span>
              </div>

              {testResult.success && testResult.data?.blockchain && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #DCFCE7', fontSize: '12px', color: '#14532D', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                  <div>
                    <strong>Blockchain Connected:</strong> {testResult.data.blockchain.connected ? '✅ Yes' : '❌ Disconnected'}
                  </div>
                  <div>
                    <strong>Chain ID:</strong> {testResult.data.blockchain.chain_id || '1337'}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Contract Address:</strong> <code style={{ fontSize: '11px', background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: '4px' }}>{testResult.data.blockchain.contract_address}</code>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Contract Deployed:</strong> {testResult.data.blockchain.contract_deployed ? '✅ Verified on-chain' : '❌ Not deployed'}
                  </div>
                </div>
              )}

              {!testResult.success && testResult.hint && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#7F1D1D', background: '#FEE2E2', padding: '8px 10px', borderRadius: '6px' }}>
                  <strong>Advisory:</strong> {testResult.hint}
                </div>
              )}
            </div>
          )}

          {/* Connection Mode Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'block' }}>
              Select Connection Target
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Option 1: Local Backend (Ganache) */}
              <div
                onClick={() => {
                  setSelectedTarget(DEFAULT_LOCAL_BACKEND);
                  runHealthCheck(DEFAULT_LOCAL_BACKEND);
                }}
                style={{
                  border: isLocalSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                  backgroundColor: isLocalSelected ? '#F0FDF4' : '#FFFFFF',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Laptop size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                          Local Backend (Localhost / Ganache)
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '10px', background: '#D1FAE5', color: '#065F46' }}>
                          RECOMMENDED FOR GANACHE
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#059669', fontWeight: '700', marginTop: '2px' }}>
                        {DEFAULT_LOCAL_BACKEND}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isLocalSelected ? '6px solid #059669' : '2px solid #CBD5E1',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                </div>

                <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569', lineHeight: '1.5', paddingLeft: '48px' }}>
                  Connects directly to your local FastAPI backend running on your computer. All transactions are signed locally and sent to your Ganache instance (Chain ID 1337). No private keys or Ganache RPC ports are exposed over the public internet.
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#047857', fontWeight: '600' }}>
                    • Prerequisite: Ensure <code>python app.py</code> is running in your local backend terminal.
                  </div>
                </div>
              </div>

              {/* Option 2: Cloud Backend (Render Default) */}
              <div
                onClick={() => {
                  setSelectedTarget(DEFAULT_CLOUD_BACKEND);
                  runHealthCheck(DEFAULT_CLOUD_BACKEND);
                }}
                style={{
                  border: isCloudSelected && !isLocalSelected ? '2px solid #0284C7' : '1px solid #CBD5E1',
                  backgroundColor: isCloudSelected && !isLocalSelected ? '#F0F9FF' : '#FFFFFF',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        color: '#0284C7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Cloud size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                          Deployed Cloud Backend (Render Default)
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '10px', background: '#E0F2FE', color: '#0369A1' }}>
                          DEFAULT
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0284C7', fontWeight: '700', marginTop: '2px' }}>
                        {DEFAULT_CLOUD_BACKEND}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isCloudSelected && !isLocalSelected ? '6px solid #0284C7' : '2px solid #CBD5E1',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                </div>

                <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569', lineHeight: '1.5', paddingLeft: '48px' }}>
                  The default production cloud backend hosted on Render. Connects to Ethereum Sepolia Testnet (Chain ID 11155111) for decentralized on-chain ledger tracking.
                </div>
              </div>

            </div>
          </div>

          {/* Browser Local Network / Security Note */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '10px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <Info size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
              <strong>Browser Local Network Policy (When on Vercel):</strong>
              <br />
              Modern browsers allow web applications to communicate with local services on <code>127.0.0.1</code> via W3C Secure Contexts.
              Our local backend includes standard <code>Access-Control-Allow-Private-Network: true</code> headers.
              If your browser blocks local requests, click the <strong>tune/lock icon</strong> in the browser URL bar $\rightarrow$ <strong>Site settings</strong> $\rightarrow$ set <strong>Insecure content</strong> to <strong>Allow</strong>.
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            style={{
              background: 'transparent',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Reset to Default Cloud
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {savedSuccess && (
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={14} /> Saved & Connected!
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => handleApply(selectedTarget)}
              style={{
                background: '#059669',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '800',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
              }}
            >
              <Zap size={14} />
              <span>Apply & Use {isLocalSelected ? 'Local Backend' : 'Cloud Backend'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const ApiConnectionPill = ({ style = {}, onOpenModal = () => {} }) => {
  const [details, setDetails] = useState(getApiConnectionDetails());

  useEffect(() => {
    const handleUpdate = () => {
      setDetails(getApiConnectionDetails());
    };
    window.addEventListener('govtfund_api_host_changed', handleUpdate);
    return () => window.removeEventListener('govtfund_api_host_changed', handleUpdate);
  }, []);

  const isLocal = details.isLocalTarget;

  return (
    <button
      type="button"
      onClick={onOpenModal}
      title={`Active API: ${details.currentBaseUrl} (Click to change backend)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: '700',
        cursor: 'pointer',
        backgroundColor: isLocal ? '#ECFDF5' : '#F0F9FF',
        color: isLocal ? '#065F46' : '#0369A1',
        border: `1px solid ${isLocal ? '#A7F3D0' : '#BAE6FD'}`,
        transition: 'all 0.15s ease',
        ...style
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = isLocal ? '#059669' : '#0284C7';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = isLocal ? '#A7F3D0' : '#BAE6FD';
      }}
    >
      {isLocal ? <Laptop size={13} color="#059669" /> : <Cloud size={13} color="#0284C7" />}
      <span>{isLocal ? 'LOCAL (127.0.0.1:5000)' : 'CLOUD API'}</span>
    </button>
  );
};

export default ApiConnectionModal;
