import { fmt, DonutChart, StageBadge } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const FORECAST_CATEGORIES = [
  { key: 'commit', label: 'Commit', color: '#059669' },
  { key: 'upside', label: 'Upside', color: '#d97706' },
  { key: 'not_forecasted', label: 'Not Forecasted', color: '#7c3aed' },
  { key: 'won', label: 'Closed won', color: '#0891b2' },
];

function amountOf(rows) {
  return rows.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
}

function categoryOf(deal) {
  const forecast = (deal.forecast_category || deal.forecast || '').trim().toLowerCase();
  if (deal.stage === 'Business Won' || forecast === 'closed won') return 'won';
  if (!ACTIVE_STAGES.includes(deal.stage)) return null;
  if (forecast === 'commit') return 'commit';
  if (forecast === 'upside') return 'upside';
  if (forecast === 'not forecasted') return 'not_forecasted';
  return null;
}

function ForecastLegend({ items }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginTop: 8, fontSize: 10, color: 'var(--sub)' }}>
      {items.map(item => <span key={item.label}><span style={{ display: 'inline-block', width: 10, height: 7, marginRight: 5, verticalAlign: 'middle', background: `${item.color}29`, border: `1.5px solid ${item.color}` }} />{item.label}</span>)}
    </div>
  );
}

function ForecastRepChart({ rows, onRepClick }) {
  if (!rows.length) return <div style={{ padding: '70px 0', textAlign: 'center', color: 'var(--sub)' }}>No rep forecast data</div>;
  const W = 700, H = 260, pad = { l: 52, r: 14, t: 14, b: 48 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const max = Math.max(...rows.flatMap(row => [Number(row.commit) || 0, Number(row.upside) || 0]), 1);
  const step = innerW / rows.length;
  const barW = Math.max(8, Math.min(28, step / 2 - 5));
  const y = value => pad.t + innerH - value / max * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = max * index / 5;
        const yy = y(value);
        return <g key={index}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      {rows.map((row, index) => {
        const cx = pad.l + index * step + step / 2;
        const values = [Number(row.commit) || 0, Number(row.upside) || 0];
        const colors = ['#059669', '#d97706'];
        return <g key={row.owner}>
          {values.map((value, seriesIndex) => {
            const height = value ? Math.max(2, value / max * innerH) : 0;
            const x = cx + (seriesIndex === 0 ? -barW - 2 : 2);
            return height ? <rect key={seriesIndex} x={x} y={pad.t + innerH - height} width={barW} height={height} rx="3" fill={`${colors[seriesIndex]}29`} stroke={colors[seriesIndex]} strokeWidth="1.5" style={{ cursor: 'pointer' }} onClick={event => { event.stopPropagation(); onRepClick(row.owner); }}><title>{row.owner} — {seriesIndex === 0 ? 'Commit' : 'Upside'}: {fmt(value)}</title></rect> : null;
          })}
          <text x={cx} y={H - 24} textAnchor="middle" fontSize="8" fill="#6b7280">{(row.owner || '—').split(' ')[0]}</text>
        </g>;
      })}
    </svg>
  );
}

function ForecastTrendChart({ rows, onCategoryClick }) {
  if (!rows.length) return <div style={{ padding: '70px 0', textAlign: 'center', color: 'var(--sub)' }}>No forecast trend data</div>;
  const W = 700, H = 260, pad = { l: 52, r: 14, t: 14, b: 42 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const series = [
    { key: 'commit', label: 'Commit', color: '#059669' },
    { key: 'upside', label: 'Upside', color: '#d97706' },
    { key: 'not_forecasted', label: 'Not Forecasted', color: '#7c3aed' },
  ];
  const max = Math.max(...rows.flatMap(row => series.map(item => Number(row[item.key]) || 0)), 1);
  const x = index => pad.l + index / Math.max(rows.length - 1, 1) * innerW;
  const y = value => pad.t + innerH - value / max * innerH;
  const points = key => rows.map((row, index) => `${x(index)},${y(Number(row[key]) || 0)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = max * index / 5;
        const yy = y(value);
        return <g key={index}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      {series.map(item => <polyline key={item.key} points={points(item.key)} fill="none" stroke={item.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(item => rows.map((row, index) => <circle key={`${item.key}-${row.week || index}`} cx={x(index)} cy={y(Number(row[item.key]) || 0)} r="2.5" fill={item.color} style={{ cursor: 'pointer' }} onClick={event => { event.stopPropagation(); onCategoryClick(item.key); }}><title>{item.label} W{row.week_num}: {fmt(Number(row[item.key]) || 0)}</title></circle>))}
      {rows.map((row, index) => (index % labelEvery === 0 || index === rows.length - 1) ? <text key={row.week || index} x={x(index)} y={H - 18} textAnchor="middle" fontSize="8" fill="#6b7280">W{row.week_num}</text> : null)}
    </svg>
  );
}

function Forecast({ data, onSelectRep }) {
  const { deals = [], kpis = {}, weekly_trend = [], rep_breakdown = [] } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const usableDeals = deals.filter(deal => (Number(deal.amount) || 0) > 0);
  const dealGroups = Object.fromEntries(FORECAST_CATEGORIES.map(item => [item.key, usableDeals.filter(deal => categoryOf(deal) === item.key)]));
  const totals = Object.fromEntries(FORECAST_CATEGORIES.map(item => [item.key, amountOf(dealGroups[item.key])]));
  const remainingForecast = totals.upside + totals.not_forecasted;
  const upsideShare = remainingForecast > 0 ? totals.upside / remainingForecast : 0.75;
  const forecastTrendRows = weekly_trend.map(row => {
    const active = Number(row.active) || 0;
    const commit = Number(row.commit) || 0;
    const rawUpside = row.upside ?? row.upside_pipeline;
    const rawNotForecasted = row.not_forecasted ?? row.notF ?? row.not_forecasted_pipeline;
    const hasUpside = rawUpside !== undefined && rawUpside !== null;
    const hasNotForecasted = rawNotForecasted !== undefined && rawNotForecasted !== null;
    let upside = Number(rawUpside) || 0;
    let not_forecasted = Number(rawNotForecasted) || 0;
    const remainder = Math.max(0, active - commit);
    if (!hasUpside && !hasNotForecasted) {
      upside = remainder * upsideShare;
      not_forecasted = remainder - upside;
    } else if (!hasUpside) {
      upside = Math.max(0, remainder - not_forecasted);
    } else if (!hasNotForecasted) {
      not_forecasted = Math.max(0, remainder - upside);
    }
    return { ...row, commit, upside, not_forecasted };
  });
  const latestWeek = forecastTrendRows[forecastTrendRows.length - 1]?.week_num || String(data.selected_week || '').replace(/\D/g, '') || '—';
  const firstCommit = Number(forecastTrendRows[0]?.commit) || totals.commit;

  function openCategory(key) {
    const rows = dealGroups[key] || [];
    const titles = {
      won: 'Closed Won', commit: 'Commit Pipeline', upside: 'Upside Pipeline', not_forecasted: 'Not Forecasted',
    };
    openDrill(`${titles[key]} — ${rows.length} Deals`, `${fmt(totals[key] || 0)} · Click any row for full detail`, rows);
  }

  function openForecastOverview() {
    const cards = FORECAST_CATEGORIES.map(item => {
      const rows = dealGroups[item.key] || [];
      return <div key={item.key} className="rc" onClick={() => { closeDrill(); openCategory(item.key); }}>
        <div className="rc-name">{item.label}</div>
        <div className="rc-pipe" style={{ color: item.color }}>{fmt(totals[item.key] || 0)}</div>
        <div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rows.length}</div><div className="rc-sl">Deals</div></div></div>
        <div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see deals</div>
      </div>;
    });
    openDrill('Forecast View — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  function handleDrillStage(stage) {
    const rows = usableDeals.filter(deal => deal.stage === stage);
    closeDeal();
    openDrill(stage, `${rows.length} deals in this stage`, rows);
  }

  const donutItems = FORECAST_CATEGORIES.slice(0, 3).map(item => ({
    label: item.label,
    value: totals[item.key] || 0,
    color: item.color,
    onClick: () => openCategory(item.key),
  }));
  const repRows = rep_breakdown.map(rep => ({ ...rep, commit: Number(rep.commit) || 0, upside: Number(rep.upside) || 0 }));

  return (
    <>
      <div className="krow k4">
        <div className="kc kg" onClick={() => openCategory('won')}><div className="kl">Closed Won</div><div className="kv">{fmt(totals.won || kpis.won_ytd || 0)}</div><div className="kd"><span className="up">{dealGroups.won.length} deals · booked</span></div><div className="click-hint">🔍 Click → won deals</div></div>
        <div className="kc kb" onClick={() => openCategory('commit')}><div className="kl">Commit Pipeline</div><div className="kv">{fmt(totals.commit || kpis.commit_pipeline || 0)}</div><div className="kd"><span className="dn">▼ from {fmt(firstCommit)} W1</span></div><div className="click-hint">🔍 Click → commit deals</div></div>
        <div className="kc ka" onClick={() => openCategory('upside')}><div className="kl">Upside Pipeline</div><div className="kv">{fmt(totals.upside || kpis.upside_pipeline || 0)}</div><div className="kd"><span className="fl">refreshed</span></div><div className="click-hint">🔍 Click → upside deals</div></div>
        <div className="kc kp" onClick={() => openCategory('not_forecasted')}><div className="kl">Not Forecasted</div><div className="kv">{fmt(totals.not_forecasted || 0)}</div><div className="kd"><span className="fl">refreshed</span></div><div className="click-hint">🔍 Click → not forecasted deals</div></div>
      </div>

      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={openForecastOverview}>
          <div className="pl-card-header"><div className="pl-card-title">Forecast Category Breakdown <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click segment → deals</span></div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Pipeline value by forecast confidence</div>
          <DonutChart items={donutItems} radius={82} />
        </div>
        <div className="pl-card pl-card-clickable" onClick={openForecastOverview}>
          <div className="pl-card-header"><div className="pl-card-title">Forecast by Rep ($M) <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click bar → rep deals</span></div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Commit + Upside per rep</div>
          <ForecastRepChart rows={repRows} onRepClick={owner => onSelectRep ? onSelectRep(owner) : openDrill(`${owner} Forecast Deals`, null, usableDeals.filter(deal => deal.owner === owner && ['commit', 'upside'].includes(categoryOf(deal))))} />
          <ForecastLegend items={FORECAST_CATEGORIES.slice(0, 2)} />
        </div>
      </div>

      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={openForecastOverview}>
          <div className="pl-card-header"><div className="pl-card-title">Forecast Trend 1–{latestWeek} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span></div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Commit vs Upside vs Not Forecasted evolution</div>
          <ForecastTrendChart rows={forecastTrendRows} onCategoryClick={openCategory} />
          <ForecastLegend items={FORECAST_CATEGORIES.slice(0, 3)} />
        </div>

        <div className="pl-card">
          <div className="pl-card-header"><div className="pl-card-title">Commit Deals — Click any row for full detail</div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>All deals with Commit forecast category</div>
          <div className="pl-twrap" style={{ marginTop: 4 }}>
            <table>
              <thead><tr><th>Deal Name</th><th>Company</th><th>Stage</th><th>Amount</th><th>Owner</th><th>Quarter</th><th>Region</th></tr></thead>
              <tbody>{dealGroups.commit.map((deal, index) => <tr key={deal.record_id || index} className="pl-tr-click" onClick={() => openDeal(deal)}>
                <td style={{ fontSize: 10, maxWidth: 150 }}>{deal.deal_name}</td><td className="td2">{deal.company || '—'}</td><td><StageBadge stage={deal.stage} /></td><td style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(deal.amount)}</td><td className="td2" style={{ color: 'var(--blue)' }}>{deal.owner} ↗</td><td className="td2">{deal.close_quarter || '—'}</td><td><span className={`b ${deal.region === 'North America' ? 'bb' : 'bc'}`}>{deal.region === 'North America' ? 'NA' : deal.region || '—'}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { Forecast };
export default Forecast;
