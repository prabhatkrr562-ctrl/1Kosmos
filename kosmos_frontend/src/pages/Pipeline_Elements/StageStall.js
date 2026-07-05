import { useMemo, useState } from 'react';
import { fmt, StageBadge, FcBadge, DonutChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Identify', '20% - Qualify', '40% - Validate',
  '60% - Propose', '80% - Commit', '90% - Contract',
];

function getBucket(daysStale) {
  if (daysStale === null || daysStale === undefined || daysStale >= 115) return 'never';
  if (daysStale >= 52) return 'long';
  if (daysStale >= 28) return 'medium';
  return 'recent';
}

function getAction(deal) {
  const d = deal.days_stale || 0;
  if ((deal.stage || '').includes('90%') || (deal.stage || '').includes('80%')) return 'Escalate or close';
  if (d >= 115) return 'Disqualify or archive';
  if (d >= 52)  return 'Immediate rep review';
  if (deal.amount >= 500000) return 'Escalate high-value deal';
  return 'Review and update stage';
}

/* ── Staleness SVG donut ── */
function StalenessDonut({ buckets }) {
  const items = [
    { label: 'Never Moved', value: buckets.never.amt, count: buckets.never.cnt },
    { label: 'Long Stall',  value: buckets.long.amt,  count: buckets.long.cnt  },
    { label: 'Medium Stall',value: buckets.medium.amt, count: buckets.medium.cnt },
    { label: 'Moved Recent',value: buckets.recent.amt, count: buckets.recent.cnt },
  ].filter(i => i.value > 0);
  return <DonutChart items={items} radius={75} />;
}

/* ── Stuck by Rep SVG bar chart ── */
function StuckRepChart({ repData, onBarClick }) {
  const top = repData.slice(0, 8);
  if (!top.length) return null;
  const max = Math.max(...top.map(r => r.amt), 1);
  const W = 600, H = 130, pb = 30, pt = 8, pl = 8, pr = 8;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(48, iW / top.length - 8);
  const step = iW / top.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={pt + iH} y2={pt + iH} stroke="#e5e7eb" strokeWidth="1" />
      {top.map((r, i) => {
        const cx = pl + step * i + step / 2;
        const bH = (r.amt / max) * iH;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={pt + iH - bH} width={bw} height={bH} fill="#dc2626" rx={2}
              style={{ cursor: 'pointer' }} onClick={() => onBarClick(r.owner)} />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af"
              style={{ cursor: 'pointer' }} onClick={() => onBarClick(r.owner)}>
              {r.owner.split(' ')[0]}
            </text>
            <text x={cx} y={pt + iH - bH - 4} textAnchor="middle" fontSize="8" fill="#dc2626">{r.cnt}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Stage stall analysis bar chart ── */
function StageStallChart({ stageData, onBarClick }) {
  if (!stageData.length) return null;
  const maxCount = Math.max(...stageData.map(s => s.total), 1);
  const W = 600, H = 130, pb = 28, pt = 8, pl = 8, pr = 8;
  const iW = W - pl - pr, iH = H - pb - pt;
  const bw = Math.min(36, iW / stageData.length / 2 - 4);
  const gap = 3;
  const step = iW / stageData.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pl} x2={W - pr} y1={pt + iH} y2={pt + iH} stroke="#e5e7eb" strokeWidth="1" />
      {stageData.map((s, i) => {
        const cx = pl + step * i + step / 2;
        const totalH = (s.total / maxCount) * iH;
        const staleH = (s.stale / maxCount) * iH;
        return (
          <g key={i}>
            <rect x={cx - bw - gap / 2} y={pt + iH - totalH} width={bw} height={totalH} fill="#e5e7eb" rx={2} />
            {s.stale > 0 && (
              <rect x={cx + gap / 2} y={pt + iH - staleH} width={bw} height={staleH} fill="#dc2626" rx={2}
                style={{ cursor: 'pointer' }} onClick={() => onBarClick(s.stage)} />
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">{s.short}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Movement Velocity mini chart ── */
function VelocityChart({ movement }) {
  const rows = [
    { label: '→ Forward', count: movement.forward?.length || 0, color: '#059669' },
    { label: '← Backward', count: movement.backward?.length || 0, color: '#d97706' },
    { label: '🏆 Won', count: movement.won?.length || 0, color: '#2563eb' },
    { label: '💀 Lost', count: movement.lost?.length || 0, color: '#dc2626' },
  ];
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map((r, i) => (
        <div className="pw" key={i} style={{ cursor: 'default' }}>
          <div className="ph">
            <span className="pn">{r.label}</span>
            <span className="pv" style={{ color: r.color }}>{r.count} deals</span>
          </div>
          <div className="pb">
            <div className="pf" style={{ width: `${(r.count / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StageStall({ data }) {
  const { deals = [], movement = {} } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();
  const [repFilter,    setRepFilter]    = useState('');
  const [stageFilter,  setStageFilter]  = useState('');
  const [bucketFilter, setBucketFilter] = useState('');

  const activeDeals = useMemo(() => deals.filter(d => ACTIVE_STAGES.includes(d.stage)), [deals]);

  const buckets = useMemo(() => {
    const b = { never: { cnt: 0, amt: 0 }, long: { cnt: 0, amt: 0 }, medium: { cnt: 0, amt: 0 }, recent: { cnt: 0, amt: 0 } };
    for (const d of activeDeals) {
      const bk = getBucket(d.days_stale);
      b[bk].cnt += 1;
      b[bk].amt += d.amount || 0;
    }
    return b;
  }, [activeDeals]);

  const staleDeals = useMemo(() =>
    activeDeals.filter(d => getBucket(d.days_stale) === 'never' || getBucket(d.days_stale) === 'long' || getBucket(d.days_stale) === 'medium')
    , [activeDeals]);

  const criticalAmt = staleDeals.reduce((s, d) => s + (d.amount || 0), 0);

  const repData = useMemo(() => {
    const map = {};
    for (const d of staleDeals) {
      const o = d.owner || 'Unknown';
      if (!map[o]) map[o] = { owner: o, cnt: 0, amt: 0 };
      map[o].cnt += 1;
      map[o].amt += d.amount || 0;
    }
    return Object.values(map).sort((a, b) => b.amt - a.amt);
  }, [staleDeals]);

  const STAGE_SHORT = {
    '5% - Identify': '5%', '20% - Qualify': '20%', '40% - Validate': '40%',
    '60% - Propose': '60%', '80% - Commit': '80%', '90% - Contract': '90%',
  };

  const stageData = useMemo(() =>
    ACTIVE_STAGES.map(stage => ({
      stage,
      short: STAGE_SHORT[stage] || stage.slice(0, 4),
      total: activeDeals.filter(d => d.stage === stage).length,
      stale: staleDeals.filter(d => d.stage === stage).length,
    })).filter(s => s.total > 0),
    [activeDeals, staleDeals]
  );

  const allReps = useMemo(() => [...new Set(staleDeals.map(d => d.owner).filter(Boolean))].sort(), [staleDeals]);

  const tableDeals = useMemo(() => {
    let d = staleDeals;
    if (repFilter)    d = d.filter(x => x.owner === repFilter);
    if (stageFilter)  d = d.filter(x => x.stage === stageFilter);
    if (bucketFilter) d = d.filter(x => getBucket(x.days_stale) === bucketFilter);
    return d.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [staleDeals, repFilter, stageFilter, bucketFilter]);

  function handleDrillBucket(bucket) {
    const bd = activeDeals.filter(d => getBucket(d.days_stale) === bucket);
    const labels = { never: 'Never Moved (115+ days)', long: 'Long Stall (52–115 days)', medium: 'Medium Stall (28–52 days)', recent: 'Moved Recently' };
    openDrill(labels[bucket] || bucket, `${bd.length} deals`, bd);
  }

  function handleDrillRep(owner) {
    const rd = staleDeals.filter(d => d.owner === owner);
    openDrill(`${owner} — Stale Deals`, `${rd.length} deals`, rd);
  }

  function handleDrillStage(stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(stage, `${sd.length} deals`, sd);
  }

  function handleStageBar(stage) {
    const sd = staleDeals.filter(d => d.stage === stage);
    openDrill(`${stage} — Stale Deals`, `${sd.length} stale deals`, sd);
  }

  const topOwners = repData.slice(0, 3).map(r => `${r.owner.split(' ')[0]} ${fmt(r.amt)}`).join(' · ');

  return (
    <>
      {/* ── anote ── */}
      <div className="anote">
        📌 <strong>Staleness = Days Since Last Activity</strong> based on CRM last activity date.
        Deals with no activity for <strong>52+ days</strong> are considered stalled and flagged for review.
        Window shows current week snapshot.
      </div>

      {/* ── 4 KPI cards ── */}
      <div className="krow k4">
        <div className="kc kr" onClick={() => handleDrillBucket('never')}>
          <div className="kl">Never Active (115+ days)</div>
          <div className="kv">{buckets.never.cnt}</div>
          <div className="kd"><span className="dn">deals · {fmt(buckets.never.amt)} pipeline</span></div>
          <div className="kh">Zero activity in full window</div>
          <div className="click-hint">🔍 Click → see deals</div>
        </div>
        <div className="kc ko" onClick={() => handleDrillBucket('long')}>
          <div className="kl">Long Stall (52–108 days)</div>
          <div className="kv">{buckets.long.cnt}</div>
          <div className="kd"><span style={{ color: '#f97316' }}>deals · {fmt(buckets.long.amt)} pipeline</span></div>
          <div className="kh">Critical risk — needs immediate action</div>
          <div className="click-hint">🔍 Click → see deals</div>
        </div>
        <div className="kc ka" onClick={() => handleDrillBucket('medium')}>
          <div className="kl">Medium Stall (28–52 days)</div>
          <div className="kv">{buckets.medium.cnt}</div>
          <div className="kd"><span className="fl">deals · {fmt(buckets.medium.amt)} pipeline</span></div>
          <div className="kh">Warrants close monitoring</div>
          <div className="click-hint">🔍 Click → see deals</div>
        </div>
        <div className="kc kg" onClick={() => handleDrillBucket('recent')}>
          <div className="kl">Active Recently (1–27 days)</div>
          <div className="kv">{buckets.recent.cnt}</div>
          <div className="kd"><span className="up">deals · {fmt(buckets.recent.amt)} pipeline</span></div>
          <div className="kh">Activity within last 4 weeks</div>
          <div className="click-hint">🔍 Click → see deals</div>
        </div>
      </div>

      {/* ── Critical Alert ── */}
      {staleDeals.length > 0 && (
        <div className="pl-alert">
          🔴 <strong>Critical:</strong> {staleDeals.length} deals ({fmt(criticalAmt)} = {kpis(data, criticalAmt)}% of active pipeline) have had <strong>no activity for 28+ days</strong>. This is the primary pipeline quality risk.{topOwners ? ` Top owners: ${topOwners}.` : ''}
        </div>
      )}

      {/* ── g2: Staleness donut + Stuck by Rep ── */}
      <div className="g2">
        <div className="pl-card pl-card-clickable" onClick={() => handleDrillBucket('never')}>
          <div className="pl-card-header">
            <div className="pl-card-title">Pipeline by Stage-Movement Staleness <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click → deals</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>How much pipeline is stuck at each staleness level</div>
          <StalenessDonut buckets={buckets} />
        </div>
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Stuck Pipeline by Rep (52+ days) <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click bar → rep deals</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>Who owns the most stagnant pipeline</div>
          <StuckRepChart repData={repData} onBarClick={handleDrillRep} />
        </div>
      </div>

      {/* ── g2: Stage stall analysis + Velocity ── */}
      <div className="g2">
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Stage Stall Analysis — Where Deals Get Stuck <span style={{ fontSize: 9, color: 'var(--cyan)' }}>↗ Click bar → stage deals</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>52+ days no activity · by stage · grey = total · red = stale</div>
          <StageStallChart stageData={stageData} onBarClick={handleStageBar} />
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: 'var(--sub)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 6, background: '#e5e7eb', marginRight: 4, verticalAlign: 'middle' }} />Total stage pipeline</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 6, background: '#dc2626', marginRight: 4, verticalAlign: 'middle' }} />Stale deals (52+ days)</span>
          </div>
        </div>
        <div className="pl-card">
          <div className="pl-card-header">
            <div className="pl-card-title">Movement Velocity ↗ Click → movement detail</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 8 }}>
            {(movement.forward?.length || 0) + (movement.backward?.length || 0) + (movement.won?.length || 0) + (movement.lost?.length || 0)} deals changed stage · breakdown by direction
          </div>
          <VelocityChart movement={movement} />
        </div>
      </div>

      {/* ── Stale Deal Register ── */}
      <div className="pl-card">
        <div className="pl-card-header">
          <div className="pl-card-title">🔴 Stale Deal Register — No Activity in 28+ Days · Click any row for full detail</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10 }}>
          {staleDeals.length} deals · {fmt(criticalAmt)} pipeline · Sorted by pipeline value
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="pl-filter-bar" value={repFilter} onChange={e => setRepFilter(e.target.value)} style={{ height: 32 }}>
            <option value="">All Reps</option>
            {allReps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="pl-filter-bar" value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ height: 32 }}>
            <option value="">All Stages</option>
            {ACTIVE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="pl-filter-bar" value={bucketFilter} onChange={e => setBucketFilter(e.target.value)} style={{ height: 32 }}>
            <option value="">All Staleness</option>
            <option value="never">Never Active (115d+)</option>
            <option value="long">Long Stall (52–115d)</option>
            <option value="medium">Medium Stall (28–52d)</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>{tableDeals.length} deals · {fmt(tableDeals.reduce((s, d) => s + (d.amount || 0), 0))}</span>
        </div>
        <div className="pl-twrap">
          <table>
            <thead>
              <tr>
                <th>Risk</th><th>Deal Name</th><th>Company</th><th>Stage</th>
                <th>Amount</th><th>Owner</th><th>Region</th><th>Forecast</th>
                <th>Quarter</th><th>Days Stale</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableDeals.map((d, i) => {
                const bk = getBucket(d.days_stale);
                const [rColor, rLabel] =
                  bk === 'never' ? ['#dc2626', '🔴 Critical'] :
                  bk === 'long'  ? ['#f97316', '🟠 High Risk'] :
                  ['#d97706', '🟡 Watch'];
                return (
                  <tr key={i} className="pl-tr-click" onClick={() => openDeal(d)}>
                    <td><span style={{ fontSize: 10, color: rColor, fontWeight: 600 }}>{rLabel}</span></td>
                    <td style={{ fontSize: 10, fontWeight: 600, maxWidth: 150 }} title={d.deal_name}>{d.deal_name}</td>
                    <td style={{ fontSize: 10, color: 'var(--sub)' }}>{d.company || '—'}</td>
                    <td><StageBadge stage={d.stage} /></td>
                    <td style={{ color: '#2563eb', fontWeight: 700, fontSize: 11 }}>{fmt(d.amount)}</td>
                    <td style={{ fontSize: 10 }}>{d.owner || '—'}</td>
                    <td style={{ fontSize: 10, color: 'var(--sub)' }}>{d.region || '—'}</td>
                    <td><FcBadge fc={d.forecast_category} /></td>
                    <td style={{ fontSize: 10 }}>{d.close_quarter || '—'}</td>
                    <td><span style={{ fontSize: 10, color: rColor, fontWeight: 700 }}>{d.days_stale != null ? `${d.days_stale}d` : '—'}</span></td>
                    <td style={{ fontSize: 9, color: 'var(--sub)' }}>{getAction(d)}</td>
                  </tr>
                );
              })}
              {tableDeals.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--sub)', padding: '20px 0', fontSize: 12 }}>No stale deals matching current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

function kpis(data, amt) {
  const total = data.kpis?.active_pipeline || 1;
  return (amt / total * 100).toFixed(0);
}

export { StageStall };
export default StageStall;
