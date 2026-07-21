import { useMemo } from 'react';
import { fmt } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const SOURCES = {
  Gartner: 'https://www.gartner.com',
  OpenView: 'https://openviewpartners.com',
  Forrester: 'https://www.forrester.com',
  Pavilion: 'https://www.joinpavilion.com',
  Benchmarkit: 'https://benchmarkit.ai',
  SiriusDecisions: 'https://www.forrester.com',
};

const BENCHMARKS = [
  { key: 'wrcount', nice: 'Win Rate#', label: 'Win Rate (by Count)', description: 'Won deals / (Won + Lost) deals', unit: '%', p25: 10, p50: 18, p75: 25, p90: 30, min: 0, max: 30, sources: ['Gartner', 'OpenView'], action: 'Improve qualification & discovery' },
  { key: 'wrdollar', nice: 'Win Rate $', label: 'Win Rate (by $)', description: 'Won $ / (Won $ + Lost $)', unit: '%', p25: 25, p50: 35, p75: 50, p90: 65, min: 0, max: 75, sources: ['Gartner', 'OpenView'], action: 'Strong $ win rate — focus on larger deals' },
  { key: 'wrpipe', nice: 'Win Rate vs Pipe', label: 'Win Rate vs Total Pipeline', description: 'Won $ / Active pipeline (conversion efficiency)', unit: '%', p25: 8, p50: 15, p75: 25, p90: 35, min: 0, max: 35, sources: ['Forrester', 'Pavilion'], action: 'Pipeline conversion needs acceleration' },
  { key: 'pipecov', nice: 'UW Coverage AOP', label: 'UW Pipeline Coverage vs AOP', description: 'Active pipeline (unweighted) / AOP', unit: '×', p25: 2, p50: 3, p75: 4, p90: 5, min: 1, max: 5, sources: ['Gartner', 'Benchmarkit'], action: 'Build enough new pipeline to reach the 3× median' },
  { key: 'pipecovtgt', nice: 'UW Coverage Target', label: 'UW Pipeline Coverage vs Target', description: 'Active pipeline (unweighted) / Sales Target', unit: '×', p25: 2, p50: 3, p75: 4, p90: 5, min: 1, max: 5, sources: ['Gartner', 'Benchmarkit'], action: 'Below 2× — significant pipeline gap vs stretch target' },
  { key: 'wpipecov', nice: 'W.Cov AOP', label: 'Weighted Pipeline Coverage vs AOP', description: 'Probability-weighted pipeline / AOP', unit: '×', p25: 1, p50: 1.5, p75: 2, p90: 3, min: 0, max: 3, sources: ['Gartner', 'Benchmarkit'], action: 'Weighted coverage below 1× — high miss risk' },
  { key: 'wpipecovtgt', nice: 'W.Cov Target', label: 'Weighted Pipeline Coverage vs Target', description: 'Probability-weighted pipeline / Sales Target', unit: '×', p25: 1, p50: 1.5, p75: 2, p90: 3, min: 0, max: 3, sources: ['Gartner', 'Benchmarkit'], action: 'Critically low — must double weighted pipeline' },
  { key: 'commit', nice: 'Commit%', label: 'Commit % of Pipeline', description: 'High-confidence / total active', unit: '%', p25: 5, p50: 12, p75: 18, p90: 25, min: 0, max: 25, sources: ['Forrester', 'SiriusDecisions'], action: 'Convert Upside → Commit' },
  { key: 'late', nice: 'Late Stage', label: 'Late-Stage Pipeline %', description: '80%+ stage / active pipeline', unit: '%', p25: 10, p50: 18, p75: 25, p90: 30, min: 0, max: 30, sources: ['Gartner', 'Benchmarkit'], action: 'Accelerate 40%→60%→80%' },
  { key: 'avgdeal', nice: 'Avg Deal Size', label: 'Average Deal Size', description: 'Active pipeline / deal count', unit: '$', p25: 50000, p50: 150000, p75: 300000, p90: 500000, min: 0, max: 500000, sources: ['OpenView', 'Forrester'], action: 'Focus on $250K+ deals' },
  { key: 'cycle', nice: 'Sales Cycle', label: 'Sales Cycle Length', description: 'Avg days Create→Close · all won deals incl. outliers', unit: 'd', p25: 270, p50: 150, p75: 90, p90: 60, min: 60, max: 270, higherBetter: false, sources: ['Pavilion', 'Gartner'], action: 'Review long-cycle and recompete outliers' },
  { key: 'aopatt', nice: 'AOP Attainment', label: 'AOP Attainment (H1)', description: 'Booked revenue / AOP (24 weeks)', unit: '%', p25: 25, p50: 40, p75: 50, p90: 55, min: 0, max: 100, sources: ['Benchmarkit', 'Forrester'], action: 'H2 must deliver 3× H1 pace' },
].map(row => ({ higherBetter: true, ...row }));

const RADAR_KEYS = ['wrcount', 'wrdollar', 'pipecov', 'wpipecov', 'commit', 'late', 'avgdeal', 'aopatt'];
const RADAR_LABELS = ['Win Rate#', 'Win Rate$', 'UW Coverage', 'Weighted Cov', 'Commit%', 'Late Stage%', 'Avg Deal', 'AOP Attain'];
const RADAR_MEDIAN = [60, 54, 60, 50, 48, 60, 40, 53];
const GAP_MEDIAN = [18, 35, 3, 1.5, 12, 18, 150, 40];
const GAP_BEST = [30, 60, 5, 3, 25, 30, 300, 55];

function statusFor(value, row) {
  const good = row.higherBetter
    ? [value >= row.p90, value >= row.p75, value >= row.p50, value >= row.p25]
    : [value <= row.p90, value <= row.p75, value <= row.p50, value <= row.p25];
  if (good[0]) return { group: 'good', score: 5, label: 'Best-in-Class', emoji: '🔵', color: '#0891b2', cls: 'bb' };
  if (good[1]) return { group: 'good', score: 4, label: 'Good', emoji: '🟢', color: '#059669', cls: 'bg' };
  if (good[2]) return { group: 'watch', score: 3, label: 'Watch', emoji: '🟡', color: '#d97706', cls: 'ba' };
  if (good[3]) return { group: 'below', score: 2, label: 'Below Median', emoji: '🟠', color: '#f97316', cls: 'bo' };
  return { group: 'critical', score: 1, label: 'Critical', emoji: '🔴', color: '#dc2626', cls: 'br' };
}

function formatValue(value, unit) {
  if (unit === '$') return fmt(value);
  if (unit === '×') return `${Number(value || 0).toFixed(2)}×`;
  if (unit === 'd') return `${Math.round(value || 0)} days`;
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatThreshold(value, unit, edge, higherBetter) {
  const formatted = unit === '$' ? fmt(value) : unit === 'd' ? `${value}d` : `${value}${unit}`;
  if (edge === 'p25') return `${higherBetter ? '<' : '>'}${formatted}`;
  if (edge === 'p90') return `${higherBetter ? '' : '<'}${formatted}${higherBetter ? '+' : ''}`;
  return formatted;
}

function FormulaPanel({ metric, inputs, cycle, onContinue }) {
  const formulas = {
    wrcount: ['Won Deals ÷ (Won Deals + Lost Deals) × 100', 'Every closed deal counts equally, regardless of size.', [['Won deals', inputs.won_deals], ['Lost deals', inputs.lost_deals], ['Total closed', inputs.closed_deals]]],
    wrdollar: ['Won $ ÷ (Won $ + Lost $) × 100', 'Weights the win rate by deal size, so a large win or loss has the correct impact.', [['Won value', fmt(inputs.won_pipeline)], ['Lost value', fmt(inputs.lost_pipeline)], ['Total closed value', fmt(inputs.closed_pipeline)]]],
    wrpipe: ['Won $ ÷ Active Pipeline × 100', 'Measures conversion efficiency against everything still open in the pipeline.', [['Won value', fmt(inputs.won_pipeline)], ['Active pipeline', fmt(inputs.active_pipeline)]]],
    pipecov: ['Active Pipeline ÷ AOP', 'Shows whether the open pipeline is large enough to support the annual operating plan.', [['Active pipeline (unweighted)', fmt(inputs.active_pipeline)], ['AOP', fmt(inputs.aop)]]],
    pipecovtgt: ['Active Pipeline ÷ Sales Target', 'Uses the more aggressive Sales Target denominator, so this is lower than AOP coverage.', [['Active pipeline (unweighted)', fmt(inputs.active_pipeline)], ['Sales Target', fmt(inputs.sales_target)]]],
    wpipecov: ["Σ(Deal Amount × Stage Probability) ÷ AOP", 'Discounts each open deal by its current close probability for a more realistic coverage view.', [['Weighted pipeline', fmt(inputs.weighted_pipeline)], ['AOP', fmt(inputs.aop)]]],
    wpipecovtgt: ["Σ(Deal Amount × Stage Probability) ÷ Sales Target", 'Applies the same probability weighting against the larger Sales Target.', [['Weighted pipeline', fmt(inputs.weighted_pipeline)], ['Sales Target', fmt(inputs.sales_target)]]],
    commit: ['Commit-forecast $ ÷ Active Pipeline × 100', 'Commit is pipeline the reps have personally staked their forecast on.', [['Commit pipeline', fmt(inputs.commit_pipeline)], ['Active pipeline', fmt(inputs.active_pipeline)]]],
    late: ['(80%-Validate + 90%-Negotiate) $ ÷ Active Pipeline × 100', 'A low late-stage percentage means the pipeline is top-heavy and less ready to close.', [['Late-stage pipeline', fmt(inputs.late_stage_pipeline)], ['Active pipeline', fmt(inputs.active_pipeline)]]],
    avgdeal: ['Active Pipeline ÷ Number of Active Deals', 'This average is sensitive to very large and very small deals; inspect the size distribution behind it.', [['Active pipeline', fmt(inputs.active_pipeline)], ['Active deal count', inputs.active_deals]]],
    cycle: ['Average(Close Date − Create Date) for Won deals, per rep, then across reps', 'Only won deals with usable Create and Close dates are included. Re-importing older workbooks populates the exact Close Date calculation.', [['Reps with usable cycle data', cycle.reps_with_data], ['Won deals with usable dates', cycle.deals_with_data]]],
    aopatt: ['Won $ (year to date) ÷ AOP × 100', 'Only booked revenue counts toward annual operating plan attainment.', [['Won $ (YTD)', fmt(inputs.won_pipeline)], ['AOP', fmt(inputs.aop)]]],
  };
  const [formula, why, rows] = formulas[metric.key];
  const bars = [
    { label: '1Kosmos', value: metric.value, color: metric.status.color },
    { label: 'P50 Median', value: metric.p50, color: '#f59e0b' },
    { label: 'P75 Good', value: metric.p75, color: '#10b981' },
    { label: 'P90 Best', value: metric.p90, color: '#06b6d4' },
  ];
  const max = Math.max(...bars.map(item => item.value), 1) * 1.15;
  return (
    <div className="pl-bm-formula">
      <div className="pl-bm-summary-row">
        {bars.slice(0, 3).map(item => (
          <div className="pl-bm-summary" key={item.label}>
            <div>{item.label}</div>
            <strong style={{ color: item.color }}>{formatValue(item.value, metric.unit)}</strong>
          </div>
        ))}
      </div>
      <div className="pl-bm-mini-chart">
        <div className="pl-bm-eyebrow">📊 {metric.label} vs Industry Benchmarks</div>
        <div className="pl-bm-mini-bars">
          {bars.map(item => (
            <div className="pl-bm-mini-col" key={item.label}>
              <strong style={{ color: item.color }}>{formatValue(item.value, metric.unit)}</strong>
              <div style={{ height: Math.max(5, (item.value / max) * 74), background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pl-bm-formula-box">
        <div className="pl-bm-eyebrow">FORMULA</div>
        <div className="pl-bm-formula-text">{formula}</div>
      </div>
      <div className="pl-bm-formula-box">
        <div className="pl-bm-eyebrow">RIGHT NOW, WITH YOUR CURRENT FILTERS</div>
        {rows.map(([label, value]) => <div className="pl-bm-calc-row" key={label}><span>{label}</span><strong>{value ?? 0}</strong></div>)}
        <div className="pl-bm-result"><span>Result</span><strong>{metric.formatted}</strong></div>
      </div>
      <div className="pl-bm-why">💡 {why}</div>
      <button className="pl-bm-drill-link" onClick={onContinue}>
        🔍 {metric.key === 'avgdeal' ? 'See the full size distribution (min/median/max)' : metric.key === 'cycle' ? 'See Create → Close date breakdown per deal' : 'See the actual deals behind this number'} →
      </button>
    </div>
  );
}

function StatusMetrics({ metrics, onMetric }) {
  return <div className="pl-bm-metric-grid">{metrics.map(metric => (
    <button key={metric.key} className="pl-bm-metric-choice" onClick={() => onMetric(metric)}>
      <span>{metric.label}</span><strong style={{ color: metric.status.color }}>{metric.formatted}</strong>
      <small>{metric.status.emoji} {metric.status.label} · click for formula</small>
    </button>
  ))}</div>;
}

function RadarChart({ metrics, onMetric }) {
  const cx = 170, cy = 138, radius = 102, count = metrics.length;
  const angle = i => (i / count) * Math.PI * 2 - Math.PI / 2;
  const point = (pct, i) => ({ x: cx + radius * pct * Math.cos(angle(i)), y: cy + radius * pct * Math.sin(angle(i)) });
  const polygon = values => values.map((value, i) => { const p = point(Math.min(1, value / 100), i); return `${p.x},${p.y}`; }).join(' ');
  const actual = metrics.map(metric => metric.radar);
  return <svg viewBox="0 0 340 285" className="pl-bm-radar" aria-label="Benchmark radar chart">
    {[25, 50, 75, 100].map(level => <polygon key={level} points={polygon(Array(count).fill(level))} fill="none" stroke="#dbe2ea" strokeWidth="1" />)}
    {metrics.map((metric, i) => { const p = point(1, i); return <line key={metric.key} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#dbe2ea" />; })}
    <polygon points={polygon(Array(count).fill(100))} fill="rgba(16,185,129,.025)" stroke="#10b981" strokeWidth="1.2" strokeDasharray="2 4" />
    <polygon points={polygon(RADAR_MEDIAN)} fill="rgba(245,158,11,.04)" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" />
    <polygon points={polygon(actual)} fill="rgba(6,182,212,.12)" stroke="#06b6d4" strokeWidth="2.2" />
    {metrics.map((metric, i) => { const p = point(actual[i] / 100, i); const lp = point(1.19, i); return <g key={metric.key} className="pl-bm-chart-hit" onClick={() => onMetric(metric)}>
      <circle cx={p.x} cy={p.y} r="5" fill="#06b6d4" stroke="#fff" strokeWidth="2" />
      <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="#475569">{RADAR_LABELS[i]}</text>
    </g>; })}
  </svg>;
}

function GapChart({ metrics, onMetric }) {
  const labels = ['Win Rate#', 'Win Rate$', 'UW Cov×', 'W.Cov×', 'Commit%', 'Late%', 'Avg Deal $K', 'AOP%'];
  const actual = metrics.map(metric => metric.key === 'avgdeal' ? metric.value / 1000 : metric.value);
  const width = 650, height = 285, left = 42, right = 10, top = 12, bottom = 62;
  const innerW = width - left - right, innerH = height - top - bottom, max = 330;
  const groupW = innerW / metrics.length, barW = groupW / 4;
  const sets = [
    { values: actual, color: '#2563eb', label: '1Kosmos (Live)' },
    { values: GAP_MEDIAN, color: '#f59e0b', label: 'Industry Median' },
    { values: GAP_BEST, color: '#10b981', label: 'Best-in-Class' },
  ];
  return <svg viewBox={`0 0 ${width} ${height}`} className="pl-bm-gap" aria-label="Gap to median grouped bar chart">
    {[0, 100, 200, 300].map(tick => { const y = top + innerH - (tick / max) * innerH; return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" /><text x={left - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{tick}</text></g>; })}
    {metrics.map((metric, index) => <g key={metric.key} className="pl-bm-chart-hit" onClick={() => onMetric(metric)}>
      {sets.map((set, setIndex) => { const value = set.values[index]; const h = Math.max(1, value / max * innerH); const x = left + index * groupW + 7 + setIndex * barW; return <rect key={set.label} x={x} y={top + innerH - h} width={barW - 2} height={h} rx="2" fill={set.color} fillOpacity={setIndex === 0 ? 0.82 : 0.58} stroke={set.color} />; })}
      <text x={left + index * groupW + groupW / 2} y={height - bottom + 16} textAnchor="middle" fontSize="8" fill="#64748b">{labels[index]}</text>
    </g>)}
    {sets.map((set, index) => <g key={set.label} transform={`translate(${160 + index * 145},${height - 17})`}><rect width="13" height="7" fill={set.color} /><text x="18" y="7" fontSize="8" fill="#64748b">{set.label}</text></g>)}
  </svg>;
}

function IndustryBenchmark({ data }) {
  const { kpis = {}, deals = [], industry_benchmark: apiBenchmark = {}, selected_week: selectedWeek } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const activeDeals = useMemo(() => deals.filter(deal => !['Business Won', 'Business Lost'].includes(deal.stage)), [deals]);
  const wonDeals = useMemo(() => deals.filter(deal => deal.stage === 'Business Won'), [deals]);
  const lostDeals = useMemo(() => deals.filter(deal => deal.stage === 'Business Lost'), [deals]);
  const commitDeals = useMemo(() => activeDeals.filter(deal => (deal.forecast_category || '').trim() === 'Commit'), [activeDeals]);
  const lateDeals = useMemo(() => activeDeals.filter(deal => ['80%-Validate', '90%-Negotiate & Close'].includes(deal.stage)), [activeDeals]);

  const inputs = useMemo(() => apiBenchmark.inputs || {
    active_pipeline: kpis.active_pipeline || 0, active_deals: activeDeals.length,
    weighted_pipeline: kpis.weighted_pipeline || 0,
    won_pipeline: kpis.won_ytd || 0, won_deals: wonDeals.length,
    lost_pipeline: kpis.lost_ytd || 0, lost_deals: lostDeals.length,
    closed_pipeline: (kpis.won_ytd || 0) + (kpis.lost_ytd || 0), closed_deals: wonDeals.length + lostDeals.length,
    commit_pipeline: kpis.commit_pipeline || 0, commit_deals: commitDeals.length,
    late_stage_pipeline: lateDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0), late_stage_deals: lateDeals.length,
    aop: kpis.aop || 1, sales_target: kpis.sales_target || 1,
  }, [apiBenchmark.inputs, kpis, activeDeals, wonDeals, lostDeals, commitDeals, lateDeals]);

  const values = useMemo(() => apiBenchmark.metrics || {
    wrcount: inputs.closed_deals ? inputs.won_deals / inputs.closed_deals * 100 : 0,
    wrdollar: inputs.closed_pipeline ? inputs.won_pipeline / inputs.closed_pipeline * 100 : 0,
    wrpipe: inputs.active_pipeline ? inputs.won_pipeline / inputs.active_pipeline * 100 : 0,
    pipecov: inputs.active_pipeline / inputs.aop, pipecovtgt: inputs.active_pipeline / inputs.sales_target,
    wpipecov: inputs.weighted_pipeline / inputs.aop, wpipecovtgt: inputs.weighted_pipeline / inputs.sales_target,
    commit: inputs.active_pipeline ? inputs.commit_pipeline / inputs.active_pipeline * 100 : 0,
    late: inputs.active_pipeline ? inputs.late_stage_pipeline / inputs.active_pipeline * 100 : 0,
    avgdeal: inputs.active_deals ? inputs.active_pipeline / inputs.active_deals : 0,
    cycle: data.fpa?.scorecard?.avg_cycle_days || 0,
    aopatt: inputs.won_pipeline / inputs.aop * 100,
  }, [apiBenchmark.metrics, inputs, data.fpa]);

  const metrics = useMemo(() => BENCHMARKS.map(row => {
    const value = Number(values[row.key] || 0);
    const status = statusFor(value, row);
    const marker = Math.max(0, Math.min(100, (value - row.min) / (row.max - row.min) * 100));
    const radarDivisors = { wrcount: 30, wrdollar: 65, pipecov: 5, wpipecov: 3, commit: 25, late: 30, avgdeal: 500000, aopatt: 55 };
    return { ...row, value, status, marker, formatted: formatValue(value, row.unit), radar: Math.min(100, value / (radarDivisors[row.key] || row.max) * 100) };
  }), [values]);

  const metricMap = useMemo(() => Object.fromEntries(metrics.map(metric => [metric.key, metric])), [metrics]);
  const radarMetrics = RADAR_KEYS.map(key => metricMap[key]);
  const groups = useMemo(() => ({
    critical: metrics.filter(metric => metric.status.group === 'critical'),
    below: metrics.filter(metric => metric.status.group === 'below'),
    watch: metrics.filter(metric => metric.status.group === 'watch'),
    good: metrics.filter(metric => metric.status.group === 'good'),
  }), [metrics]);
  const cycle = apiBenchmark.cycle || { average_days: values.cycle || 0, source: 'snapshot_fallback', reps_with_data: 0, deals_with_data: 0, average_excluding_outliers: 0, non_outlier_deals: 0, details: [] };

  const dealsFor = metric => {
    if (['wrcount', 'wrdollar', 'wrpipe', 'aopatt', 'cycle'].includes(metric.key)) return wonDeals;
    if (metric.key === 'commit') return commitDeals;
    if (metric.key === 'late') return lateDeals;
    return activeDeals;
  };

  const openSizeDistribution = metric => {
    const amounts = activeDeals.map(deal => deal.amount || 0).sort((a, b) => a - b);
    const median = amounts.length ? (amounts[Math.floor((amounts.length - 1) / 2)] + amounts[Math.ceil((amounts.length - 1) / 2)]) / 2 : 0;
    const children = <div className="pl-bm-distribution"><div><span>Minimum</span><strong>{fmt(amounts[0] || 0)}</strong></div><div><span>Median</span><strong>{fmt(median)}</strong></div><div><span>Average</span><strong>{metric.formatted}</strong></div><div><span>Maximum</span><strong>{fmt(amounts[amounts.length - 1] || 0)}</strong></div></div>;
    openDrill('Average Deal Size — Full Distribution', `${activeDeals.length} active deals · click any row for full detail`, activeDeals, children);
  };

  const openCycleDetail = () => {
    const rows = cycle.details || [];
    const children = <>
      <div className="pl-bm-distribution">
        <div><span>All won deals</span><strong>{cycle.average_days || 0}d</strong></div>
        <div><span>Excluding &gt;500d</span><strong>{cycle.average_excluding_outliers || 0}d</strong></div>
        <div><span>Reps included</span><strong>{cycle.reps_with_data || 0}</strong></div>
        <div><span>Deals included</span><strong>{cycle.deals_with_data || 0}</strong></div>
      </div>
      {rows.length > 0 ? <div className="pl-twrap"><table><thead><tr><th>#</th><th>Deal Name</th><th>Company</th><th>Owner</th><th>Amount</th><th>Create Date</th><th>Close Date</th><th>Gap</th></tr></thead><tbody>
        {rows.map((row, index) => { const deal = wonDeals.find(item => String(item.record_id) === String(row.record_id)); return <tr key={`${row.record_id}-${index}`} className="pl-tr-click" onClick={() => deal && openDeal(deal)}><td>{index + 1}</td><td><strong>{row.deal_name}</strong></td><td>{row.company}</td><td>{row.owner}</td><td>{fmt(row.amount)}</td><td>{row.create_date}</td><td>{row.close_date}</td><td><span className="b br">{row.cycle_days}d</span></td></tr>; })}
      </tbody></table></div> : <div className="pl-bm-empty-note">Close Date was not stored in the existing import. Re-import the same workbook once to populate the exact Create → Close breakdown.</div>}
    </>;
    openDrill('Sales Cycle — Create → Close Detail', `${rows.length} won deals, sorted longest cycle first`, null, children);
  };

  const openMetricDeals = metric => {
    if (metric.key === 'avgdeal') return openSizeDistribution(metric);
    if (metric.key === 'cycle') return openCycleDetail();
    const list = dealsFor(metric);
    openDrill(`${metric.label} — Related Deals`, `${list.length} deals behind ${metric.formatted} · click any row for full deal detail`, list);
  };

  const openFormula = metric => openDrill(
    `${metric.label} — How this is calculated`,
    `${metric.status.emoji} ${metric.status.label} · P50 ${formatValue(metric.p50, metric.unit)}`,
    null,
    <FormulaPanel metric={metric} inputs={inputs} cycle={cycle} onContinue={() => openMetricDeals(metric)} />,
  );

  const openGroup = (label, group) => openDrill(label, `${group.length} benchmark metrics · click a metric for its formula and drill-down`, null, <StatusMetrics metrics={group} onMetric={openFormula} />);
  const handleDrillStage = stage => openDrill(`${stage} — Deals`, 'Deals in the selected stage', deals.filter(deal => deal.stage === stage));

  const cards = [
    ['Metrics Critical (P25)', groups.critical, 'kr', 'critical', '#dc2626'],
    ['Metrics Below Median', groups.below, 'ko', 'below median', '#f97316'],
    ['Metrics Watch', groups.watch, 'ka', 'watch', '#d97706'],
    ['Metrics Good/Best', groups.good, 'kg', 'good / best', '#059669'],
  ];

  return <>
    <div className="anote">📚 <strong>Sources (all ARR &gt;$25M B2B SaaS):</strong> Gartner B2B Sales Benchmarks 2024 · Forrester/SiriusDecisions Revenue Waterfall 2024 · OpenView Partners SaaS Benchmarks 2024 (n=600+) · Benchmarkit SaaS Operating Benchmarks 2024 · Pavilion/RevOps Squared GTM Benchmarks 2024 (n=400+ CROs) · KeyBanc Capital Markets SaaS Survey 2024. Benchmarks represent P25 (Worst), P50 (Median), P75 (Good), P90 (Best-in-Class).</div>

    <div className="krow k4">
      {cards.map(([label, group, cls, descriptor, color]) => <div key={label} className={`kc ${cls}`} onClick={() => openGroup(label, group)}>
        <div className="kl">{label}</div><div className="kv">{group.length}</div>
        <div className="kd"><span style={{ color }}>{group.length ? group.map(metric => metric.nice).join(', ') : 'None'}</span></div>
        <div className="click-hint">🔍 Click → {descriptor} metrics</div>
      </div>)}
    </div>

    <div className="g2">
      <div className="pl-card">
        <div className="pl-card-title">Benchmark Radar — 1Kosmos vs Median vs Best-in-Class</div>
        <div className="pl-card-sub">Normalized 0–100 scale · Higher = better · Click any point</div>
        <RadarChart metrics={radarMetrics} onMetric={openFormula} />
        <div className="pl-bm-legend"><span><i style={{ background: '#06b6d4' }} />1Kosmos (Live)</span><span><i style={{ background: '#f59e0b' }} />Industry Median</span><span><i style={{ background: '#10b981' }} />Best-in-Class</span></div>
      </div>
      <div className="pl-card">
        <div className="pl-card-title">Gap to Median — Current vs Benchmark</div>
        <div className="pl-card-sub">Blue = 1Kosmos · Amber = Median · Green = Best-in-Class · Click any group</div>
        <GapChart metrics={radarMetrics} onMetric={openFormula} />
      </div>
    </div>

    <div className="pl-card">
      <div className="pl-card-title">📊 Full Benchmark Scorecard — Click any row to drill into related deals</div>
      <div className="pl-card-sub">Color coded: 🔴 Critical (P25) · 🟠 Below Median · 🟡 Watch · 🟢 Good · 🔵 Best-in-Class · See Methodology doc for sources</div>
      <div className="pl-twrap" style={{ marginTop: 8 }}><table className="pl-bm-scorecard"><thead><tr><th>Metric</th><th>1Kosmos {selectedWeek || apiBenchmark.selected_week}</th><th>Worst (P25)</th><th>Median (P50)</th><th>Good (P75)</th><th>Best-in-Class (P90)</th><th>Visual Position</th><th>Status</th><th>Source</th><th>Action</th></tr></thead><tbody>
        {metrics.map(metric => <tr key={metric.key} className="pl-tr-click" onClick={() => openFormula(metric)}>
          <td><strong>{metric.label}</strong> <span className="click-hint" title="How is this calculated?">❓</span><div className="td3 tds">{metric.description}</div></td>
          <td><strong className="pl-bm-current" style={{ color: metric.status.color }}>{metric.formatted}</strong><div className="td3 tds">{metric.key === 'wrcount' ? `${inputs.won_deals}W / ${inputs.closed_deals} closed` : metric.key === 'wrdollar' ? `${fmt(inputs.won_pipeline)} won / ${fmt(inputs.closed_pipeline)} closed` : metric.key === 'cycle' ? `${cycle.reps_with_data} reps · avg Create→Close` : ''}</div></td>
          <td className="td3">{formatThreshold(metric.p25, metric.unit, 'p25', metric.higherBetter)}</td><td className="pl-bm-p50">{formatThreshold(metric.p50, metric.unit)}</td><td className="pl-bm-p75">{formatThreshold(metric.p75, metric.unit)}</td><td className="pl-bm-p90">{formatThreshold(metric.p90, metric.unit, 'p90', metric.higherBetter)}</td>
          <td><div className={`pl-bm-gauge${metric.higherBetter ? '' : ' reverse'}`}><i style={{ left: `${metric.marker}%` }} /></div><div className="pl-bm-gauge-labels"><span>{formatValue(metric.min, metric.unit)}</span><span>{formatValue(metric.max, metric.unit)}</span></div></td>
          <td><span className={`b ${metric.status.cls}`}>{metric.status.emoji} {metric.status.label}</span></td>
          <td className="td3 tds">{metric.sources.map((source, index) => <span key={source}>{index > 0 && ', '}<a href={SOURCES[source]} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{source}</a></span>)}</td>
          <td className="td3 tds">{metric.action}</td>
        </tr>)}
      </tbody></table></div>
    </div>

    {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
    {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
  </>;
}

export { IndustryBenchmark };
export default IndustryBenchmark;
