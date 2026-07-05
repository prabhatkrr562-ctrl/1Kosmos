import { useMemo } from 'react';
import { fmt, Card } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Identify', '20% - Qualify', '40% - Validate',
  '60% - Propose', '80% - Commit', '90% - Contract',
];

function RepKpis({ data }) {
  const { rep_breakdown, deals = [] } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const repDealsMap = useMemo(() => {
    const map = {};
    for (const d of deals) {
      if (!map[d.owner]) map[d.owner] = [];
      map[d.owner].push(d);
    }
    return map;
  }, [deals]);

  function repAvgCycle(owner) {
    const rDeals = (repDealsMap[owner] || []).filter(d => d.days_open > 0);
    if (!rDeals.length) return null;
    return Math.round(rDeals.reduce((s, d) => s + d.days_open, 0) / rDeals.length);
  }

  const byWon  = useMemo(() => [...rep_breakdown].sort((a, b) => b.won - a.won),   [rep_breakdown]);
  const byDeals = useMemo(() => [...rep_breakdown].sort((a, b) => b.deals - a.deals), [rep_breakdown]);
  const byLost = useMemo(() => [...rep_breakdown].sort((a, b) => (b.lost_deals || 0) - (a.lost_deals || 0)), [rep_breakdown]);

  function handleDrillRep(rep) {
    const allRepDeals  = repDealsMap[rep.owner] || [];
    const activeDeals  = allRepDeals.filter(d => ACTIVE_STAGES.includes(d.stage));
    const wonDeals     = allRepDeals.filter(d => d.stage === 'Business Won');
    const lostDeals    = allRepDeals.filter(d => d.stage === 'Business Lost');
    const commitDeals  = allRepDeals.filter(d =>
      (d.forecast_category || '').trim() === 'Commit' && ACTIVE_STAGES.includes(d.stage));
    const upsideDeals  = allRepDeals.filter(d =>
      (d.forecast_category || '').trim() === 'Upside' && ACTIVE_STAGES.includes(d.stage));
    const activePipeline = activeDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const upsideAmt    = rep.upside != null ? rep.upside : upsideDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const lostCount    = rep.lost_deals != null ? rep.lost_deals : lostDeals.length;
    const winRatePct   = (rep.won_deals + lostCount) > 0
      ? (rep.won_deals / (rep.won_deals + lostCount) * 100).toFixed(1) + '%'
      : '—';
    const isApac = (rep.team || '').toLowerCase().includes('apj')
      || (rep.region || '').toLowerCase().includes('asia')
      || (rep.region || '').toLowerCase().includes('pacific');
    const avatarBg = isApac
      ? 'linear-gradient(135deg,#10b981,#34d399)'
      : 'linear-gradient(135deg,#2563eb,#06b6d4)';

    const content = (
      <>
        <div className="rep-drill-hdr">
          <div className="rep-drill-ava" style={{ background: avatarBg }}>👤</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{rep.owner}</div>
            <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 2 }}>
              {rep.team || '—'} · {rep.region || '—'}
            </div>
          </div>
        </div>
        <div className="rep-drill-kpis">
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--blue)' }}
            onClick={() => openDrill(`${rep.owner} — Active Pipeline`, `${activeDeals.length} active deals`, activeDeals)}>
            <div className="rep-mkpi-v" style={{ color: 'var(--blue)' }}>{fmt(activePipeline)}</div>
            <div className="rep-mkpi-l">Active Pipeline</div>
            <div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div>
          </div>
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--green)' }}
            onClick={() => openDrill(`${rep.owner} — Won YTD`, `${wonDeals.length} wins`, wonDeals)}>
            <div className="rep-mkpi-v" style={{ color: 'var(--green)' }}>{fmt(rep.won)}</div>
            <div className="rep-mkpi-l">Won YTD</div>
            <div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div>
          </div>
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--amber)' }}
            onClick={() => openDrill(`${rep.owner} — Commit`, `${commitDeals.length} commit deals`, commitDeals)}>
            <div className="rep-mkpi-v">{fmt(rep.commit)}</div>
            <div className="rep-mkpi-l">Commit</div>
            <div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div>
          </div>
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--purple)' }}
            onClick={() => openDrill(`${rep.owner} — Upside`, `${upsideDeals.length} upside deals`, upsideDeals)}>
            <div className="rep-mkpi-v" style={{ color: 'var(--purple)' }}>{fmt(upsideAmt)}</div>
            <div className="rep-mkpi-l">Upside</div>
            <div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div>
          </div>
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--green)' }}>
            <div className="rep-mkpi-v" style={{
              fontSize: 18, fontWeight: 900,
              color: parseFloat(winRatePct) >= 20 ? 'var(--green)' : 'var(--amber)',
            }}>{winRatePct}</div>
            <div className="rep-mkpi-l">Win Rate #</div>
          </div>
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--red)' }}
            onClick={() => openDrill(`${rep.owner} — Lost Deals`, `${lostCount} lost`, lostDeals)}>
            <div className="rep-mkpi-v" style={{ color: 'var(--red)' }}>{fmt(rep.lost)}</div>
            <div className="rep-mkpi-l">Lost ({lostCount})</div>
            <div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div>
          </div>
        </div>
      </>
    );

    openDrill(rep.owner, `${rep.deals} active · ${fmt(rep.pipeline)}`, activeDeals, content);
  }

  function handleDrillStage(stage) {
    const stageDeals = deals.filter(d => d.stage === stage);
    openDrill(stage, `${stageDeals.length} deals`, stageDeals);
  }

  const topPipeline = rep_breakdown[0];

  return (
    <>
      <div className="anote">
        📌 <strong>Click any rep card</strong> → see that rep's deal pipeline.
        Click mini KPI cards inside the panel → drill into specific deal categories.
      </div>

      {/* 4 Hero KPI cards */}
      <div className="krow k4">
        <div className="kc kb" onClick={() => rep_breakdown[0] && handleDrillRep(rep_breakdown[0])}>
          <div className="kl">Top Pipeline Rep</div>
          <div className="kv" style={{ fontSize: 16 }}>{rep_breakdown[0]?.owner || '—'}</div>
          <div className="kd">
            <span className="up">{fmt(rep_breakdown[0]?.pipeline || 0)} active · {rep_breakdown[0]?.deals || 0} deals</span>
          </div>
          <div className="pl-click-hint">🔍 Click → rep dashboard</div>
        </div>
        <div className="kc kg" onClick={() => byWon[0] && handleDrillRep(byWon[0])}>
          <div className="kl">Top Closer</div>
          <div className="kv" style={{ fontSize: 16 }}>{byWon[0]?.owner || '—'}</div>
          <div className="kd">
            <span className="up">{byWon[0]?.won_deals || 0} wins · {fmt(byWon[0]?.won || 0)}</span>
          </div>
          <div className="pl-click-hint">🔍 Click → rep dashboard</div>
        </div>
        <div className="kc ka" onClick={() => byDeals[0] && handleDrillRep(byDeals[0])}>
          <div className="kl">Most Active Deals</div>
          <div className="kv" style={{ fontSize: 16 }}>{byDeals[0]?.owner || '—'}</div>
          <div className="kd">
            <span className="fl">{byDeals[0]?.deals || 0} active deals · {fmt(byDeals[0]?.pipeline || 0)}</span>
          </div>
          <div className="pl-click-hint">🔍 Click → rep dashboard</div>
        </div>
        <div className="kc kr" onClick={() => byLost[0] && handleDrillRep(byLost[0])}>
          <div className="kl">Most Losses</div>
          <div className="kv" style={{ fontSize: 16 }}>{byLost[0]?.owner || '—'}</div>
          <div className="kd">
            <span className="dn">{byLost[0]?.lost_deals || 0} deals lost YTD</span>
          </div>
          <div className="pl-click-hint">🔍 Click → rep dashboard</div>
        </div>
      </div>

      {/* Rep Card Grid */}
      <div className="rep-grid">
        {rep_breakdown.map((rep, i) => {
          const teamLower   = (rep.team || '').toLowerCase();
          const regionLower = (rep.region || '').toLowerCase();
          const isApac = teamLower.includes('apj')
            || regionLower.includes('asia')
            || regionLower.includes('pacific');
          const lostCount = rep.lost_deals || 0;
          const winPct = (rep.won_deals + lostCount) > 0
            ? (rep.won_deals / (rep.won_deals + lostCount) * 100).toFixed(1) + '%'
            : '—';
          const winPctVal = (rep.won + rep.lost) > 0
            ? (rep.won / (rep.won + rep.lost) * 100).toFixed(1) + '%'
            : '—';
          const avgCycle = repAvgCycle(rep.owner);
          const pipeRatio = Math.min(rep.pipeline / (topPipeline?.pipeline || 1) * 100, 100);
          const barH = Math.max(6, Math.round(pipeRatio * 0.22));

          return (
            <div key={i} className={`rc ${isApac ? 'apac' : 'na'}`} onClick={() => handleDrillRep(rep)}>
              <div className="rc-name">{rep.owner}</div>
              <div className="rc-team">{rep.team || '—'} · {rep.region || '—'}</div>
              <div className="rc-pipe">{fmt(rep.pipeline)}</div>
              <div className="rc-row">
                <div className="rc-stat">
                  <div className="rc-sv">{rep.deals}</div>
                  <div className="rc-sl">Deals</div>
                </div>
                <div className="rc-stat">
                  <div className="rc-sv" style={{ color: 'var(--green)' }}>{rep.won_deals}</div>
                  <div className="rc-sl">Won</div>
                </div>
                <div className="rc-stat">
                  <div className="rc-sv" style={{ color: 'var(--red)' }}>{lostCount}</div>
                  <div className="rc-sl">Lost</div>
                </div>
                <div className="rc-stat">
                  <div className="rc-sv" style={{ fontSize: 11 }}>{winPct}</div>
                  <div className="rc-sl">Win%#</div>
                </div>
                <div className="rc-stat">
                  <div className="rc-sv" style={{
                    fontSize: 11,
                    color: parseFloat(winPctVal) >= 20 ? 'var(--green)' : 'var(--amber)',
                  }}>{winPctVal}</div>
                  <div className="rc-sl">Win%$</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 5 }}>
                Won: <strong style={{ color: 'var(--green)' }}>{fmt(rep.won)}</strong>
                {' · '}Commit: <strong>{fmt(rep.commit)}</strong>
                {avgCycle != null && (
                  <> · Avg Cycle: <strong style={{ color: 'var(--cyan)' }}>{avgCycle}d</strong></>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, marginTop: 6 }}>
                {[0, 1, 2, 3, 4, 5].map(j => (
                  <div key={j} style={{
                    height: `${barH}px`, background: '#2563eb',
                    flex: 1, borderRadius: 1, opacity: 0.7,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 8, color: 'var(--sub)', marginTop: 2 }}>
                Pipeline (relative to top rep)
              </div>
              <div className="pl-click-hint" style={{ marginTop: 4 }}>🔍 Click → full rep dashboard</div>
            </div>
          );
        })}
      </div>

      {/* Performance Table */}
      <Card title="Rep Performance Table">
        <div className="pl-twrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Rep</th><th>Team</th><th>Region</th>
                <th>Pipeline ($)</th><th>Deals</th><th>Weighted ($)</th>
                <th>Won ($)</th><th>Won #</th><th>Lost #</th>
                <th>Commit ($)</th><th>Lost ($)</th><th>Win%#</th><th>Win%$</th>
              </tr>
            </thead>
            <tbody>
              {rep_breakdown.map((r, i) => {
                const lc = r.lost_deals || 0;
                const wp = (r.won_deals + lc) > 0
                  ? (r.won_deals / (r.won_deals + lc) * 100).toFixed(1) + '%' : '—';
                const wv = (r.won + r.lost) > 0
                  ? (r.won / (r.won + r.lost) * 100).toFixed(1) + '%' : '—';
                return (
                  <tr key={i} className="pl-tr-click" onClick={() => handleDrillRep(r)}>
                    <td style={{ color: '#9ca3af', fontSize: 10 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{r.owner}</td>
                    <td style={{ fontSize: 11 }}>{r.team || '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.region || '—'}</td>
                    <td className="c-blue">{fmt(r.pipeline)}</td>
                    <td>{r.deals}</td>
                    <td style={{ color: 'var(--purple)' }}>{fmt(r.weighted)}</td>
                    <td className="c-green">{fmt(r.won)}</td>
                    <td>{r.won_deals}</td>
                    <td className="c-red">{lc}</td>
                    <td>{fmt(r.commit)}</td>
                    <td className="c-red">{fmt(r.lost)}</td>
                    <td style={{ color: parseFloat(wp) >= 20 ? '#059669' : '#d97706', fontWeight: 700 }}>{wp}</td>
                    <td style={{ color: parseFloat(wv) >= 20 ? '#059669' : '#d97706', fontWeight: 700 }}>{wv}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && (
        <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />
      )}
    </>
  );
}

export { RepKpis };
export default RepKpis;
