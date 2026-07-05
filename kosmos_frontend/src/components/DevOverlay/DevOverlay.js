import { useRef } from 'react';
import { useDevMode } from '../../context/DevModeContext';
import './DevOverlay.css';
import { API_URL } from '../../config/api';

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
);

const slug = (value) => String(value || 'component').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function DevOverlay({ name, children }) {
  const { isDevMode, setInspected } = useDevMode();
  const ref = useRef(null);

  if (!isDevMode) return children;

  const inspect = async (e) => {
    e.stopPropagation();
    setInspected({ name, loading: true });
    try {
      const res = await fetch(
        `${API_URL}/api/dev/source-code/?component=${encodeURIComponent(name)}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setInspected({ name, frontend: data.frontend, backend: data.backend });
    } catch (err) {
      setInspected({ name, error: err.message });
    }
  };

  return (
    <div className={`dov-wrap dov-${slug(name)}`} ref={ref}>
      {children}
      <button className="dov-btn" onClick={inspect} title={`View source: ${name}`}>
        <PencilIcon />
        <span>{name}</span>
      </button>
    </div>
  );
}
