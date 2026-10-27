import React, { useState } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
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

/**
 * Global Floating Theme Toggle Component
 * Anchored unobtrusively at the bottom-right of the viewport on all pages.
 * Ensures the user can switch theme at ANY moment regardless of scroll position or route.
 */
export const FloatingThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="floating-theme-switch-container"
      style={{
        position: 'fixed',
        bottom: '22px',
        right: '22px',
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={toggleTheme}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
        aria-label={isDark ? 'Switch to White / Light Theme' : 'Switch to Dark Theme'}
        id="global-floating-theme-toggle"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          height: '42px',
          padding: '0 14px 0 12px',
          borderRadius: '9999px',
          cursor: 'pointer',
          border: isDark 
            ? '1.5px solid rgba(99, 102, 241, 0.4)' 
            : '1.5px solid rgba(13, 92, 58, 0.25)',
          backgroundColor: isDark 
            ? 'rgba(23, 32, 51, 0.94)' 
            : 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: isDark ? '#F8FAFC' : '#0F172A',
          boxShadow: isDark
            ? '0 10px 25px -3px rgba(0, 0, 0, 0.6), 0 0 14px rgba(99, 102, 241, 0.2)'
            : '0 10px 25px -3px rgba(15, 23, 42, 0.12), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
          transform: hovered ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)',
          transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none',
        }}
      >
        {/* Animated Icon Circle */}
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(13, 92, 58, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s ease',
            transform: hovered ? 'rotate(15deg)' : 'rotate(0deg)',
          }}
        >
          {isDark ? (
            <Sun size={15} strokeWidth={2.4} color="#FACC15" />
          ) : (
            <Moon size={15} strokeWidth={2.2} color="#0D5C3A" />
          )}
        </div>

        {/* Text & Switch Pill */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: '800',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            color: isDark ? '#F8FAFC' : '#0F172A',
          }}
        >
          {isDark ? 'White' : 'Dark'}
        </span>

        {/* Mini Pill Toggle Track */}
        <div
          style={{
            width: '28px',
            height: '16px',
            borderRadius: '9999px',
            backgroundColor: isDark ? '#6366F1' : '#CBD5E1',
            position: 'relative',
            transition: 'background-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              position: 'absolute',
              top: '2px',
              left: isDark ? '14px' : '2px',
              transition: 'left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
            }}
          />
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;
