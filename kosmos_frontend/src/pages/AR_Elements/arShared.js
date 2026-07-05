import { useState } from 'react';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';
export { API_URL } from '../../config/api';

export const fmt = (v) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: Math.abs(Number(v || 0)) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(Number(v || 0)) >= 1_000_000 ? 2 : 0,
}).format(Number(v || 0));

export const fmtFull = (v) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format(Number(v || 0));

export function fmtCompact(v, digits = 2) {
    const value = Number(v || 0);
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const trim = (s) => s.replace(/\.?0+$/, '');
    if (abs >= 1_000_000) return `${sign}$${trim((abs / 1_000_000).toFixed(digits))}M`;
    if (abs >= 1_000)     return `${sign}$${trim((abs / 1_000).toFixed(digits))}K`;
    return `${sign}$${Math.round(abs)}`;
}

function niceChartMax(value) {
    if (!value) return 1;
    const exponent = Math.floor(Math.log10(value));
    const base = 10 ** exponent;
    const normalized = value / base;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * base;
}

export function bucketBadge(bucket) {
    const map = { 'Not Due': 'ar-b-cur', '0-30': 'ar-b-d1', '31-60': 'ar-b-d31', '61-90': 'ar-b-d61', '91+': 'ar-b-d91' };
    return map[bucket] || 'ar-b-d91';
}

export function regionTag(region) {
    return region === 'APAC' ? 'ar-b-apac' : 'ar-b-nam';
}

export function cycleColor(days) {
    if (days <= 30) return '#15803d';
    if (days <= 60) return '#c2410c';
    return '#b91c1c';
}

export function cycleLabel(days) {
    if (days <= 30) return 'Fast';
    if (days <= 60) return 'Medium';
    return 'Slow';
}

export function KCard({ label, value, sub, ico, variant = 1, onClick }) {
    return (
        <DevOverlay name={`AR KPI: ${label}`}>
            <div
                className={`ar-kcard ar-kc${variant}${onClick ? ' ar-kcard-clickable' : ''}`}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={onClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onClick();
                    }
                } : undefined}
            >
                <div className="ar-kcard-label">{label}</div>
                <div className="ar-kcard-val">{value}</div>
                {sub && <div className="ar-kcard-sub">{sub}</div>}
                {ico && <div className="ar-kcard-ico">{ico}</div>}
            </div>
        </DevOverlay>
    );
}

export function ARBarChart({
    title,
    sub,
    items = [],
    colors = ['#1e5fa8'],
    formatter = fmt,
    axisFormatter = fmtCompact,
    valueFormatter = fmtCompact,
    showLegend = null,
}) {
    const [tooltip, setTooltip] = useState(null);

    if (!items || items.length === 0) {
        return (
            <DevOverlay name={`AR Chart: ${title}`}>
                <div className="ar-panel" style={{ marginBottom: 0 }}>
                    <h4>{title}</h4>
                    {sub && <div className="ar-panel-sub">{sub}</div>}
                    <p className="empty-copy" style={{ fontSize: 11, color: '#718096', padding: '20px 0' }}>No data.</p>
                </div>
            </DevOverlay>
        );
    }

    const maxValue = Math.max(...items.map((i) => Number(i.value) || 0), 1);
    const axisMax = niceChartMax(maxValue);
    const chartWidth = 640;
    const chartHeight = 250;
    const padding = { top: 24, right: 16, bottom: 48, left: 48 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = 178;
    const slotWidth = plotWidth / Math.max(items.length, 1);
    const barWidth = Math.min(220, Math.max(26, slotWidth * 0.72));
    const palette = Array.isArray(colors) ? colors : [colors];
    const ticks = Array.from({ length: 5 }, (_, i) => axisMax - (axisMax / 4) * i);
    const shouldShowLegend = showLegend ?? items.length <= 3;

    return (
        <DevOverlay name={`AR Chart: ${title}`}>
            <div className="ar-panel" style={{ marginBottom: 0 }}>
                <h4>{title}</h4>
                {sub && <div className="ar-panel-sub">{sub}</div>}
                <div className="ar-chart-wrap">
                    <svg
                        className="ar-bar-svg"
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        preserveAspectRatio="xMidYMid meet"
                        role="img"
                        aria-label={title}
                    >
                        {ticks.map((tick) => {
                            const y = padding.top + plotHeight - (tick / axisMax) * plotHeight;
                            return (
                                <g key={tick}>
                                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#edf0f2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                    <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#8091a7" vectorEffect="non-scaling-stroke">
                                        {axisFormatter(tick)}
                                    </text>
                                </g>
                            );
                        })}
                        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#d9dde2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <line x1={padding.left} y1={padding.top + plotHeight} x2={chartWidth - padding.right} y2={padding.top + plotHeight} stroke="#d9dde2" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        {items.map((item, i) => {
                            const value = Number(item.value) || 0;
                            const barHeightScaled = (value / axisMax) * plotHeight;
                            const x = padding.left + (i * slotWidth) + ((slotWidth - barWidth) / 2);
                            const y = padding.top + plotHeight - barHeightScaled;
                            const color = palette[i % palette.length];
                            const label = String(item.label || '');
                            const labelRotation = items.length > 4 ? -12 : 0;
                            const tooltipX = Math.min(Math.max(x + barWidth / 2, 96), chartWidth - 96);
                            const tooltipY = Math.max(y - 48, 6);

                            return (
                                <g key={item.label}>
                                    <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={barHeightScaled}
                                        fill={`${color}cc`}
                                        stroke={color}
                                        strokeWidth="1"
                                        rx="6"
                                        vectorEffect="non-scaling-stroke"
                                        onMouseEnter={() => setTooltip({
                                            color,
                                            label,
                                            value: formatter(value),
                                            x: tooltipX,
                                            y: tooltipY,
                                        })}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                    <text x={x + barWidth / 2} y={Math.max(y - 10, 12)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#002b5c" letterSpacing="2" vectorEffect="non-scaling-stroke">
                                        {valueFormatter(value)}
                                    </text>
                                    <text
                                        x={x + barWidth / 2}
                                        y={padding.top + plotHeight + 24}
                                        textAnchor={labelRotation ? 'end' : 'middle'}
                                        fontSize="12"
                                        fontWeight="600"
                                        fill="#8091a7"
                                        transform={labelRotation ? `rotate(${labelRotation} ${x + barWidth / 2} ${padding.top + plotHeight + 24})` : undefined}
                                        vectorEffect="non-scaling-stroke"
                                    >
                                        {label.length > 18 ? `${label.slice(0, 16)}...` : label}
                                    </text>
                                </g>
                            );
                        })}
                        {tooltip && (
                            <g className="ar-chart-tooltip" pointerEvents="none">
                                <rect x={tooltip.x - 86} y={tooltip.y} width="172" height="40" rx="5" fill="rgba(15, 23, 42, 0.92)" />
                                <circle cx={tooltip.x - 72} cy={tooltip.y + 14} r="4" fill={tooltip.color} />
                                <text x={tooltip.x - 62} y={tooltip.y + 18} fontSize="12" fontWeight="700" fill="#fff">
                                    {tooltip.label}
                                </text>
                                <text x={tooltip.x - 72} y={tooltip.y + 33} fontSize="12" fill="#e5e7eb">
                                    {tooltip.value}
                                </text>
                            </g>
                        )}
                    </svg>
                </div>

                {shouldShowLegend && <div className="ar-chart-legend">
                    {items.map((item, i) => {
                        const color = palette[i % palette.length];
                        return (
                            <div key={item.label} className="ar-chart-legend-item">
                                <span className="ar-chart-dot" style={{ background: color }} />
                                <span>
                                    {item.label}: <strong>{formatter(item.value)}</strong>
                                </span>
                            </div>
                        );
                    })}
                </div>}
            </div>
        </DevOverlay>
    );
}

export function BarList({ title, sub, items = [], formatter = fmt, colors = [] }) {
    const max = Math.max(...items.map((i) => Math.abs(Number(i.value))), 1);
    return (
        <DevOverlay name={`AR Bar List: ${title}`}>
            <div className="ar-panel" style={{ marginBottom: 0 }}>
                <h4>{title}</h4>
                {sub && <div className="ar-panel-sub">{sub}</div>}
                <div className="bar-list" style={{ marginTop: sub ? 0 : 14 }}>
                    {items.map((item, i) => {
                        const color = colors[i] || undefined;
                        return (
                            <div className="bar-item" key={item.label}>
                                <div className="bar-label">
                                    <span title={item.label}>{item.label}</span>
                                    <strong style={color ? { color } : undefined}>{formatter(item.value)}</strong>
                                </div>
                                <div className="bar-track">
                                    <span style={{ width: `${Math.max(Math.abs(item.value) / max * 100, 2)}%`, ...(color ? { background: color } : {}) }} />
                                </div>
                            </div>
                        );
                    })}
                    {!items.length && <p className="empty-copy" style={{ fontSize: 11, color: '#718096' }}>No data.</p>}
                </div>
            </div>
        </DevOverlay>
    );
}
