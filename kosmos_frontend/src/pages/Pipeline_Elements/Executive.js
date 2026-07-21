import { fmt, fmtN } from './plShared';
import { DealModal, DrillModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const DONUT_COLORS = ['#7c3aed', '#2563eb', '#0d9488', '#d97706', '#ea580c', '#dc2626', '#059669'];
const toNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const total = (rows, field = 'amount') => rows.reduce((sum, row) => sum + toNumber(row[field]), 0);
const money = value => fmt(toNumber(value));
const cleanForecast = deal => String(deal.forecast_category || '').trim();
const changePct = (current, previous) => previous ? ((current - previous) / previous) * 100 : 0;

function Sparkline({ values = [], color }) {
  if (!values.length) return null;
  const max = Math.max(...values.map(toNumber).map(Math.abs), 1);
  return (
    <span className="spark" aria-hidden="true">
      {values.map((value, index) => (
        <i
          className="sb"
          key={index}
          style={{ height: `${Math.max(2, Math.round(Math.abs(toNumber(value)) / max * 26))}px`, background: color, flex: 1 }}
        />
      ))}
    </span>
  );
}

function KpiCard({ label, value, delta, deltaClass = '', hint, color, spark, sparkColor, onClick, clickHint = '🔍 Click → drill into deals' }) {
  return (
    <button
      type="button"
      className={`kc ${color}`}
      onClick={onClick}
      style={{ textAlign: 'left', font: 'inherit', width: '100%' }}
    >
      <span className="kl">{label}</span>
      <span className="kv">{value}</span>
      <span className={`kd ${deltaClass}`}>{delta}</span>
      <span className="kh">{hint}</span>
      <span className="click-hint">{clickHint}</span>
      <Sparkline values={spark} color={sparkColor} />
    </button>
  );
}

function Card({ title, sub, children, onClick, hint }) {
  return (
    <section className={`pl-card${onClick ? ' pl-card-clickable' : ''}`} onClick={onClick}>
      <div className="pl-card-header" style={{ display: 'block' }}>
        <div className="pl-card-title">{title}</div>
        {sub && <div className="pl-card-sub">{sub}</div>}
      </div>
      {children}
      {onClick && <div className="ch">{hint || '🔍 Click to drill into deals'}</div>}
    </section>
  );
}

function TrendChart({ rows, aop, target, onWeekClick }) {
  if (!rows.length) return <div className="pl-chart-empty">No trend data available.</div>;

  const width = 700;
  const height = 300;
  const pad = { left: 12, right: 66, top: 14, bottom: 26 };
  const max = Math.max(...rows.flatMap(row => [toNumber(row.active), toNumber(row.weighted), toNumber(row.won)]), aop, target, 1);
  const x = index => pad.left + index / (rows.length - 1 || 1) * (width - pad.left - pad.right);
  const y = value => pad.top + (1 - toNumber(value) / max) * (height - pad.top - pad.bottom);
  const points = key => rows.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pl-trend-svg" role="img" aria-label="Pipeline trend">
      {[.25, .5, .75, 1].map(ratio => (
        <line key={ratio} x1={pad.left} y1={y(max * ratio)} x2={width - pad.right} y2={y(max * ratio)} stroke="#d1d5db" strokeWidth="1" />
      ))}
      {aop > 0 && <><line x1={pad.left} y1={y(aop)} x2={width - pad.right} y2={y(aop)} stroke="#d97706" strokeDasharray="5 4" /><text x={width - pad.right + 5} y={y(aop) + 4} fontSize="9" fill="#d97706">AOP</text></>}
      {target > 0 && <><line x1={pad.left} y1={y(target)} x2={width - pad.right} y2={y(target)} stroke="#dc2626" strokeDasharray="5 4" /><text x={width - pad.right + 5} y={y(target) + 4} fontSize="9" fill="#dc2626">Target</text></>}
      <polyline points={points('active')} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={points('weighted')} fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round" />
      <polyline points={points('won')} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((row, index) => (
        <g key={`${row.week || 'week'}-${index}`}>
          <circle cx={x(index)} cy={y(row.active)} r="4" fill="#0891b2" role="button" tabIndex="0" onClick={event => { event.stopPropagation(); onWeekClick(row); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onWeekClick(row); } }}>
            <title>{`${row.week || `W${row.week_num}`}: ${money(row.active)}`}</title>
          </circle>
          <text x={x(index)} y={height - 5} textAnchor="middle" fontSize="8.5" fill="#6b7280">W{row.week_num}</text>
        </g>
      ))}
    </svg>
  );
}

function Donut({ items, onItemClick }) {
  const visible = items.filter(item => toNumber(item.value) > 0);
  if (!visible.length) return <div className="pl-chart-empty">No data available.</div>;
  const sum = visible.reduce((value, item) => value + toNumber(item.value), 0) || 1;
  const center = 76;
  const outer = 66;
  const inner = 39;
  let angle = -Math.PI / 2;
  const arcs = visible.map((item, index) => {
    const sweep = toNumber(item.value) / sum * Math.PI * 2;
    const start = angle;
    angle += sweep;
    const point = (radius, radians) => [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
    const [x1, y1] = point(outer, start);
    const [x2, y2] = point(outer, angle);
    const [x3, y3] = point(inner, start);
    const [x4, y4] = point(inner, angle);
    return {
      item,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      path: `M${x1} ${y1}A${outer} ${outer} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}L${x4} ${y4}A${inner} ${inner} 0 ${sweep > Math.PI ? 1 : 0} 0 ${x3} ${y3}Z`,
    };
  });
  return (
    <div className="pl-reference-donut">
      <svg viewBox="0 0 152 152" aria-label="Distribution chart">
        {arcs.map(({ item, color, path }) => (
          <path key={item.label} d={path} fill={color} stroke="#f0f2f5" strokeWidth="2" role="button" tabIndex="0" onClick={event => { event.stopPropagation(); onItemClick(item); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onItemClick(item); } }}>
            <title>{`${item.label}: ${money(item.value)}`}</title>
          </path>
        ))}
      </svg>
      <div className="pl-reference-legend">
        {arcs.map(({ item, color }) => (
          <button type="button" key={item.label} onClick={event => { event.stopPropagation(); onItemClick(item); }}>
            <i style={{ background: color }} />
            <span title={item.label}>{item.label}</span>
            <strong>{fmtN(item.value)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function Gauge({ title, week, value, weighted, onClick, targetKind }) {
  const tone = (multiple, weightedValue = false) => {
    if (weightedValue) return multiple >= (targetKind === 'aop' ? 1.5 : 1) ? 'gok' : 'gbad';
    if (multiple >= (targetKind === 'aop' ? 2.5 : 2)) return 'gok';
    return multiple >= 1.5 ? 'gwarn' : 'gbad';
  };
  return (
    <button type="button" className="gauge-box pl-gauge-box" onClick={onClick} style={{ width: '100%' }}>
      <span className="gauge-lbl pl-gauge-lbl">{title}</span>
      <span className={`gauge-v pl-gauge-v ${tone(value)}`}>{value.toFixed(2)}×</span>
      <span className="gauge-sub pl-gauge-sub">Unweighted {week}</span>
      <span className="gauge-sub pl-gauge-sub">Weighted: <b className={tone(weighted, true)}>{weighted.toFixed(2)}×</b></span>
      <span className="click-hint">🔍 Click → gap analysis</span>
    </button>
  );
}

function CompareRow({ label, oldValue, newValue, format = 'number', change = 'percent', onClick }) {
  const old = toNumber(oldValue);
  const current = toNumber(newValue);
  const difference = current - old;
  const rising = difference >= 0;
  const display = value => format === 'money' ? money(value) : format === 'multiple' ? `${toNumber(value).toFixed(2)}×` : toNumber(value).toLocaleString();
  let changeText = !old ? (current ? '▲ New' : '—') : `${rising ? '▲ +' : '▼ −'}${Math.abs(changePct(current, old)).toFixed(1)}%`;
  if (change === 'absolute') changeText = `${rising ? '▲ +' : '▼ −'}${Math.abs(difference).toLocaleString()}`;
  if (change === 'direction') changeText = rising ? '▲ Improving' : '▼ Declining';
  return (
    <tr className="clickable-row pl-click-row" onClick={onClick}>
      <td>{label}</td><td className="td2">{display(old)}</td><td className="td2">{display(current)}</td>
      <td><span className={rising ? 'up' : 'dn'}>{changeText}</span></td>
    </tr>
  );
}

function CoverageBreakdown({ kind, aop, target, won, commit, upside, notForecasted, active, weighted }) {
  const denominator = kind === 'aop' ? aop : target;
  const name = kind === 'aop' ? 'AOP' : 'Sales Target';
  const baseCase = won + commit * .8 + upside * .3 + notForecasted * .05;
  const percent = value => denominator ? value / denominator * 100 : 0;
  const rows = kind === 'aop'
    ? [['🟢 Booked', won, '#059669'], ['🔵 Commit (80%)', commit * .8, '#2563eb'], ['🟡 Upside (30%)', upside * .3, '#d97706'], ['🟣 Not Forecasted (5%)', notForecasted * .05, '#7c3aed'], ['📈 Base Case Total', baseCase, '#0891b2'], [`🎯 ${name} Gap (Base Case)`, Math.max(0, denominator - baseCase), '#dc2626']]
    : [['Booked Revenue', won, '#059669'], ['Active Pipeline (Unweighted)', active, '#2563eb'], ['Active Pipeline (Weighted)', weighted, '#d97706']];
  return (
    <div className="pl-coverage-drill">
      <div className="krow k3" style={{ marginBottom: 14 }}>
        <div className="kc kg"><span className="kl">Booked (Won)</span><span className="kv">{money(won)}</span><span className="kd up">{percent(won).toFixed(1)}% of {name}</span></div>
        {kind === 'aop' ? <>
          <div className="kc kb"><span className="kl">Commit (80% conv.)</span><span className="kv">{money(commit * .8)}</span><span className="kd fl">{percent(commit * .8).toFixed(1)}% of {name}</span></div>
          <div className="kc ka"><span className="kl">Upside (30% conv.)</span><span className="kv">{money(upside * .3)}</span><span className="kd fl">{percent(upside * .3).toFixed(1)}% of {name}</span></div>
        </> : <>
          <div className="kc kb"><span className="kl">Active Pipeline</span><span className="kv">{money(active)}</span><span className="kd fl">{(denominator ? active / denominator : 0).toFixed(2)}× {name}</span></div>
          <div className="kc kr"><span className="kl">Gap to {name}</span><span className="kv">{money(Math.max(0, denominator - won))}</span><span className="kd dn">Remaining to book</span></div>
        </>}
      </div>
      {rows.map(([label, value, color]) => (
        <div className="pw" key={label}>
          <div className="ph"><span className="pn">{label}</span><span className="pv">{money(value)} — {percent(value).toFixed(1)}%</span></div>
          <div className="pb"><div className="pf" style={{ width: `${Math.min(100, Math.max(0, percent(value)))}%`, background: color }} /></div>
        </div>
      ))}
      <div className="pl-formula-box"><strong>📐 How {kind === 'aop' ? 'Base Case Total' : 'coverage'} is calculated</strong>
        {kind === 'aop' ? <><span>Base Case = Booked + (Commit × 80%) + (Upside × 30%) + (Not Forecasted × 5%)</span><code>{money(won)} + {money(commit * .8)} + {money(upside * .3)} + {money(notForecasted * .05)} = <b>{money(baseCase)}</b></code></> : <><span>Coverage = Active Pipeline ÷ {name}</span><code>{money(active)} ÷ {money(denominator)} = <b>{(denominator ? active / denominator : 0).toFixed(2)}×</b></code></>}
      </div>
    </div>
  );
}

function Executive({ data, onNavigate }) {
  const { kpis = {}, stage_dist = [], forecast_dist = [], region_dist = [], weekly_trend = [], executive = {}, deals = [] } = data || {};
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage } = useDrill();

  const metricDeals = deals.filter(deal => toNumber(deal.amount) > 0);
  const activeDeals = metricDeals.filter(deal => ACTIVE_STAGES.includes(deal.stage));
  const wonDeals = metricDeals.filter(deal => deal.stage === 'Business Won');
  const lostDeals = metricDeals.filter(deal => deal.stage === 'Business Lost');
  const commitDeals = activeDeals.filter(deal => cleanForecast(deal) === 'Commit');
  const upsideDeals = activeDeals.filter(deal => cleanForecast(deal) === 'Upside');
  const notForecastedDeals = activeDeals.filter(deal => cleanForecast(deal) === 'Not forecasted');

  const active = toNumber(kpis.active_pipeline ?? total(activeDeals));
  const weighted = toNumber(kpis.weighted_pipeline ?? total(activeDeals, 'weighted'));
  const won = toNumber(kpis.won_ytd ?? total(wonDeals));
  const lost = toNumber(kpis.lost_ytd ?? total(lostDeals));
  const commit = toNumber(kpis.commit_pipeline ?? total(commitDeals));
  const upside = toNumber(kpis.upside_pipeline ?? total(upsideDeals));
  const aop = toNumber(kpis.aop);
  const target = toNumber(kpis.sales_target);

  const latestTrend = weekly_trend[weekly_trend.length - 1] || {};
  const selectedWeek = executive.selected_week_short || (data?.selected_week ? `W${String(data.selected_week).replace(/\D/g, '')}` : `W${latestTrend.week_num || ''}`);
  const selectedNumber = String(selectedWeek).replace(/\D/g, '') || selectedWeek;
  const baselineWeek = executive.baseline_week_short || `W${weekly_trend[0]?.week_num || 1}`;
  const previousWeek = executive.previous_week_short || baselineWeek;
  const period = executive.period_comparison || {};
  const baseline = period.baseline || weekly_trend[0] || {};
  const current = period.current || latestTrend;
  const activeDelta = toNumber(executive.active_change_vs_baseline ?? changePct(active, baseline.active));
  const commitBaseline = toNumber(weekly_trend[0]?.commit ?? baseline.commit);
  const coverageAop = aop ? active / aop : 0;
  const coverageTarget = target ? active / target : 0;
  const weightedAop = aop ? weighted / aop : 0;
  const weightedTarget = target ? weighted / target : 0;
  const movement = executive.movement_counts || {};
  const spark = key => weekly_trend.map(week => week[key]);
  const openWeek = row => openDrill(`${row.week || `W${row.week_num}`} Pipeline`, 'Historical snapshot · Click any row for full detail', activeDeals);
  const openActive = () => openDrill('Active Pipeline — All Active Deals', `Excludes Business Won and Business Lost · ${activeDeals.length} deals · sorted by amount`, activeDeals);
  const openWon = () => openDrill(`Won Deals — ${wonDeals.length} Deals`, 'All won deals · Click any row for full detail', wonDeals);
  const openCoverage = kind => {
    const denominator = kind === 'aop' ? aop : target;
    const name = kind === 'aop' ? 'AOP' : 'Sales Target';
    openDrill(`${name} Coverage Analysis`, `${money(denominator)} ${name} vs current pipeline`, null, <CoverageBreakdown kind={kind} aop={aop} target={target} won={won} commit={commit} upside={upside} notForecasted={total(notForecastedDeals)} active={active} weighted={weighted} />);
  };

  const stageItems = stage_dist.map(item => ({ label: item.stage, value: item.amount, key: item.stage }));
  const forecastItems = forecast_dist.map(item => ({ label: String(item.forecast || '').trim() || 'None', value: item.amount }));
  const regionItems = region_dist.map(item => ({ label: item.region || 'Unknown', value: item.amount }));
  const drillStageDeals = (stage, title = stage) => {
    const rows = activeDeals.filter(deal => deal.stage === stage);
    openDrill(`${title} — ${rows.length} Deals`, `All deals in ${stage} stage · Click any row for full detail`, rows);
  };

  return (
    <div className="pl-reference pl-reference-executive">
      <div className="pl-extra-alert">⚠️ <strong>Every metric, chart, and table is clickable.</strong> Click KPI cards → drill into deals. Click chart bars/segments → see filtered deals. Click any deal row → full deal detail. <strong>Active pipeline {baselineWeek}→{selectedWeek}</strong>. Won YTD: <strong>{money(won)} / {toNumber(kpis.won_deals ?? wonDeals.length)} deals</strong>. AOP attainment: <span>{aop ? (won / aop * 100).toFixed(1) : '0.0'}%</span>.</div>

      <div className="krow" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        <KpiCard label={`Active Pipeline ${selectedNumber}`} value={money(active)} delta={`${activeDelta >= 0 ? '▲' : '▼ −'} ${Math.abs(activeDelta).toFixed(1)}% vs ${baselineWeek}`} deltaClass={activeDelta >= 0 ? 'up' : 'dn'} hint={`${toNumber(kpis.active_deals ?? activeDeals.length)} active deals`} color="kb" spark={spark('active')} sparkColor="#0891b2" onClick={openActive} />
        <KpiCard label="Won YTD" value={money(won)} delta={`▲ ${toNumber(kpis.won_deals ?? wonDeals.length)} deals closed`} deltaClass="up" hint={`${toNumber(kpis.won_deals ?? wonDeals.length)} deals closed YTD`} color="kg" spark={spark('won')} sparkColor="#059669" onClick={openWon} />
        <KpiCard label="Commit Pipeline" value={money(commit)} delta={commitBaseline ? `▼ from ${money(commitBaseline)} ${baselineWeek}` : 'refreshed'} deltaClass="dn" hint={`${toNumber(kpis.commit_deals ?? commitDeals.length)} deals · needs conversion`} color="ka" onClick={() => openDrill(`Commit Pipeline — ${commitDeals.length} Deals`, 'High confidence deals · Click any row for full detail', commitDeals)} />
        <KpiCard label="Weighted Pipeline" value={money(weighted)} delta={`${weightedAop.toFixed(2)}× AOP · ${weightedTarget.toFixed(2)}× Target`} deltaClass="pl-purple-text" hint={`Excel Weighted column · ${selectedWeek}`} color="kp" onClick={() => openDrill(`Weighted Pipeline — ${activeDeals.filter(deal => toNumber(deal.weighted) > 0).length} Deals`, `Sorted by Weighted value (Excel) · Weighted Total: ${money(weighted)} · UW Total: ${money(active)}`, activeDeals.filter(deal => toNumber(deal.weighted) > 0))} />
        <KpiCard label="Upside Pipeline" value={money(upside)} delta="refreshed" hint="Needs conversion focus" color="kp" onClick={() => openDrill(`Upside Pipeline — ${upsideDeals.length} Deals`, 'All Upside forecast deals · Click any row for full detail', upsideDeals)} />
        <KpiCard label="Lost Pipeline YTD" value={money(lost)} delta={`${toNumber(kpis.lost_deals ?? lostDeals.length)} deals lost`} deltaClass="dn" hint="Accelerating loss rate" color="kr" spark={spark('lost')} sparkColor="#dc2626" onClick={() => openDrill(`Lost Pipeline — ${lostDeals.length} Deals`, 'All deals lost YTD · sorted by amount · Click any row for full detail', lostDeals)} />
        <KpiCard label={`Stage Movements ${previousWeek}→${selectedWeek}`} value={toNumber(movement.total)} delta={`${toNumber(movement.forward)} fwd, ${toNumber(movement.backward)} bwd`} deltaClass="up" hint="Highest velocity week" color="kc2" onClick={() => onNavigate?.('movement')} clickHint="🔍 Click → movement analysis" />
      </div>

      <div className="g2">
        <Card title={`Pipeline Trend ${weekly_trend[0]?.week_num || 1}–${selectedNumber} · Active Pipeline ($M) ↗ Click to drill`} sub={`vs AOP ${money(aop)} and Sales Target ${money(target)} · hover points for values · all pipeline data`} onClick={openActive} hint="💡 Click any data point → see that week's deals">
          <TrendChart rows={weekly_trend} aop={aop} target={target} onWeekClick={openWeek} />
          <div className="pl-chart-legend"><span className="active">— Active Pipeline (UW)</span><span className="weighted">- - Weighted Pipeline</span><span className="won">— Won Cumulative</span><span className="aop">- - AOP</span><span className="target">- - Target</span></div>
        </Card>
        <Card title="Coverage Gauges — Click any gauge to drill" sub="Unweighted and weighted pipeline coverage">
          <div className="gauge-row pl-gauge-row"><Gauge title={`vs Sales Target (${money(target)})`} week={selectedNumber} value={coverageTarget} weighted={weightedTarget} targetKind="target" onClick={() => openCoverage('target')} /><Gauge title={`vs AOP (${money(aop)})`} week={selectedNumber} value={coverageAop} weighted={weightedAop} targetKind="aop" onClick={() => openCoverage('aop')} /></div>
          <div className="dv" />
          <div className="pl-card-title" style={{ marginBottom: 8 }}>Period Comparison — Click rows to drill</div>
          <div className="pl-twrap"><table><thead><tr><th>Metric</th><th>{baselineWeek}</th><th>{selectedWeek}</th><th>Change</th></tr></thead><tbody>
            <CompareRow label="Pipeline UW" oldValue={baseline.active} newValue={current.active ?? active} format="money" onClick={openActive} />
            <CompareRow label="Active Deals" oldValue={baseline.count} newValue={current.count ?? kpis.active_deals} change="absolute" onClick={openActive} />
            <CompareRow label="Avg Deal Size" oldValue={baseline.avg_deal_size} newValue={current.avg_deal_size ?? kpis.avg_deal_size} format="money" onClick={openActive} />
            <CompareRow label="Won YTD" oldValue={baseline.won} newValue={current.won ?? won} format="money" onClick={openWon} />
            <CompareRow label="Cov vs Target" oldValue={baseline.coverage_target} newValue={current.coverage_target ?? coverageTarget} format="multiple" change="direction" onClick={() => openCoverage('target')} />
            <CompareRow label="Weighted Cov (Target)" oldValue={baseline.weighted_target} newValue={current.weighted_target ?? weightedTarget} format="multiple" change="direction" onClick={() => openCoverage('target')} />
            <CompareRow label="Cov vs AOP" oldValue={baseline.coverage_aop} newValue={current.coverage_aop ?? coverageAop} format="multiple" change="direction" onClick={() => openCoverage('aop')} />
            <CompareRow label="Weighted Cov (AOP)" oldValue={baseline.weighted_aop} newValue={current.weighted_aop ?? weightedAop} format="multiple" change="direction" onClick={() => openCoverage('aop')} />
          </tbody></table></div>
        </Card>
      </div>

      <div className="g3">
        <Card title={`Stage Distribution ${selectedWeek} ↗ Click segment`} sub="Click any segment → deals in that stage"><Donut items={stageItems} onItemClick={item => drillStageDeals(item.key)} /></Card>
        <Card title={`Forecast Mix ${selectedWeek} ↗ Click segment`} sub="Click any segment → deals in that category"><Donut items={forecastItems} onItemClick={item => { const rows = activeDeals.filter(deal => cleanForecast(deal) === item.label); openDrill(`${item.label} Pipeline — ${rows.length} Deals`, `All ${item.label} forecast deals · Click any row for full detail`, rows); }} /></Card>
        <Card title={`Region Split ${selectedWeek} ↗ Click segment`} sub="Click any segment → deals in that region"><Donut items={regionItems} onItemClick={item => { const rows = activeDeals.filter(deal => (deal.region || 'Unknown') === item.label); openDrill(`${item.label} — ${rows.length} Deals`, `All ${item.label} active deals · Click any row for full detail`, rows); }} /></Card>
      </div>

      {drill && <DrillModal title={drill.title} sub={drill.sub} deals={drill.deals} onClose={closeDrill} onDealClick={openDeal}>{drill.children}</DrillModal>}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={stage => drillStage(stage, metricDeals)} />}
    </div>
  );
}

export { Executive };
export default Executive;
