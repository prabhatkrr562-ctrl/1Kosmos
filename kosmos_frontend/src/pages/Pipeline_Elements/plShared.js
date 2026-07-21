import { useCallback, useMemo, useState } from 'react';

export const STAGE_ORDER = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
  'Business Won', 'Business Lost',
];

export const STAGE_CLASS = {
  '5% - Prospecting': 'st-prosp',
  '20%-Discovery': 'st-disc',
  '40%-Scoping': 'st-scope',
  '60%-Propose': 'st-propose',
  '80%-Validate': 'st-validate',
  '90%-Negotiate & Close': 'st-nego',
  'Business Won': 'st-won',
  'Business Lost': 'st-lost',
};

export const FC_CLASS = {
  'Commit': 'fc-commit', 'Commit ': 'fc-commit',
  'Upside': 'fc-upside',
  'Closed won': 'fc-closed', 'closed won': 'fc-closed',
  'Not forecasted': 'fc-none',
};

export const DONUT_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626', '#6b7280'];
export const BAR_COLORS   = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626', '#f59e0b', '#10b981'];

export const fmt = (v) => {
  if (!v && v !== 0) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const fmtN = (v) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Number(v).toFixed(0)}`;
};

// ── SVG Charts ────────────────────────────────────────────────────────────────

export function LineChart({ data = [], color = '#2563eb', height = 120, fill = true, showLabels = false }) {
  if (!data.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>No data</div>
  );
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 600, H = height;
  const pad = { l: 10, r: 10, t: 10, b: showLabels ? 24 : 8 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const pts = data.map((d, i) => [
    pad.l + (i / (data.length - 1 || 1)) * iW,
    pad.t + (1 - (d.value - min) / range) * iH,
  ]);
  const polyline = pts.map(p => p.join(',')).join(' ');
  const area = [`M${pts[0][0]},${pad.t + iH}`, ...pts.map(p => `L${p[0]},${p[1]}`), `L${pts[pts.length - 1][0]},${pad.t + iH}Z`].join(' ');
  const uid = `lg-${color.slice(1)}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {fill && (
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".25" />
            <stop offset="100%" stopColor={color} stopOpacity=".02" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${uid})`} />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {showLabels && data.map((d, i) => (
        <text key={i} x={pts[i][0]} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label || ''}</text>
      ))}
    </svg>
  );
}

export function MultiLineChart({ series = [], height = 140 }) {
  if (!series.length || !series[0].data.length) return null;
  const allVals = series.flatMap(s => s.data.map(d => d.value));
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const W = 600, H = height;
  const pad = { l: 8, r: 8, t: 8, b: 8 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const n = series[0].data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {series.map((s, si) => {
        const pts = s.data.map((d, i) => [
          pad.l + (i / (n - 1 || 1)) * iW,
          pad.t + (1 - (d.value - min) / range) * iH,
        ]);
        return <polyline key={si} points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

export function HBarChart({ items = [] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="pl-bar-list">
      {items.map((item, i) => (
        <div key={i} className="pl-bar-row">
          <div className="pl-bar-label" title={item.label}>{item.label}</div>
          <div className="pl-bar-track">
            <div className="pl-bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
          </div>
          <div className="pl-bar-val">{fmtN(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ items = [], radius = 70 }) {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const cx = radius + 10, cy = radius + 10;
  const R = radius, r = radius * 0.58;
  let angle = -Math.PI / 2;
  const arcs = items.map((item, idx) => {
    const sweep = (item.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
    const laf = sweep > Math.PI ? 1 : 0;
    const mx1 = cx + r * Math.cos(angle - sweep), my1 = cy + r * Math.sin(angle - sweep);
    const mx2 = cx + r * Math.cos(angle), my2 = cy + r * Math.sin(angle);
    return {
      d: `M${x1},${y1} A${R},${R} 0 ${laf},1 ${x2},${y2} L${mx2},${my2} A${r},${r} 0 ${laf},0 ${mx1},${my1}Z`,
      color: item.color || DONUT_COLORS[idx % DONUT_COLORS.length],
      item,
    };
  });
  const size = (radius + 10) * 2;
  return (
    <div className="pl-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} stroke="#fff" strokeWidth="1.5" onClick={(event) => { event.stopPropagation(); a.item.onClick?.(); }} style={{ cursor: a.item.onClick ? 'pointer' : 'default' }} />)}
      </svg>
      <div className="pl-donut-legend">
        {arcs.map((a, i) => (
          <div key={i} className="pl-donut-legend-row" onClick={(event) => { event.stopPropagation(); a.item.onClick?.(); }} style={{ cursor: a.item.onClick ? 'pointer' : 'default' }}>
            <div className="pl-donut-dot" style={{ background: a.color }} />
            <span style={{ fontSize: 11, color: '#374151' }}>{a.item.label || a.item.stage || a.item.forecast || a.item.region || a.item.sector}</span>
            <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 'auto', paddingLeft: 8 }}>{a.item.displayValue ?? fmtN(a.item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GaugeBar({ pct = 0, label = '', target = '' }) {
  const capped = Math.min(pct, 150);
  const barColor = pct >= 100 ? '#059669' : pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color: barColor }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(capped, 100)}%`, background: barColor, borderRadius: 5, transition: 'width .5s' }} />
      </div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>Target: {target}</div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, color = 'k-blue', icon = '' }) {
  return (
    <div className={`pl-kpi ${color}`}>
      {icon && <div className="pl-kpi-icon">{icon}</div>}
      <div className="pl-kpi-label">{label}</div>
      <div className="pl-kpi-value">{value}</div>
      {sub && <div className="pl-kpi-sub">{sub}</div>}
    </div>
  );
}

export function StageBadge({ stage }) {
  return <span className={`pl-stage-badge ${STAGE_CLASS[stage] || 'st-prosp'}`}>{stage}</span>;
}

export function FcBadge({ fc }) {
  const clean = (fc || '').trim();
  return <span className={`pl-stage-badge ${FC_CLASS[clean] || 'fc-none'}`}>{clean || 'None'}</span>;
}

export function Card({ title, tag, children, style, onClick, clickHint }) {
  return (
    <div className={`pl-card${onClick ? ' pl-card-clickable' : ''}`} style={style} onClick={onClick}>
      {(title || tag) && (
        <div className="pl-card-header">
          {title && <div className="pl-card-title">{title}</div>}
          {tag && <div className="pl-card-tag">{tag}</div>}
        </div>
      )}
      {children}
      {onClick && <div className="pl-click-hint">{clickHint || '🔍 Click to drill into deals'}</div>}
    </div>
  );
}

export function SortTh({ col, sortKey, dir, onSort, children }) {
  const active = sortKey === col;
  return (
    <th className={active ? 'sorted' : ''} onClick={() => onSort(col)}>
      {children} {active ? (dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

export function useSort(data, defaultKey, defaultDir = 'desc') {
  const [key, setKey] = useState(defaultKey);
  const [dir, setDir] = useState(defaultDir);
  const sorted = useMemo(() => {
    if (!key) return data;
    return [...data].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === 'number') return dir === 'asc' ? av - bv : bv - av;
      return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data, key, dir]);
  const onSort = useCallback((col) => {
    if (col === key) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setKey(col); setDir('desc'); }
  }, [key]);
  return { sorted, sortKey: key, dir, onSort };
}
