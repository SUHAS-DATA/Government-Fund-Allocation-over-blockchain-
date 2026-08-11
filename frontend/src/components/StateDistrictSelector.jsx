import React, { useMemo } from 'react';
import { MapPin, Building } from 'lucide-react';
import { 
  STATES_DISTRICTS_DATA, 
  getAllStates, 
  getDistrictsByState, 
  getState, 
  isValidDistrictForState 
} from '../config/statesDistrictsData';

/**
 * Reusable Dependent State & District Selector Component
 * 
 * Enforces strict 1-to-many State -> District dependency:
 * - When a State is chosen (e.g. Karnataka), ONLY districts for that State are available.
 * - When State changes, the District selection is immediately reset/cleared.
 * - Never shows districts from other states.
 */
const StateDistrictSelector = ({
  selectedState = '',
  selectedDistrict = '',
  onStateChange,
  onDistrictChange,
  showAllOption = false,
  allStatesLabel = 'All States / UTs',
  allDistrictsLabel = 'All Districts',
  stateLabel = 'State Treasury',
  districtLabel = 'District Agency',
  stateValueType = 'code', // 'code' (e.g. 'KA') or 'name' (e.g. 'Karnataka')
  stateRequired = false,
  districtRequired = false,
  disabledState = false,
  disabledDistrict = false,
  layout = 'grid', // 'grid' | 'vertical' | 'inline' | 'bare'
  showIcons = true,
  statePlaceholder = 'Select State...',
  districtPlaceholder = 'Select District...',
  customDistricts = null, // Optional override list
  className = '',
  style = {}
}) => {
  const allStates = useMemo(() => getAllStates(), []);

  // Determine current active state object
  const currentStateObj = useMemo(() => {
    if (!selectedState) return null;
    return getState(selectedState);
  }, [selectedState]);

  // Derive districts belonging strictly to the currently selected state
  const availableDistricts = useMemo(() => {
    if (!selectedState) {
      if (showAllOption && customDistricts && customDistricts.length > 0) {
        return customDistricts;
      }
      return [];
    }

    if (customDistricts && customDistricts.length > 0) {
      const stateCode = currentStateObj?.code || selectedState;
      const stateName = currentStateObj?.name?.toLowerCase() || '';
      return customDistricts.filter(
        (d) =>
          d.state_code === stateCode ||
          d.state_name?.toLowerCase() === stateName ||
          isValidDistrictForState(d.name, stateCode)
      );
    }

    return getDistrictsByState(selectedState);
  }, [selectedState, currentStateObj, customDistricts, showAllOption]);

  // Handle State Change
  const handleStateChange = (e) => {
    const newStateValue = e.target.value;
    const newStateObj = newStateValue ? getState(newStateValue) : null;

    if (onStateChange) {
      onStateChange(newStateValue, newStateObj);
    }

    // Automatically clear / reset district when state changes
    if (onDistrictChange) {
      onDistrictChange('', null);
    }
  };

  // Handle District Change
  const handleDistrictChange = (e) => {
    const newDistrictValue = e.target.value;
    const newDistrictObj = availableDistricts.find(
      (d) => d.name === newDistrictValue
    ) || null;

    if (onDistrictChange) {
      onDistrictChange(newDistrictValue, newDistrictObj);
    }
  };

  const isDistrictDisabled = disabledDistrict || (!selectedState && !showAllOption);

  const stateSelectElement = (
    <div className="form-group" style={{ marginBottom: layout === 'bare' ? 0 : undefined }}>
      {stateLabel && (
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {showIcons && <Building size={13} color="var(--color-primary)" />}
          <span>{stateLabel}</span>
          {stateRequired && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      <select
        className="form-control form-select"
        value={selectedState}
        onChange={handleStateChange}
        disabled={disabledState}
        required={stateRequired}
      >
        {showAllOption ? (
          <option value="">{allStatesLabel}</option>
        ) : (
          <option value="" disabled>{statePlaceholder}</option>
        )}
        {allStates.map((s) => (
          <option
            key={s.code}
            value={stateValueType === 'name' ? s.name : s.code}
          >
            {s.name} ({s.code})
          </option>
        ))}
      </select>
    </div>
  );

  const districtSelectElement = (
    <div className="form-group" style={{ marginBottom: layout === 'bare' ? 0 : undefined }}>
      {districtLabel && (
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {showIcons && <MapPin size={13} color="var(--color-primary)" />}
          <span>{districtLabel}</span>
          {districtRequired && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          {selectedState && currentStateObj && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              ({availableDistricts.length} in {currentStateObj.name})
            </span>
          )}
        </label>
      )}
      <select
        className="form-control form-select"
        value={selectedDistrict}
        onChange={handleDistrictChange}
        disabled={isDistrictDisabled}
        required={districtRequired}
      >
        {showAllOption ? (
          <option value="">{allDistrictsLabel}</option>
        ) : (
          <option value="" disabled>
            {!selectedState ? 'Please select a state first...' : districtPlaceholder}
          </option>
        )}
        {availableDistricts.map((d, idx) => (
          <option key={`${d.name}-${idx}`} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );

  if (layout === 'bare') {
    return (
      <div className={className} style={{ display: 'contents', ...style }}>
        {stateSelectElement}
        {districtSelectElement}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div className={className} style={{ display: 'flex', gap: '12px', alignItems: 'center', ...style }}>
        <div style={{ flex: 1 }}>{stateSelectElement}</div>
        <div style={{ flex: 1 }}>{districtSelectElement}</div>
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px', ...style }}>
        {stateSelectElement}
        {districtSelectElement}
      </div>
    );
  }

  // Default: grid-2
  return (
    <div className={`grid-2 ${className}`} style={style}>
      {stateSelectElement}
      {districtSelectElement}
    </div>
  );
};

export default StateDistrictSelector;
