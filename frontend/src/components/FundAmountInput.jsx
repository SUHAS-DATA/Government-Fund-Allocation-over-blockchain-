import React, { useState, useEffect } from 'react';
import { Coins, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../services/blockchain';

// Denomination Units & Multipliers
export const FUND_UNITS = [
  { key: 'CR', label: 'Crores (Cr)', short: 'Cr', multiplier: 10000000 },
  { key: 'LAKH', label: 'Lakhs (Lakh)', short: 'Lakh', multiplier: 100000 },
  { key: 'THOUSAND', label: 'Thousands (k)', short: 'k', multiplier: 1000 },
  { key: 'INR', label: 'Rupees (₹)', short: '₹', multiplier: 1 }
];

// Quick Selection Presets: Ex: 100 (Cr), 50 (Lakh), 10 (k)
export const FUND_PRESETS = [
  { label: '-- Quick Amount Presets (Click to Select) --', amount: null, unit: null },
  { label: '100 (Cr)  —  ₹100 Crores', amount: 100, unit: 'CR' },
  { label: '50 (Cr)   —  ₹50 Crores', amount: 50, unit: 'CR' },
  { label: '25 (Cr)   —  ₹25 Crores', amount: 25, unit: 'CR' },
  { label: '10 (Cr)   —  ₹10 Crores', amount: 10, unit: 'CR' },
  { label: '5 (Cr)    —  ₹5 Crores', amount: 5, unit: 'CR' },
  { label: '2 (Cr)    —  ₹2 Crores', amount: 2, unit: 'CR' },
  { label: '1 (Cr)    —  ₹1 Crore', amount: 1, unit: 'CR' },
  { label: '50 (Lakh) —  ₹50 Lakhs', amount: 50, unit: 'LAKH' },
  { label: '25 (Lakh) —  ₹25 Lakhs', amount: 25, unit: 'LAKH' },
  { label: '10 (Lakh) —  ₹10 Lakhs', amount: 10, unit: 'LAKH' },
  { label: '5 (Lakh)  —  ₹5 Lakhs', amount: 5, unit: 'LAKH' },
  { label: '1 (Lakh)  —  ₹1 Lakh', amount: 1, unit: 'LAKH' },
  { label: '500 (k)   —  ₹5 Lakhs (500 Thousands)', amount: 500, unit: 'THOUSAND' },
  { label: '100 (k)   —  ₹1 Lakh (100 Thousands)', amount: 100, unit: 'THOUSAND' },
  { label: '50 (k)    —  ₹50,000 (50 Thousands)', amount: 50, unit: 'THOUSAND' },
  { label: '25 (k)    —  ₹25,000 (25 Thousands)', amount: 25, unit: 'THOUSAND' },
  { label: '10 (k)    —  ₹10,000 (10 Thousands)', amount: 10, unit: 'THOUSAND' }
];

// Helper to convert number to Indian denomination word representation
const formatIndianWords = (amountInInr) => {
  const num = Number(amountInInr);
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees';

  const cr = Math.floor(num / 10000000);
  const remCr = num % 10000000;
  const lakh = Math.floor(remCr / 100000);
  const remLakh = remCr % 100000;
  const th = Math.floor(remLakh / 1000);
  const remTh = remLakh % 1000;

  const parts = [];
  if (cr > 0) parts.push(`${cr} Crore${cr > 1 ? 's' : ''}`);
  if (lakh > 0) parts.push(`${lakh} Lakh${lakh > 1 ? 's' : ''}`);
  if (th > 0) parts.push(`${th} Thousand${th > 1 ? 's' : ''}`);
  if (remTh > 0) parts.push(`${remTh} Rupees`);

  return parts.join(' ') || `${num} Rupees`;
};

/**
 * FundAmountInput Component
 * Provides a dropdown feature for allocating fund values:
 * - Direct quantity input (e.g. 100)
 * - Unit dropdown selector: Crores (Cr), Lakhs (Lakh), Thousands (k), Rupees (₹)
 * - Preset dropdown selector: Ex: 100 (Cr), 50 (Cr), 25 (Lakh), 50 (k)
 * - Real-time INR preview and Indian denomination breakdown
 */
const FundAmountInput = ({
  value,
  onChange,
  label = 'Fund Allocation Amount',
  max = null,
  maxLabel = 'Available Ceiling',
  min = 0,
  required = true,
  disabled = false,
  helperText = null,
  id = 'fund-amount-input'
}) => {
  // Determine initial display quantity and unit from numeric value
  const parseValue = (val) => {
    const num = Number(val);
    if (!num || isNaN(num) || num <= 0) {
      return { numVal: '', unitKey: 'CR' };
    }
    if (num >= 10000000) {
      const crVal = num / 10000000;
      return { numVal: Number.isInteger(crVal) ? String(crVal) : crVal.toFixed(2), unitKey: 'CR' };
    }
    if (num >= 100000) {
      const lVal = num / 100000;
      return { numVal: Number.isInteger(lVal) ? String(lVal) : lVal.toFixed(2), unitKey: 'LAKH' };
    }
    if (num >= 1000) {
      const kVal = num / 1000;
      return { numVal: Number.isInteger(kVal) ? String(kVal) : kVal.toFixed(2), unitKey: 'THOUSAND' };
    }
    return { numVal: String(num), unitKey: 'INR' };
  };

  const initial = parseValue(value);
  const [displayNumber, setDisplayNumber] = useState(initial.numVal);
  const [selectedUnit, setSelectedUnit] = useState(initial.unitKey);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState('');

  // Synchronize when external value changes drastically
  useEffect(() => {
    const currentCalculated = (Number(displayNumber) || 0) * (FUND_UNITS.find(u => u.key === selectedUnit)?.multiplier || 1);
    if (Math.abs(currentCalculated - (Number(value) || 0)) > 0.01) {
      const parsed = parseValue(value);
      setDisplayNumber(parsed.numVal);
      setSelectedUnit(parsed.unitKey);
    }
  }, [value]);

  // Compute actual INR value from quantity and unit
  const activeMultiplier = FUND_UNITS.find(u => u.key === selectedUnit)?.multiplier || 10000000;
  const currentInr = (parseFloat(displayNumber) || 0) * activeMultiplier;
  const unitShort = FUND_UNITS.find(u => u.key === selectedUnit)?.short || 'Cr';

  // Handle number input change
  const handleNumberChange = (newNumStr) => {
    setDisplayNumber(newNumStr);
    setSelectedPresetIndex('');
    const num = parseFloat(newNumStr);
    const inr = isNaN(num) ? 0 : num * activeMultiplier;
    onChange(inr);
  };

  // Handle unit dropdown change
  const handleUnitChange = (newUnitKey) => {
    setSelectedUnit(newUnitKey);
    setSelectedPresetIndex('');
    const newMult = FUND_UNITS.find(u => u.key === newUnitKey)?.multiplier || 1;
    const num = parseFloat(displayNumber);
    const inr = isNaN(num) ? 0 : num * newMult;
    onChange(inr);
  };

  // Handle quick preset dropdown selection
  const handlePresetSelect = (presetIndexStr) => {
    setSelectedPresetIndex(presetIndexStr);
    const idx = parseInt(presetIndexStr, 10);
    if (isNaN(idx) || idx <= 0 || idx >= FUND_PRESETS.length) return;

    const preset = FUND_PRESETS[idx];
    if (preset && preset.amount != null) {
      setDisplayNumber(String(preset.amount));
      setSelectedUnit(preset.unit);
      const mult = FUND_UNITS.find(u => u.key === preset.unit)?.multiplier || 1;
      const totalInr = preset.amount * mult;
      onChange(totalInr);
    }
  };

  const isExceedingMax = max != null && currentInr > max;

  return (
    <div className="fund-amount-input-container" style={{ marginBottom: '16px' }}>
      {/* Label Row with optional Max Limit indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label htmlFor={id} className="form-label" style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
        {max != null && (
          <span style={{
            fontSize: '11px',
            color: isExceedingMax ? 'var(--color-danger)' : 'var(--text-muted)',
            fontWeight: '600',
            backgroundColor: isExceedingMax ? 'var(--color-danger-bg)' : 'var(--bg-subtle)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: `1px solid ${isExceedingMax ? 'var(--color-danger-border)' : 'var(--border-color)'}`
          }}>
            {maxLabel}: <strong>{formatCurrency(max)}</strong>
          </span>
        )}
      </div>

      {/* Main Controls Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
        {/* Left Side: Number input with attached unit dropdown */}
        <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', borderRight: '1px solid var(--border-color)' }}>
            <Coins size={15} color="var(--color-primary)" />
          </div>
          <input
            id={id}
            type="number"
            step="any"
            min={min}
            max={max != null ? max / activeMultiplier : undefined}
            placeholder={`Ex: 100`}
            value={displayNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            disabled={disabled}
            required={required}
            style={{
              flex: 1,
              border: 'none',
              padding: '8px 12px',
              fontSize: '14px',
              fontWeight: '700',
              color: 'var(--text-main)',
              outline: 'none',
              backgroundColor: 'transparent'
            }}
          />
          <select
            value={selectedUnit}
            onChange={(e) => handleUnitChange(e.target.value)}
            disabled={disabled}
            style={{
              border: 'none',
              borderLeft: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-subtle)',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              outline: 'none'
            }}
            title="Select allocation denomination unit"
          >
            {FUND_UNITS.map((u) => (
              <option key={u.key} value={u.key}>{u.label}</option>
            ))}
          </select>
        </div>

        {/* Right Side: Quick Amount Presets Dropdown */}
        <div>
          <select
            className="form-control form-select"
            value={selectedPresetIndex}
            onChange={(e) => handlePresetSelect(e.target.value)}
            disabled={disabled}
            style={{
              height: '38px',
              fontSize: '12px',
              fontWeight: '600',
              color: selectedPresetIndex ? 'var(--color-primary)' : 'var(--text-secondary)',
              borderColor: selectedPresetIndex ? 'var(--color-accent)' : 'var(--border-color)'
            }}
            title="Choose a standard allocation preset"
          >
            {FUND_PRESETS.map((p, idx) => (
              <option key={idx} value={idx === 0 ? '' : idx}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-Time Live Value & Denomination Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '7px 12px',
        borderRadius: 'var(--radius-xs)',
        backgroundColor: isExceedingMax ? 'var(--color-danger-bg)' : 'rgba(5, 150, 105, 0.06)',
        border: `1px solid ${isExceedingMax ? 'var(--color-danger-border)' : 'rgba(5, 150, 105, 0.2)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isExceedingMax ? (
            <AlertCircle size={14} color="var(--color-danger)" />
          ) : (
            <CheckCircle size={14} color="var(--color-success)" />
          )}
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            color: isExceedingMax ? 'var(--color-danger)' : 'var(--color-success)'
          }}>
            Allocating: {displayNumber ? `${displayNumber} (${unitShort})` : '0 (Cr)'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>•</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '800',
            color: isExceedingMax ? 'var(--color-danger)' : 'var(--text-main)',
            fontFamily: 'monospace'
          }}>
            ₹ {Number(currentInr || 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div style={{ fontSize: '11px', fontWeight: '600', color: isExceedingMax ? 'var(--color-danger)' : 'var(--text-muted)' }}>
          {isExceedingMax ? `Exceeds max limit by ${formatCurrency(currentInr - max)}` : formatIndianWords(currentInr)}
        </div>
      </div>

      {helperText && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {helperText}
        </div>
      )}
    </div>
  );
};

export default FundAmountInput;
