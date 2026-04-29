import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dc_theme');
    if (saved) return saved;
    return 'system';
  });
  const [effectiveTheme, setEffectiveTheme] = useState('dark');

  const getEffectiveTheme = (value) => {
    if (value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return value;
  };

  useEffect(() => {
    const next = getEffectiveTheme(theme);
    setEffectiveTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dc_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setEffectiveTheme(media.matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', media.matches ? 'dark' : 'light');
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  };

  const value = useMemo(() => ({
    theme,
    effectiveTheme,
    isDark: effectiveTheme === 'dark',
    toggleTheme,
    setTheme
  }), [effectiveTheme, theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
