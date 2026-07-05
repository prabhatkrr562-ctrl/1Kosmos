import { useMemo } from 'react';
import { fmt, DonutChart, MultiLineChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const NA_REGION   = 'North America';
const APAC_REGION = 'APAC';

const STAGE_ORDER = [
  '5% - Identify', '20% - Qualify', '40% - Validate',
  '60% - Propose', '80% - Commit', '90% - Contract',
  'Business Won',
];
const STAGE_SHORT = {
  '5% - Identify': '5%', '20% - Qualify': '20%', '40% - Validate': '40%',
  '60% - Propose': '60%', '80% - Commit': '80%', '90% - Contract': '90%',
  'Business Won': 'Won',
};

/* ── NA vs APAC grouped bar chart by stage (deal count) ── */
function RegStageChart({ stageData, onBarClick }) {
  if (!stageData.length) return null;
  const maxCount = Math.max(...stageData.flatMap(s => [s.na, s.apac]), 1);
  const W = 600, H = 130, pb = 28, pt = 10, pl = 10, pr = 10;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(28, iW / stageData.length / 2 - 4);
  const gap = 4;
  const step = iW / stageData.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={pt + iH} y2={pt + iH} stroke="#e5e7eb" strokeWidth="1" />
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
                <rect x={x1} y={pt + iH - naH} width={bw} height={naH} fill="#2563eb" rx={2}
                  style={{ cursor: 'pointer' }} onClick={() => onBarClick(NA_REGION, s.stage)} />
                <text x={x1 + bw / 2} y={pt + iH - naH - 3} textAnchor="middle" fontSize="8" fill="#2563eb">{s.na}</text>
              </>
            )}
            {s.apac > 0 && (
              <>
                <rect x={x2} y={pt + iH - apacH} width={bw} height={apacH} fill="#0891b2" rx={2}
                  style={{ cursor: 'pointer' }} onClick={() => onBarClick(APAC_REGION, s.stage)} />
                <text x={x2 + bw / 2} y={pt + iH - apacH - 3} textAnchor="middle" fontSize="8" fill="#0891b2">{s.apac}</text>
              </>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">
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
  const maxAmt = Math.max(...qData.flatMap(q => [q.na, q.apac]), 1);
  const W = 600, H = 140, pb = 28, pt = 10, pl = 10, pr = 10;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw  = Math.min(40, iW / qData.length / 2 - 6);
  const gap = 4;
  const step = iW / qData.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={pt + iH} y2={pt + iH} stroke="#e5e7eb" strokeWidth="1" />
      {qData.map((q, i) => {
        const cx   = pl + step * i + step / 2;
        const naH  = (q.na   / maxAmt) * iH;
        const apacH= (q.apac / maxAmt) * iH;
        const x1   = cx - bw - gap / 2;
        const x2   = cx + gap / 2;
        return (
          <g key={i}>
            {q.na > 0 && (
              <rect x={x1} y={pt + iH - naH} width={bw} height={naH} fill="#2563eb" rx={2}
                style={{ cursor: 'pointer' }} onClick={() => onBarClick(q.quarter, NA_REGION)} />
            )}
            {q.apac > 0 && (
              <rect x={x2} y={pt + iH - apacH} width={bw} height={apacH} fill="#0891b2" rx={2}
                style={{ cursor: 'pointer' }} onClick={() => onBarClick(q.quarter, APAC_REGION)} />
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">{q.quarter}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Legend row ── */
function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--sub)' }}>
      <span>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: '#2563eb', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />
        NA
      </span>
      <span>
        <span style={{ display: 'inline-block', width: 10, height: 3, background: '#0891b2', borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }} />
        APAC
      </span>
    </div>
  );
}

function Region({ data }) {
  const { region_dist, deals = [], weekly_trend = [], weekly_region_trend = [] } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const weekNum = weekly_trend.length
    ? weekly_trend[weekly_trend.length - 1].week_num
    : '';

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
    const rd = deals.filter(d => d.region === region && d.stage !== 'Business Lost');
    openDrill(`${region} — Pipeline`, `${rd.length} deals`, rd);
  }

  function handleStageBarClick(region, stage) {
    const sd = deals.filter(d => d.region === region && d.stage === stage);
    openDrill(`${region} — ${stage}`, `${sd.length} deals`, sd);
  }

  function handleQuarterBarClick(quarter, region) {
    const qd = activeDeals.filter(d => d.close_quarter === quarter && d.region === region);
    openDrill(`${quarter} — ${region}`, `${qd.length} deals`, qd);
  }

  function handleDrillStage(stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(stage, `${sd.length} deals in this stage`, sd);
  }

  /* ── Chart data ── */
  const regionItems = useMemo(() =>
    region_dist.map(r => ({ label: r.region || 'Unknown', value: r.amount, count: r.count })),
    [region_dist]
  );

  const typeItems = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const k = d.order_type || 'Unknown';
      map[k] = (map[k] || 0) + (d.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [activeDeals]);

  const srcItems = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const k = d.source || 'Unknown';
      map[k] = (map[k] || 0) + (d.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [activeDeals]);

  const trendSeries = useMemo(() => {
    if (!weekly_region_trend.length) return [];
    return [
      {
        label: NA_REGION,
        data:  weekly_region_trend.map(w => ({ label: `W${w.week_num}`, value: w.regions?.[NA_REGION]   || 0 })),
        color: '#2563eb',
      },
      {
        label: APAC_REGION,
        data:  weekly_region_trend.map(w => ({ label: `W${w.week_num}`, value: w.regions?.[APAC_REGION] || 0 })),
        color: '#0891b2',
      },
    ];
  }, [weekly_region_trend]);

  const stageByRegion = useMemo(() =>
    STAGE_ORDER
      .map(stage => ({
        stage,
        na:   deals.filter(d => d.region === NA_REGION   && d.stage === stage).length,
        apac: deals.filter(d => d.region === APAC_REGION && d.stage === stage).length,
      }))
      .filter(s => s.na > 0 || s.apac > 0),
    [deals]
  );

  const { srcTypes, srcSources, srcMatrix } = useMemo(() => {
    const types   = [...new Set(activeDeals.map(d => d.order_type || 'Unknown'))].sort();
    const sources = [...new Set(activeDeals.map(d => d.source    || 'Unknown'))].sort();
    const matrix  = {};
    for (const d of activeDeals) {
      const src = d.source    || 'Unknown';
      const typ = d.order_type || 'Unknown';
      if (!matrix[src]) matrix[src] = {};
      matrix[src][typ] = (matrix[src][typ] || 0) + (d.amount || 0);
    }
    return { srcTypes: types, srcSources: sources, srcMatrix: matrix };
  }, [activeDeals]);

  const quarterData = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const q = d.close_quarter || 'Unknown';
      if (!map[q]) map[q] = { na: 0, apac: 0 };
      if      (d.region === NA_REGION)   map[q].na   += d.amount || 0;
      else if (d.region === APAC_REGION) map[q].apac += d.amount || 0;
    }
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([quarter, v]) => ({ quarter, ...v }));
  }, [activeDeals]);

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
        <div className="pl-card pl-card-clickable"
          onClick={() => openDrill('Region Split', `${deals.filter(d => d.stage !== 'Business Lost').length} deals`, deals.filter(d => d.stage !== 'Business Lost'))}>
          <div className="pl-card-header">
            <div className="pl-card-title">Region Split W{weekNum} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → region deals</div>
          <DonutChart items={regionItems} radius={70} />
        </div>
        <div className="pl-card pl-card-clickable"
          onClick={() => openDrill('Deal Type Mix', `${activeDeals.length} active deals`, activeDeals)}>
          <div className="pl-card-header">
            <div className="pl-card-title">Deal Type Mix W{weekNum} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → type deals</div>
          <DonutChart items={typeItems} radius={70} />
        </div>
        <div className="pl-card pl-card-clickable"
          onClick={() => openDrill('Deal Source', `${activeDeals.length} active deals`, activeDeals)}>
          <div className="pl-card-header">
            <div className="pl-card-title">Deal Source W{weekNum} <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Click segment → source deals</div>
          <DonutChart items={srcItems} radius={70} />
        </div>
      </div>

      {/* ── g2: Trend + Stage bar ── */}
      <div className="g2">
        <div className="pl-card pl-card-clickable"
          onClick={() => openDrill('NA vs APAC Trend', 'Regional pipeline overview', activeDeals)}>
          <div className="pl-card-header">
            <div className="pl-card-title">
              NA vs APAC Pipeline Trend <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Regional pipeline evolution W1→W{weekNum}</div>
          {trendSeries.length > 0
            ? <MultiLineChart series={trendSeries} height={140} />
            : <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--sub)', fontSize: 11 }}>
                Loading trend data…
              </div>
          }
          <Legend />
        </div>
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">
              NA vs APAC by Stage <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click bar → deals</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Deal count per stage per region</div>
          <RegStageChart stageData={stageByRegion} onBarClick={handleStageBarClick} />
          <Legend />
        </div>
      </div>

      {/* ── g2: Source × Type Matrix + Quarter × Region ── */}
      <div className="g2">
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">
              Source × Type Matrix <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Pipeline value by source and deal type</div>
          <div className="pl-twrap">
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
          </div>
        </div>
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">
              Quarter × Region Pipeline <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Expected close quarter by region</div>
          <QuarterRegionChart qData={quarterData} onBarClick={handleQuarterBarClick} />
          <Legend />
        </div>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { Region };
export default Region;
