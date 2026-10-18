import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';

const FinancialYearContext = createContext(null);

export const FinancialYearProvider = ({ children }) => {
  const [selectedFY, setSelectedFYState] = useState(() => {
    return localStorage.getItem('selected_fy') || '2026-27';
  });

  const [financialYears, setFinancialYears] = useState([
    { year: '2026-27', is_current: true, description: 'National Financial Year 2026-27' },
    { year: '2025-26', is_current: false, description: 'National Financial Year 2025-26' }
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const fetchFinancialYears = async () => {
    try {
      setIsLoading(true);
      const res = await API.get('/public/financial-years');
      if (res && res.success && Array.isArray(res.financial_years) && res.financial_years.length > 0) {
        setFinancialYears(res.financial_years);
        const exists = res.financial_years.some((f) => f.year === selectedFY);
        if (!exists) {
          const current = res.financial_years.find((f) => f.is_current) || res.financial_years[0];
          if (current) {
            setSelectedFYState(current.year);
            localStorage.setItem('selected_fy', current.year);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch financial years from backend, using defaults:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialYears();
  }, []);

  const setSelectedFY = (newFY) => {
    if (!newFY || newFY === selectedFY) return;
    setSelectedFYState(newFY);
    localStorage.setItem('selected_fy', newFY);
  };

  return (
    <FinancialYearContext.Provider
      value={{
        selectedFY,
        setSelectedFY,
        setFinancialYear: setSelectedFY,
        financialYears,
        refreshFinancialYears: fetchFinancialYears,
        isLoading
      }}
    >
      {children}
    </FinancialYearContext.Provider>
  );
};

export const useFinancialYear = () => {
  const context = useContext(FinancialYearContext);
  if (!context) {
    throw new Error('useFinancialYear must be used within a FinancialYearProvider');
  }
  return context;
};

export default FinancialYearContext;
