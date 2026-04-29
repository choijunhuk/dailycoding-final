import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button 
      onClick={toggleTheme}
      className="btn btn-ghost"
      style={{ 
        width: 36, 
        height: 36, 
        padding: 0, 
        borderRadius: '50%',
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)'
      }}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
