import { useState, useMemo, useEffect } from 'react';
import { fmt, DonutChart, LineChart, StageBadge, FcBadge } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

/* ── Stage metadata ── */
const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];
const LATE_STAGES = ['80%-Validate', '90%-Negotiate & Close'];

/* ── Inline badge helpers (mirrors DrillModal internals) ── */
function AgeBadge({ days }) {
  if (days == null) return <span className="b bx">—</span>;
  if (days <= 30)   return <span className="b bg">{days}d</span>;
  if (days <= 90)   return <span className="b ba">{days}d</span>;
  if (days <= 180)  return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠ {days}d</span>;
}
function StaleBadge({ days }) {
  if (days == null) return <span className="b bx">—</span>;
  if (days <= 14)   return <span className="b bg">{days}d</span>;
  if (days <= 30)   return <span className="b ba">{days}d</span>;
  if (days <= 90)   return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠ {days}d</span>;
}

/* ── Grouped bar chart: Commit / Upside / Won per rep ── */
function RepStackChart({ reps, onBarClick }) {
  const W = 700, H = 200;
  const PAD = { t: 10, b: 55, l: 10, r: 10 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...reps.map(r => Math.max(r.commit || 0, r.upside || 0, r.won || 0)), 1);
  const slotW  = chartW / Math.max(reps.length, 1);
  const barW   = Math.max(5, Math.min(14, slotW * 0.27));
  const COL    = { commit: '#059669', upside: '#d97706', won: '#0891b2' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {reps.map((rep, i) => {
        const cx = PAD.l + slotW * i + slotW / 2;
        const firstName = rep.owner.split(' ')[0];
        const bars = [
          { key: 'commit', val: rep.commit || 0, x: cx - barW - 1 },
          { key: 'upside', val: rep.upside || 0, x: cx - barW / 2 + 0.5 },
          { key: 'won',    val: rep.won    || 0, x: cx + 1 },
        ];
        return (
          <g key={i}>
            {bars.map(b => {
              const bh = b.val > 0 ? Math.max((b.val / maxVal) * chartH, 2) : 0;
              return bh > 0 ? (
                <rect key={b.key}
                  x={b.x} y={PAD.t + chartH - bh}
                  width={barW} height={bh}
                  fill={COL[b.key]} rx={2} opacity={0.85}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onBarClick && onBarClick(rep.owner, b.key)}>
                  <title>{b.key}: {fmt(b.val)}</title>
                </rect>
              ) : null;
            })}
            <text x={cx} y={PAD.t + chartH + 14} textAnchor="middle" fontSize={7.5} fill="#9ca3af">
              {firstName}
            </text>
          </g>
        );
      })}
      {[
        { col: COL.commit, label: 'Commit' },
        { col: COL.upside, label: 'Upside' },
        { col: COL.won,    label: 'Won YTD' },
      ].map((l, i) => (
        <g key={i} transform={`translate(${10 + i * 68}, ${H - 8})`}>
          <rect width={8} height={8} y={-8} fill={l.col} rx={1} />
          <text x={11} fontSize={8} fill="#9ca3af">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

function RepWinLossChart({ reps, onBarClick }) {
  const max = Math.max(...reps.map(r => Math.max(r.won_deals || 0, r.lost_deals || 0)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '8px 8px 28px', overflowX: 'auto' }}>
      {reps.map((rep, i) => (
        <div key={i} style={{ minWidth: 46, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 150 }}>
            <div title={`${rep.owner} won`} onClick={() => onBarClick?.(rep.owner)} style={{ width: 14, height: `${Math.max(2, (rep.won_deals || 0) / max * 140)}px`, background: 'var(--green)', borderRadius: '3px 3px 0 0', cursor: 'pointer' }} />
            <div title={`${rep.owner} lost`} onClick={() => onBarClick?.(rep.owner)} style={{ width: 14, height: `${Math.max(2, (rep.lost_deals || 0) / max * 140)}px`, background: 'var(--red)', borderRadius: '3px 3px 0 0', cursor: 'pointer' }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--sub)', whiteSpace: 'nowrap' }}>{rep.owner.split(' ')[0]}</span>
        </div>
      ))}
      <div style={{ position: 'absolute', fontSize: 9, color: 'var(--sub)', marginTop: 178 }}>■ Won &nbsp; <span style={{ color: 'var(--red)' }}>■ Lost</span></div>
    </div>
  );
}

function movDir(m) {
  if (m.to_stage === 'Business Won')  return 'won';
  if (m.to_stage === 'Business Lost') return 'lost';
  const fi = ACTIVE_STAGES.indexOf(m.from_stage);
  const ti = ACTIVE_STAGES.indexOf(m.to_stage);
  return (ti > fi) ? 'forward' : 'backward';
}

/* ── Main component ── */
function RepDeepDive({ data, initialRep = null }) {
  const { rep_breakdown, deals = [], movement = {}, weekly_trend = [], rep_weekly_trend = {} } = data;
  const [selectedRep, setSelectedRep] = useState(initialRep);
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  useEffect(() => {
    if (initialRep && rep_breakdown.some(rep => rep.owner === initialRep)) setSelectedRep(initialRep);
  }, [initialRep, rep_breakdown]);

  /* ── Per-rep slices ── */
  const repData = useMemo(
    () => rep_breakdown.find(r => r.owner === selectedRep) || null,
    [rep_breakdown, selectedRep]
  );

  /* repDeals matches reference: active + won, excludes Business Lost */
  const repDeals = useMemo(
    () => selectedRep
      ? deals.filter(d => d.owner === selectedRep && d.stage !== 'Business Lost')
            .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      : [],
    [deals, selectedRep]
  );

  const activeRepDeals = useMemo(() => repDeals.filter(d => ACTIVE_STAGES.includes(d.stage)), [repDeals]);

  /* ── Stage donut items ── */
  const stageDonutItems = useMemo(() => {
    const map = {};
    for (const d of repDeals) {
      map[d.stage] = (map[d.stage] || 0) + (d.amount || 0);
    }
    return [...ACTIVE_STAGES, 'Business Won'].filter(s => map[s]).map(s => ({
      label: s,
      value: map[s],
      onClick: () => {
        const filtered = repDeals.filter(d => d.stage === s);
        openDrill(`${selectedRep} — ${s}`, `${filtered.length} deals`, filtered);
      },
    }));
  }, [repDeals, selectedRep, openDrill]);

  /* ── Forecast donut items ── */
  const fcDonutItems = useMemo(() => {
    const map = { 'Commit': 0, 'Upside': 0, 'Not Forecasted': 0, 'Closed Won': 0 };
    for (const d of repDeals) {
      const fc = (d.forecast_category || '').trim();
      if (fc === 'Commit') map['Commit'] += d.amount || 0;
      else if (fc === 'Upside') map['Upside'] += d.amount || 0;
      else if (d.stage === 'Business Won' || fc.toLowerCase() === 'closed won') map['Closed Won'] += d.amount || 0;
      else map['Not Forecasted'] += d.amount || 0;
    }
    return Object.entries(map).filter(([, v]) => v > 0).map(([label, value]) => ({
      label,
      value,
      onClick: () => {
        const filtered = label === 'Not Forecasted'
          ? repDeals.filter(d => !['Commit', 'Upside'].includes((d.forecast_category || '').trim()) && d.stage !== 'Business Won')
          : label === 'Closed Won'
            ? repDeals.filter(d => d.stage === 'Business Won' || (d.forecast_category || '').trim().toLowerCase() === 'closed won')
            : repDeals.filter(d => (d.forecast_category || '').trim() === label);
        openDrill(`${selectedRep} — ${label}`, `${filtered.length} deals`, filtered);
      },
    }));
  }, [repDeals, selectedRep, openDrill]);

  /* ── Pipeline trend approx (rep's share of total weekly pipeline) ── */
  const trendData = useMemo(() => {
    if (!repData || !weekly_trend.length) return [];
    return (rep_weekly_trend[selectedRep] || []).map(w => ({
      label: w.week,
      value: Number(w.active || 0),
    }));
  }, [repData, weekly_trend, rep_weekly_trend, selectedRep]);

  /* ── Stage movements for this rep ── */
  const repMoves = useMemo(() => {
    if (!selectedRep) return [];
    const byId = new Map(deals.map(d => [String(d.record_id), d]));
    const byName = new Map(deals.map(d => [d.deal_name, d]));
    return [
      ...(movement.forward  || []),
      ...(movement.backward || []),
      ...(movement.won      || []),
      ...(movement.lost     || []),
    ].filter(m => m.owner === selectedRep)
     .map(m => {
       const match = byId.get(String(m.record_id)) || byName.get(m.deal_name);
       return match ? { ...match, ...m, deal_name: match.deal_name, company: match.company, stage: m.to_stage || match.stage } : m;
     })
     .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [movement, deals, selectedRep]);

  /* ── Scorecard stats ── */
  const lateStageCount = activeRepDeals.filter(d => LATE_STAGES.includes(d.stage)).length;
  const fwd = repMoves.filter(m => movDir(m) === 'forward').length;
  const bwd = repMoves.filter(m => movDir(m) === 'backward').length;

  const winRatePct = repData
    ? (repData.won_deals + (repData.lost_deals || 0)) > 0
      ? (repData.won_deals / (repData.won_deals + (repData.lost_deals || 0)) * 100).toFixed(1) + '%'
      : '—'
    : '—';

  const isApac   = repData
    ? (repData.team || '').toLowerCase().includes('apj') || (repData.region || '').toLowerCase().includes('asia')
    : false;
  const avatarBg = isApac
    ? 'linear-gradient(135deg,#10b981,#34d399)'
    : 'linear-gradient(135deg,#2563eb,#06b6d4)';

  /* ── Drill helpers ── */
  function openRepDrill(title, filterFn) {
    const filtered = repDeals.filter(filterFn);
    openDrill(`${selectedRep} — ${title}`, `${filtered.length} deals`, filtered);
  }
  function drillStage(stage) {
    const filtered = deals.filter(d => d.stage === stage);
    openDrill(stage, `${filtered.length} deals`, filtered);
  }
  function openRepOverview() {
    const cards = rep_breakdown.map(rep => (
      <div key={rep.owner} className={`rc ${(rep.region || '').toLowerCase().includes('apac') ? 'apac' : 'na'}`} onClick={() => { closeDrill(); setSelectedRep(rep.owner); }}>
        <div className="rc-name">{rep.owner}</div>
        <div className="rc-team">{rep.team || '—'} · {rep.region || '—'}</div>
        <div className="rc-pipe">{fmt(rep.pipeline)}</div>
        <div className="rc-row"><div className="rc-stat"><div className="rc-sv">{rep.deals}</div><div className="rc-sl">Deals</div></div><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--green)' }}>{rep.won_deals}</div><div className="rc-sl">Won</div></div><div className="rc-stat"><div className="rc-sv" style={{ color: 'var(--red)' }}>{rep.lost_deals || 0}</div><div className="rc-sl">Lost</div></div></div>
        <div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click → rep dashboard</div>
      </div>
    ));
    openDrill('Sales Rep Overview — Click a rep to drill', null, null, <div className="rep-grid">{cards}</div>);
  }

  /* ── Render ── */
  return (
    <>
      {/* ── Rep selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>Select Rep:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rep_breakdown.map((rep, i) => (
            <button key={i}
              className={`sbtn${selectedRep === rep.owner ? ' on' : ''}`}
              onClick={() => setSelectedRep(rep.owner)}>
              {rep.owner.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Reference HTML cross-rep charts ── */}
      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={openRepOverview}>
          <div className="pl-card-header"><div className="pl-card-title">Rep Commit vs Upside vs Won — Stacked <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click → rep detail</span></div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Pipeline quality breakdown per rep</div>
          <RepStackChart reps={rep_breakdown} onBarClick={openRepOverview} />
        </div>
        <div className="pl-card pl-card-clickable" onClick={openRepOverview}>
          <div className="pl-card-header"><div className="pl-card-title">Rep Won vs Lost — Click bars → rep detail</div></div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Deal count by outcome, per rep</div>
          <RepWinLossChart reps={rep_breakdown} onBarClick={openRepOverview} />
        </div>
      </div>

      {/* ── Empty state ── */}
      {!selectedRep && (
        <div className="pl-card" style={{ textAlign: 'center', padding: 40, color: 'var(--sub)' }}>
          👆 Select a rep above or click a rep card in the Sales Rep KPIs tab
        </div>
      )}

      {/* ── Rep detail panel ── */}
      {selectedRep && repData && (
        <>
          {/* Avatar header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            marginBottom: 16, padding: '14px 16px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: avatarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>👤</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{selectedRep}</div>
              <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 2 }}>
                {repData.team || '—'} · {repData.region || '—'}
              </div>
            </div>
          </div>

          {/* 6 KPI cards */}
          <div className="krow" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: 14 }}>
            <div className="kc kb"
              onClick={() => openRepDrill('Active Pipeline', d => ACTIVE_STAGES.includes(d.stage))}>
              <div className="kl">Active Pipeline</div>
              <div className="kv" style={{ fontSize: 18, color: 'var(--cyan)' }}>{fmt(repData.pipeline)}</div>
              <div className="click-hint">🔍 Click → deals</div>
            </div>
            <div className="kc kg"
              onClick={() => openRepDrill('Won Deals', d => d.stage === 'Business Won')}>
              <div className="kl">Won YTD</div>
              <div className="kv" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt(repData.won)}</div>
              <div className="click-hint">🔍 Click → won deals</div>
            </div>
            <div className="kc ka"
              onClick={() => openRepDrill('Commit', d => (d.forecast_category || '').trim() === 'Commit' && ACTIVE_STAGES.includes(d.stage))}>
              <div className="kl">Commit</div>
              <div className="kv" style={{ fontSize: 18 }}>{fmt(repData.commit)}</div>
              <div className="click-hint">🔍 Click → commit deals</div>
            </div>
            <div className="kc kp"
              onClick={() => openRepDrill('Upside', d => (d.forecast_category || '').trim() === 'Upside' && ACTIVE_STAGES.includes(d.stage))}>
              <div className="kl">Upside</div>
              <div className="kv" style={{ fontSize: 18 }}>{fmt(repData.upside || 0)}</div>
              <div className="click-hint">🔍 Click → upside deals</div>
            </div>
            {/* Static (no click) matching reference */}
            <div className="kc" style={{ borderTop: '2px solid var(--green)' }}>
              <div className="kl">Won Deals</div>
              <div className="kv" style={{ fontSize: 18, color: 'var(--green)' }}>{repData.won_deals}</div>
            </div>
            <div className="kc" style={{ borderTop: '2px solid var(--red)' }}>
              <div className="kl">Lost Deals</div>
              <div className="kv" style={{ fontSize: 18, color: 'var(--red)' }}>{repData.lost_deals || 0}</div>
            </div>
          </div>

          {/* g3: Pipeline Trend | Stage Distribution | Forecast Split */}
          <div className="g3">
            {/* Pipeline Trend */}
            <div className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-title">
                  Pipeline Trend{' '}
                  <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6 }}>Active pipeline by week</div>
              {trendData.length > 0
                ? <LineChart data={trendData} color={isApac ? '#0891b2' : '#2563eb'} height={160} fill />
                : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>No trend data</div>
              }
            </div>

            {/* Stage Distribution */}
            <div className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-title">
                  Stage Distribution{' '}
                  <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click → stage deals</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6 }}>Current deals by stage</div>
              <DonutChart items={stageDonutItems} radius={70} />
            </div>

            {/* Forecast Split */}
            <div className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-title">
                  Forecast Split{' '}
                  <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click → forecast deals</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6 }}>Commit vs Upside vs Not Forecasted</div>
              <DonutChart items={fcDonutItems} radius={70} />
            </div>
          </div>

          {/* g2: Scorecard | Movements */}
          <div className="g2">
            {/* Rep Scorecard */}
            <div className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-title">Rep Scorecard — Click bars to drill</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Pipeline quality metrics</div>
              <div style={{ marginTop: 8 }}>
                <div className="pw" style={{ cursor: 'pointer' }}
                  onClick={() => openRepDrill('Commit', d => (d.forecast_category || '').trim() === 'Commit' && ACTIVE_STAGES.includes(d.stage))}>
                  <div className="ph"><span className="pn">Commit</span><span className="pv">{fmt(repData.commit)}</span></div>
                  <div className="pb"><div className="pf" style={{ width: `${repData.pipeline ? Math.min(100, repData.commit / repData.pipeline * 100) : 0}%`, background: 'var(--green)' }} /></div>
                </div>
                <div className="pw" style={{ cursor: 'pointer' }}
                  onClick={() => openRepDrill('Upside', d => (d.forecast_category || '').trim() === 'Upside' && ACTIVE_STAGES.includes(d.stage))}>
                  <div className="ph"><span className="pn">Upside</span><span className="pv">{fmt(repData.upside || 0)}</span></div>
                  <div className="pb"><div className="pf" style={{ width: `${repData.pipeline ? Math.min(100, (repData.upside || 0) / repData.pipeline * 100) : 0}%`, background: 'var(--amber)' }} /></div>
                </div>
                <div className="pw" style={{ cursor: 'pointer' }}
                  onClick={() => openRepDrill('Won Deals', d => d.stage === 'Business Won')}>
                  <div className="ph"><span className="pn">Won YTD</span><span className="pv">{fmt(repData.won)}</span></div>
                  <div className="pb"><div className="pf" style={{ width: `${(repData.won + repData.pipeline) > 0 ? Math.min(100, repData.won / (repData.won + repData.pipeline) * 100) : 0}%`, background: 'var(--cyan)' }} /></div>
                </div>
                <div className="dv" />
                <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.8 }}>
                  Win Rate:{' '}
                  <strong style={{ color: 'var(--text)' }}>{winRatePct}</strong>
                  {' '}&nbsp;|&nbsp;{' '}
                  Active Deals:{' '}
                  <strong style={{ color: 'var(--text)' }}>{repData.deals}</strong>
                  {' '}&nbsp;|&nbsp;{' '}
                  Late Stage:{' '}
                  <strong style={{ color: 'var(--text)' }}>{lateStageCount}</strong>
                </div>
                {repMoves.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 4 }}>
                    Movements:{' '}
                    <strong style={{ color: 'var(--green)', cursor: 'pointer' }}
                      onClick={() => openDrill(`${selectedRep} — Forward Moves`, `${fwd} forward`,
                        repMoves.filter(m => movDir(m) === 'forward').map(m => ({
                          ...m, deal_name: m.deal_name, stage: m.to_stage,
                        })))}>
                      ↑{fwd} forward
                    </strong>
                    {' '}&nbsp;|&nbsp;{' '}
                    <strong style={{ color: 'var(--red)', cursor: 'pointer' }}
                      onClick={() => openDrill(`${selectedRep} — Backward Moves`, `${bwd} backward`,
                        repMoves.filter(m => movDir(m) === 'backward').map(m => ({
                          ...m, deal_name: m.deal_name, stage: m.to_stage,
                        })))}>
                      ↓{bwd} backward
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Stage Movements */}
            <div className="pl-card">
              <div className="pl-card-header">
                <div className="pl-card-title">Stage Movements — Click rows for deal detail</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 4 }}>
                This rep's deal movements
              </div>
              <div className="pl-twrap" style={{ marginTop: 4 }}>
                <table>
                  <thead>
                    <tr><th>Dir</th><th>Deal</th><th>From</th><th>To</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {repMoves.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 12, color: '#9ca3af', fontSize: 11 }}>No stage movements this week</td></tr>
                    ) : repMoves.map((m, i) => {
                      const dir = movDir(m);
                      const badge = dir === 'won'
                        ? <span className="b bg">🏆</span>
                        : dir === 'lost'
                          ? <span className="b br">❌</span>
                          : dir === 'forward'
                            ? <span className="b bg">↑</span>
                            : <span className="b br">↓</span>;
                      return (
                        <tr key={i} className="pl-tr-click"
                          onClick={() => openDeal({ ...m, deal_name: m.deal_name, stage: m.to_stage })}>
                          <td>{badge}</td>
                          <td style={{ fontSize: 10 }}>{m.deal_name}</td>
                          <td><StageBadge stage={m.from_stage} /></td>
                          <td><StageBadge stage={m.to_stage} /></td>
                          <td style={{ color: 'var(--blue)', fontWeight: 700 }}>{fmt(m.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* All Deals — full-width, matching reference columns exactly */}
          <div className="pl-card">
            <div className="pl-card-header">
              <div className="pl-card-title">
                All Deals — {selectedRep} — Click any row for full detail
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 4 }}>
              Complete deal list · sorted by amount
            </div>
            <div className="pl-twrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Deal Name</th><th>Company</th><th>Stage</th>
                    <th>Amount</th><th>Weighted</th><th>Forecast</th>
                    <th>Quarter</th><th>Region</th><th>Type</th>
                    <th>Source</th><th>Days Open</th><th>Days Stale</th>
                  </tr>
                </thead>
                <tbody>
                  {repDeals.map((d, i) => (
                    <tr key={d.record_id || i} className="pl-tr-click" onClick={() => openDeal(d)}>
                      <td style={{ fontSize: 10, maxWidth: 180, fontWeight: 600 }}>{d.deal_name}</td>
                      <td className="td2" style={{ fontSize: 10 }}>{d.company}</td>
                      <td><StageBadge stage={d.stage} /></td>
                      <td style={{ fontWeight: 700, color: 'var(--blue)' }}>{fmt(d.amount)}</td>
                      <td className="td2">{fmt(d.weighted)}</td>
                      <td><FcBadge fc={d.forecast_category} /></td>
                      <td className="td2">{d.close_quarter || '—'}</td>
                      <td style={{ fontSize: 10 }}>{d.region || '—'}</td>
                      <td><span className="b bx">{d.order_type || '—'}</span></td>
                      <td className="td2" style={{ fontSize: 10 }}>{d.source || '—'}</td>
                      <td><AgeBadge days={d.days_open} /></td>
                      <td><StaleBadge days={d.days_stale} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && (
        <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={drillStage} />
      )}
    </>
  );
}

export { RepDeepDive };
export default RepDeepDive;
