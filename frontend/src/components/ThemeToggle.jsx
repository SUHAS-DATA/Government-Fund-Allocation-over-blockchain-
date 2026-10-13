import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle = ({ showLabel = false, style = {}, className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      title={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
      aria-label={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: showLabel ? '6px 12px' : '6px',
        width: showLabel ? 'auto' : '36px',
        height: '36px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
        color: isDark ? '#FACC15' : '#475569',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'var(--shadow-xs)',
        outline: 'none',
        ...style,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = isDark ? '#FACC15' : 'var(--color-primary)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {isDark ? (
        <Sun size={18} strokeWidth={2.2} style={{ transition: 'transform 0.3s ease' }} />
      ) : (
        <Moon size={18} strokeWidth={2.2} style={{ transition: 'transform 0.3s ease' }} />
      )}
      {showLabel && (
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
