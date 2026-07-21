import { useMemo } from 'react';
import { fmt, DonutChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const NA_REGION   = 'North America';
const APAC_REGION = 'APAC';
const DEAL_TYPES = ['New Business', 'Cross-Sell', 'Upsell'];
const DEAL_SOURCES = ['1Kosmos Staff', 'Marketing', 'Partner'];
const REGION_QUARTERS = ['Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27+'];

const STAGE_ORDER = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
  'Business Won',
];
const STAGE_SHORT = {
  '5% - Prospecting': '5%', '20%-Discovery': '20%', '40%-Scoping': '40%',
  '60%-Propose': '60%', '80%-Validate': '80%', '90%-Negotiate & Close': '90%',
  'Business Won': 'Won',
};

/* ── NA vs APAC grouped bar chart by stage (deal count) ── */
function RegStageChart({ stageData, onBarClick }) {
  if (!stageData.length) return null;
  const maxCount = Math.max(...stageData.flatMap(s => [s.na, s.apac]), 1);
  const W = 700, H = 260, pb = 48, pt = 14, pl = 42, pr = 14;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(38, iW / stageData.length / 2 - 4);
  const gap = 4;
  const step = iW / stageData.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = maxCount * index / 5;
        const yy = pt + iH - value / maxCount * iH;
        return <g key={index}><line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pl - 7} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{Math.round(value)}</text></g>;
      })}
      {stageData.map((s, i) => {
        const cx = pl + step * i + step / 2;
        const naH  = (s.na   / maxCount) * iH;
        const apacH= (s.apac / maxCount) * iH;
        const x1   = cx - bw - gap / 2;
        const x2   = cx + gap / 2;
        return (
          <g key={i}>
            {s.na > 0 && (
              <>
                <rect x={x1} y={pt + iH - naH} width={bw} height={naH} fill="rgba(37,99,235,.16)" stroke="#2563eb" strokeWidth="2" rx={2}
                  style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); onBarClick(NA_REGION, s.stage); }} />
                <text x={x1 + bw / 2} y={pt + iH - naH - 3} textAnchor="middle" fontSize="8" fill="#2563eb">{s.na}</text>
              </>
            )}
            {s.apac > 0 && (
              <>
                <rect x={x2} y={pt + iH - apacH} width={bw} height={apacH} fill="rgba(8,145,178,.16)" stroke="#0891b2" strokeWidth="2" rx={2}
                style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); onBarClick(APAC_REGION, s.stage); }} />
                <text x={x2 + bw / 2} y={pt + iH - apacH - 3} textAnchor="middle" fontSize="8" fill="#0891b2">{s.apac}</text>
              </>
            )}
            <text x={cx} y={H - 22} textAnchor="middle" fontSize="10" fill="#6b7280">
              {STAGE_SHORT[s.stage] || s.stage.slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Quarter × Region grouped bar chart (pipeline amount) ── */
function QuarterRegionChart({ qData, onBarClick }) {
  if (!qData.length) return null;
  const maxTotal = Math.max(...qData.map(q => (q.na || 0) + (q.apac || 0)), 1);
  const W = 700, H = 260, pb = 58, pt = 14, pl = 52, pr = 14;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(76, iW / qData.length * 0.62);
  const step = iW / qData.length;
  const ticks = 5;
  const y = value => pt + iH - (value / maxTotal) * iH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const value = maxTotal * i / ticks;
        const yy = y(value);
        return <g key={i}><line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#d7dce3" strokeWidth="1" /><text x={pl - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      {qData.map((q, i) => {
        const cx = pl + step * i + step / 2;
        const naTop = y(q.na || 0);
        const totalTop = y((q.na || 0) + (q.apac || 0));
        const base = y(0);
        return (
          <g key={i}>
            {q.na > 0 && (
              <rect x={cx - bw / 2} y={naTop} width={bw} height={base - naTop} fill="rgba(37,99,235,.16)" stroke="#2563eb" strokeWidth="2" rx="2"
                style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); onBarClick(q.quarter, NA_REGION); }}><title>{q.quarter} — North America: {fmt(q.na)}</title></rect>
            )}
            {q.apac > 0 && (
              <rect x={cx - bw / 2} y={totalTop} width={bw} height={naTop - totalTop} fill="rgba(8,182,196,.16)" stroke="#0891b2" strokeWidth="2" rx="2"
                style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); onBarClick(q.quarter, APAC_REGION); }}><title>{q.quarter} — APAC: {fmt(q.apac)}</title></rect>
            )}
            <text x={cx} y={base + 22} textAnchor="middle" fontSize="10" fill="#6b7280">{q.quarter}</text>
          </g>
        );
      })}
      <g transform={`translate(${W / 2 - 112}, ${H - 12})`}><rect width="10" height="10" fill="rgba(37,99,235,.16)" stroke="#2563eb" strokeWidth="2" /><text x="16" y="9" fontSize="10" fill="#4b5563">North America</text><rect x="144" width="10" height="10" fill="rgba(8,182,196,.16)" stroke="#0891b2" strokeWidth="2" /><text x="160" y="9" fontSize="10" fill="#4b5563">APAC</text></g>
    </svg>
  );
}

/* Source × Type grouped pipeline chart from the reference HTML. */
function SourceMatrixChart({ sources, types, matrix, onCellClick }) {
  if (!sources.length || !types.length) return null;
  const W = 700, H = 260, pad = { l: 52, r: 14, t: 14, b: 56 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const max = Math.max(...sources.flatMap(source => types.map(type => matrix[source]?.[type] || 0)), 1);
  const step = innerW / sources.length;
  const barW = Math.max(10, Math.min(42, step / Math.max(types.length, 1) - 5));
  const colors = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = max * index / 5;
        const yy = pad.t + innerH - value / max * innerH;
        return <g key={index}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      {sources.map((source, si) => {
        const values = types.map(type => matrix[source]?.[type] || 0);
        const start = pad.l + si * step + (step - types.length * (barW + 2)) / 2;
        return <g key={source}>
          {values.map((value, ti) => {
            const height = value ? Math.max(2, value / max * innerH) : 0;
            return height ? <rect key={types[ti]} x={start + ti * (barW + 2)} y={pad.t + innerH - height} width={barW} height={height} rx={2} fill={`${colors[ti % colors.length]}29`} stroke={colors[ti % colors.length]} strokeWidth="2" style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); onCellClick(source, types[ti]); }}><title>{source} / {types[ti]}: {fmt(value)}</title></rect> : null;
          })}
          <text x={pad.l + si * step + step / 2} y={H - 38} textAnchor="middle" fontSize="9" fill="#6b7280">{source}</text>
        </g>;
      })}
      {types.map((type, i) => <g key={type} transform={`translate(${W / 2 - 145 + i * 105}, ${H - 5})`}><rect width="9" height="9" y={-9} fill={`${colors[i % colors.length]}29`} stroke={colors[i % colors.length]} strokeWidth="1.5" rx="1" /><text x="13" fontSize="8" fill="#6b7280">{type}</text></g>)}
    </svg>
  );
}

/* ── Legend row ── */
function RegionTrendChart({ rows, onRegionClick }) {
  if (!rows.length) return null;
  const W = 700, H = 250, pad = { l: 50, r: 16, t: 14, b: 38 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const values = rows.flatMap(row => [row.regions?.[NA_REGION] || 0, row.regions?.[APAC_REGION] || 0]);
  const max = Math.max(...values, 1);
  const x = index => pad.l + (index / Math.max(rows.length - 1, 1)) * innerW;
  const y = value => pad.t + innerH - value / max * innerH;
  const makePoints = region => rows.map((row, index) => `${x(index)},${y(row.regions?.[region] || 0)}`).join(' ');
  const makeArea = region => `${pad.l},${pad.t + innerH} ${makePoints(region)} ${pad.l + innerW},${pad.t + innerH}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {Array.from({ length: 6 }, (_, index) => {
        const value = max * index / 5;
        const yy = y(value);
        return <g key={index}><line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#d7dce3" /><text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize="9" fill="#6b7280">{fmt(value)}</text></g>;
      })}
      <polygon points={makeArea(NA_REGION)} fill="rgba(37,99,235,.10)" />
      <polygon points={makeArea(APAC_REGION)} fill="rgba(8,145,178,.10)" />
      <polyline points={makePoints(NA_REGION)} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinejoin="round" />
      <polyline points={makePoints(APAC_REGION)} fill="none" stroke="#0891b2" strokeWidth="2.2" strokeLinejoin="round" />
      {[NA_REGION, APAC_REGION].map(region => rows.map((row, index) => <circle key={`${region}-${index}`} cx={x(index)} cy={y(row.regions?.[region] || 0)} r="2.5" fill={region === NA_REGION ? '#2563eb' : '#0891b2'} style={{ cursor: 'pointer' }} onClick={event => { event.stopPropagation(); onRegionClick(region); }}><title>{region} W{row.week_num}: {fmt(row.regions?.[region] || 0)}</title></circle>))}
      {rows.map((row, index) => (index % Math.max(1, Math.ceil(rows.length / 8)) === 0 || index === rows.length - 1) ? <text key={row.week} x={x(index)} y={H - 18} textAnchor="middle" fontSize="8" fill="#6b7280">W{row.week_num}</text> : null)}
    </svg>
  );
}

function Legend({ first = 'North America', second = 'APAC' }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--sub)' }}>
      <span>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: '#2563eb', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />
        {first}
      </span>
      <span>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: '#0891b2', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />
        {second}
      </span>
    </div>
  );
}

function Region({ data }) {
  const { deals = [], weekly_trend = [], weekly_region_trend = [], selected_week_short = '' } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const weekLabel = selected_week_short || (weekly_trend.length ? `W${weekly_trend[weekly_trend.length - 1].week_num}` : 'W—');

  /* ── Derived deal buckets ── */
  const activeDeals = useMemo(() =>
    deals.filter(d => d.stage !== 'Business Won' && d.stage !== 'Business Lost'),
    [deals]
  );
  const naActive   = useMemo(() => activeDeals.filter(d => d.region === NA_REGION),   [activeDeals]);
  const apacActive = useMemo(() => activeDeals.filter(d => d.region === APAC_REGION), [activeDeals]);
  const naWon      = useMemo(() => deals.filter(d => d.region === NA_REGION   && d.stage === 'Business Won'), [deals]);
  const apacWon    = useMemo(() => deals.filter(d => d.region === APAC_REGION && d.stage === 'Business Won'), [deals]);

  const naPipeline  = naActive.reduce((s, d)   => s + (d.amount || 0), 0);
  const apacPipeline= apacActive.reduce((s, d) => s + (d.amount || 0), 0);
  const naWonAmt    = naWon.reduce((s, d)       => s + (d.amount || 0), 0);
  const apacWonAmt  = apacWon.reduce((s, d)     => s + (d.amount || 0), 0);

  /* ── Drill helpers ── */
  function drillRegion(region) {
    const rd = activeDeals.filter(d => d.region === region);
    openDrill(`${region} — Pipeline`, `${rd.length} deals`, rd);
  }

  function openRegionOverview() {
    const cards = [NA_REGION, APAC_REGION].map(region => {
      const rows = activeDeals.filter(d => d.region === region);
      const value = rows.reduce((sum, d) => sum + (d.amount || 0), 0);
      return <div key={region} className={`rc ${region === NA_REGION ? 'na' : 'apac'}`} onClick={() => { closeDrill(); drillRegion(region); }}>
        <div className="rc-name">{region}</div><div className="rc-pipe">{fmt(value)}</div>
        <div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rows.length}</div><div className="rc-sl">Deals</div></div></div>
        <div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see region deals</div>
      </div>;
    });
    openDrill('Region Split — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  function handleStageBarClick(_region, stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(`${stage} — ${sd.length} Deals`, `All deals in ${stage} stage · Click any row for full detail`, sd);
  }

  function handleQuarterBarClick(quarter) {
    const qd = activeDeals.filter(d => quarter === 'Q2 27+' ? ['Q2 27', 'Q3 27', 'Q4 27'].includes(d.close_quarter) : d.close_quarter === quarter);
    openDrill(`${quarter} Pipeline`, `${qd.length} deals · Click any row for full detail`, qd);
  }

  function handleDrillStage(stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(stage, `${sd.length} deals in this stage`, sd);
  }

  /* ── Chart data ── */
  const regionItems = [
    { label: NA_REGION, value: naPipeline, count: naActive.length, color: '#2563eb', onClick: () => drillRegion(NA_REGION) },
    { label: APAC_REGION, value: apacPipeline, count: apacActive.length, color: '#0891b2', onClick: () => drillRegion(APAC_REGION) },
  ];

  const typeItems = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const k = d.order_type || 'Unknown';
      map[k] = (map[k] || 0) + (d.amount || 0);
    }
    return DEAL_TYPES.map((label, index) => ({ label, value: map[label] || 0, color: ['#2563eb', '#0891b2', '#059669'][index], onClick: () => { const rows = activeDeals.filter(d => d.order_type === label); openDrill(`${label} Deals`, `${rows.length} deals`, rows); } }));
  }, [activeDeals, openDrill]);

  const srcItems = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const k = d.source || 'Unknown';
      map[k] = (map[k] || 0) + (d.amount || 0);
    }
    return DEAL_SOURCES.map((label, index) => ({ label, value: map[label] || 0, color: ['#2563eb', '#d97706', '#7c3aed'][index], onClick: () => { const rows = activeDeals.filter(d => d.source === label); openDrill(`${label} Sourced Deals`, `${rows.length} deals`, rows); } }));
  }, [activeDeals, openDrill]);

  function openTypeOverview() {
    const cards = typeItems.map(item => {
      const rows = activeDeals.filter(d => (d.order_type || 'Unknown') === item.label);
      return <div key={item.label} className="rc" onClick={() => { closeDrill(); openDrill(`${item.label} Deals`, `${rows.length} deals · ${fmt(item.value)}`, rows); }}><div className="rc-name">{item.label}</div><div className="rc-pipe">{fmt(item.value)}</div><div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rows.length}</div><div className="rc-sl">Deals</div></div></div><div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see deals</div></div>;
    });
    openDrill('Deal Type Mix — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  function openSourceOverview() {
    const cards = srcItems.map(item => {
      const rows = activeDeals.filter(d => (d.source || 'Unknown') === item.label);
      return <div key={item.label} className="rc" onClick={() => { closeDrill(); openDrill(`${item.label} Sourced Deals`, `${rows.length} deals · ${fmt(item.value)}`, rows); }}><div className="rc-name">{item.label}</div><div className="rc-pipe">{fmt(item.value)}</div><div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rows.length}</div><div className="rc-sl">Deals</div></div></div><div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see deals</div></div>;
    });
    openDrill('Deal Source — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  const stageByRegion = useMemo(() =>
    STAGE_ORDER
      .map(stage => ({
        stage,
        na:   activeDeals.filter(d => d.region === NA_REGION   && d.stage === stage).length,
        apac: activeDeals.filter(d => d.region === APAC_REGION && d.stage === stage).length,
      }))
      .filter(s => s.na > 0 || s.apac > 0),
    [activeDeals]
  );

  const { srcTypes, srcSources, srcMatrix } = useMemo(() => {
    const types = DEAL_TYPES;
    const sources = DEAL_SOURCES;
    const matrix  = {};
    for (const d of activeDeals) {
      const src = d.source    || 'Unknown';
      const typ = d.order_type || 'Unknown';
      if (!matrix[src]) matrix[src] = {};
      matrix[src][typ] = (matrix[src][typ] || 0) + (d.amount || 0);
    }
    return { srcTypes: types, srcSources: sources, srcMatrix: matrix };
  }, [activeDeals]);

  const quarterData = useMemo(() => REGION_QUARTERS.map(quarter => ({
    quarter,
    na: activeDeals.filter(d => d.region === NA_REGION && (quarter === 'Q2 27+' ? ['Q2 27', 'Q3 27', 'Q4 27'].includes(d.close_quarter) : d.close_quarter === quarter)).reduce((sum, d) => sum + (d.amount || 0), 0),
    apac: activeDeals.filter(d => d.region === APAC_REGION && (quarter === 'Q2 27+' ? ['Q2 27', 'Q3 27', 'Q4 27'].includes(d.close_quarter) : d.close_quarter === quarter)).reduce((sum, d) => sum + (d.amount || 0), 0),
  })), [activeDeals]);

  function openStageOverview() {
    const cards = STAGE_ORDER.filter(stage => stage !== 'Business Won').map(stage => {
      const rows = deals.filter(d => d.stage === stage);
      return <div key={stage} className="rc" onClick={() => { closeDrill(); handleDrillStage(stage); }}><div className="rc-name">{stage}</div><div className="rc-row"><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--blue)' }}>{rows.filter(d => d.region === NA_REGION).length}</div><div className="rc-sl">NA Deals</div></div><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--cyan)' }}>{rows.filter(d => d.region === APAC_REGION).length}</div><div className="rc-sl">APAC Deals</div></div></div><div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see all deals</div></div>;
    });
    openDrill('NA vs APAC by Stage — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  function openQuarterOverview() {
    const cards = quarterData.map(q => {
      const rows = activeDeals.filter(d => (q.quarter === 'Q2 27+' ? ['Q2 27', 'Q3 27', 'Q4 27'].includes(d.close_quarter) : d.close_quarter === q.quarter));
      return <div key={q.quarter} className="rc" onClick={() => { closeDrill(); openDrill(`${q.quarter} Pipeline`, `${rows.length} deals · ${fmt(q.na + q.apac)}`, rows); }}><div className="rc-name">{q.quarter}</div><div className="rc-pipe">{fmt(q.na + q.apac)}</div><div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rows.length}</div><div className="rc-sl">Deals</div></div><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--blue)' }}>{fmt(q.na)}</div><div className="rc-sl">NA ({rows.filter(d => d.region === NA_REGION).length})</div></div><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--cyan)' }}>{fmt(q.apac)}</div><div className="rc-sl">APAC ({rows.filter(d => d.region === APAC_REGION).length})</div></div></div><div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → see deals</div></div>;
    });
    openDrill('Pipeline by Quarter — Click to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  return (
    <>
      {/* ── 4 Hero KPI cards ── */}
      <div className="krow k4">
        <div className="kc kb" onClick={() => drillRegion(NA_REGION)}>
          <div className="kl">NA Total Pipeline</div>
          <div className="kv">{fmt(naPipeline)}</div>
          <div className="kd"><span className="fl">active</span></div>
          <div className="click-hint">🔍 Click → NA deals</div>
        </div>
        <div className="kc kc2" onClick={() => drillRegion(APAC_REGION)}>
          <div className="kl">APAC Total Pipeline</div>
          <div className="kv">{fmt(apacPipeline)}</div>
          <div className="kd"><span className="fl">active</span></div>
          <div className="click-hint">🔍 Click → APAC deals</div>
        </div>
        <div className="kc kg" onClick={() => openDrill('NA Won YTD', `${naWon.length} deals`, naWon)}>
          <div className="kl">NA Won YTD</div>
          <div className="kv">{fmt(naWonAmt)}</div>
          <div className="kd"><span className="up">{naWon.length} deals</span></div>
          <div className="click-hint">🔍 Click → NA won deals</div>
        </div>
        <div className="kc ka" onClick={() => openDrill('APAC Won YTD', `${apacWon.length} deals`, apacWon)}>
          <div className="kl">APAC Won YTD</div>
          <div className="kv">{fmt(apacWonAmt)}</div>
          <div className="kd"><span className="up">{apacWon.length} deals</span></div>
          <div className="click-hint">🔍 Click → APAC won deals</div>
        </div>
      </div>

      {/* ── g3: 3 Donut charts ── */}
      <div className="g3">
        <div className="pl-card pl-card-clickable" onClick={openRegionOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">Region Split {weekLabel} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click segment</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → region deals</div>
          <DonutChart items={regionItems} radius={82} />
        </div>
        <div className="pl-card pl-card-clickable" onClick={openTypeOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">Deal Type Mix {weekLabel} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click segment</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → type deals</div>
          <DonutChart items={typeItems} radius={82} />
        </div>
        <div className="pl-card pl-card-clickable" onClick={openSourceOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">Deal Source {weekLabel} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click segment</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → source deals</div>
          <DonutChart items={srcItems} radius={82} />
        </div>
      </div>

      {/* ── g2: Trend + Stage bar ── */}
      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={openRegionOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">
              NA vs APAC Pipeline Trend <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Regional pipeline evolution W1→{weekLabel}</div>
          {weekly_region_trend.length > 0
            ? <RegionTrendChart rows={weekly_region_trend} onRegionClick={drillRegion} />
            : <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--sub)', fontSize: 11 }}>
                Loading trend data…
              </div>
          }
          <Legend />
        </div>
        <div className="pl-card pl-card-clickable" onClick={openStageOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">
              NA vs APAC by Stage <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click bar → deals</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Deal count per stage per region</div>
          <RegStageChart stageData={stageByRegion} onBarClick={handleStageBarClick} />
          <Legend first="NA Deals" />
        </div>
      </div>

      {/* ── g2: Source × Type Matrix + Quarter × Region ── */}
      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={openSourceOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">
              Source × Type Matrix <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Pipeline value by source and deal type</div>
          <SourceMatrixChart sources={srcSources} types={srcTypes} matrix={srcMatrix} onCellClick={openSourceOverview} />
          {false && <div className="pl-twrap">
            <table>
              <thead>
                <tr>
                  <th style={{ fontSize: 10 }}>Source \ Type</th>
                  {srcTypes.map(t => <th key={t} style={{ fontSize: 10 }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {srcSources.map(src => (
                  <tr key={src}>
                    <td style={{ fontWeight: 600, fontSize: 10 }}>{src}</td>
                    {srcTypes.map(typ => {
                      const amt = srcMatrix[src]?.[typ] || 0;
                      return (
                        <td key={typ}
                          style={{ fontSize: 10, cursor: amt ? 'pointer' : 'default', color: amt ? '#2563eb' : '#9ca3af' }}
                          onClick={() => {
                            if (!amt) return;
                            const filtered = activeDeals.filter(d =>
                              (d.source || 'Unknown') === src && (d.order_type || 'Unknown') === typ
                            );
                            openDrill(`${src} / ${typ}`, `${filtered.length} deals`, filtered);
                          }}>
                          {amt ? fmt(amt) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
        <div className="pl-card pl-card-clickable" onClick={openQuarterOverview}>
          <div className="pl-card-header">
            <div className="pl-card-title">
              Quarter × Region Pipeline <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Expected close quarter by region</div>
          <QuarterRegionChart qData={quarterData} onBarClick={handleQuarterBarClick} />
        </div>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { Region };
export default Region;
