import { useMemo } from 'react';
import { fmt } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const sumDeals = rows => rows.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);

function StackedQuarterChart({ quarters, onBarClick }) {
  if (!quarters.length) return null;
  const W = 700, H = 260, pad = { l: 52, r: 14, t: 14, b: 58 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const max = Math.max(...quarters.map(row => (row.commit || 0) + (row.upside || 0) + (row.not_forecasted || 0)), 1);
  const step = innerW / quarters.length;
  const barW = Math.min(76, step * 0.62);
  const y = value => pad.t + innerH - value / max * innerH;
  const series = [
    { key: 'commit', label: 'Commit', color: '#059669' },
    { key: 'upside', label: 'Upside', color: '#d97706' },
    { key: 'not_forecasted', label: 'Not Forecasted', color: '#7c3aed' },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = max * index / 5;
        const yy = y(value);
        return <g key={index}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      {quarters.map((quarter, index) => {
        const cx = pad.l + index * step + step / 2;
        let cumulative = 0;
        return <g key={quarter.quarter}>
          {series.map(item => {
            const value = Number(quarter[item.key]) || 0;
            const bottom = cumulative;
            cumulative += value;
            const topY = y(cumulative);
            const height = y(bottom) - topY;
            return height > 0 ? <rect key={item.key} x={cx - barW / 2} y={topY} width={barW} height={height} fill={`${item.color}29`} stroke={item.color} strokeWidth="1.5" rx="2" style={{ cursor: 'pointer' }} onClick={event => { event.stopPropagation(); onBarClick(quarter); }}><title>{quarter.quarter} — {item.label}: {fmt(value)}</title></rect> : null;
          })}
          <text x={cx} y={pad.t + innerH + 21} textAnchor="middle" fontSize="9" fill="#6b7280">{index === quarters.length - 1 ? `${quarter.quarter}+` : quarter.quarter}</text>
        </g>;
      })}
      {series.map((item, index) => <g key={item.key} transform={`translate(${W / 2 - 150 + index * 112}, ${H - 12})`}><rect width="9" height="9" y="-8" fill={`${item.color}29`} stroke={item.color} strokeWidth="1.5" /><text x="14" fontSize="8" fill="#6b7280">{item.label}</text></g>)}
    </svg>
  );
}

function StatusBadge({ metric }) {
  const { value, p25, p50, p75, p90, higherBetter = true } = metric;
  let label;
  let tone;
  if (higherBetter) {
    if (value >= p90) [label, tone] = ['🔵 Best-in-Class', 'bb'];
    else if (value >= p75) [label, tone] = ['🟢 Good', 'bg'];
    else if (value >= p50) [label, tone] = ['🟡 Watch', 'ba'];
    else if (value >= p25) [label, tone] = ['🟠 Below Median', 'bo'];
    else [label, tone] = ['🔴 Critical', 'br'];
  } else {
    if (!value) [label, tone] = ['— No Data', 'bx'];
    else if (value <= p90) [label, tone] = ['🔵 Best-in-Class', 'bb'];
    else if (value <= p75) [label, tone] = ['🟢 Good', 'bg'];
    else if (value <= p50) [label, tone] = ['🟡 Watch', 'ba'];
    else if (value <= p25) [label, tone] = ['🟠 Below Median', 'bo'];
    else [label, tone] = ['🔴 Long Cycle', 'br'];
  }
  return <span className={`b ${tone}`}>{label}</span>;
}

function FPA({ data, onSelectRep }) {
  const { kpis = {}, deals = [], weekly_trend = [], rep_breakdown = [], executive = {}, fpa = {} } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const usableDeals = useMemo(() => deals.filter(deal => (Number(deal.amount) || 0) > 0), [deals]);
  const wonDeals = useMemo(() => usableDeals.filter(deal => deal.stage === 'Business Won'), [usableDeals]);
  const lostDeals = useMemo(() => usableDeals.filter(deal => deal.stage === 'Business Lost'), [usableDeals]);
  const activeDeals = useMemo(() => usableDeals.filter(deal => ACTIVE_STAGES.includes(deal.stage)), [usableDeals]);
  const commitDeals = useMemo(() => activeDeals.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'commit'), [activeDeals]);
  const upsideDeals = useMemo(() => activeDeals.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'upside'), [activeDeals]);
  const nfDeals = useMemo(() => activeDeals.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'not forecasted'), [activeDeals]);
  const lateDeals = useMemo(() => activeDeals.filter(deal => ['80%-Validate', '90%-Negotiate & Close'].includes(deal.stage)), [activeDeals]);
  const zombieDeals = useMemo(() => [...activeDeals].filter(deal => Number(deal.days_open) > 0).sort((a, b) => (b.days_open || 0) - (a.days_open || 0)).slice(0, 3), [activeDeals]);

  const won = Number(kpis.won_ytd) || sumDeals(wonDeals);
  const lost = Number(kpis.lost_ytd) || sumDeals(lostDeals);
  const active = Number(kpis.active_pipeline) || sumDeals(activeDeals);
  const weighted = Number(kpis.weighted_pipeline) || activeDeals.reduce((sum, deal) => sum + (Number(deal.weighted) || 0), 0);
  const commit = Number(kpis.commit_pipeline) || sumDeals(commitDeals);
  const upside = Number(kpis.upside_pipeline) || sumDeals(upsideDeals);
  const notForecasted = Number(fpa.not_forecasted_pipeline) || sumDeals(nfDeals);
  const aop = Number(fpa.aop || kpis.aop) || 17_300_000;
  const coverage = aop ? active / aop : 0;
  const aopAttainment = aop ? won / aop * 100 : 0;
  const baselineCommit = Number(fpa.baseline_commit || weekly_trend[0]?.commit) || commit;
  const latestWeek = executive.selected_week_short || `W${weekly_trend[weekly_trend.length - 1]?.week_num || '—'}`;

  const scenarioValues = {
    bear: Number(fpa.scenarios?.bear) || won + commit * 0.8 + upside * 0.1,
    base: Number(fpa.scenarios?.base) || won + commit * 0.8 + upside * 0.3 + notForecasted * 0.05,
    bull: Number(fpa.scenarios?.bull) || won + commit * 0.9 + upside * 0.5 + notForecasted * 0.1,
  };

  const quarterRows = useMemo(() => {
    if (fpa.quarters?.length) return fpa.quarters;
    return ['Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27'].map(quarter => {
      const rows = activeDeals.filter(deal => deal.close_quarter === quarter);
      return {
        quarter, deals: rows.length, pipeline: sumDeals(rows),
        commit: sumDeals(rows.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'commit')),
        upside: sumDeals(rows.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'upside')),
        not_forecasted: sumDeals(rows.filter(deal => (deal.forecast_category || '').trim().toLowerCase() === 'not forecasted')),
      };
    });
  }, [activeDeals, fpa.quarters]);

  const fallbackScore = {
    win_rate_count: wonDeals.length + lostDeals.length ? wonDeals.length / (wonDeals.length + lostDeals.length) * 100 : 0,
    win_rate_dollar: won + lost ? won / (won + lost) * 100 : 0,
    pipeline_coverage: coverage,
    commit_pct: active ? commit / active * 100 : 0,
    late_stage_pct: active ? sumDeals(lateDeals) / active * 100 : 0,
    avg_deal_pipeline: activeDeals.length ? active / activeDeals.length : 0,
    avg_deal_won: wonDeals.length ? won / wonDeals.length : 0,
    avg_cycle_days: wonDeals.length ? Math.round(wonDeals.reduce((sum, deal) => sum + (Number(deal.days_open) || 0), 0) / wonDeals.length) : 0,
    aop_attainment: aopAttainment,
  };
  const score = { ...fallbackScore, ...(fpa.scorecard || {}) };
  const topRep = fpa.top_rep || rep_breakdown[0] || null;
  const topRepDeals = topRep ? activeDeals.filter(deal => deal.owner === topRep.owner) : [];
  const topRepShare = active ? (Number(topRep?.pipeline) || sumDeals(topRepDeals)) / active * 100 : 0;
  const baseGap = Math.max(0, aop - scenarioValues.base);

  function openDeals(title, rows, sub) {
    openDrill(title, sub || `${rows.length} deals · Click any row for full detail`, rows);
  }

  function openCategory(key) {
    const map = {
      won: ['Won Deals', wonDeals, 'All won deals · Click any row for full detail'],
      lost: ['Lost Deals YTD', lostDeals, 'All lost deals · Click any row for full detail'],
      commit: ['Commit Pipeline', commitDeals, 'High confidence deals · Click any row for full detail'],
      upside: ['Upside Pipeline', upsideDeals, 'All Upside forecast deals · Click any row for full detail'],
      not_forecasted: ['Not Forecasted', nfDeals, 'Early stage / unqualified deals · Click any row for full detail'],
      active: ['Active Pipeline — All Active Deals', activeDeals, 'Excludes Business Won and Business Lost · sorted by amount'],
      late_stage: ['Late-Stage Pipeline', lateDeals, 'Deals closest to closing · Click any row for full detail'],
      zombie: ['Zombie Deals — Oldest Active Opportunities', zombieDeals, 'Oldest active deals by days open · Click any row for full detail'],
    };
    const [title, rows, sub] = map[key];
    openDeals(`${title} — ${rows.length} Deals`, rows, sub);
  }

  function categoryCards() {
    return <div className="rep-grid">
      {[
        ['won', 'Won', won, wonDeals.length, 'var(--green)'],
        ['commit', 'Commit', commit, commitDeals.length, 'var(--blue)'],
        ['upside', 'Upside', upside, upsideDeals.length, 'var(--amber)'],
        ['not_forecasted', 'Not Forecasted', notForecasted, nfDeals.length, 'var(--purple)'],
      ].map(([key, label, value, count, color]) => <div key={key} className="rc" onClick={() => openCategory(key)}><div className="rc-name">{label}</div><div className="rc-pipe" style={{ color }}>{fmt(value)}</div><div className="rc-row"><div className="rc-stat"><div className="rc-sv">{count}</div><div className="rc-sl">Deals</div></div></div><div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see deals</div></div>)}
    </div>;
  }

  function openScenario(type) {
    const config = {
      bear: { icon: '🐻', label: 'Bear Case', commitRate: .8, upsideRate: .1, nfRate: 0 },
      base: { icon: '📊', label: 'Base Case', commitRate: .8, upsideRate: .3, nfRate: .05 },
      bull: { icon: '🐂', label: 'Bull Case', commitRate: .9, upsideRate: .5, nfRate: .1 },
    }[type];
    const total = scenarioValues[type];
    const formula = `Booked + (Commit × ${config.commitRate * 100}%) + (Upside × ${config.upsideRate * 100}%)${config.nfRate ? ` + (Not Forecasted × ${config.nfRate * 100}%)` : ''}`;
    const content = <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'var(--teal)', color: '#fff' }}># UNWEIGHTED — raw deal amounts</span></div>
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Formula</div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>{formula}</div></div>
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Right now, with your current filters</div>
        <table style={{ width: '100%', fontSize: 13 }}><tbody>
          <tr><td style={{ color: 'var(--sub)' }}>Booked (Won)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(won)}</td></tr>
          <tr><td style={{ color: 'var(--sub)' }}>Commit pipeline × {config.commitRate * 100}%</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(commit)} × {config.commitRate * 100}% = {fmt(commit * config.commitRate)}</td></tr>
          <tr><td style={{ color: 'var(--sub)' }}>Upside pipeline × {config.upsideRate * 100}%</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(upside)} × {config.upsideRate * 100}% = {fmt(upside * config.upsideRate)}</td></tr>
          {config.nfRate > 0 && <tr><td style={{ color: 'var(--sub)' }}>Not Forecasted × {config.nfRate * 100}%</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(notForecasted)} × {config.nfRate * 100}% = {fmt(notForecasted * config.nfRate)}</td></tr>}
        </tbody></table>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--sub)' }}>Result — {(total / aop * 100).toFixed(0)}% of AOP</span><span style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{fmt(total)}</span></div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 12 }}>The conversion percentages are fixed scenario assumptions—not derived from your data—representing pessimistic, expected, or optimistic close behavior.</div>
      <div className="dv" /><div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 8, fontWeight: 700 }}>See the real underlying deals (unscaled):</div>{categoryCards()}
    </>;
    openDrill(`${config.icon} ${config.label} — ${fmt(total)} (${(total / aop * 100).toFixed(0)}% of AOP)`, null, null, content);
  }

  function CoverageBar({ label, value, color, onClick }) {
    const pct = aop ? value / aop * 100 : 0;
    return <div className="pw" onClick={onClick}><div className="ph"><span className="pn">{label}</span><span className="pv">{fmt(value)} — {pct.toFixed(1)}%</span></div><div className="pb"><div className="pf" style={{ width: `${Math.min(100, pct)}%`, background: color }} /></div></div>;
  }

  function openCoverageAnalysis() {
    const projectedCommit = commit * .8;
    const projectedUpside = upside * .3;
    const projectedNf = notForecasted * .05;
    const content = <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'var(--teal)', color: '#fff' }}># UNWEIGHTED — raw deal amounts</span></div>
      <div className="krow k3" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 14 }}>
        <div className="kc kg" onClick={() => openCategory('won')}><div className="kl">Booked (Won)</div><div className="kv">{fmt(won)}</div><div className="kd"><span className="up">{aopAttainment.toFixed(1)}% of AOP</span></div><div className="click-hint">🔍 Click → won deals</div></div>
        <div className="kc kb" onClick={() => openCategory('commit')}><div className="kl">Commit (80% conv.)</div><div className="kv">{fmt(projectedCommit)}</div><div className="kd"><span className="fl">{(projectedCommit / aop * 100).toFixed(1)}% of AOP</span></div><div className="click-hint">🔍 Click → commit deals</div></div>
        <div className="kc ka" onClick={() => openCategory('upside')}><div className="kl">Upside (30% conv.)</div><div className="kv">{fmt(projectedUpside)}</div><div className="kd"><span className="fl">{(projectedUpside / aop * 100).toFixed(1)}% of AOP</span></div><div className="click-hint">🔍 Click → upside deals</div></div>
      </div>
      <CoverageBar label="🟢 Booked" value={won} color="var(--green)" onClick={() => openCategory('won')} />
      <CoverageBar label="🔵 Commit (80%)" value={projectedCommit} color="var(--blue)" onClick={() => openCategory('commit')} />
      <CoverageBar label="🟡 Upside (30%)" value={projectedUpside} color="var(--amber)" onClick={() => openCategory('upside')} />
      <CoverageBar label="🟣 Not Forecasted (5%)" value={projectedNf} color="var(--purple)" onClick={() => openCategory('not_forecasted')} />
      <div className="dv" />
      <CoverageBar label="📈 Base Case Total" value={scenarioValues.base} color="linear-gradient(90deg,var(--blue),var(--cyan))" />
      <CoverageBar label="🎯 AOP Gap (Base Case)" value={baseGap} color="var(--red)" />
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, marginTop: 10, fontSize: 12, lineHeight: 1.6 }}><div style={{ fontWeight: 700, marginBottom: 6 }}>📐 How Base Case Total is calculated</div><div style={{ color: 'var(--sub)' }}>Base Case = Booked + (Commit × 80%) + (Upside × 30%) + (Not Forecasted × 5%)</div><div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11 }}>= {fmt(won)} + {fmt(projectedCommit)} + {fmt(projectedUpside)} + {fmt(projectedNf)} = <strong>{fmt(scenarioValues.base)}</strong></div><div style={{ marginTop: 8, color: 'var(--sub)' }}>Gap = AOP − Base Case = {fmt(aop)} − {fmt(scenarioValues.base)} = <strong>{fmt(baseGap)}</strong></div></div>
    </>;
    openDrill('AOP Coverage Analysis', `${fmt(aop)} AOP vs current pipeline`, null, content);
  }

  function quarterDeals(quarter) {
    const rows = quarter.quarter === 'Q2 27'
      ? activeDeals.filter(deal => ['Q2 27', 'Q3 27', 'Q4 27'].includes(deal.close_quarter))
      : activeDeals.filter(deal => deal.close_quarter === quarter.quarter);
    openDeals(`${quarter.quarter === 'Q2 27' ? 'Q2 2027+' : quarter.quarter} Pipeline — ${fmt(sumDeals(rows))}`, rows, `${rows.length} deals closing ${quarter.quarter === 'Q2 27' ? 'Q2 2027 and beyond' : quarter.quarter} · Click any row for full detail`);
  }

  function openMetric(metric) {
    const content = <>
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Formula</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>{metric.formula}</div></div>
      <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Right now, with your current filters</div><table style={{ width: '100%', fontSize: 13 }}><tbody>{metric.inputs.map(([label, value]) => <tr key={label}><td style={{ color: 'var(--sub)' }}>{label}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{value}</td></tr>)}</tbody></table><div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--sub)' }}>Result</span><span style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{metric.display}</span></div></div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>💡 {metric.why}</div>
      <div className="pl-click-hint" style={{ marginTop: 12, cursor: 'pointer' }} onClick={metric.drill}>🔍 See the actual deals behind this number →</div>
    </>;
    openDrill(`${metric.label} — How this is calculated`, null, null, content);
  }

  function handleDrillStage(stage) {
    closeDeal();
    openDeals(stage, usableDeals.filter(deal => deal.stage === stage));
  }

  const metrics = [
    { key: 'wrcount', label: 'Win Rate (Count)', value: score.win_rate_count, display: `${score.win_rate_count.toFixed(1)}%`, p25: 10, p50: 18, p75: 25, p90: 30, median: '18%', best: '30%+', source: 'Gartner, OpenView', formula: 'Won Deals ÷ (Won Deals + Lost Deals) × 100', inputs: [['Won deals', wonDeals.length], ['Lost deals', lostDeals.length], ['Total closed', wonDeals.length + lostDeals.length]], why: 'Every closed deal counts equally, regardless of size—this answers how often completed deals are won.', drill: () => openCategory('won') },
    { key: 'wrdollar', label: 'Win Rate ($)', value: score.win_rate_dollar, display: `${score.win_rate_dollar.toFixed(1)}%`, p25: 25, p50: 35, p75: 50, p90: 65, median: '35%', best: '60%+', source: 'Gartner, OpenView', formula: 'Won $ ÷ (Won $ + Lost $) × 100', inputs: [['Won value', fmt(won)], ['Lost value', fmt(lost)], ['Total closed value', fmt(won + lost)]], why: 'This weights win rate by deal size, so large wins and losses influence the result appropriately.', drill: () => openCategory('won') },
    { key: 'pipecov', label: 'Pipeline Coverage (UW)', value: score.pipeline_coverage, display: `${score.pipeline_coverage.toFixed(2)}×`, p25: 2, p50: 3, p75: 4, p90: 5, median: '3×', best: '5×+', source: 'Gartner, Benchmarkit', formula: `Active Pipeline ÷ AOP (${fmt(aop)})`, inputs: [['Active pipeline (unweighted)', fmt(active)], ['AOP', fmt(aop)]], why: 'Coverage asks whether the open pipeline is large enough to absorb normal deal loss and still hit plan.', drill: openCoverageAnalysis },
    { key: 'commit', label: 'Commit % of Pipeline', value: score.commit_pct, display: `${score.commit_pct.toFixed(1)}%`, p25: 5, p50: 12, p75: 18, p90: 25, median: '12%', best: '25%+', source: 'Forrester, SiriusDecisions', formula: 'Commit-forecast $ ÷ Active Pipeline × 100', inputs: [['Commit pipeline', fmt(commit)], ['Active pipeline', fmt(active)]], why: 'Commit is pipeline reps have personally staked their forecast on; a thin Commit share makes forecasts less reliable.', drill: () => openCategory('commit') },
    { key: 'late', label: 'Late-Stage Pipeline %', value: score.late_stage_pct, display: `${score.late_stage_pct.toFixed(1)}%`, p25: 10, p50: 18, p75: 25, p90: 30, median: '18%', best: '30%+', source: 'Gartner, Benchmarkit', formula: '(80%-Validate + 90%-Negotiate deals) $ ÷ Active Pipeline × 100', inputs: [['Late-stage pipeline (80%+90%)', fmt(sumDeals(lateDeals))], ['Active pipeline', fmt(active)]], why: 'Deals in the final two stages are closest to closing; a low share indicates top-heavy pipeline.', drill: () => openCategory('late_stage') },
    { key: 'avgdeal', label: 'Avg Deal Size (Pipeline)', value: score.avg_deal_pipeline, display: fmt(score.avg_deal_pipeline), p25: 50000, p50: 150000, p75: 300000, p90: 500000, median: '$150K', best: '$500K+', source: 'OpenView, Forrester', formula: 'Active Pipeline ÷ Number of Active Deals', inputs: [['Active pipeline', fmt(active)], ['Active deal count', activeDeals.length]], why: 'The average size of all open opportunities; inspect the deal list because outliers can move this substantially.', drill: () => openCategory('active') },
    { key: 'avgdealwon', label: 'Avg Deal Size (Won)', value: score.avg_deal_won, display: fmt(score.avg_deal_won), p25: 50000, p50: 150000, p75: 300000, p90: 500000, median: '$150K', best: '$500K+', source: 'OpenView, Forrester', formula: 'Total Won $ ÷ Number of Won Deals', inputs: [['Won value', fmt(won)], ['Won deal count', wonDeals.length]], why: 'This shows the average size of deals that actually closed, rather than everything still in pipeline.', drill: () => openCategory('won') },
    { key: 'cycle', label: 'Avg Sales Cycle', value: score.avg_cycle_days, display: score.avg_cycle_days ? `${score.avg_cycle_days}d` : '—', p25: 270, p50: 150, p75: 90, p90: 60, higherBetter: false, median: '180d', best: '<90d', source: 'Create→Close Date (won deals)', formula: 'Average elapsed days for Won deals with usable dates', inputs: [['Won deals with cycle data', wonDeals.filter(deal => Number(deal.days_open) > 0).length]], why: 'How long it typically takes to convert a created opportunity into booked revenue.', drill: () => openCategory('won') },
    { key: 'aopatt', label: 'AOP Attainment (H1)', value: score.aop_attainment, display: `${score.aop_attainment.toFixed(1)}%`, p25: 25, p50: 40, p75: 50, p90: 55, median: '40%', best: '55%+', source: 'Benchmarkit, Forrester', formula: `Won $ (year to date) ÷ AOP (${fmt(aop)}) × 100`, inputs: [['Won $ (YTD)', fmt(won)], ['AOP', fmt(aop)]], why: 'Only booked revenue receives credit; open pipeline is excluded from attainment.', drill: () => openCategory('won') },
  ];

  const waterfallRows = [
    ['✅ Closed Won (Booked)', won, 'var(--green)', 'won', true],
    ['🔵 Commit Pipeline', commit, 'var(--blue)', 'commit'],
    ['🟡 Upside Pipeline', upside, 'var(--amber)', 'upside'],
    ['🟣 Not Forecasted', notForecasted, 'var(--purple)', 'not_forecasted'],
    ['Total Active Pipeline (UW)', active, 'linear-gradient(90deg,var(--blue),var(--cyan))', 'active', true],
    ['⚖️ Weighted Pipeline', weighted, 'linear-gradient(90deg,var(--purple),#a78bfa)', 'active'],
    ['❌ Lost YTD', lost, 'var(--red)', 'lost'],
  ];

  const risks = [
    { title: 'Commit Pipeline Collapse', desc: `Commit dropped from ${fmt(baselineCommit)} (W1) to ${fmt(commit)} (${latestWeek}) — ${baselineCommit ? Math.max(0, (baselineCommit - commit) / baselineCommit * 100).toFixed(0) : 0}% decline. Only ${commitDeals.length} deals.`, color: 'var(--red)', severity: 'HIGH', action: () => openCategory('commit') },
    { title: `Late-Stage Pipeline ${fmt(sumDeals(lateDeals))} (${lateDeals.length} deals)`, desc: `80%+ stage pipeline vs ${fmt(Number(fpa.baseline_late_stage) || 0)} at baseline. ${lateDeals.length} deals are closest to closing.`, color: 'var(--red)', severity: 'HIGH', action: () => openCategory('late_stage') },
    { title: 'Rep Concentration Risk', desc: topRep ? `${topRep.owner} holds ${topRepShare.toFixed(1)}% of active pipeline (${fmt(Number(topRep.pipeline) || sumDeals(topRepDeals))}). Single-rep dependency.` : 'No rep concentration data available.', color: 'var(--amber)', severity: 'MED', action: () => topRep && (onSelectRep ? onSelectRep(topRep.owner) : openDeals(`${topRep.owner} — Active Pipeline`, topRepDeals)) },
    { title: 'Accelerating Deal Losses', desc: `${lostDeals.length} deals lost (${fmt(lost)}) YTD. Win/loss ratio requires continued attention.`, color: 'var(--amber)', severity: 'MED', action: () => openCategory('lost') },
    { title: `AOP Gap — ${fmt(Math.max(0, aop - won))} Remaining`, desc: `Only ${aopAttainment.toFixed(1)}% of AOP booked. Base case (${fmt(scenarioValues.base)}) ${baseGap > 0 ? `still falls short by ${fmt(baseGap)}` : 'meets the current AOP'}.`, color: 'var(--amber)', severity: 'MED', action: openCoverageAnalysis },
    { title: 'Zombie Deals Inflating Pipeline', desc: zombieDeals.length ? `${zombieDeals.map(deal => `${deal.company || deal.deal_name} (${deal.days_open}d)`).join(', ')} — stale deals.` : 'No aged active deals found.', color: 'var(--blue)', severity: 'LOW', action: () => openCategory('zombie') },
  ];

  return (
    <>
      <div className="exh">
        <div className="exav fpa">💼</div><div><div className="exname">FP&amp;A / Business Finance Dashboard</div><div className="exrole">Revenue Forecasting · Scenario Analysis · Pipeline Quality · Risk Register · AOP Tracking · Click everything</div></div>
        <div className="exm"><div className="em" onClick={openCoverageAnalysis}><div className="eml">AOP Attainment</div><div className="emv" style={{ color: 'var(--amber)' }}>{aopAttainment.toFixed(1)}%</div></div><div className="em" onClick={() => openCategory('active')}><div className="eml">Pipeline Coverage</div><div className="emv" style={{ color: 'var(--green)' }}>{coverage.toFixed(2)}×</div></div><div className="em" onClick={() => openCategory('won')}><div className="eml">Booked Revenue</div><div className="emv" style={{ color: 'var(--blue)' }}>{fmt(won)}</div></div></div>
      </div>

      <div className="krow k4">
        <div className="kc kg" onClick={() => openCategory('won')}><div className="kl">Booked Revenue YTD</div><div className="kv">{fmt(won)}</div><div className="kd"><span className="up">{aopAttainment.toFixed(1)}% of {fmt(aop)} AOP</span></div><div className="click-hint">🔍 Click → won deals</div></div>
        <div className="kc kb" onClick={() => openCategory('commit')}><div className="kl">Commit Pipeline</div><div className="kv">{fmt(commit)}</div><div className="kd"><span className="dn">▼ from {fmt(baselineCommit)} W1</span></div><div className="click-hint">🔍 Click → commit deals</div></div>
        <div className="kc ka" onClick={() => openCategory('upside')}><div className="kl">Upside Pipeline</div><div className="kv">{fmt(upside)}</div><div className="kd"><span className="fl">refreshed</span></div><div className="click-hint">🔍 Click → upside deals</div></div>
        <div className="kc kr" onClick={() => openCategory('lost')}><div className="kl">Lost Value YTD</div><div className="kv">{fmt(lost)}</div><div className="kd"><span className="dn">{lostDeals.length} deals · refreshed</span></div><div className="click-hint">🔍 Click → lost deals</div></div>
      </div>

      <div className="g2">
        <div className="pl-card"><div className="pl-card-header"><div className="pl-card-title">Revenue Scenario Analysis — Click scenarios to drill</div></div><div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10 }}>Bear / Base / Bull case based on pipeline conversion assumptions</div>
          <div className="sc-grid"><div className="sc sc-bear" onClick={() => openScenario('bear')}><div className="sc-lbl">🐻 Bear Case</div><div className="sc-val">{fmt(scenarioValues.bear)}</div><div className="sc-pct">{(scenarioValues.bear / aop * 100).toFixed(0)}% of AOP</div><div className="sc-note">Won {fmt(won)} + Commit 80% + Upside 10%</div></div><div className="sc sc-base" onClick={() => openScenario('base')}><div className="sc-lbl">📊 Base Case</div><div className="sc-val">{fmt(scenarioValues.base)}</div><div className="sc-pct">{(scenarioValues.base / aop * 100).toFixed(0)}% of AOP</div><div className="sc-note">Won {fmt(won)} + Commit 80% + Upside 30% + NF 5%</div></div><div className="sc sc-bull" onClick={() => openScenario('bull')}><div className="sc-lbl">🐂 Bull Case</div><div className="sc-val">{fmt(scenarioValues.bull)}</div><div className="sc-pct">{(scenarioValues.bull / aop * 100).toFixed(0)}% of AOP</div><div className="sc-note">Won {fmt(won)} + Commit 90% + Upside 50% + NF 10%</div></div></div>
          <div className="dv" /><div className="pl-card-title" style={{ marginBottom: 8 }}>AOP Attainment Tracker — Click bars to drill</div>
          <CoverageBar label="🟢 Booked (Closed Won)" value={won} color="var(--green)" onClick={() => openCategory('won')} /><CoverageBar label="🔵 Commit (80% conv.)" value={commit * .8} color="var(--blue)" onClick={openCoverageAnalysis} /><CoverageBar label="🟡 Upside (30% conv.)" value={upside * .3} color="var(--amber)" onClick={openCoverageAnalysis} /><CoverageBar label="🟣 Not Forecasted (5%)" value={notForecasted * .05} color="var(--purple)" onClick={openCoverageAnalysis} />
        </div>

        <div className="pl-card"><div className="pl-card-header"><div className="pl-card-title">Quarterly Revenue Timing — Click quarters to drill</div></div><div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Expected close by quarter — active pipeline {latestWeek}</div><StackedQuarterChart quarters={quarterRows} onBarClick={quarterDeals} /><div className="dv" />
          <div className="pl-twrap"><table><thead><tr><th>Quarter</th><th>Deals</th><th>Pipeline</th><th>Commit</th><th>Upside</th></tr></thead><tbody>{quarterRows.map(row => <tr key={row.quarter} className="pl-tr-click" onClick={() => quarterDeals(row)}><td><strong>{row.quarter}</strong></td><td className="td2">{row.deals}</td><td className="td2">{fmt(row.pipeline)}</td><td className="up">{row.commit ? <span className="up">{fmt(row.commit)}</span> : '—'}</td><td className="td2">{fmt(row.upside)}</td></tr>)}</tbody></table></div>
        </div>
      </div>

      <div className="g2">
        <div className="pl-card"><div className="pl-card-header"><div className="pl-card-title">Pipeline Waterfall — Click each layer to drill</div></div><div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10 }}>Revenue breakdown from booked to at-risk</div><div style={{ marginTop: 8 }}>{waterfallRows.map(([label, value, color, key, strong]) => { const pct = aop ? value / aop * 100 : 0; const width = label.includes('Closed Won') || label.includes('Total Active') ? 100 : label.includes('Weighted') ? (active ? weighted / active * 100 : 0) : Math.min(100, pct); return <div className="wf" key={label} onClick={() => openCategory(key)}><div className="wf-lbl" style={label.includes('Weighted') ? { color: 'var(--purple)', fontWeight: 700 } : undefined}>{strong ? <strong>{label}</strong> : label}</div><div className="wf-bw"><div className="wf-bf" style={{ width: `${width}%`, background: color }} /></div><div className="wf-v" style={label.includes('Weighted') ? { color: 'var(--purple)' } : undefined}>{strong ? <strong>{fmt(value)}</strong> : fmt(value)}</div><div className="wf-p" style={label.includes('Weighted') ? { color: 'var(--purple)' } : undefined}>{strong ? <strong>{pct.toFixed(0)}%</strong> : `${pct.toFixed(label.includes('Commit') || label.includes('Lost') ? 1 : 0)}%`}</div></div>; })}</div></div>
        <div className="pl-card"><div className="pl-card-header"><div className="pl-card-title">Risk Register — Click each risk to drill into related deals</div></div><div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Key risks to FY2026 revenue forecast</div><div style={{ marginTop: 8 }}>{risks.map(risk => <div className="risk-item" key={risk.title} onClick={risk.action}><div className="rdot" style={{ background: risk.color }} /><div style={{ flex: 1 }}><div className="rtitle">{risk.title}</div><div className="rdesc">{risk.desc}</div></div><div className="rsev" style={{ background: `${risk.color === 'var(--red)' ? 'rgba(239,68,68,.15)' : risk.color === 'var(--amber)' ? 'rgba(245,158,11,.15)' : 'rgba(37,99,235,.15)'}`, color: risk.color }}>{risk.severity}</div></div>)}</div></div>
      </div>

      <div className="g1 pl-card"><div className="pl-card-header"><div className="pl-card-title">📊 FP&amp;A Pipeline Quality Scorecard — Click rows to drill</div></div><div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Key financial health metrics vs benchmarks {latestWeek}</div><div className="pl-twrap" style={{ marginTop: 8 }}><table><thead><tr><th>Metric</th><th>{latestWeek}</th><th>P50 Median</th><th>P90 Best</th><th>Status</th><th>Source</th></tr></thead><tbody>{metrics.map(metric => <tr key={metric.key} className="pl-tr-click" onClick={() => openMetric(metric)}><td><strong>{metric.label}</strong> <span className="click-hint" title="How is this calculated?">❓</span></td><td><strong>{metric.display}</strong></td><td className="td3">{metric.median}</td><td className="td3">{metric.best}</td><td><StatusBadge metric={metric} /></td><td className="td3 tds">{metric.source}</td></tr>)}</tbody></table></div></div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { FPA };
export default FPA;
