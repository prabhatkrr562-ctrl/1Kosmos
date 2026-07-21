import { useMemo } from 'react';
import { fmt, Card } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

function RepKpis({ data, onSelectRep }) {
  const {
    rep_breakdown = [], deals = [], selected_week_short = '', rep_weekly_trend = {},
  } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();

  const repDealsMap = useMemo(() => {
    const map = {};
    deals.forEach(deal => { (map[deal.owner] ||= []).push(deal); });
    return map;
  }, [deals]);

  const byPipeline = useMemo(() => [...rep_breakdown].sort((a, b) => b.pipeline - a.pipeline), [rep_breakdown]);
  const byWeighted = useMemo(() => [...rep_breakdown].sort((a, b) => b.weighted - a.weighted), [rep_breakdown]);
  const byCloser = useMemo(() => [...rep_breakdown].sort((a, b) => (b.won_deals - a.won_deals) || (b.won - a.won)), [rep_breakdown]);
  const byDeals = useMemo(() => [...rep_breakdown].sort((a, b) => b.deals - a.deals), [rep_breakdown]);
  const byLost = useMemo(() => [...rep_breakdown].sort((a, b) => (b.lost_deals || 0) - (a.lost_deals || 0)), [rep_breakdown]);

  function avgCycle(owner) {
    const rows = (repDealsMap[owner] || []).filter(d => Number(d.days_open) > 0);
    return rows.length ? Math.round(rows.reduce((sum, d) => sum + Number(d.days_open), 0) / rows.length) : null;
  }

  function handleDrillRep(rep) {
    if (!rep) return;
    const rows = repDealsMap[rep.owner] || [];
    const active = rows.filter(d => ACTIVE_STAGES.includes(d.stage));
    const won = rows.filter(d => d.stage === 'Business Won');
    const lost = rows.filter(d => d.stage === 'Business Lost');
    const commit = active.filter(d => (d.forecast_category || '').trim() === 'Commit');
    const upside = active.filter(d => (d.forecast_category || '').trim() === 'Upside');
    const activeValue = active.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const lostCount = rep.lost_deals ?? lost.length;
    const winRate = (rep.won_deals + lostCount) > 0
      ? `${(rep.won_deals / (rep.won_deals + lostCount) * 100).toFixed(1)}%` : '—';
    const apac = `${rep.team || ''} ${rep.region || ''}`.toLowerCase().includes('apj')
      || `${rep.team || ''} ${rep.region || ''}`.toLowerCase().includes('asia');
    const content = (
      <>
        <div className="rep-drill-hdr">
          <div className="rep-drill-ava" style={{ background: apac ? 'linear-gradient(135deg,#10b981,#34d399)' : 'linear-gradient(135deg,#2563eb,#06b6d4)' }}>👤</div>
          <div><div style={{ fontSize: 18, fontWeight: 900 }}>{rep.owner}</div><div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 2 }}>{rep.team || '—'} · {rep.region || '—'}</div></div>
        </div>
        <div className="rep-drill-kpis">
          <MiniKpi label="Active Pipeline" value={activeValue} color="var(--blue)" onClick={() => openDrill(`${rep.owner} — Active Pipeline`, `${active.length} active deals`, active)} />
          <MiniKpi label="Won YTD" value={rep.won} color="var(--green)" onClick={() => openDrill(`${rep.owner} — Won YTD`, `${won.length} wins`, won)} />
          <MiniKpi label="Commit" value={rep.commit} color="var(--amber)" onClick={() => openDrill(`${rep.owner} — Commit`, `${commit.length} commit deals`, commit)} />
          <MiniKpi label="Upside" value={rep.upside} color="var(--purple)" onClick={() => openDrill(`${rep.owner} — Upside`, `${upside.length} upside deals`, upside)} />
          <div className="rep-mkpi" style={{ borderTop: '2px solid var(--green)' }}><div className="rep-mkpi-v" style={{ color: parseFloat(winRate) >= 20 ? 'var(--green)' : 'var(--amber)' }}>{winRate}</div><div className="rep-mkpi-l">Win Rate #</div></div>
          <MiniKpi label={`Lost (${lostCount})`} value={rep.lost} color="var(--red)" onClick={() => openDrill(`${rep.owner} — Lost Deals`, `${lostCount} lost`, lost)} />
        </div>
      </>
    );
    openDrill(rep.owner, `${rep.deals} active · ${fmt(rep.pipeline)}`, active, content);
  }

  function handleDrillStage(stage) {
    const rows = deals.filter(d => d.stage === stage);
    openDrill(stage, `${rows.length} deals`, rows);
  }

  const selectRep = (rep) => {
    if (!rep) return;
    if (onSelectRep) onSelectRep(rep.owner);
    else handleDrillRep(rep);
  };

  const topPipeline = byPipeline[0];
  const topWeighted = byWeighted[0];
  const topCloser = byCloser[0];
  const topActive = byDeals[0];
  const topLosses = byLost[0];

  return (
    <>
      <div className="anote">📌 <strong>Click any rep card</strong> → loads their full individual dashboard. Click chart bars → rep detail. Click table rows → rep dashboard.</div>

      <div className="krow k5" id="repLeaderboard">
        <LeaderCard tone="kb" label="Top Pipeline Rep" rep={topPipeline} detail={`${fmt(topPipeline?.pipeline || 0)} active · ${topPipeline?.deals || 0} deals`} onClick={() => selectRep(topPipeline)} />
        <LeaderCard tone="kp" label="Top Weighted Pipeline Rep" rep={topWeighted} detail={`${fmt(topWeighted?.weighted || 0)} weighted`} onClick={() => selectRep(topWeighted)} />
        <LeaderCard tone="kg" label={<>Top Closer <span className="dyn-week">{selected_week_short || 'W—'}</span></>} rep={topCloser} detail={`${topCloser?.won_deals || 0} wins · ${fmt(topCloser?.won || 0)}`} onClick={() => selectRep(topCloser)} />
        <LeaderCard tone="ka" label="Most Active Deals" rep={topActive} detail={`${topActive?.deals || 0} active deals · ${fmt(topActive?.pipeline || 0)}`} onClick={() => selectRep(topActive)} />
        <LeaderCard tone="kr" label="Most Losses" rep={topLosses} detail={`${topLosses?.lost_deals || 0} deals lost YTD`} onClick={() => selectRep(topLosses)} />
      </div>

      <div className="rep-grid">
        {rep_breakdown.map((rep, i) => {
          const isApac = `${rep.team || ''} ${rep.region || ''}`.toLowerCase().includes('apj') || `${rep.team || ''} ${rep.region || ''}`.toLowerCase().includes('asia');
          const lost = rep.lost_deals || 0;
          const winCount = (rep.won_deals + lost) > 0 ? `${(rep.won_deals / (rep.won_deals + lost) * 100).toFixed(1)}%` : '—';
          const winValue = (rep.won + rep.lost) > 0 ? `${(rep.won / (rep.won + rep.lost) * 100).toFixed(1)}%` : '—';
          const trend = (rep_weekly_trend[rep.owner] || []).slice(-6).map(w => Number(w.active || 0));
          const bars = trend.length ? trend : [rep.pipeline, rep.pipeline, rep.pipeline, rep.pipeline, rep.pipeline, rep.pipeline];
          const max = Math.max(...bars, 1);
          return (
            <div key={i} className={`rc ${isApac ? 'apac' : 'na'}`} onClick={() => selectRep(rep)}>
              <div className="rc-name">{rep.owner}</div><div className="rc-team">{rep.team || '—'} · {rep.region || '—'}</div>
              <div className="rc-pipe">{fmt(rep.pipeline)}</div>
              <div className="rc-row">
                <Stat value={rep.deals} label="Deals" /><Stat value={rep.won_deals} label="Won" color="var(--green)" /><Stat value={lost} label="Lost" color="var(--red)" /><Stat value={winCount} label="Win%#" small /><Stat value={winValue} label="Win%$" small color="var(--amber)" />
              </div>
              <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 5 }}>Won: <strong style={{ color: 'var(--green)' }}>{fmt(rep.won || 0)}</strong> · Commit: <strong>{fmt(rep.commit || 0)}</strong> · Avg Cycle: <strong style={{ color: 'var(--cyan)' }}>{avgCycle(rep.owner) != null ? `${avgCycle(rep.owner)}d` : '—'}</strong></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, marginTop: 6 }}>{bars.map((v, j) => <div key={j} style={{ height: `${Math.max(2, Math.round((v / max) * 22))}px`, background: isApac ? '#06b6d4' : '#2563eb', flex: 1, borderRadius: 1, opacity: .7 }} />)}</div>
              <div style={{ fontSize: 8, color: 'var(--sub)', marginTop: 2 }}>Pipeline trend W1→{selected_week_short || 'W—'}</div>
              <div className="pl-click-hint" style={{ marginTop: 4 }}>🔍 Click → full rep dashboard</div>
            </div>
          );
        })}
      </div>

      <Card title="Rep Scorecard — Click any row → rep dashboard" tag={`Full metrics ${selected_week_short || ''}`}>
        <div className="pl-twrap"><table><thead><tr><th>#</th><th>Rep</th><th>Region</th><th>Deals</th><th>Pipeline UW</th><th style={{ color: 'var(--purple)' }}>Weighted</th><th>Won $</th><th>Won #</th><th>Lost #</th><th title="Win Rate by Count">Win%#</th><th title="Win Rate by $ Value" style={{ color: 'var(--amber)' }}>Win%$</th><th title="Avg Sales Cycle" style={{ color: 'var(--cyan)' }}>Avg Days</th><th>Commit</th><th>Upside</th></tr></thead>
          <tbody>{rep_breakdown.map((r, i) => {
            const lost = r.lost_deals || 0;
            const countRate = (r.won_deals + lost) > 0 ? `${(r.won_deals / (r.won_deals + lost) * 100).toFixed(1)}%` : '—';
            const dollarRate = (r.won + r.lost) > 0 ? `${(r.won / (r.won + r.lost) * 100).toFixed(1)}%` : '—';
            return <tr key={i} className="pl-tr-click" onClick={() => selectRep(r)}><td style={{ color: '#9ca3af', fontSize: 10 }}>{i + 1}</td><td style={{ fontWeight: 700, color: 'var(--blue)' }}>{r.owner} ↗</td><td>{r.region || '—'}</td><td>{r.deals}</td><td className="c-blue">{fmt(r.pipeline)}</td><td style={{ color: 'var(--purple)' }}>{fmt(r.weighted)}</td><td className="c-green">{fmt(r.won)}</td><td className="c-green">{r.won_deals}</td><td className="c-red">{lost}</td><td>{countRate}</td><td style={{ color: 'var(--amber)' }}>{dollarRate}</td><td style={{ color: 'var(--cyan)' }}>{avgCycle(r.owner) != null ? avgCycle(r.owner) : '—'}</td><td>{fmt(r.commit)}</td><td>{fmt(r.upside)}</td></tr>;
          })}</tbody>
        </table></div>
      </Card>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

function LeaderCard({ tone, label, rep, detail, onClick }) {
  return <div className={`kc ${tone}`} onClick={onClick}><div className="kl">{label}</div><div className="kv" style={{ fontSize: 16 }}>{rep?.owner || '—'}</div><div className="kd"><span className={tone === 'kr' ? 'dn' : tone === 'ka' ? 'fl' : 'up'}>{detail}</span></div><div className="pl-click-hint">🔍 Click → rep dashboard</div></div>;
}

function Stat({ value, label, color, small }) { return <div className="rc-stat"><div className="rc-sv" style={{ color, fontSize: small ? 11 : undefined }}>{value}</div><div className="rc-sl">{label}</div></div>; }
function MiniKpi({ label, value, color, onClick }) { return <div className="rep-mkpi" style={{ borderTop: `2px solid ${color}` }} onClick={onClick}><div className="rep-mkpi-v" style={{ color }}>{fmt(value || 0)}</div><div className="rep-mkpi-l">{label}</div><div style={{ fontSize: 8, color: '#0891b2', marginTop: 3 }}>🔍 drill</div></div>; }

export { RepKpis };
export default RepKpis;
