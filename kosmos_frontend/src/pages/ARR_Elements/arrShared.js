import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const PALETTE = [
  '#7c3aed','#2563eb','#0891b2','#059669','#d97706','#dc2626',
  '#9333ea','#1d4ed8','#0e7490','#047857','#b45309','#b91c1c',
  '#6d28d9','#1e40af','#075985','#065f46','#92400e','#991b1b',
];

// ── formatters ───────────────────────────────────────────────────────────────
const fmt = (v) => {
  const n = Number(v || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: Math.abs(n) >= 1e6 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(n) >= 1e6 ? 1 : 0,
  }).format(n);
};

const fmtFull = (v) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(Number(v || 0));

const mLbl = (month) => {
  if (!month) return '';
  const [y, m] = month.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const dSign = (v) => {
  const n = Number(v || 0);
  return (n >= 0 ? '▲ ' : '▼ ') + fmt(Math.abs(n));
};

// ── SVG: Line Chart ──────────────────────────────────────────────────────────
function LineChart({ data = [], color = '#7c3aed', height = 120 }) {
  if (data.length < 2) return <div style={{ height, background: '#f8fafc', borderRadius: 8 }} />;
  const vals = data.map(d => Number(d.value));
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 1);
  const range = maxV - minV || 1;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: height - 6 - ((Number(d.value) - minV) / range) * (height - 14),
  }));
  const poly = pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${pts[0].x},${height - 4} ${poly} ${pts.at(-1).x},${height - 4}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity=".02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#lcGrad)" />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      {pts.at(-1) && (
        <circle cx={pts.at(-1).x} cy={pts.at(-1).y} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// ── SVG: Spark Line (mini) ───────────────────────────────────────────────────
function SparkLine({ data = [], color = '#7c3aed' }) {
  if (data.length < 2) return null;
  const vals = data.map(d => Number(d.value));
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, minV + 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 60,
    y: 20 - ((Number(d.value) - minV) / (maxV - minV)) * 18,
  }));
  const poly = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 60 24" style={{ width: 60, height: 24, display: 'block' }}>
      <polyline points={poly} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── SVG: Bar Chart ───────────────────────────────────────────────────────────
function BarChart({ items = [], maxItems = 10 }) {
  const visible = items.slice(0, maxItems);
  if (!visible.length) return <p style={{ color: '#94a3b8', fontSize: 13 }}>No data available.</p>;
  const max = Math.max(...visible.map(i => Number(i.value)), 1);
  return (
    <div className="arr-bar-list">
      {visible.map((item, i) => (
        <div className="arr-bar-row" key={item.label}>
          <span className="arr-bar-label" title={item.label}>{item.label}</span>
          <div className="arr-bar-track">
            <div className="arr-bar-fill" style={{
              width: `${Math.max(2, (Number(item.value) / max) * 100)}%`,
              background: PALETTE[i % PALETTE.length],
            }} />
          </div>
          <span className="arr-bar-val">{fmt(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── SVG: Gauge Chart ─────────────────────────────────────────────────────────
function GaugeChart({ value = 0, label, color = '#7c3aed', maxVal = 150 }) {
  const [animVal, setAnimVal] = useState(0);
  const target = Math.min(Math.max(Number(value), 0), maxVal);

  useEffect(() => {
    setAnimVal(0);
    let raf;
    let startTs = null;
    const DURATION = 1500;
    const id = setTimeout(() => {
      const step = (ts) => {
        if (!startTs) startTs = ts;
        const t = Math.min((ts - startTs) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic
        setAnimVal(target * eased);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 120);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [target]);

  const cx = 110, cy = 108, r = 82;
  const arcLen   = Math.PI * r;
  const filled   = (animVal / maxVal) * arcLen;
  const arcPath  = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const gid      = `gg-${color.replace('#', '')}`;

  // Grade retention by the real percentage, not by fill ratio against the chart max.
  const grade = target >= 110 ? { text: 'Excellent', bg: '#dcfce7', fg: '#166534' }
    : target >= 90            ? { text: 'Good',      bg: '#fef3c7', fg: '#92400e' }
    :                            { text: 'At Risk',   bg: '#fee2e2', fg: '#991b1b' };

  // Tip circle: point on the arc where the fill ends
  const tipAngle = -Math.PI + (animVal / maxVal) * Math.PI;
  const tipX = cx + r * Math.cos(tipAngle);
  const tipY = cy + r * Math.sin(tipAngle);
  const showTip = animVal > 0.5;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 220 148" className="gauge-svg">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id={`${gid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Outer decorative ring */}
        <path d={arcPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
          opacity="0.12" strokeDasharray={`${arcLen}`} strokeDashoffset="0" />

        {/* Background track */}
        <path d={arcPath} fill="none" stroke="#e8edf5" strokeWidth="20" strokeLinecap="round" />

        {/* Coloured value arc */}
        <path d={arcPath} fill="none"
          stroke={`url(#${gid})`} strokeWidth="20" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={arcLen - filled}
        />

        {/* Glowing tip dot */}
        {showTip && (
          <circle cx={tipX} cy={tipY} r="10" fill={color} opacity="0.18"
            filter={`url(#${gid}-glow)`} />
        )}
        {showTip && (
          <circle cx={tipX} cy={tipY} r="5" fill={color} />
        )}

        {/* Centre percentage (animated counter) */}
        <text x={cx} y={cy - 22} textAnchor="middle" fontSize="36" fontWeight="800"
          fill={color} fontFamily="Inter, system-ui, sans-serif" letterSpacing="-1">
          {animVal.toFixed(1)}%
        </text>

        {/* Label */}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9.5" fill="#94a3b8"
          letterSpacing="0.6" fontFamily="Inter, system-ui, sans-serif">
          {label}
        </text>

        {/* End scale labels */}
        <text x={cx - r + 4} y={cy + 22} textAnchor="middle" fontSize="8.5" fill="#b0bcc8">0%</text>
        <text x={cx + r - 4} y={cy + 22} textAnchor="middle" fontSize="8.5" fill="#b0bcc8">{maxVal}%</text>
      </svg>

      {/* Grade badge */}
      <span className="gauge-grade" style={{ background: grade.bg, color: grade.fg }}>
        {grade.text}
      </span>
    </div>
  );
}

// ── SVG: Treemap ─────────────────────────────────────────────────────────────
function Treemap({ items = [], height = 280 }) {
  const TW = 1000;  // coordinate width — matched to landscape aspect ratio
  const TH = height;

  const sorted = [...items]
    .filter(i => Number(i.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 20);

  if (!sorted.length) return (
    <div style={{ height, background: '#f8fafc', borderRadius: 10, display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
      No customer data
    </div>
  );

  function layout(nodes, x, y, w, h) {
    if (!nodes.length) return [];
    if (nodes.length === 1) return [{ ...nodes[0], x, y, w, h }];
    const total = nodes.reduce((s, n) => s + Number(n.value), 0);
    let cum = 0, splitAt = nodes.length - 1;
    for (let i = 0; i < nodes.length; i++) {
      cum += Number(nodes[i].value);
      if (cum >= total / 2) { splitAt = i + 1; break; }
    }
    const first = nodes.slice(0, splitAt);
    const rest = nodes.slice(splitAt);
    if (!rest.length) return [{ ...nodes[0], x, y, w, h }];
    const ratio = first.reduce((s, n) => s + Number(n.value), 0) / total;
    if (w >= h) {
      const w1 = w * ratio;
      return [...layout(first, x, y, w1, h), ...layout(rest, x + w1, y, w - w1, h)];
    }
    const h1 = h * ratio;
    return [...layout(first, x, y, w, h1), ...layout(rest, x, y + h1, w, h - h1)];
  }

  const cells = layout(sorted, 0, 0, TW, TH);

  const GRADS = [
    ['#6d28d9', '#9f5cf7'], ['#1d4ed8', '#4f83f5'], ['#047857', '#10b981'],
    ['#b45309', '#f59e0b'], ['#b91c1c', '#f87171'], ['#0e7490', '#22d3ee'],
    ['#7c3aed', '#c084fc'], ['#1e40af', '#60a5fa'], ['#065f46', '#34d399'],
    ['#78350f', '#fbbf24'],
  ];

  return (
    <svg viewBox={`0 0 ${TW} ${TH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', borderRadius: 10, overflow: 'hidden' }}>
      <defs>
        {GRADS.map(([c1, c2], i) => (
          <linearGradient key={`tmg${i}`} id={`tmg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        ))}
        {/* One clipPath per cell — clips text 4 units inside each tile edge */}
        {cells.map((cell, i) => (
          <clipPath key={`tmcp${i}`} id={`tmcp${i}`}>
            <rect x={cell.x + 4} y={cell.y + 4}
              width={Math.max(0, cell.w - 8)}
              height={Math.max(0, cell.h - 8)} />
          </clipPath>
        ))}
      </defs>

      {cells.map((cell, i) => {
        const gi  = i % GRADS.length;
        const pad = 3;
        const cw  = Math.max(0, cell.w - pad * 2);
        const ch  = Math.max(0, cell.h - pad * 2);
        const cx  = cell.x + pad + cw / 2;
        const cy  = cell.y + pad + ch / 2;

        const label = cell.label || '—';
        // Inner width with inner padding (text must fit here)
        const INNER = Math.max(1, cw - 16);
        // CR = conservative char-width / font-size ratio (0.65 accounts for wide glyphs)
        const CR = 0.65;

        // Ceiling font size from cell height
        const maxFz = Math.min(15, ch / 2.5);

        // Can the tile vertically fit 2 text lines?
        const words     = label.split(' ');
        const multiWord = words.length > 1;
        const canWrap   = ch >= maxFz * 2.8 && multiWord;

        // Choose font size so the longest expected line fits in INNER
        const longestHalf = Math.ceil(label.length / 2);  // approx chars on longest line when wrapped
        const fzForTwo    = INNER / (longestHalf * CR);
        const fzForOne    = INNER / (label.length * CR);
        const nameFz      = Math.max(8, Math.min(maxFz, canWrap ? fzForTwo : fzForOne));

        const showName = cw > 30 && ch > 20;
        if (!showName) {
          return (
            <g key={`${label}-${i}`}>
              <rect x={cell.x + pad} y={cell.y + pad} width={cw} height={ch}
                fill={`url(#tmg${gi})`} opacity={Math.max(0.68, 0.94 - i * 0.015)} rx="8" />
            </g>
          );
        }

        // ── Word-wrap: split into at most 2 lines at a word boundary ─────────
        const charsPerLine = Math.max(1, Math.floor(INNER / (nameFz * CR)));
        let lines;
        if (!multiWord || label.length <= charsPerLine) {
          lines = [label];
        } else {
          let l1 = '';
          // Keep adding words while they fit; stop before the last word
          // so at least one word always goes to line 2
          for (let wi = 0; wi < words.length - 1; wi++) {
            const test = l1 ? `${l1} ${words[wi]}` : words[wi];
            if (test.length <= charsPerLine) { l1 = test; }
            else break;
          }
          if (!l1) l1 = words[0];  // even the first word was too long — put it alone
          const l2 = label.slice(l1.length).trim();
          lines = l2 ? [l1, l2] : [l1];
        }

        const lineH = nameFz * 1.3;
        // Cap valFz so it never makes the block taller than the cell
        const rawValFz = nameFz * 0.75;
        const valFz    = Math.max(6.5, Math.min(rawValFz, ch * 0.28));

        // ── Visual-centering math ─────────────────────────────────────────────
        // SVG text y = baseline. Ascender ≈ 0.75·fz above baseline.
        const ASC = 0.75;
        const GAP = Math.max(1.5, nameFz * 0.18);  // gap between name and value

        // Visual height of the name block (top of first line → baseline of last line + descender)
        const nameVisH = (lines.length - 1) * lineH + nameFz;
        const fullH    = nameVisH + GAP + valFz;

        // Show value when full block fits within cell height with 2-unit margin
        // Math: value bottom = cy + fullH/2, clipPath bottom = cy + ch/2
        // → need fullH/2 ≤ ch/2 − 1  →  fullH ≤ ch − 2
        const showVal = cw > 30 && fullH <= ch - 2;

        const totalH   = showVal ? fullH : nameVisH;
        const blockTop = cy - totalH / 2;
        const firstY   = blockTop + nameFz * ASC;
        const valueY   = blockTop + nameVisH + GAP + valFz * ASC;

        return (
          <g key={`${label}-${i}`}>
            <rect x={cell.x + pad} y={cell.y + pad} width={cw} height={ch}
              fill={`url(#tmg${gi})`} opacity={Math.max(0.68, 0.94 - i * 0.015)} rx="8" />

            {/* clipPath hard-clips any glyph that still exceeds the tile */}
            <g clipPath={`url(#tmcp${i})`}>
              <text textAnchor="middle" fontSize={nameFz} fill="white"
                fontWeight="700" fontFamily="Inter, system-ui, sans-serif">
                {lines.map((line, li) => {
                  const estW = line.length * nameFz * CR;
                  const tl   = estW > INNER ? INNER : undefined;
                  return (
                    <tspan key={li} x={cx} y={firstY + li * lineH}
                      {...(tl ? { textLength: tl, lengthAdjust: 'spacingAndGlyphs' } : {})}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
              {showVal && (
                <text x={cx} y={valueY}
                  textAnchor="middle" fontSize={valFz}
                  fill="rgba(255,255,255,0.85)"
                  fontFamily="Inter, system-ui, sans-serif">
                  {fmt(cell.value)}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG: Sankey (ARR Flow) ───────────────────────────────────────────────────
function SankeyChart({ kpis = {} }) {
  const W = 900, H = 300, NODE_W = 20;
  const COL_X = [40, 280, 560, 840];
  const openARR  = Number(kpis.ltm_opening_arr || 0);
  const closeARR = Number(kpis.total_arr        || 0);
  const pNew     = Number(kpis.ltm_new_arr      || 0);
  const pUpsell  = Number(kpis.ltm_upsell       || 0);
  const pChurn   = Number(kpis.ltm_churn        || 0);
  const pDown    = Number(kpis.ltm_downsell     || 0);
  const pRenewal = Number(kpis.ltm_renewal      || 0);
  const fmtV = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M'
                  : v >= 1e3  ? '$' + (v / 1e3).toFixed(0) + 'K'
                  : '$' + (v || 0).toFixed(0);
  const maxVal = Math.max(openARR, closeARR, pNew + pUpsell + pRenewal, 1);
  const scaleH = v => Math.max(v / maxVal * (H - 60), 8);
  const rawNodes = [
    { id: 'open',   col: 0, label: 'Opening ARR', val: openARR,  color: '#7c3aed' },
    { id: 'new',    col: 1, label: 'New',          val: pNew,     color: '#059669' },
    { id: 'upsell', col: 1, label: 'Upsell',       val: pUpsell,  color: '#0891b2' },
    { id: 'renew',  col: 1, label: 'Renewal',      val: pRenewal, color: '#6d28d9' },
    { id: 'churn',  col: 2, label: 'Churn',        val: pChurn,   color: '#dc2626' },
    { id: 'down',   col: 2, label: 'Downsell',     val: pDown,    color: '#d97706' },
    { id: 'close',  col: 3, label: 'Closing ARR',  val: closeARR, color: '#1a1038' },
  ];
  const nodes = rawNodes.map(n => ({ ...n }));
  const nodeMap = {};
  nodes.forEach(n => (nodeMap[n.id] = n));
  const colGroups = {};
  nodes.forEach(n => { (colGroups[n.col] = colGroups[n.col] || []).push(n); });
  Object.values(colGroups).forEach(members => {
    const totalH = members.reduce((s, n) => s + scaleH(n.val), 0);
    const gap = (H - 20 - totalH) / (members.length + 1);
    let y = 10 + gap;
    members.forEach(n => { n.h = scaleH(n.val); n.x = COL_X[n.col]; n.y = y; y += n.h + gap; });
  });
  const links = [
    { from: 'open',   to: 'new',    val: pNew,     color: '#059669' },
    { from: 'open',   to: 'upsell', val: pUpsell,  color: '#0891b2' },
    { from: 'open',   to: 'renew',  val: pRenewal, color: '#6d28d9' },
    { from: 'open',   to: 'churn',  val: pChurn,   color: '#dc2626' },
    { from: 'open',   to: 'down',   val: pDown,    color: '#d97706' },
    { from: 'new',    to: 'close',  val: pNew,     color: '#059669' },
    { from: 'upsell', to: 'close',  val: pUpsell,  color: '#0891b2' },
    { from: 'renew',  to: 'close',  val: pRenewal, color: '#6d28d9' },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}
      preserveAspectRatio="xMidYMid meet">
      <defs>
        {links.map((l, i) => (
          <linearGradient key={i} id={`sk${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={l.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0.18" />
          </linearGradient>
        ))}
      </defs>
      {links.map((l, i) => {
        const fn = nodeMap[l.from], tn = nodeMap[l.to];
        if (!fn || !tn || !l.val) return null;
        const lh = Math.min(Math.max(l.val / maxVal * (H - 60), 2), 40);
        const x1 = fn.x + NODE_W, y1 = fn.y + fn.h / 2 - lh / 2;
        const x2 = tn.x,          y2 = tn.y + tn.h / 2 - lh / 2;
        const cx = (x1 + x2) / 2;
        return (
          <path key={i} fill={`url(#sk${i})`}
            d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${y2+lh} C${cx},${y2+lh} ${cx},${y1+lh} ${x1},${y1+lh} Z`} />
        );
      })}
      {nodes.map(n => {
        if (n.x === undefined || !n.h) return null;
        const isRight = n.col === 3;
        const lx = isRight ? n.x - 6 : n.x + NODE_W + 6;
        const anchor = isRight ? 'end' : 'start';
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={NODE_W} height={n.h} fill={n.color} rx="5" />
            <text x={lx} y={n.y + n.h / 2 - 5}  textAnchor={anchor} fontSize="11"
              fontWeight="700" fill="#1a0533">{n.label}</text>
            <text x={lx} y={n.y + n.h / 2 + 10} textAnchor={anchor} fontSize="10"
              fill="#6b7280" fontFamily="'Courier New',monospace">{fmtV(n.val)}</text>
          </g>
        );
      })}
    </svg>
  );
}
// ── SVG: Waterfall Chart ─────────────────────────────────────────────────────
function WaterfallChart({ data = [] }) {
  if (!data.length) return (
    <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
      Need at least 2 months of data.
    </p>
  );

  const series = [
    { key: 'new', label: 'New', color: '#1e5fa8' },
    { key: 'upsell', label: 'Upsell', color: '#15803d' },
    { key: 'renewal', label: 'Renewal', color: '#d97706' },
    { key: 'churn', label: 'Churn', color: '#b91c1c' },
    { key: 'downsell', label: 'Downsell', color: '#ea580c' },
  ];
  const rows = data.map((row) => ({
    ...row,
    new: Number(row.new || 0),
    upsell: Number(row.upsell || 0),
    renewal: Number(row.renewal || 0),
    churn: Number(row.churn || 0),
    downsell: Number(row.downsell || 0),
  }));
  const stacks = rows.map((row) => {
    let pos = 0;
    let neg = 0;
    const parts = series.map((s) => {
      const value = Number(row[s.key] || 0);
      const start = value >= 0 ? pos : neg;
      const end = start + value;
      if (value >= 0) pos = end;
      else neg = end;
      return { ...s, value, start, end };
    });
    return { month: row.month, parts, pos, neg };
  });
  const minV = Math.min(0, ...stacks.map((row) => row.neg));
  const maxV = Math.max(1, ...stacks.map((row) => row.pos));
  const range = maxV - minV || 1;

  const PAD_L = 62, PAD_R = 20, PAD_T = 28, PAD_B = 42;
  const CHART_H = 200;
  const SVG_H = CHART_H + PAD_T + PAD_B;
  const SVG_W = 900;
  const n = stacks.length;
  const slot = (SVG_W - PAD_L - PAD_R) / n;
  const bw = Math.min(48, Math.max(24, slot * 0.58));

  const toY = v => PAD_T + CHART_H - ((v - minV) / range) * CHART_H;
  const toX = i => PAD_L + i * slot + (slot - bw) / 2;
  const baseY = toY(0);

  const fmtShort = v => {
    const a = Math.abs(v);
    const s = v < 0 ? '-' : '';
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
    return `${s}$${a.toFixed(0)}`;
  };

  const TICKS = 5;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = minV + (range * i) / TICKS;
    return { v, y: toY(v) };
  });

  return (
    <div>
      <div className="arr-wf-legend">
        {series.map((s) => (
          <span className="arr-wf-legend-item" key={s.key}>
            <span className="arr-wf-dot" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', minWidth: 480, height: SVG_H, display: 'block' }}>

          {/* Y-axis grid + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={t.y} x2={SVG_W - PAD_R} y2={t.y}
                stroke="#f1f5f9" strokeWidth="1" />
              <text x={PAD_L - 6} y={t.y + 3.5} textAnchor="end"
                fontSize="9" fill="#94a3b8" fontFamily="Inter, sans-serif">
                {fmtShort(t.v)}
              </text>
            </g>
          ))}

          {/* Zero baseline */}
          <line x1={PAD_L} y1={baseY} x2={SVG_W - PAD_R} y2={baseY}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3" />

          {stacks.map((row, i) => {
            const x = toX(i);
            const center = x + bw / 2;
            const total = row.pos + row.neg;

            return (
              <g key={row.month}>
                {/* Subtle highlight column */}
                <rect x={x - 2} y={PAD_T} width={bw + 4} height={CHART_H}
                  fill={total >= 0 ? 'rgba(30,95,168,0.06)' : 'rgba(185,28,28,0.06)'} rx="4" />

                {row.parts.map((part) => {
                  if (!part.value) return null;
                  const y1 = toY(part.start);
                  const y2 = toY(part.end);
                  const barTop = Math.min(y1, y2);
                  const barH = Math.max(Math.abs(y1 - y2), 2);
                  return (
                    <g key={part.key}>
                      <rect x={x} y={barTop} width={bw} height={barH}
                        fill={`${part.color}cc`} stroke={part.color} strokeWidth="1" rx="3">
                        <title>{`${row.month} ${part.label}: ${fmtShort(part.value)}`}</title>
                      </rect>
                    </g>
                  );
                })}

                <text x={center} y={total >= 0 ? toY(row.pos) - 6 : toY(row.neg) + 13}
                  textAnchor="middle" fontSize="8.5" fill={total >= 0 ? '#15803d' : '#b91c1c'}
                  fontWeight="700" fontFamily="Inter, sans-serif">
                  {total ? `${total > 0 ? '+' : ''}${fmtShort(total)}` : '$0'}
                </text>

                {/* Month label */}
                <text x={center} y={SVG_H - PAD_B + 18}
                  textAnchor="middle" fontSize="9" fill="#64748b"
                  fontFamily="Inter, sans-serif">
                  {mLbl(row.month)}
                </text>
              </g>
            );
          })}

          {/* Y-axis line */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + CHART_H}
            stroke="#e2e8f0" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

// ── UI Atoms ─────────────────────────────────────────────────────────────────
function ArrDetailModal({ detail, onClose }) {
  if (!detail) return null;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="arr-modal-ov" onClick={(event) => { event.stopPropagation(); onClose(); }}>
      <div className="arr-modal-box" onClick={(event) => event.stopPropagation()}>
        <button className="arr-modal-close" onClick={(event) => { event.stopPropagation(); onClose(); }} aria-label="Close">x</button>
        <h3 className="arr-modal-title">{detail.title}</h3>
        {detail.formula && <div className="arr-modal-sub">{detail.formula}</div>}
        <div className="arr-modal-big-val" style={{ color: detail.color || '#0f2d52' }}>{detail.big}</div>
        {!!detail.stats?.length && (
          <div className="arr-modal-grid">
            {detail.stats.map((stat) => (
              <div className="arr-modal-stat" key={stat.label} style={{ borderLeftColor: stat.color || detail.color || '#7c3aed' }}>
                <div className="arr-modal-sl">{stat.label}</div>
                <div className="arr-modal-sv" style={{ color: stat.color || '#0f172a' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}
        {detail.insight && <div className="arr-modal-insight">{detail.insight}</div>}
        {detail.benchmark && <div className="arr-modal-bench">{detail.benchmark}</div>}
        {!!detail.sections?.length && (
          <div className="arr-modal-breakdowns">
            {detail.sections.map((section) => (
              <div className="arr-modal-section" key={section.title}>
                <div className="arr-modal-section-title">{section.title}</div>
                {section.items?.length ? section.items.map((item) => (
                  <div className="arr-modal-bar-row" key={`${section.title}-${item.label}`}>
                    <div className="arr-modal-bar-label" title={item.label}>{item.label}</div>
                    <div className="arr-modal-bar-track">
                      <div
                        className="arr-modal-bar-fill"
                        style={{
                          width: `${Math.max(3, Math.min(100, item.percent || 0))}%`,
                          background: item.color || section.color || '#1e5fa8',
                        }}
                      />
                    </div>
                    <div className="arr-modal-bar-value" style={{ color: item.color || section.color || '#1e5fa8' }}>
                      {item.value}
                    </div>
                    <div className="arr-modal-bar-pct">{Math.max(0, Math.round(item.percent || 0))}%</div>
                  </div>
                )) : <div className="arr-modal-empty">No data for this period</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function KpiCard({ label, value, sub, delta: dv, variant = 1, icon, tip, detail }) {
  const [open, setOpen] = useState(false);
  const isNeg = dv && String(dv).startsWith('▼');
  return (
    <article
      className={`arr-kpi-card kc-${variant}${detail ? ' is-clickable' : ''}`}
      onClick={() => detail && setOpen(true)}
      role={detail ? 'button' : undefined}
      tabIndex={detail ? 0 : undefined}
      onKeyDown={(event) => {
        if (detail && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <div className="arr-kpi-click">Click for details</div>
      <div className="arr-kpi-label">{label}</div>
      <div className="arr-kpi-value">{value}</div>
      {dv && <div className={`arr-kpi-delta ${isNeg ? 'dn' : 'up'}`}>{dv}</div>}
      {sub && <div className="arr-kpi-sub">{sub}</div>}
      {icon && <div className="arr-kpi-icon">{icon}</div>}
      {tip != null && <div className="arr-kpi-tip">{tip}</div>}
      {open && <ArrDetailModal detail={detail} onClose={() => setOpen(false)} />}
    </article>
  );
}

function MetricCard({ label, value, sub, icon, color, detail }) {
  const [open, setOpen] = useState(false);
  return (
    <article
      className={`arr-metric-card${detail ? ' is-clickable' : ''}`}
      style={{ '--metric-color': color }}
      onClick={() => detail && setOpen(true)}
      role={detail ? 'button' : undefined}
      tabIndex={detail ? 0 : undefined}
      onKeyDown={(event) => {
        if (detail && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <div className="arr-metric-click">Click for details</div>
      <div>
        <div className="arr-metric-label">{label}</div>
        <div className="arr-metric-value">{value}</div>
        {sub && <div className="arr-metric-sub">{sub}</div>}
      </div>
      <span className="arr-metric-icon">{icon}</span>
      {open && <ArrDetailModal detail={detail} onClose={() => setOpen(false)} />}
    </article>
  );
}

function SectionHeader({ title, tag }) {
  return (
    <div className="arr-sh">
      {title}
      {tag && <span className="arr-sh-tag">{tag}</span>}
    </div>
  );
}

export { PALETTE, fmt, fmtFull, mLbl, dSign };
export { LineChart, BarChart, Treemap, SankeyChart, WaterfallChart };
export { KpiCard, GaugeChart, SectionHeader };
export { SparkLine, MetricCard };
