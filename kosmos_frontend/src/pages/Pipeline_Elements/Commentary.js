import { useMemo, useState } from 'react';
import { fmt } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';
import { API_URL } from '../../config/api';
import { readApiJson } from '../../utils/apiErrors';

const ACTIVE = stage => stage !== 'Business Won' && stage !== 'Business Lost';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

const REFERENCE_COMMENTARY = {
  1: { date: 'February 2026 · BASELINE', title: 'Year Start — $37.6M Baseline Pipeline, 165 Deals', body: 'Week 1 establishes the FY2026 baseline with <strong>$37.6M pipeline</strong> across <strong>165 deals</strong> and 148 companies. North America accounts for $32.3M (86%) with APAC at $5.3M (14%). AOP target is $17.3M with stretch sales target of $23.9M.', tags: [['$37.6M Baseline', 'bb'], ['165 Deals', 'bc'], ['AOP: $17.3M', 'ba']] },
  7: { date: 'February 2026', title: 'Pipeline Peaks at $44.6M — 202 Deals, First Win', body: 'Week 7 saw pipeline surge to <strong>$44.6M</strong> with 202 deals. Straive WF Upsell 2 ($100K) became the first closed won deal. 65 new deals added ($12M value). North America dominated at $42.5M.', tags: [['First Win — Straive', 'bg'], ['$44.6M Peak', 'bb']] },
  8: { title: 'W8 — $42.8M Pipeline, 168 Active Deals', body: 'Week 8: Active pipeline <strong>$42.8M</strong> (168 deals). Won YTD: <strong>$100K</strong>. Pipeline declined from W7 peak.', tags: [['$42.8M Pipeline', 'bb'], ['168 Deals', 'bc']] },
  9: { title: 'W9 — $35.8M Pipeline, 173 Active Deals', body: 'Week 9: Active pipeline <strong>$35.8M</strong> (173 deals). Won YTD: <strong>$100K</strong>. Major correction — 51 deals lost.', tags: [['$35.8M Pipeline', 'bb'], ['225 Deals', 'bc']] },
  10: { date: 'March 2026', title: 'Post-Correction Stabilization — 226 Deals, $40.8M', body: 'Week 10 showed stabilization after the W7–W9 correction. Pipeline held at $40.8M with 226 deals. 51 deals lost by this point ($5.54M). Active pipeline was $35.1M.', tags: [['Stabilization', 'bb'], ['51 Deals Lost', 'ba']] },
  11: { title: 'W11 — $34.6M Pipeline, 172 Active Deals', body: 'Week 11: Active pipeline <strong>$34.6M</strong> (172 deals). Won YTD: <strong>$100K</strong>. Stabilization phase.', tags: [['$34.6M Pipeline', 'bb'], ['229 Deals', 'bc']] },
  12: { title: 'W12 — $34.6M Pipeline, 174 Active Deals', body: 'Week 12: Active pipeline <strong>$34.6M</strong> (174 deals). Won YTD: <strong>$100K</strong>. Steady state — pipeline holds.', tags: [['$34.6M Pipeline', 'bb'], ['241 Deals', 'bc']] },
  13: { date: 'March 2026', title: 'Recovery Week — Pipeline Rebounds to $42.4M', body: 'After a dip in W9–W12, Week 13 showed a strong recovery with pipeline rebounding to $42.4M (+$1.55M WoW). 20 new deals added ($587K value). 259 deals tracked across 234 companies.', tags: [['Recovery Week', 'bg'], ['+$1.55M WoW', 'bb']] },
  14: { title: 'W14 — $36.5M Pipeline, 175 Active Deals', body: 'Week 14: Active pipeline <strong>$36.5M</strong> (175 deals). Won YTD: <strong>$100K</strong>. Recovery continues.', tags: [['$36.5M Pipeline', 'bb'], ['264 Deals', 'bc']] },
  15: { date: 'March 2026', title: 'Pipeline Peaks at $45.5M — 309 Deals, Strongest Week', body: 'Week 15 recorded the highest deal count at <strong>309 deals</strong> and pipeline of $45.5M. Active pipeline reached $38.8M — a $2.25M WoW increase. Upside hit $28.9M (84 deals). 7 new deals added.', tags: [['309 Deals — Peak Count', 'bb'], ['$45.5M Pipeline', 'bc']] },
  16: { title: 'W16 — $36.6M Pipeline, 172 Active Deals', body: 'Week 16: Active pipeline <strong>$36.6M</strong> (172 deals). Won YTD: <strong>$239K</strong>. Michigan Medicine win — first new close.', tags: [['$36.6M Pipeline', 'bb'], ['271 Deals', 'bc']] },
  17: { title: 'W17 — $36.7M Pipeline, 173 Active Deals', body: 'Week 17: Active pipeline <strong>$36.7M</strong> (173 deals). Won YTD: <strong>$239K</strong>. Pipeline stable — 3M advancing.', tags: [['$36.7M Pipeline', 'bb'], ['273 Deals', 'bc']] },
  18: { date: 'April 2026', title: '3M Win + Pipeline Surge to $46.8M — 320 Deals', body: 'Week 18 was a strong week with <strong>3M (EY) Remote Caller Verification ($190K)</strong> closing. Pipeline surged to $46.8M with 320 deals — a $2.3M WoW increase. Active pipeline reached $39.1M. Commit grew to $2.69M (10 deals).', tags: [['✅ 3M $190K Won', 'bg'], ['$46.8M Pipeline', 'bc']] },
  19: { title: 'W19 — $38.6M Pipeline, 218 Active Deals', body: 'Week 19: Active pipeline <strong>$38.6M</strong> (218 deals). Won YTD: <strong>$429K</strong>. S&P Global advancing to 90%.', tags: [['$38.6M Pipeline', 'bb'], ['323 Deals', 'bc']] },
  20: { date: 'April 2026', title: 'S&P Global Closes — Pipeline Peaks at $47.7M', body: 'Week 20 saw pipeline reach <strong>$47.7M</strong> — the highest total recorded. S&P Global IDV ($164K) and Staples ($12K) added to won deals. Active pipeline grew to $39.0M with 226 deals. Upside expanded to $28.1M (81 deals).', tags: [['✅ S&P Global Won', 'bg'], ['Pipeline Peak $47.7M', 'bb']] },
  21: { date: 'May 2026', title: 'VF Corp + S&P Global Wins — Cumulative Wins Cross $989K', body: 'Week 21 saw two significant wins: <strong>VF Corp ($300K)</strong> and <strong>S&P Global IDV ($164K)</strong>. Total pipeline reached $47.6M with 337 deals. Active pipeline was $38.7M. Commit softened to $2.19M (8 deals). Loss count reached 104 deals ($7.88M).', tags: [['✅ VF Corp $300K', 'bg'], ['✅ S&P Global $164K', 'bg'], ['$47.6M Pipeline', 'bb']] },
  22: { date: 'May 2026', title: 'Steady State — Pipeline Holds at $47.4M, No New Wins', body: 'Week 22 showed pipeline stability at <strong>$47.4M</strong> with 338 deals. Active pipeline was $38.5M — a modest decline of $225K from W21. No new closures this week. Loss count reached 108 deals ($7.88M). Commit held at $2.19M (8 deals) while Upside grew to $27.5M (82 deals).', tags: [['$47.4M Pipeline', 'bb'], ['⚠ No New Wins', 'ba'], ['108 Deals Lost', 'br']] },
  23: { date: 'Jun 6, 2026', title: '🏆 Breakthrough Week — $2.04M Cumulative Wins, 10 New Closures, 87 Stage Movements', body: 'Week 23 marks the strongest closing week of FY2026. <strong>3 new deals closed W22→W23</strong> bringing cumulative wins to <strong>$2.04M across 10 deals</strong>. Standout closures: DMDC recompete ($810K, Federal), S&P Global IDV ($370K), VF Corp ($300K), Marks & Spencer ($204K). <strong>108 deals changed stage</strong> — 62 forward, 42 backward, 3 won, 1 lost. Active pipeline declined $2.47M WoW to $38.3M as deals converted. Commit pipeline: $687K (6 deals) — near-term revenue visibility is thin heading into H2.', tags: [['✅ 10 New Wins', 'bg'], ['$2.04M Won YTD', 'bc'], ['⚠ Thin Commit', 'ba'], ['APAC Momentum', 'bb'], ['87 Stage Moves', 'br']] },
};

function signalFor(change, index) {
  if (index === 0) return '🔵 Baseline';
  if (change > 2000000) return '🟢 Strong Growth';
  if (change > 0) return '🟡 Modest Growth';
  if (change > -1000000) return '🟠 Minor Decline';
  return '🟡 Modest Decline';
}

function CommentaryBlock({ row, latest, previous, newWins, children }) {
  const reference = REFERENCE_COMMENTARY[row.week_num];
  const activeCount = number(row.active_count_all || row.count);
  const wow = previous ? number(row.active) - number(previous.active) : null;
  const topWins = (newWins || []).slice(0, 3);
  const dynamic = latest ? {
    date: 'Latest Snapshot',
    title: `W${row.week_num} Latest — ${number(row.won_count)} Wins, ${fmt(row.won)} Won YTD`,
    body: null,
    tags: [['📅 Latest', 'bg'], [`✅ ${number(row.won_count)} Wins`, 'bg'], [fmt(row.active), 'bc']],
  } : reference || {
    title: `W${row.week_num} — ${fmt(row.active)} Active, ${activeCount} Deals`,
    body: `Active: <strong>${fmt(row.active)}</strong> (${activeCount} deals). Won YTD: <strong>${fmt(row.won)}</strong> (${number(row.won_count)} deals).`,
    tags: [],
  };

  return <div className="comm-week-block">
    <div className="cc">
      <div className="cw">📅 Week {row.week_num}{dynamic.date ? ` · ${dynamic.date}` : ''}</div>
      <div className="ctitle">{dynamic.title}</div>
      {latest ? <div className="cbody">
        Week {row.week_num}: Active pipeline <strong>{fmt(row.active)}</strong> ({activeCount} deals).
        {wow !== null && <> WoW: <strong>{wow >= 0 ? '+' : '−'}{fmt(Math.abs(wow))}</strong>.</>}
        {topWins.length > 0 && <> <strong>New wins: {topWins.map(win => `${win.deal_name || win.company || 'Deal'} (${fmt(win.amount)})`).join(', ')}</strong>.</>}
        {' '}Won YTD: <strong>{fmt(row.won)}</strong> ({number(row.won_count)} deals). Commit: {fmt(row.commit)} · Upside: {fmt(row.upside)}.
      </div> : <div className="cbody" dangerouslySetInnerHTML={{ __html: dynamic.body }} />}
      {dynamic.tags?.length > 0 && <div className="ctags">{dynamic.tags.map(([label, cls]) => <span key={label} className={`b ${cls}`}>{label}</span>)}</div>}
    </div>
    {children}
  </div>;
}

function InsightCard({ title, insights }) {
  return <div className="pl-card comm-key-card"><div className="pl-card-title">{title}</div><ul className="pl-il comm-insights">
    {insights.map((insight, index) => <li key={index} role="button" tabIndex="0" onClick={insight.onClick} onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && insight.onClick()}><span className="pl-ii">{insight.icon}</span><span>{insight.content}</span></li>)}
  </ul></div>;
}

function Commentary({ data, onOpenMovement }) {
  const weekly = useMemo(() => [...(data.weekly_trend || [])].sort((a, b) => number(a.week_num) - number(b.week_num)), [data.weekly_trend]);
  const latest = useMemo(() => weekly[weekly.length - 1] || {}, [weekly]);
  const [fromWeek, setFromWeek] = useState('');
  const [toWeek, setToWeek] = useState('');
  const [jumpWeek, setJumpWeek] = useState(String(latest.week_num || ''));
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();
  const deals = data.deals || [];
  const newWins = data.commentary?.new_wins || [];

  const visible = useMemo(() => {
    const from = number(fromWeek), to = number(toWeek), jump = number(jumpWeek);
    if (jump && !from && !to) return weekly.filter(row => number(row.week_num) === jump);
    if (from && !to) return weekly.filter(row => number(row.week_num) === from);
    if (!from && !to) return latest.week_num ? [latest] : [];
    return weekly.filter(row => (!from || number(row.week_num) >= from) && (!to || number(row.week_num) <= to));
  }, [weekly, latest, fromWeek, toWeek, jumpWeek]);

  const activeDeals = deals.filter(deal => ACTIVE(deal.stage));
  const wonDeals = deals.filter(deal => deal.stage === 'Business Won');
  const lostDeals = deals.filter(deal => deal.stage === 'Business Lost');
  const commitDeals = activeDeals.filter(deal => (deal.forecast_category || '').trim() === 'Commit');

  const openList = (title, sub, rows) => openDrill(title, sub, rows);
  const openCurrent = type => {
    const defs = {
      active: ['Active Pipeline — All Active Deals', 'Excludes Business Won and Business Lost · sorted by amount', activeDeals],
      won: [`Won Deals — ${wonDeals.length} Deals`, 'All won deals · Click any row for full detail', wonDeals],
      commit: [`Commit Pipeline — ${commitDeals.length} Deals`, 'High confidence deals · Click any row for full detail', commitDeals],
      lost: [`Lost Deals — ${lostDeals.length} Deals`, 'All lost deals · Click any row for full detail', lostDeals],
    };
    openList(...defs[type]);
  };

  const openWeekDeals = row => {
    const title = `W${row.week_num} Active Pipeline`;
    const loading = <div className="comm-loading">Loading the Week {row.week_num} snapshot…</div>;
    openDrill(title, 'Historical snapshot · loading deals', null, loading);
    const params = new URLSearchParams();
    Object.entries(data.applied_filters || {}).forEach(([key, value]) => { if (value && key !== 'week') params.set(key, value); });
    params.set('week', row.week || `Week ${row.week_num}`);
    fetch(`${API_URL}/api/pipeline/?${params}`, { credentials: 'include' })
      .then(response => readApiJson(response, `Unable to load Week ${row.week_num} deals.`))
      .then(payload => {
        const rows = (payload.deals || []).filter(deal => ACTIVE(deal.stage));
        const total = rows.reduce((sum, deal) => sum + number(deal.amount), 0);
        const weighted = rows.reduce((sum, deal) => sum + number(deal.weighted), 0);
        openDrill(title, `${rows.length} actionable deals · ${fmt(total)} UW · ${fmt(weighted)} Weighted · click any row for full detail`, rows);
      })
      .catch(error => openDrill(title, 'Historical snapshot unavailable', null, <div className="pl-bm-empty-note">{error.message}</div>));
  };

  const findDeal = (...needles) => deals.find(deal => needles.some(needle => (deal.deal_name || '').toLowerCase().includes(needle.toLowerCase())));
  const openNamedDeal = (...needles) => { const deal = findDeal(...needles); if (deal) openDeal(deal); };
  const handleDrillStage = stage => openList(`${stage} — Deals`, 'Deals in this stage · click any row for full detail', deals.filter(deal => deal.stage === stage));

  const latestInsights = [
    { icon: '📊', content: <>Active pipeline: <strong>{fmt(latest.active)}</strong> · {number(latest.active_count_all || latest.count)} deals. Click → see all active deals</>, onClick: () => openCurrent('active') },
    { icon: '💰', content: <>Won YTD: <strong>{fmt(latest.won)}</strong> ({number(latest.won_count)} deals). Click → won deals</>, onClick: () => openCurrent('won') },
    { icon: '⚠️', content: <>Commit: <strong>{fmt(latest.commit)}</strong> · Upside: <strong>{fmt(latest.upside)}</strong>. Click → commit deals</>, onClick: () => openCurrent('commit') },
    ...(newWins.length ? [{ icon: '🏆', content: <><strong>New wins: {newWins.slice(0, 3).map(win => `${win.deal_name} (${fmt(win.amount)})`).join(', ')}</strong>. Click → won deals</>, onClick: () => openCurrent('won') }] : []),
  ];

  const week23Insights = [
    { icon: '🏆', content: <><strong>DMDC | CSP recompete — $810K</strong> (Fadi Jarrar). Largest win this week. 5-year federal contract. Click → deal detail.</>, onClick: () => openNamedDeal('DMDC | CSP') },
    { icon: '🎖️', content: <><strong>S&P Global | IDV — $370K</strong> (Cody Dussault). Enterprise data analytics win. Click → deal detail.</>, onClick: () => openNamedDeal('S&P Global | IDV') },
    { icon: '🔄', content: <><strong>108 deals changed stage</strong> — Boeing slipped 60%→20%, M&T slipped 40%→20%. Click → movement analysis.</>, onClick: () => onOpenMovement?.() },
    { icon: '⚠️', content: <><strong>Commit pipeline collapsed to $1.96M</strong> — from $5.4M at W1. Only 6 deals remain. Click → commit deals.</>, onClick: () => openCurrent('commit') },
    { icon: '🔴', content: <><strong>108 deals lost YTD ($7.71M)</strong> — Sutherland ($300K), Bombardier, ACG lost this week. Click → lost deals.</>, onClick: () => openCurrent('lost') },
    { icon: '💡', content: <><strong>Fifth Third Bank ($3.5M)</strong> — largest single active deal in 40%-Scoping. Must advance before Q4 26. Click → deal detail.</>, onClick: () => openNamedDeal('Fifth Third | Verify') },
  ];

  const changeFrom = index => index > 0 ? number(weekly[index].active) - number(weekly[index - 1].active) : null;
  const rangeLabel = fromWeek || toWeek ? (fromWeek && !toWeek ? `Week ${fromWeek}` : `${fromWeek ? `W${fromWeek}` : 'Start'} → ${toWeek ? `W${toWeek}` : 'Latest'} · ${visible.length} week${visible.length === 1 ? '' : 's'}`) : '';

  return <>
    <div className="comm-filter-bar">
      <span className="comm-filter-title">📝 Commentary:</span><span className="comm-filter-help">Select a week to read its commentary, or a range to see multiple weeks</span>
      <label>Week: <select className="fs" value={fromWeek} onChange={event => { setFromWeek(event.target.value); setJumpWeek(''); }}><option value="">All Weeks</option>{weekly.map(row => <option key={row.week_num} value={row.week_num}>Week {row.week_num}</option>)}</select></label>
      <label>To Week: <select className="fs" value={toWeek} onChange={event => { setToWeek(event.target.value); setJumpWeek(''); }}><option value="">All Weeks</option>{weekly.map(row => <option key={row.week_num} value={row.week_num}>Week {row.week_num}</option>)}</select></label>
      <label>Jump to: <select className="fs" value={jumpWeek} onChange={event => { setJumpWeek(event.target.value); setFromWeek(''); setToWeek(''); }}><option value="">— Jump to Week —</option>{[...weekly].reverse().map(row => <option key={row.week_num} value={row.week_num}>Week {row.week_num}{row.week_num === latest.week_num ? ' (Latest)' : ''}</option>)}</select></label>
      {rangeLabel && <span className="comm-range-label">{rangeLabel}</span>}
    </div>

    <div className="comm-blocks-container">
      {[...visible].sort((a, b) => number(b.week_num) - number(a.week_num)).map(row => {
        const index = weekly.findIndex(item => item.week_num === row.week_num);
        const isLatest = row.week_num === latest.week_num;
        return <CommentaryBlock key={row.week_num} row={row} latest={isLatest} previous={index > 0 ? weekly[index - 1] : null} newWins={isLatest ? newWins : []}>
          {isLatest && <InsightCard title={`W${row.week_num} Key Insights`} insights={latestInsights} />}
          {row.week_num === 23 && <InsightCard title={`W${row.week_num} Key Insights — Click each to drill`} insights={week23Insights} />}
        </CommentaryBlock>;
      })}
      {visible.length === 0 && <div className="cc comm-empty">No weekly commentary is available for the selected range.</div>}
    </div>

    <div className="comm-divider" />
    <div className="pl-card comm-trend-card">
      <div className="pl-card-title">📈 Full Year Trend Summary 1–{latest.week_num || '—'} — Click rows to drill</div>
      <div className="pl-card-sub">All 18 weekly snapshots</div>
      <div className="pl-twrap" style={{ marginTop: 8 }}><table><thead><tr><th>Week</th><th>Total Pipeline</th><th>Active Pipeline</th><th>Deals</th><th>Won (Cum.)</th><th>Lost (Cum.)</th><th>WoW Change</th><th>Signal</th></tr></thead><tbody>
        {weekly.map((row, index) => { const change = changeFrom(index); return <tr key={row.week_num} className="pl-tr-click" onClick={() => openWeekDeals(row)}><td><strong>{row.week_num}</strong></td><td className="td2">{fmt(row.active)}</td><td className="td2">{fmt(row.active)}</td><td className="td2">{number(row.total_count_all || row.count)}</td><td style={{ color: 'var(--green)' }}>{fmt(row.won)}</td><td style={{ color: 'var(--red)' }}>{fmt(row.lost)}</td><td>{change === null ? '—' : <span className={change >= 0 ? 'up' : 'dn'}>{change >= 0 ? '▲' : '▼'} {fmt(Math.abs(change))}</span>}</td><td className="td3 tds">{signalFor(change, index)}</td></tr>; })}
      </tbody></table></div>
    </div>

    {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
    {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
  </>;
}

export { Commentary };
export default Commentary;
