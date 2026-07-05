import { useState, useEffect, useCallback } from 'react';
import { fmt, fmtN, Card, StageBadge, FcBadge, STAGE_ORDER } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

/* ── Stage shorthands for matrix headers ── */
const STAGE_SHORT_MX = {
  '5% - Prospecting':       '5%',
  '20%-Discovery':           '20%',
  '40%-Scoping':             '40%',
  '60%-Propose':             '60%',
  '80%-Validate':            '80%',
  '90%-Negotiate & Close':   '90%',
  'Business Won':            'Won',
  'Business Lost':           'Lost',
};

const MATRIX_STAGES = STAGE_ORDER; // all 8 stages shown in matrix

function dirOf(from, to) {
  if (to === 'Business Won')  return 'won';
  if (to === 'Business Lost') return 'lost';
  const fi = STAGE_ORDER.indexOf(from);
  const ti = STAGE_ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return 'unknown';
  return ti > fi ? 'forward' : 'backward';
}

/* ── Clickable KPI card (movement style) ── */
function MvKpi({ label, value, sub, subClass, color, onClick }) {
  return (
    <div
      className={`pl-kpi ${color}${onClick ? ' pl-card-clickable' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="pl-kpi-label">{label}</div>
      <div className="pl-kpi-value">{value}</div>
      {sub && <div className={`pl-kpi-sub ${subClass || ''}`}>{sub}</div>}
      {onClick && <div className="pl-click-hint">🔍 Click → see deals</div>}
    </div>
  );
}

/* ── Movement table (used inside DrillModal children) ── */
function MovementTable({ moves, onDealClick }) {
  const total = moves.reduce((s, m) => s + (m.amount || 0), 0);
  return (
    <>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
        {moves.length} movements ·{' '}
        <span style={{ color: '#2563eb', fontWeight: 700 }}>{fmt(total)}</span> pipeline value
      </div>
      <div className="pl-twrap">
        <table>
          <thead>
            <tr>
              <th>Dir</th><th>Deal Name</th><th>Company</th>
              <th>From</th><th style={{ color: '#9ca3af' }}>→</th><th>To</th>
              <th>Amount</th><th>Owner</th><th>Region</th><th>Forecast</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m, i) => {
              const dir = dirOf(m.from_stage, m.to_stage);
              const dirBadge =
                dir === 'won'      ? <span className="b bg">🏆 Won</span>
                : dir === 'lost'   ? <span className="b bx">❌ Lost</span>
                : dir === 'forward'? <span className="b bg">↑ Fwd</span>
                :                    <span className="b br">↓ Back</span>;
              return (
                <tr key={i} onClick={() => onDealClick(m)} style={{ cursor: 'pointer' }}>
                  <td>{dirBadge}</td>
                  <td style={{ fontSize: 10, fontWeight: 600, maxWidth: 160 }}>{m.deal_name}</td>
                  <td className="td2" style={{ fontSize: 10 }}>{m.company || '—'}</td>
                  <td><span className="b bx" style={{ fontSize: 9 }}>{m.from_stage}</span></td>
                  <td style={{ color: '#9ca3af' }}>→</td>
                  <td><StageBadge stage={m.to_stage} /></td>
                  <td style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(m.amount)}</td>
                  <td className="td2" style={{ fontSize: 10 }}>{m.owner}</td>
                  <td className="td2" style={{ fontSize: 10 }}>{m.region || '—'}</td>
                  <td><FcBadge fc={m.forecast_category} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Rep bar chart (SVG) ── */
function RepBarChart({ moves, height = 160 }) {
  const repTotals = {};
  moves.forEach(m => {
    if (m.owner) repTotals[m.owner] = (repTotals[m.owner] || 0) + 1;
  });
  const items = Object.entries(repTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (!items.length) return null;
  const maxV = items[0][1];
  const W = 500, H = height;
  const pad = { l: 90, r: 30, t: 10, b: 10 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;
  const rowH = iH / items.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {items.map(([rep, cnt], i) => {
        const bW = (cnt / maxV) * iW;
        const y  = pad.t + i * rowH;
        const shortName = rep.split(' ').map((w, j) => j === 0 ? w : w[0] + '.').join(' ');
        return (
          <g key={i}>
            <text x={pad.l - 6} y={y + rowH / 2 + 4} textAnchor="end" fontSize="9" fill="#6b7280">{shortName}</text>
            <rect x={pad.l} y={y + 3} width={Math.max(bW, 2)} height={rowH - 6} fill="#2563eb" opacity=".75" rx="2" />
            <text x={pad.l + bW + 4} y={y + rowH / 2 + 4} fontSize="9" fill="#374151" fontWeight="600">{cnt}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

function DealMovement({ data }) {
  const weeks = data.weeks || data.filters?.weeks || [];

  const initPrev  = data.movement?.prev_week    || (weeks.length >= 2 ? weeks[weeks.length - 2] : '');
  const initTo    = data.movement?.to_week || data.selected_week || (weeks.length >= 1 ? weeks[weeks.length - 1] : '');

  const [fromWeek,  setFromWeek]  = useState(initPrev);
  const [toWeek,    setToWeek]    = useState(initTo);
  const [mvData,    setMvData]    = useState(data.movement || {});
  const [mvLoading, setMvLoading] = useState(false);
  const [dirFilter, setDirFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');

  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage } = useDrill();

  const fetchMovement = useCallback(async (fw, tw) => {
    if (!fw || !tw || fw === tw) return;
    setMvLoading(true);
    try {
      const params = new URLSearchParams({ from_week: fw, to_week: tw });
      const res    = await fetch(`/api/pipeline/movement/?${params}`, { credentials: 'include' });
      const d      = await res.json();
      setMvData(d.movement || {});
    } catch (_) {
      /* keep existing */
    } finally {
      setMvLoading(false);
    }
  }, []);

  const handleFrom = (w) => { setFromWeek(w); fetchMovement(w, toWeek); };
  const handleTo   = (w) => { setToWeek(w);   fetchMovement(fromWeek, w); };

  /* ── Sync when parent data changes (e.g. filter change) ── */
  useEffect(() => {
    setMvData(data.movement || {});
  }, [data.movement]);

  const {
    matrix   = {},
    forward  = [],
    backward = [],
    won      = [],
    lost     = [],
    new: newDeals = [],
  } = mvData;

  const allMoves = [
    ...forward.map(m => ({ ...m, _dir: 'forward' })),
    ...backward.map(m => ({ ...m, _dir: 'backward' })),
    ...won.map(m => ({ ...m, _dir: 'won' })),
    ...lost.map(m => ({ ...m, _dir: 'lost' })),
  ];

  const filteredMoves = allMoves
    .filter(m => !dirFilter || m._dir === dirFilter)
    .filter(m => !repFilter || m.owner === repFilter)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0));

  const reps = [...new Set(allMoves.map(m => m.owner).filter(Boolean))].sort();

  const fwdTotal  = forward.reduce((s, m)  => s + m.amount, 0);
  const bwdTotal  = backward.reduce((s, m) => s + m.amount, 0);
  const wonTotal  = won.reduce((s, m)      => s + m.amount, 0);
  const lostTotal = lost.reduce((s, m)     => s + m.amount, 0);
  const total     = allMoves.length;

  const fromLabel = fromWeek?.replace('Week ', 'W') || '?';
  const toLabel   = toWeek?.replace('Week ', 'W')   || '?';

  /* ── Open drill with movement table as children ── */
  const drillMoves = (moves, title, sub) => {
    openDrill(title, sub, null,
      <MovementTable moves={[...moves].sort((a, b) => (b.amount || 0) - (a.amount || 0))} onDealClick={openDeal} />
    );
  };

  /* ── Matrix cell click ── */
  const handleMatrixCell = (from, to) => {
    const cellMoves = allMoves.filter(m => m.from_stage === from && m.to_stage === to);
    if (!cellMoves.length) return;
    drillMoves(cellMoves, `${from} → ${to}`, `${cellMoves.length} deals moved between these stages`);
  };

  /* ── Matrix cell class ── */
  const cellClass = (from, to) => {
    const dir = dirOf(from, to);
    if (dir === 'forward')  return 'mfwd';
    if (dir === 'backward') return 'mbwd';
    if (dir === 'won')      return 'mwon';
    if (dir === 'lost')     return 'mlost';
    return '';
  };

  const cellArrow = (dir) =>
    dir === 'forward' ? '↑' : dir === 'backward' ? '↓' : dir === 'won' ? '🏆' : '❌';

  return (
    <>
      {/* ── Week From/To selector ── */}
      <div className="mv-week-bar">
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 700 }}>📅 Compare Weeks:</span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>
          Shows deals that changed stage between the two selected weeks
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>From:</label>
          <select className="mv-select" value={fromWeek} onChange={e => handleFrom(e.target.value)}>
            <option value="">— Select —</option>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>To:</label>
          <select className="mv-select" value={toWeek} onChange={e => handleTo(e.target.value)}>
            <option value="">— Select —</option>
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <span className="mv-period-label">{fromLabel} → {toLabel}</span>
        {mvLoading && <span style={{ fontSize: 11, color: '#0891b2' }}>Loading…</span>}
      </div>

      {/* ── Alert banner ── */}
      <div className="pl-extra-alert">
        🔄 <strong>{fromLabel}→{toLabel} Deal Movement Analysis — Every cell and row is clickable.</strong>{' '}
        Click matrix cells to see deals that moved between those stages.{' '}
        <strong>{total} deals changed stage</strong>{' '}
        — {won.length} won, {lost.length} lost, {forward.length} forward, {backward.length} backward.
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="pl-kpi-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MvKpi
          label="Moved Forward"
          value={forward.length}
          sub={`${forward.length} deals advanced stage`}
          subClass="up"
          color="k-green"
          onClick={() => drillMoves(forward, `Forward Progressions — ${fromLabel}→${toLabel}`, `${forward.length} deals advanced · sorted by amount`)}
        />
        <MvKpi
          label="Moved Backward"
          value={backward.length}
          sub={`${backward.length} deals regressed`}
          subClass="dn"
          color="k-red"
          onClick={() => drillMoves(backward, `Backward Slippage — ${fromLabel}→${toLabel}`, `${backward.length} deals slipped · sorted by amount`)}
        />
        <MvKpi
          label="Closed Won This Week"
          value={won.length}
          sub={`${fmt(wonTotal)} new bookings`}
          subClass="up"
          color="k-amber"
          onClick={() => drillMoves(won, `Deals Closed Won — ${toLabel}`, `${won.length} deals closed won`)}
        />
        <MvKpi
          label="Moved to Lost"
          value={lost.length}
          sub={`${lost.length} deals moved to lost`}
          subClass="dn"
          color="k-cyan"
          onClick={() => drillMoves(lost, `Deals Lost — ${toLabel}`, `${lost.length} deals lost · ${fmt(lostTotal)}`)}
        />
      </div>

      {/* ── 2-col: Matrix + Rep Summary ── */}
      <div className="pl-2col">
        {/* Stage Transition Matrix */}
        <Card
          title={`Stage Transition Matrix — ${fromLabel} → ${toLabel}`}
          tag="Click any cell → see deals that made that transition"
        >
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table className="mtbl">
              <thead>
                <tr>
                  <th className="rl">From \ To</th>
                  {MATRIX_STAGES.map(s => (
                    <th key={s}>{STAGE_SHORT_MX[s]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_STAGES.map(from => (
                  <tr key={from}>
                    <td className="rl">{STAGE_SHORT_MX[from]}</td>
                    {MATRIX_STAGES.map(to => {
                      if (from === to) return <td key={to} className="mzero">—</td>;
                      const count = matrix[from]?.[to] || 0;
                      if (!count) return <td key={to} className="mzero">—</td>;
                      const dir = dirOf(from, to);
                      return (
                        <td
                          key={to}
                          className={cellClass(from, to)}
                          onClick={() => handleMatrixCell(from, to)}
                          title={`${from} → ${to}: ${count} deals`}
                        >
                          {cellArrow(dir)}{count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 6 }}>
            Row = From stage · Column = To stage · Click any non-zero cell for deal details
          </div>
        </Card>

        {/* Movement by Rep + Impact Summary */}
        <Card title="Movement by Rep" tag="Stage changes per rep this period">
          <RepBarChart moves={allMoves} height={140} />
          <div style={{ height: 1, background: '#e5e7eb', margin: '12px 0 10px' }} />
          <div className="pl-card-title" style={{ marginBottom: 8 }}>Pipeline Impact Summary</div>
          <div className="pl-twrap">
            <table>
              <thead>
                <tr><th>Type</th><th>Deals</th><th>Value</th><th>Impact</th></tr>
              </thead>
              <tbody>
                <tr
                  onClick={() => drillMoves(forward, `Forward Progressions — ${fromLabel}→${toLabel}`, `${forward.length} deals`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><span className="b bg">↑ Forward</span></td>
                  <td className="td2">{forward.length}</td>
                  <td className="up">{fmt(fwdTotal)}</td>
                  <td><span className="b bg">Positive</span></td>
                </tr>
                <tr
                  onClick={() => drillMoves(backward, `Backward Slippage — ${fromLabel}→${toLabel}`, `${backward.length} deals`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><span className="b br">↓ Backward</span></td>
                  <td className="td2">{backward.length}</td>
                  <td className="dn">{fmt(bwdTotal)}</td>
                  <td><span className="b br">At Risk</span></td>
                </tr>
                <tr
                  onClick={() => drillMoves(won, `Deals Closed Won — ${toLabel}`, `${won.length} deals`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><span className="b ba">🏆 Won</span></td>
                  <td className="td2">{won.length}</td>
                  <td style={{ color: '#d97706', fontWeight: 700 }}>{fmt(wonTotal)}</td>
                  <td><span className="b ba">Booked</span></td>
                </tr>
                <tr
                  onClick={() => drillMoves(lost, `Deals Lost — ${toLabel}`, `${lost.length} deals`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><span className="b bx">❌ Lost</span></td>
                  <td className="td2">{lost.length}</td>
                  <td className="dn">{fmt(lostTotal)}</td>
                  <td><span className="b br">Lost</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Full-width: All Stage Movements ── */}
      <Card title={`All Stage Movements ${fromLabel}→${toLabel} — Click any row for full deal detail`} tag="Every deal that changed stage · colour coded by direction">
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="mv-select" value={dirFilter} onChange={e => setDirFilter(e.target.value)}>
            <option value="">All Movements</option>
            <option value="forward">Forward Only</option>
            <option value="backward">Backward Only</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          <select className="mv-select" value={repFilter} onChange={e => setRepFilter(e.target.value)}>
            <option value="">All Reps</option>
            {reps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{filteredMoves.length} movements</span>
        </div>

        <div className="pl-twrap">
          <table>
            <thead>
              <tr>
                <th>Dir</th><th>Deal Name</th><th>Company</th>
                <th>From Stage</th><th style={{ color: '#9ca3af' }}>→</th><th>To Stage</th>
                <th>Amount</th><th>Owner</th><th>Region</th><th>Forecast</th>
              </tr>
            </thead>
            <tbody>
              {filteredMoves.map((m, i) => {
                const dirBadge =
                  m._dir === 'won'      ? <span className="b bg">🏆 Won</span>
                  : m._dir === 'lost'   ? <span className="b bx">❌ Lost</span>
                  : m._dir === 'forward'? <span className="b bg">↑ Fwd</span>
                  :                       <span className="b br">↓ Back</span>;
                return (
                  <tr key={i} onClick={() => openDeal(m)} style={{ cursor: 'pointer' }}>
                    <td>{dirBadge}</td>
                    <td style={{ fontSize: 10, maxWidth: 160, fontWeight: 600 }}>{m.deal_name}</td>
                    <td className="td2" style={{ fontSize: 10 }}>{m.company || '—'}</td>
                    <td><span className="b bx" style={{ fontSize: 9 }}>{m.from_stage}</span></td>
                    <td style={{ color: '#9ca3af' }}>→</td>
                    <td><StageBadge stage={m.to_stage} /></td>
                    <td style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(m.amount)}</td>
                    <td className="td2" style={{ fontSize: 10 }}>{m.owner}</td>
                    <td className="td2" style={{ fontSize: 10 }}>{m.region || '—'}</td>
                    <td><FcBadge fc={m.forecast_category} /></td>
                  </tr>
                );
              })}
              {!filteredMoves.length && (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>
                    No movements match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Drill & Deal Modals ── */}
      {drill && (
        <DrillModal
          title={drill.title}
          sub={drill.sub}
          deals={drill.deals}
          onClose={closeDrill}
          onDealClick={openDeal}
        >
          {drill.children}
        </DrillModal>
      )}
      {activeDeal && (
        <DealModal
          deal={activeDeal}
          onClose={closeDeal}
          onDrillStage={(stage) => {
            closeDeal();
            const stageDeals = allMoves.filter(m => m.stage === stage || m.to_stage === stage);
            openDrill(`${stage} — Movements`, `${stageDeals.length} deals currently in this stage`, null,
              <MovementTable moves={stageDeals} onDealClick={openDeal} />
            );
          }}
        />
      )}
    </>
  );
}

export { DealMovement };
export default DealMovement;
