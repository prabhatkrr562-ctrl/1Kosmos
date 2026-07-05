import { fmt } from './plShared';

export const ACTIVE = [
  '5% - Prospecting',
  '20%-Discovery',
  '40%-Scoping',
  '60%-Propose',
  '80%-Validate',
  '90%-Negotiate & Close',
];

export const REP_QUOTAS = {
  'Fadi Jarrar': 3500000,
  'Frank Mendicino': 3500000,
  'William Easton': 3000000,
  'Cody Dussault': 2500000,
  'Siddharth Gandhi': 2000000,
  'Rohit Kumar': 1500000,
  'Dan Ryan': 1500000,
  'robert sokolowski': 1500000,
};

export function groupBy(rows, keyFn, valueFn = (row) => row.amount) {
  const map = new Map();
  rows.forEach((row) => {
    const label = keyFn(row) || 'Unknown';
    const existing = map.get(label) || { label, value: 0, count: 0, rows: [] };
    existing.value += Number(valueFn(row) || 0);
    existing.count += 1;
    existing.rows.push(row);
    map.set(label, existing);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function activeDeals(data) {
  return (data.deals || []).filter((deal) => ACTIVE.includes(deal.stage));
}

export function closedWonDeals(data) {
  return (data.deals || []).filter((deal) =>
    deal.stage === 'Business Won' || deal.forecast_category?.trim()?.toLowerCase() === 'closed won'
  );
}

export function riskScore(deal) {
  const amount = Number(deal.amount || 0);
  const stageIndex = ACTIVE.indexOf(deal.stage);
  const earlyStageRisk = stageIndex <= 2 ? 30 : stageIndex <= 4 ? 18 : 10;
  const amountRisk = amount >= 1000000 ? 40 : amount >= 500000 ? 30 : amount >= 200000 ? 20 : 10;
  const forecastRisk = deal.forecast_category?.trim() === 'Not forecasted' ? 20 : 5;
  return amountRisk + earlyStageRisk + forecastRisk;
}

export function Metric({ label, value }) {
  return (
    <div className="pl-bm-metric">
      <div className="pl-bm-metric-label">{label}</div>
      <div className="pl-bm-metric-value">{value}</div>
    </div>
  );
}

export function Waterfall({ label, value, total, color }) {
  const pct = total ? Math.min(100, Math.abs(value) / total * 100) : 0;
  return (
    <div className="pl-water-row">
      <div className="pl-water-label">{label}</div>
      <div className="pl-water-track">
        <div className="pl-water-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="pl-water-value">{fmt(value)}</div>
      <div className="pl-water-pct">{total ? `${(value / total * 100).toFixed(1)}%` : '—'}</div>
    </div>
  );
}

export function BenchmarkTile({ label, value, benchmark, good }) {
  return (
    <div className="pl-benchmark-card">
      <div className="pl-bm-title">{label}</div>
      <div className="pl-bm-big" style={{ color: good ? '#059669' : '#d97706' }}>{value}</div>
      <div className="pl-bm-sub">{benchmark}</div>
    </div>
  );
}
