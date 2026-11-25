import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * Standard Inline / Header Theme Toggle
 * Can be placed in top-meta bars, navigation headers, or settings pages.
 */
export const ThemeToggle = ({ 
  showLabel = false, 
  variant = 'button', // 'button' | 'pill' | 'compact'
  style = {}, 
  className = '' 
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${isDark ? 'dark-active' : 'light-active'} ${className}`}
      title={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
      aria-label={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        padding: showLabel ? '6px 14px' : '6px',
        minWidth: showLabel ? 'auto' : '36px',
        height: '36px',
        borderRadius: variant === 'pill' ? '9999px' : '8px',
        border: isDark ? '1px solid #334155' : '1px solid var(--border-color)',
        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        color: isDark ? '#FACC15' : '#1E293B',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isDark 
          ? '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
          : '0 1px 3px rgba(0, 0, 0, 0.06)',
        outline: 'none',
        userSelect: 'none',
        ...style,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = isDark ? '#6366F1' : 'var(--color-primary)';
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = isDark 
          ? '0 4px 12px rgba(99, 102, 241, 0.25)' 
          : '0 3px 8px rgba(0, 0, 0, 0.1)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = isDark ? '#334155' : 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isDark 
          ? '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
          : '0 1px 3px rgba(0, 0, 0, 0.06)';
      }}
    >
      <span style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' 
      }}>
        {isDark ? (
          <Sun size={17} strokeWidth={2.4} color="#FACC15" />
        ) : (
          <Moon size={17} strokeWidth={2.2} color="#0F172A" />
        )}
      </span>

      {showLabel && (
        <span style={{ 
          fontSize: '12px', 
          fontWeight: '700', 
          letterSpacing: '0.2px',
          color: isDark ? '#F8FAFC' : '#0F172A' 
        }}>
          {isDark ? 'White' : 'Dark'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
