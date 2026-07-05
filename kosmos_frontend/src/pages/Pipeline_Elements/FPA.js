import { useMemo } from 'react';
import { fmt, StageBadge } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

function QuarterBarChart({ quarters, onBarClick }) {
  if (!quarters.length) return null;
  const max = Math.max(...quarters.map(([, v]) => v.pipeline), 1);
  const W = 600, H = 100, pb = 24, pt = 8, pl = 8, pr = 8;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(48, iW / quarters.length - 10);
  const step = iW / quarters.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={pt + iH} y2={pt + iH} stroke="#e5e7eb" strokeWidth="1" />
      {quarters.map(([q, v], i) => {
        const cx = pl + step * i + step / 2;
        const bH = (v.pipeline / max) * iH;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={pt + iH - bH} width={bw} height={bH} fill="#4f46e5" rx={3}
              style={{ cursor: 'pointer' }} onClick={() => onBarClick(q)} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">{q}</text>
          </g>
        );
      })}
    </svg>
  );
}

function FPA({ data }) {
  const { kpis, deals = [] } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const wonDeals    = useMemo(() => deals.filter(d => d.stage === 'Business Won'),    [deals]);
  const lostDeals   = useMemo(() => deals.filter(d => d.stage === 'Business Lost'),   [deals]);
  const activeDeals = useMemo(() => deals.filter(d => !['Business Won', 'Business Lost'].includes(d.stage)), [deals]);
  const commitDeals = useMemo(() => activeDeals.filter(d => ['Commit', 'Commit '].includes((d.forecast_category || '').trim())), [activeDeals]);
  const upsideDeals = useMemo(() => activeDeals.filter(d => (d.forecast_category || '').trim() === 'Upside'), [activeDeals]);
  const nfDeals     = useMemo(() => activeDeals.filter(d => ['Not forecasted', 'Not Forecasted'].includes((d.forecast_category || '').trim())), [activeDeals]);

  const aop     = kpis.aop || 1;
  const won     = kpis.won_ytd || 0;
  const commit  = kpis.commit_pipeline || 0;
  const upside  = kpis.upside_pipeline || 0;
  const lost    = kpis.lost_ytd || 0;
  const nfAmt   = useMemo(() => nfDeals.reduce((s, d) => s + (d.amount || 0), 0), [nfDeals]);
  const aopPct  = aop > 0 ? (won / aop * 100) : 0;
  const coverage= kpis.active_pipeline / aop;

  const bearCase = won + commit * 0.8 + upside * 0.1;
  const baseCase = won + commit * 0.8 + upside * 0.3 + nfAmt * 0.05;
  const bullCase = won + commit * 0.9 + upside * 0.5 + nfAmt * 0.1;

  const quarters = useMemo(() => {
    const map = {};
    for (const d of activeDeals) {
      const q = d.close_quarter || 'Unknown';
      if (!map[q]) map[q] = { deals: 0, pipeline: 0, commit: 0, upside: 0 };
      map[q].deals += 1;
      map[q].pipeline += d.amount || 0;
      if (['Commit', 'Commit '].includes((d.forecast_category || '').trim())) map[q].commit += d.amount || 0;
      if ((d.forecast_category || '').trim() === 'Upside') map[q].upside += d.amount || 0;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeDeals]);

  const wfMax = Math.max(kpis.active_pipeline, aop, 1);

  const WF_ROWS = [
    { label: '✅ Closed Won (Booked)',  value: won,                 color: 'var(--green)',  deals: wonDeals,    title: 'Won Deals' },
    { label: '🔵 Commit Pipeline',      value: commit,              color: 'var(--blue)',   deals: commitDeals, title: 'Commit Pipeline' },
    { label: '🟡 Upside Pipeline',      value: upside,              color: 'var(--amber)',  deals: upsideDeals, title: 'Upside Pipeline' },
    { label: '🟣 Not Forecasted',       value: nfAmt,               color: 'var(--purple)', deals: nfDeals,     title: 'Not Forecasted' },
    { label: '⚫ Total Active Pipeline', value: kpis.active_pipeline, color: '#374151',       deals: activeDeals, title: 'All Active Deals' },
  ];

  const ATTAINMENT_ROWS = [
    { label: '🟢 Booked (Closed Won)',    value: won,          conv: 1.0,  color: 'var(--green)',  deals: wonDeals,    title: 'Won Deals' },
    { label: '🔵 Commit (80% conv.)',     value: commit,       conv: 0.8,  color: 'var(--blue)',   deals: commitDeals, title: 'Commit Pipeline' },
    { label: '🟡 Upside (30% conv.)',     value: upside,       conv: 0.3,  color: 'var(--amber)',  deals: upsideDeals, title: 'Upside Pipeline' },
    { label: '🟣 Not Forecasted (5%)',    value: nfAmt,        conv: 0.05, color: 'var(--purple)', deals: nfDeals,     title: 'Not Forecasted' },
  ];

  function drillAll() {
    openDrill('All Active Deals', `${activeDeals.length} deals`, activeDeals);
  }

  function handleDrillStage(stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(stage, `${sd.length} deals in this stage`, sd);
  }

  return (
    <>
      {/* ── FPA Header ── */}
      <div className="exh">
        <div className="exav fpa">💼</div>
        <div>
          <div className="exname">FP&amp;A / Business Finance Dashboard</div>
          <div className="exrole">Revenue Forecasting · Scenario Analysis · Pipeline Quality · Risk Register · AOP Tracking · Click everything</div>
        </div>
        <div className="exm">
          <div className="em" onClick={() => openDrill('AOP Attainment', `${fmt(won)} booked`, wonDeals)}>
            <div className="eml">AOP Attainment</div>
            <div className="emv" style={{ color: 'var(--amber)' }}>{aopPct.toFixed(1)}%</div>
          </div>
          <div className="em" onClick={drillAll}>
            <div className="eml">Pipeline Coverage</div>
            <div className="emv" style={{ color: 'var(--green)' }}>{coverage.toFixed(2)}×</div>
          </div>
          <div className="em" onClick={() => openDrill('Booked Revenue', `${wonDeals.length} won deals`, wonDeals)}>
            <div className="eml">Booked Revenue</div>
            <div className="emv" style={{ color: 'var(--blue)' }}>{fmt(won)}</div>
          </div>
        </div>
      </div>

      {/* ── 4 Hero KPI cards ── */}
      <div className="krow k4">
        <div className="kc kg" onClick={() => openDrill('Booked Revenue YTD', `${wonDeals.length} won deals`, wonDeals)}>
          <div className="kl">Booked Revenue YTD</div>
          <div className="kv">{fmt(won)}</div>
          <div className="kd"><span className="up">{aopPct.toFixed(1)}% of {fmt(aop)} AOP</span></div>
          <div className="click-hint">🔍 Click → won deals</div>
        </div>
        <div className="kc kb" onClick={() => openDrill('Commit Pipeline', `${commitDeals.length} commit deals`, commitDeals)}>
          <div className="kl">Commit Pipeline</div>
          <div className="kv">{fmt(commit)}</div>
          <div className="kd"><span className="dn">active commit deals</span></div>
          <div className="click-hint">🔍 Click → commit deals</div>
        </div>
        <div className="kc ka" onClick={() => openDrill('Upside Pipeline', `${upsideDeals.length} upside deals`, upsideDeals)}>
          <div className="kl">Upside Pipeline</div>
          <div className="kv">{fmt(upside)}</div>
          <div className="kd"><span className="fl">refreshed</span></div>
          <div className="click-hint">🔍 Click → upside deals</div>
        </div>
        <div className="kc kr" onClick={() => openDrill('Lost Value YTD', `${lostDeals.length} lost deals`, lostDeals)}>
          <div className="kl">Lost Value YTD</div>
          <div className="kv">{fmt(lost)}</div>
          <div className="kd"><span className="dn">{lostDeals.length} deals · refreshed</span></div>
          <div className="click-hint">🔍 Click → lost deals</div>
        </div>
      </div>

      {/* ── g2: Scenarios + Quarter Table ── */}
      <div className="g2">
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Revenue Scenario Analysis — Click scenarios to drill</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10 }}>Bear / Base / Bull case based on pipeline conversion assumptions</div>

          <div className="sc-grid">
            <div className="sc sc-bear" onClick={() => openDrill('Bear Case', `${fmt(bearCase)} projected`, activeDeals)}>
              <div className="sc-lbl">🐻 Bear Case</div>
              <div className="sc-val">{fmt(bearCase)}</div>
              <div className="sc-pct">{(bearCase / aop * 100).toFixed(0)}% of AOP</div>
              <div className="sc-note">Won + Commit 80% + Upside 10%</div>
            </div>
            <div className="sc sc-base" onClick={() => openDrill('Base Case', `${fmt(baseCase)} projected`, activeDeals)}>
              <div className="sc-lbl">📊 Base Case</div>
              <div className="sc-val">{fmt(baseCase)}</div>
              <div className="sc-pct">{(baseCase / aop * 100).toFixed(0)}% of AOP</div>
              <div className="sc-note">Won + Commit 80% + Upside 30% + NF 5%</div>
            </div>
            <div className="sc sc-bull" onClick={() => openDrill('Bull Case', `${fmt(bullCase)} projected`, activeDeals)}>
              <div className="sc-lbl">🐂 Bull Case</div>
              <div className="sc-val">{fmt(bullCase)}</div>
              <div className="sc-pct">{(bullCase / aop * 100).toFixed(0)}% of AOP</div>
              <div className="sc-note">Won + Commit 90% + Upside 50% + NF 10%</div>
            </div>
          </div>

          <div className="dv" />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>AOP Attainment Tracker — Click bars to drill</div>

          {ATTAINMENT_ROWS.map((row, i) => {
            const projected = row.value * row.conv;
            const pct = Math.min(projected / aop * 100, 100);
            return (
              <div className="pw" key={i} onClick={() => openDrill(row.title, `${row.deals.length} deals`, row.deals)}>
                <div className="ph">
                  <span className="pn">{row.label}</span>
                  <span className="pv">{fmt(projected)} — {pct.toFixed(1)}%</span>
                </div>
                <div className="pb"><div className="pf" style={{ width: `${pct}%`, background: row.color }} /></div>
              </div>
            );
          })}
        </div>

        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Quarterly Revenue Timing — Click quarters to drill</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Expected close by quarter — active pipeline</div>
          <QuarterBarChart quarters={quarters} onBarClick={(q) => {
            const qd = activeDeals.filter(d => d.close_quarter === q);
            openDrill(q, `${qd.length} deals`, qd);
          }} />
          <div className="dv" />
          <div className="pl-twrap">
            <table>
              <thead>
                <tr><th>Quarter</th><th>Deals</th><th>Pipeline</th><th>Commit</th><th>Upside</th></tr>
              </thead>
              <tbody>
                {quarters.map(([q, v]) => (
                  <tr key={q} className="pl-tr-click" onClick={() => {
                    const qd = activeDeals.filter(d => d.close_quarter === q);
                    openDrill(q, `${qd.length} deals`, qd);
                  }}>
                    <td style={{ fontWeight: 700 }}>{q}</td>
                    <td style={{ fontSize: 11, color: 'var(--sub)' }}>{v.deals}</td>
                    <td style={{ fontSize: 11, color: 'var(--sub)' }}>{fmt(v.pipeline)}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{v.commit ? fmt(v.commit) : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--sub)' }}>{v.upside ? fmt(v.upside) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── g2: Pipeline Waterfall + Risk Register ── */}
      <div className="g2">
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Pipeline Waterfall — Click each layer to drill</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10 }}>Revenue breakdown from booked to at-risk</div>
          <div style={{ marginTop: 8 }}>
            {WF_ROWS.map((row, i) => {
              const pct = Math.min(row.value / wfMax * 100, 100);
              const aopPctRow = (row.value / aop * 100).toFixed(0) + '%';
              return (
                <div className="wf" key={i} onClick={() => openDrill(row.title, `${row.deals.length} deals`, row.deals)}>
                  <div className="wf-lbl">{row.label}</div>
                  <div className="wf-bw"><div className="wf-bf" style={{ width: `${pct}%`, background: row.color }} /></div>
                  <div className="wf-v">{fmt(row.value)}</div>
                  <div className="wf-p">{aopPctRow}</div>
                </div>
              );
            })}
            <div className="dv" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sub)' }}>
              <span>AOP: <strong style={{ color: 'var(--text)' }}>{fmt(aop)}</strong></span>
              <span>Remaining Gap: <strong style={{ color: 'var(--red)' }}>{fmt(Math.max(0, aop - won))}</strong></span>
            </div>
          </div>
        </div>

        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Pipeline Risk Register</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Active deals sorted by age — oldest at highest risk</div>
          <div className="pl-twrap">
            <table>
              <thead>
                <tr><th>Deal</th><th>Amount</th><th>Stage</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {activeDeals
                  .slice()
                  .sort((a, b) => (b.days_open || 0) - (a.days_open || 0))
                  .slice(0, 15)
                  .map((d, i) => {
                    const days = d.days_open || 0;
                    const [rColor, rLabel] =
                      days > 500 ? ['#dc2626', '🔴 High'] :
                      days > 180 ? ['#d97706', '🟡 Medium'] :
                      ['#059669', '🟢 Low'];
                    return (
                      <tr key={i} className="pl-tr-click" onClick={() => openDrill(d.deal_name, `${fmt(d.amount)}`, [d])}>
                        <td style={{ fontSize: 10, fontWeight: 600, maxWidth: 140 }} title={d.deal_name}>{d.deal_name}</td>
                        <td style={{ color: '#2563eb', fontWeight: 700, fontSize: 11 }}>{fmt(d.amount)}</td>
                        <td><StageBadge stage={d.stage} /></td>
                        <td><span style={{ fontSize: 10, color: rColor, fontWeight: 600 }}>{rLabel}</span></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { FPA };
export default FPA;
