import { fmt, fmtN, MultiLineChart } from './plShared';
import { DealModal, DrillModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const STAGE_SHORT = {
  '5% - Prospecting': '5% Prosp', '20%-Discovery': '20% Disc',
  '40%-Scoping': '40% Scope', '60%-Propose': '60% Prop',
  '80%-Validate': '80% Val', '90%-Negotiate & Close': '90% Neg',
};

const STAGE_COLORS = {
  '5% - Prospecting': '#7c3aed', '20%-Discovery': '#2563eb',
  '40%-Scoping': '#0d9488', '60%-Propose': '#d97706',
  '80%-Validate': '#ea580c', '90%-Negotiate & Close': '#dc2626',
};

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => fmt(number(value));

function TrendCard({ title, tag, children, onClick, clickHint }) {
  return (
    <section className={`pl-card${onClick ? ' pl-card-clickable' : ''}`} onClick={onClick}>
      <div className="pl-card-header" style={{ display: 'block' }}>
        <div className="pl-card-title">{title}</div>
        {tag && <div className="pl-card-sub">{tag}</div>}
      </div>
      {children}
      {onClick && <div className="ch">{clickHint || '🔍 Click to drill into deals'}</div>}
    </section>
  );
}

function WeekSummaryGrid({ weeklyTrend, onWeekClick }) {
  return (
    <div className="rep-grid">
      {weeklyTrend.map(row => (
        <div
          className="rc"
          key={row.week || row.week_num}
          role="button"
          tabIndex="0"
          onClick={() => onWeekClick(row)}
          onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && onWeekClick(row)}
        >
          <div className="rc-name">{row.week_num}</div>
          <div className="rc-pipe">${(number(row.active) / 1000000).toFixed(1)}M</div>
          <div className="rc-row">
            <div className="rc-stat"><div className="rc-sv">{number(row.count)}</div><div className="rc-sl">Deals</div></div>
            <div className="rc-stat"><div className="rc-sv" style={{ color: '#059669' }}>${(number(row.won) / 1000000).toFixed(1)}M</div><div className="rc-sl">Won</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ weeklyTrend = [], aop = 0, target = 0, onWeekClick }) {
  if (!weeklyTrend.length) return null;
  const width = 700;
  const height = 280;
  const pad = { left: 12, right: 66, top: 14, bottom: 26 };
  const max = Math.max(...weeklyTrend.flatMap(row => [number(row.active), number(row.weighted), number(row.won)]), aop, target, 1);
  const x = index => pad.left + index / (weeklyTrend.length - 1 || 1) * (width - pad.left - pad.right);
  const y = value => pad.top + (1 - number(value) / max) * (height - pad.top - pad.bottom);
  const line = key => weeklyTrend.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pl-trend-svg" role="img" aria-label="Full pipeline trend">
      {[.25, .5, .75, 1].map(ratio => <line key={ratio} x1={pad.left} y1={y(max * ratio)} x2={width - pad.right} y2={y(max * ratio)} stroke="#d1d5db" />)}
      {aop > 0 && <><line x1={pad.left} y1={y(aop)} x2={width - pad.right} y2={y(aop)} stroke="#d97706" strokeDasharray="5 4" /><text x={width - pad.right + 5} y={y(aop) + 4} fontSize="9" fill="#d97706">AOP</text></>}
      {target > 0 && <><line x1={pad.left} y1={y(target)} x2={width - pad.right} y2={y(target)} stroke="#dc2626" strokeDasharray="5 4" /><text x={width - pad.right + 5} y={y(target) + 4} fontSize="9" fill="#dc2626">Target</text></>}
      <polyline points={line('active')} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={line('weighted')} fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
      <polyline points={line('won')} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
      {weeklyTrend.map((row, index) => (
        <g key={`${row.week || row.week_num}-${index}`}>
          <circle cx={x(index)} cy={y(row.active)} r="3.5" fill="#0891b2" role="button" tabIndex="0" onClick={event => { event.stopPropagation(); onWeekClick(row); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onWeekClick(row); } }}>
            <title>{`${row.week || `W${row.week_num}`}: ${money(row.active)}`}</title>
          </circle>
          <text x={x(index)} y={height - 5} textAnchor="middle" fontSize="8.5" fill="#6b7280">W{row.week_num}</text>
        </g>
      ))}
    </svg>
  );
}

function WoWChart({ weeklyTrend = [], onWeekClick }) {
  if (weeklyTrend.length < 2) return null;
  const changes = weeklyTrend.map((row, index) => ({ ...row, value: index ? number(row.active) - number(weeklyTrend[index - 1].active) : 0 }));
  const maxAbs = Math.max(...changes.map(row => Math.abs(row.value)), 1);
  const width = 700;
  const height = 160;
  const pad = { left: 10, right: 10, top: 10, bottom: 24 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const mid = pad.top + innerHeight / 2;
  const barWidth = innerWidth / changes.length * .65;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pl-trend-svg" role="img" aria-label="Week over week pipeline change">
      <line x1={pad.left} y1={mid} x2={width - pad.right} y2={mid} stroke="#9ca3af" />
      {changes.map((row, index) => {
        const x = pad.left + (index + .5) * innerWidth / changes.length;
        const barHeight = Math.max(Math.abs(row.value) / maxAbs * (innerHeight / 2 - 2), 1);
        const y = row.value >= 0 ? mid - barHeight : mid;
        return <g key={index} role="button" tabIndex="0" onClick={event => { event.stopPropagation(); onWeekClick?.(row); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onWeekClick?.(row); } }}>
          <rect x={x - barWidth / 2} y={y} width={barWidth} height={barHeight} fill={row.value >= 0 ? '#059669' : '#dc2626'} opacity=".85" rx="1" />
          <text x={x} y={height - 4} textAnchor="middle" fontSize="8.5" fill="#6b7280">W{row.week_num}</text>
        </g>;
      })}
    </svg>
  );
}

function CountChart({ weeklyTrend = [] }) {
  if (!weeklyTrend.length) return null;
  const max = Math.max(...weeklyTrend.map(row => number(row.count)), 1);
  const width = 700;
  const height = 160;
  const pad = { left: 10, right: 10, top: 10, bottom: 24 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const barWidth = innerWidth / weeklyTrend.length * .65;
  return <svg viewBox={`0 0 ${width} ${height}`} className="pl-trend-svg" role="img" aria-label="Active deal count by week">
    {weeklyTrend.map((row, index) => {
      const x = pad.left + (index + .5) * innerWidth / weeklyTrend.length;
      const barHeight = number(row.count) / max * innerHeight;
      return <g key={index}><rect x={x - barWidth / 2} y={pad.top + innerHeight - barHeight} width={barWidth} height={barHeight} fill="#0891b2" opacity=".85" rx="2" /><text x={x} y={height - 4} textAnchor="middle" fontSize="8.5" fill="#6b7280">W{row.week_num}</text></g>;
    })}
  </svg>;
}

function StackedChart({ weeklyStage = [], onStageClick }) {
  if (!weeklyStage.length) return null;
  const max = Math.max(...weeklyStage.map(row => ACTIVE_STAGES.reduce((sum, stage) => sum + number(row.stages?.[stage]), 0)), 1);
  const width = 700;
  const height = 220;
  const pad = { left: 10, right: 10, top: 10, bottom: 24 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const barWidth = innerWidth / weeklyStage.length * .7;
  return <svg viewBox={`0 0 ${width} ${height}`} className="pl-trend-svg" role="img" aria-label="Stage evolution by week">
    {weeklyStage.map((row, weekIndex) => {
      const x = pad.left + (weekIndex + .5) * innerWidth / weeklyStage.length;
      let bottom = pad.top + innerHeight;
      return <g key={weekIndex}>
        {ACTIVE_STAGES.map(stage => {
          const value = number(row.stages?.[stage]);
          if (!value) return null;
          const barHeight = value / max * innerHeight;
          bottom -= barHeight;
          return <rect key={stage} x={x - barWidth / 2} y={bottom} width={barWidth} height={barHeight} fill={STAGE_COLORS[stage]} opacity=".85" role="button" tabIndex="0" onClick={event => { event.stopPropagation(); onStageClick(stage); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onStageClick(stage); } }}><title>{`${STAGE_SHORT[stage]}: ${money(value)}`}</title></rect>;
        })}
        <text x={x} y={height - 4} textAnchor="middle" fontSize="8.5" fill="#6b7280">W{row.week_num}</text>
      </g>;
    })}
  </svg>;
}

function stageStatus(stage, change, baseline) {
  const highStage = ['90%-Negotiate & Close', '80%-Validate'].includes(stage);
  const percentage = baseline ? Math.abs(change) / baseline * 100 : 0;
  if (highStage) {
    if (change < -300000) return { label: '🚨 Critical', className: 'br' };
    if (change > 0) return { label: '✅ Excellent', className: 'bg' };
    return { label: '→ Stable', className: 'bc' };
  }
  if (stage === '5% - Prospecting') return change > 0 ? { label: '↑ Growing', className: 'bb' } : { label: '→ Stable', className: 'bc' };
  if (change > 0 && percentage > 3) return { label: '↑ Growing', className: 'bb' };
  if (Math.abs(change) < 200000 || percentage < 3) return { label: '→ Stable', className: 'bc' };
  return { label: '⚠ Declining', className: 'ba' };
}

function PipelineTrend({ data }) {
  const { weekly_trend = [], weekly_stage_trend = [], baseline_stage_dist = {}, stage_dist = [], kpis = {}, executive = {}, deals = [] } = data || {};
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage } = useDrill();
  if (!weekly_trend.length) return <div className="pl-empty"><p>No trend data available.</p></div>;

  const metricDeals = deals.filter(deal => number(deal.amount) > 0);
  const activeDeals = metricDeals.filter(deal => ACTIVE_STAGES.includes(deal.stage));
  const wonDeals = metricDeals.filter(deal => deal.stage === 'Business Won');
  const baselineWeek = executive.baseline_week_short || `W${weekly_trend[0]?.week_num || 1}`;
  const selectedWeek = executive.selected_week_short || `W${weekly_trend[weekly_trend.length - 1]?.week_num || '?'}`;
  const currentStageDist = Object.fromEntries(stage_dist.map(item => [item.stage, number(item.amount)]));
  const baseline = executive.period_comparison?.baseline || weekly_trend[0] || {};
  const latestTrend = weekly_trend[weekly_trend.length - 1] || {};
  const current = executive.period_comparison?.current || latestTrend;
  const latestWeek = latestTrend;
  const selectedWeekLabel = executive.selected_week_short || `W${latestTrend.week_num || '?'}`;
  const openWeek = row => openDrill(`${row.week || `W${row.week_num}`} Pipeline`, 'Historical snapshot · Click any row for full detail', activeDeals);
  const openTrendSummary = () => openDrill('Pipeline Trend — Click a week to see deals', `${weekly_trend.length} weeks`, null, <WeekSummaryGrid weeklyTrend={weekly_trend} onWeekClick={openWeek} />);
  const openStage = stage => {
    const rows = activeDeals.filter(deal => deal.stage === stage);
    openDrill(`${stage} — ${rows.length} Deals`, `All deals in ${stage} stage · Click any row for full detail`, rows);
  };

  const stageRows = [
    { stage: 'Business Won', label: '🏆 Won', baseline: number(baseline.won), current: number(current.won), status: { label: '✅ Excellent', className: 'bg' }, dealRows: wonDeals, onClick: () => openDrill(`Won Deals — ${wonDeals.length} Deals`, 'All won deals · Click any row for full detail', wonDeals) },
    ...[...ACTIVE_STAGES].reverse().map(stage => {
      const base = number(baseline_stage_dist[stage]);
      const curr = number(currentStageDist[stage]);
      return { stage, label: STAGE_SHORT[stage] || stage, baseline: base, current: curr, status: stageStatus(stage, curr - base, base), dealRows: activeDeals.filter(deal => deal.stage === stage), onClick: () => openStage(stage) };
    }),
  ];

  return <>
    <TrendCard title={`Full Pipeline Trend ${baselineWeek}→${selectedWeekLabel} ↗ Click any point → that week's deals`} tag={`Historical weekly snapshots · All pipeline data · ${weekly_trend.length} weeks`} onClick={openTrendSummary} clickHint="🔍 Click any point → that week's deals">
      <TrendChart weeklyTrend={weekly_trend} aop={number(kpis.aop)} target={number(kpis.sales_target)} onWeekClick={openWeek} />
      <div className="pl-chart-legend"><span>— Active Pipeline</span><span>— Won Cumulative</span><span>- - Weighted Pipeline</span><span>- - AOP</span><span>- - Sales Target</span></div>
    </TrendCard>

    <div className="g2">
      <TrendCard title="Week-over-Week Change ($M) — Unweighted ↗ Click bar → week deals" tag="Green = growth · Red = decline · Purple dashed = Weighted Pipeline" onClick={() => openWeek(latestWeek)} clickHint="🔍 Click bar → week deals"><WoWChart weeklyTrend={weekly_trend} onWeekClick={openWeek} /></TrendCard>
      <TrendCard title="Active Deal Count by Week ↗ Click" tag="Total deals tracked per snapshot" onClick={() => openWeek(latestWeek)} clickHint="🔍 Click → see deals"><CountChart weeklyTrend={weekly_trend} /></TrendCard>
    </div>

    <div className="g2">
      <TrendCard title="Won vs Lost Cumulative ($M) ↗ Click → won deals" tag="Running total of won and lost pipeline" onClick={() => openDrill(`Won Deals — ${wonDeals.length} Deals`, 'All won deals · Click any row for full detail', wonDeals)} clickHint="🔍 Click → won deals">
        <MultiLineChart series={[{ data: weekly_trend.map(row => ({ value: row.won, label: `W${row.week_num}` })), color: '#059669' }, { data: weekly_trend.map(row => ({ value: row.lost, label: `W${row.week_num}` })), color: '#dc2626' }]} height={180} />
        <div className="pl-chart-legend"><span className="won">— Won</span><span className="lost">— Lost</span></div>
      </TrendCard>
      <TrendCard title={`Stage Movement ${baselineWeek} → ${selectedWeek} — Click rows to drill`} tag="Pipeline value change by stage">
        <div className="pl-twrap"><table><thead><tr><th>Stage</th><th>{baselineWeek}</th><th>{selectedWeek}</th><th>Change</th><th>Status</th></tr></thead><tbody>
          {stageRows.map(row => { const difference = row.current - row.baseline; return <tr key={row.stage} className="clickable-row pl-click-row" onClick={row.onClick} title={`Click to see ${row.dealRows.length} deals`}><td>{row.label}</td><td className="td2">{fmtN(row.baseline)}</td><td className="td2">{fmtN(row.current)}</td><td className={difference >= 0 ? 'up' : 'dn'}>{difference >= 0 ? `+${fmtN(difference)}` : `−${fmtN(Math.abs(difference))}`}</td><td><span className={`b ${row.status.className}`}>{row.status.label}</span></td></tr>; })}
        </tbody></table></div>
        <div className="pl-click-hint">🔍 Click any row → see stage deals</div>
      </TrendCard>
    </div>

    <TrendCard title="Stage Evolution — Stacked Pipeline by Week ↗ Click → stage deals" tag={`Pipeline value by stage across ${weekly_stage_trend.length} weeks`} onClick={() => openStage(ACTIVE_STAGES[0])} clickHint="🔍 Click → stage deals">
      <StackedChart weeklyStage={weekly_stage_trend} onStageClick={openStage} />
      <div className="pl-chart-legend">{ACTIVE_STAGES.map(stage => <span key={stage}><i style={{ background: STAGE_COLORS[stage] }} />{STAGE_SHORT[stage]}</span>)}</div>
    </TrendCard>

    {drill && <DrillModal title={drill.title} sub={drill.sub} deals={drill.deals} onClose={closeDrill} onDealClick={openDeal}>{drill.children}</DrillModal>}
    {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={stage => drillStage(stage, metricDeals)} />}
  </>;
}

export { PipelineTrend };
export default PipelineTrend;
