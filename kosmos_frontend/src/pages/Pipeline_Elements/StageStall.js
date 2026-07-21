import { useMemo, useState } from 'react';
import { fmt, StageBadge, FcBadge, DonutChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGES = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const BUCKETS = [
  { key: 'never', label: 'Never Moved', range: '360+ days', hint: 'Zero stage change in full window', color: '#dc2626', fill: 'rgba(220,38,38,.22)', cls: 'kr' },
  { key: 'long', label: 'Long Stall', range: '180–360 days', hint: 'Fifth Third $3.5M, USAccess $500K', color: '#ea580c', fill: 'rgba(234,88,12,.20)', cls: 'ko' },
  { key: 'medium', label: 'Medium Stall', range: '90–180 days', hint: 'Wells Fargo WF&V, Cargill...', color: '#d97706', fill: 'rgba(245,158,11,.24)', cls: 'ka' },
  { key: 'recent', label: 'Moved Recently', range: '0–90 days', hint: 'Stage changed recently', color: '#059669', fill: 'rgba(16,185,129,.22)', cls: 'kg' },
];

const STAGE_SHORT = {
  '5% - Prospecting': '5% Prospecting',
  '20%-Discovery': '20% Discovery',
  '40%-Scoping': '40% Scoping',
  '60%-Propose': '60% Propose',
  '80%-Validate': '80% Validate',
  '90%-Negotiate & Close': '90% Negotiate',
};

const STAGE_COLORS = ['#0891b2', '#2563eb', '#7c3aed', '#d97706', '#ea580c', '#dc2626'];

function sumAmount(rows) {
  return rows.reduce((sum, row) => sum + (row.amount || 0), 0);
}

function riskFor(deal) {
  const score = deal.urgency_score || 0;
  if (score >= 70) return { label: '🔴 Critical', cls: 'br', color: '#dc2626' };
  if (score >= 50) return { label: '🟠 High', cls: 'bo', color: '#ea580c' };
  if (score >= 30) return { label: '🟡 Medium', cls: 'ba', color: '#d97706' };
  return { label: '🟢 Low', cls: 'bg', color: '#059669' };
}

function StalenessChart({ buckets, onBucket }) {
  const values = BUCKETS.map(bucket => buckets[bucket.key]?.amount || 0);
  const counts = BUCKETS.map(bucket => buckets[bucket.key]?.count || 0);
  const maxValue = Math.max(...values, 1);
  const maxCount = Math.max(...counts, 1);
  const W = 680, H = 245;
  const p = { l: 54, r: 42, t: 20, b: 63 };
  const iw = W - p.l - p.r, ih = H - p.t - p.b;
  const step = iw / BUCKETS.length, barWidth = Math.min(82, step * .55);
  const points = counts.map((count, index) => ({
    x: p.l + step * index + step / 2,
    y: p.t + ih - (count / maxCount) * ih,
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg stage-stall-chart" role="img" aria-label="Pipeline by stage movement staleness">
      {[0, .25, .5, .75, 1].map((tick, index) => {
        const y = p.t + ih - tick * ih;
        return <g key={index}><line x1={p.l} x2={W - p.r} y1={y} y2={y} stroke="#e5e7eb" /><text x={p.l - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#6b7280">${(maxValue * tick / 1e6).toFixed(1)}M</text></g>;
      })}
      {BUCKETS.map((bucket, index) => {
        const x = p.l + step * index + (step - barWidth) / 2;
        const height = (values[index] / maxValue) * ih;
        return (
          <g key={bucket.key} onClick={event => { event.stopPropagation(); onBucket(bucket.key); }} style={{ cursor: 'pointer' }}>
            <rect x={x} y={p.t + ih - height} width={barWidth} height={height} rx="4" fill={bucket.fill} stroke={bucket.color} strokeWidth="1.6"><title>{bucket.label}: {fmt(values[index])} · {counts[index]} deals</title></rect>
            <text x={x + barWidth / 2} y={H - 35} textAnchor="middle" fontSize="9" fontWeight="700" fill="#374151">{bucket.label}</text>
            <text x={x + barWidth / 2} y={H - 21} textAnchor="middle" fontSize="8" fill="#9ca3af">({bucket.range})</text>
          </g>
        );
      })}
      <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#7c3aed" strokeWidth="2.2" />
      {points.map((point, index) => <g key={index} onClick={event => { event.stopPropagation(); onBucket(BUCKETS[index].key); }} style={{ cursor: 'pointer' }}><circle cx={point.x} cy={point.y} r="5" fill="#7c3aed" stroke="#fff" strokeWidth="2" /><text x={point.x + 8} y={point.y - 7} fontSize="9" fontWeight="700" fill="#7c3aed">{counts[index]}</text></g>)}
      <text x={W - p.r + 8} y={p.t + 3} fontSize="8" fill="#7c3aed">DEALS</text>
      <g transform={`translate(${p.l},${H - 7})`}><rect width="12" height="7" fill="rgba(37,99,235,.2)" stroke="#2563eb" /><text x="17" y="7" fontSize="9" fill="#6b7280">Pipeline ($M)</text><line x1="98" x2="114" y1="4" y2="4" stroke="#7c3aed" strokeWidth="2" /><circle cx="106" cy="4" r="3" fill="#7c3aed" /><text x="120" y="7" fontSize="9" fill="#6b7280">Deal Count</text></g>
    </svg>
  );
}

function RepStallChart({ rows, onRep }) {
  const shown = rows.slice(0, 9);
  const max = Math.max(...shown.map(row => row.amount), 1);
  const W = 680, H = 245, left = 128, right = 55, top = 9;
  const rowHeight = (H - 26) / Math.max(shown.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg stage-stall-chart" role="img" aria-label="Stuck pipeline by representative">
      {[0, .25, .5, .75, 1].map((tick, i) => <g key={i}><line x1={left + (W-left-right)*tick} x2={left + (W-left-right)*tick} y1={top} y2={H-18} stroke="#e5e7eb" /><text x={left + (W-left-right)*tick} y={H-4} textAnchor="middle" fontSize="8" fill="#9ca3af">${(max*tick/1e6).toFixed(1)}M</text></g>)}
      {shown.map((row, index) => {
        const y = top + index * rowHeight;
        const width = (row.amount / max) * (W - left - right);
        const color = index < 2 ? '#dc2626' : index < 4 ? '#ea580c' : index < 7 ? '#d97706' : '#0891b2';
        return <g key={row.owner} onClick={event => { event.stopPropagation(); onRep(row.owner); }} style={{ cursor: 'pointer' }}><text x={left - 8} y={y + rowHeight*.63} textAnchor="end" fontSize="9" fill="#374151">{row.owner}</text><rect x={left} y={y + 3} width={width} height={Math.max(9, rowHeight - 7)} rx="3" fill={`${color}30`} stroke={color} strokeWidth="1.4"><title>{row.owner}: {fmt(row.amount)} · {row.count} deals</title></rect><text x={Math.min(left + width + 6, W-right+2)} y={y + rowHeight*.63} fontSize="8" fontWeight="700" fill={color}>{fmt(row.amount)}</text></g>;
      })}
    </svg>
  );
}

function StageStallChart({ rows, onStage }) {
  const max = Math.max(...rows.map(row => row.total_amount), 1);
  const W = 680, H = 245, left = 48, right = 12, top = 16, bottom = 52;
  const iw = W-left-right, ih = H-top-bottom, step = iw / Math.max(rows.length, 1), bw = Math.min(32, step*.31);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg stage-stall-chart" role="img" aria-label="Stage stall analysis">
      {[0,.25,.5,.75,1].map((tick,i) => { const y=top+ih-tick*ih; return <g key={i}><line x1={left} x2={W-right} y1={y} y2={y} stroke="#e5e7eb"/><text x={left-7} y={y+3} textAnchor="end" fontSize="8" fill="#9ca3af">${(max*tick/1e6).toFixed(1)}M</text></g>; })}
      {rows.map((row,index) => {
        const cx=left+step*index+step/2, totalH=row.total_amount/max*ih, stuckH=row.stuck_amount/max*ih, color=STAGE_COLORS[index%STAGE_COLORS.length];
        return <g key={row.stage} onClick={event => { event.stopPropagation(); onStage(row.stage); }} style={{cursor:'pointer'}}><rect x={cx-bw-2} y={top+ih-totalH} width={bw} height={totalH} fill="rgba(148,163,184,.16)" stroke="#94a3b8"><title>Total: {fmt(row.total_amount)}</title></rect><rect x={cx+2} y={top+ih-stuckH} width={bw} height={stuckH} rx="2" fill={`${color}35`} stroke={color} strokeWidth="1.5"><title>Stuck: {fmt(row.stuck_amount)} · {row.stuck_count} deals</title></rect><text x={cx} y={H-31} textAnchor="middle" fontSize="8" fill="#6b7280">{(STAGE_SHORT[row.stage]||row.stage).split(' ')[0]}</text><text x={cx} y={H-19} textAnchor="middle" fontSize="8" fill="#9ca3af">{(STAGE_SHORT[row.stage]||'').split(' ').slice(1).join(' ')}</text></g>;
      })}
      <g transform={`translate(${left},${H-7})`}><rect width="11" height="7" fill="rgba(37,99,235,.25)" stroke="#2563eb"/><text x="16" y="7" fontSize="9" fill="#6b7280">Stuck Pipeline</text><rect x="96" width="11" height="7" fill="rgba(148,163,184,.15)" stroke="#94a3b8"/><text x="112" y="7" fontSize="9" fill="#6b7280">Total Stage Pipeline</text></g>
    </svg>
  );
}

function StaleDealTable({ deals, onDeal, onRep }) {
  const sorted = [...deals].sort((a,b) => (b.days_stuck||0)-(a.days_stuck||0) || (b.amount||0)-(a.amount||0));
  return <div className="pl-twrap"><table><thead><tr><th>#</th><th>Deal Name</th><th>Company</th><th>Stage</th><th>Amount</th><th>Owner</th><th>Region</th><th>Create Age</th><th>Days Stuck</th><th>Stuck Since</th></tr></thead><tbody>{sorted.map((deal,index) => <tr key={deal.record_id||index} className="pl-tr-click" onClick={() => onDeal(deal)}><td className="td3">{index+1}</td><td style={{fontSize:10,fontWeight:600,maxWidth:180}}>{deal.deal_name}</td><td className="td2">{deal.company||'—'}</td><td><StageBadge stage={deal.stage}/></td><td style={{fontWeight:700,color:'#2563eb'}}>{fmt(deal.amount)}</td><td className="stage-owner-link" onClick={event => { event.stopPropagation(); onRep?.(deal.owner); }}>{deal.owner||'—'} {onRep && '↗'}</td><td className="td2">{deal.region||'—'}</td><td className="td2">{deal.days_open == null ? '—' : `${deal.days_open}d`}</td><td><span className={`b ${deal.stall_bucket==='never'?'br':deal.stall_bucket==='long'?'bo':deal.stall_bucket==='medium'?'ba':'bg'}`}>{deal.days_stuck}d</span></td><td className="td3">{deal.stuck_since||'—'}</td></tr>)}</tbody></table></div>;
}

function OverviewCards({ rows, getKey, getTitle, getValue, getSub, onClick }) {
  return <div className="stage-drill-grid">{rows.map((row,index) => <button type="button" className="stage-drill-card" key={getKey(row,index)} onClick={() => onClick(row)}><span className="stage-drill-title">{getTitle(row)}</span><span className="stage-drill-value">{getValue(row)}</span><span className="stage-drill-sub">{getSub(row)}</span><span className="click-hint">🔍 Click → see deals</span></button>)}</div>;
}

function StageStall({ data, onSelectRep, onOpenMovement }) {
  const stall = data.stage_stall || {};
  const deals = useMemo(() => stall.deals || [], [stall.deals]);
  const movement = useMemo(() => data.movement || {}, [data.movement]);
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();
  const [repFilter,setRepFilter] = useState('');
  const [stageFilter,setStageFilter] = useState('');
  const [bucketFilter,setBucketFilter] = useState('');

  const buckets = stall.buckets || Object.fromEntries(BUCKETS.map(bucket => [bucket.key,{count:0,amount:0}]));
  const repRows = useMemo(() => stall.rep_summary || [], [stall.rep_summary]);
  const stageRows = useMemo(() => stall.stage_summary || [], [stall.stage_summary]);
  const priority = stall.priority || [];
  const staleDeals = useMemo(() => deals.filter(deal => (deal.days_stuck||0)>90), [deals]);
  const allReps = useMemo(() => [...new Set(deals.map(deal => deal.owner).filter(Boolean))].sort(), [deals]);
  const tableDeals = useMemo(() => deals.filter(deal => (!repFilter||deal.owner===repFilter)&&(!stageFilter||deal.stage===stageFilter)&&(!bucketFilter||deal.stall_bucket===bucketFilter)), [deals,repFilter,stageFilter,bucketFilter]);
  const openDeals = (title, rows, sub) => openDrill(title, sub || `${rows.length} deals · ${fmt(sumAmount(rows))} pipeline · Click any row for full detail`, null, <StaleDealTable deals={rows} onDeal={openDeal} onRep={onSelectRep}/>);
  const drillBucket = key => { const meta=BUCKETS.find(bucket=>bucket.key===key); openDeals(`${meta.label} — ${meta.range} No Stage Change`, deals.filter(deal=>deal.stall_bucket===key)); };
  const drillRep = owner => openDeals(`${owner} — Stale Deals`, staleDeals.filter(deal=>deal.owner===owner));
  const drillStage = stage => openDeals(`${stage} — Stale Deals`, staleDeals.filter(deal=>deal.stage===stage));
  const openRepOverview = () => openDrill('Stuck Pipeline by Rep',`${repRows.length} reps · 90+ days no stage change`,null,<OverviewCards rows={repRows} getKey={row=>row.owner} getTitle={row=>row.owner} getValue={row=>fmt(row.amount)} getSub={row=>`${row.count} stuck deals · ${row.stale_pct}% of rep pipeline`} onClick={row=>drillRep(row.owner)}/>);
  const openStageOverview = () => openDrill('Stage Stall Analysis','Where stagnant pipeline is concentrated · click a stage for deals',null,<OverviewCards rows={stageRows} getKey={row=>row.stage} getTitle={row=>STAGE_SHORT[row.stage]||row.stage} getValue={row=>fmt(row.stuck_amount)} getSub={row=>`${row.stuck_count} stuck · ${fmt(row.total_amount)} total`} onClick={row=>drillStage(row.stage)}/>);
  const velocity = stall.velocity || { total: 108, forward: 62, backward: 42, won: 3, lost: 1 };
  const velocityDefs = [
    {key:'forward',label:'Forward (↑ Advanced)',color:'#059669'}, {key:'backward',label:'Backward (↓ Slipped)',color:'#dc2626'},
    {key:'won',label:'Won (🏆 Closed)',color:'#d97706'}, {key:'lost',label:'Lost (❌ Dropped)',color:'#64748b'},
  ];
  const velocityItems = velocityDefs.map(item => ({
    ...item,
    value: velocity[item.key] || 0,
    displayValue: velocity[item.key] || 0,
    onClick: onOpenMovement,
  }));
  const shortWeek = week => `W${String(week || '').replace(/[^0-9]/g, '')}`;
  const topOwners = (stall.top_stuck_owners||[]).map(row=>`${row.owner} owns ${fmt(row.amount)} stuck`).join(', ');

  return <>
    <div className="anote">📌 <strong>Staleness = No Stage Change</strong> in weekly CRM snapshots — independent of activity logging. Formula: <code className="stage-formula">Days Stuck = days since the deal's stage last changed</code>. Observation window: <strong>{stall.observation_start||'first week'} → {stall.observation_end||data.selected_week}</strong>.</div>

    <div className="krow k4">{BUCKETS.map(bucket => <div className={`kc ${bucket.cls}`} key={bucket.key} onClick={()=>drillBucket(bucket.key)}><div className="kl">{bucket.label} ({bucket.range})</div><div className="kv">{buckets[bucket.key]?.count||0}</div><div className="kd"><span style={{color:bucket.color,fontWeight:600}}>deals · {fmt(buckets[bucket.key]?.amount||0)} pipeline</span></div><div className="kh">{bucket.hint}</div><div className="click-hint">🔍 Click → see deals</div></div>)}</div>

    <div className="pl-alert">🔴 <strong>Critical:</strong> {stall.stuck_count||0} deals ({fmt(stall.stuck_amount||0)} = {stall.stuck_pct||0}% of active valued pipeline) have had <strong>zero stage movement for 90+ days</strong>. This is the primary pipeline quality risk — not activity logging.{topOwners && ` ${topOwners}.`}</div>

    <div className="g2">
      <div className="pl-card pl-card-clickable" onClick={()=>drillBucket('never')}><div className="pl-card-title">Pipeline by Stage-Movement Staleness <span className="stage-chart-click">↗ Click → deals</span></div><div className="pl-card-sub">How much pipeline is stuck at each staleness level</div><StalenessChart buckets={buckets} onBucket={drillBucket}/></div>
      <div className="pl-card pl-card-clickable" onClick={openRepOverview}><div className="pl-card-title">Stuck Pipeline by Rep (90+ days no stage change) <span className="stage-chart-click">↗ Click bar → rep deals</span></div><div className="pl-card-sub">Who owns the most stagnant pipeline</div><RepStallChart rows={repRows} onRep={owner=>{drillRep(owner);}}/></div>
    </div>
    <div className="g2">
      <div className="pl-card pl-card-clickable" onClick={openStageOverview}><div className="pl-card-title">Stage Stall Analysis — Where Deals Get Stuck <span className="stage-chart-click">↗ Click bar → stage deals</span></div><div className="pl-card-sub">90+ days no movement · by stage · grey = total stage pipeline</div><StageStallChart rows={stageRows} onStage={stage=>drillStage(stage)}/></div>
      <div className="pl-card pl-card-clickable" onClick={onOpenMovement}><div className="pl-card-title">{shortWeek(movement.from_week)}→{shortWeek(movement.to_week||data.selected_week)} Movement Velocity <span className="stage-chart-click">↗ Click → movement detail</span></div><div className="pl-card-sub">{velocity.total} deals changed stage · breakdown by direction</div><DonutChart items={velocityItems} radius={75}/></div>
    </div>

    <div className="pl-card stage-register"><div className="pl-card-title">🔴 Stale Deal Register — No Stage Movement · Click any row for full detail</div><div className="pl-card-sub">{deals.length} active deals · {fmt(sumAmount(deals))} pipeline · Sorted by days stuck</div><div className="stage-filter-row"><select className="fs" value={repFilter} onChange={event=>setRepFilter(event.target.value)}><option value="">All Reps</option>{allReps.map(rep=><option key={rep}>{rep}</option>)}</select><select className="fs" value={stageFilter} onChange={event=>setStageFilter(event.target.value)}><option value="">All Stages</option>{ACTIVE_STAGES.map(stage=><option key={stage}>{stage}</option>)}</select><select className="fs" value={bucketFilter} onChange={event=>setBucketFilter(event.target.value)}><option value="">All Staleness</option>{BUCKETS.map(bucket=><option key={bucket.key} value={bucket.key}>{bucket.label} ({bucket.range})</option>)}</select><span className="stage-filter-count">{tableDeals.length} deals · {fmt(sumAmount(tableDeals))}</span></div>
      <div className="pl-twrap"><table><thead><tr><th>Risk</th><th>Deal Name</th><th>Company</th><th>Stage (Stuck)</th><th>Amount</th><th>Owner</th><th>Region</th><th>Forecast</th><th>Close Qtr</th><th>Days Stuck</th><th>Stuck Since</th><th>Recommended Action</th></tr></thead><tbody>{tableDeals.map((deal,index)=>{const risk=riskFor(deal);return <tr key={deal.record_id||index} className="pl-tr-click" onClick={()=>openDeal(deal)}><td><span className={`b ${risk.cls}`}>{risk.label}</span></td><td className="stage-deal-name">{deal.deal_name}</td><td className="td2">{deal.company||'—'}</td><td><StageBadge stage={deal.stage}/></td><td className="stage-money">{fmt(deal.amount)}</td><td className="stage-owner-link" onClick={event=>{event.stopPropagation();onSelectRep?.(deal.owner);}}>{deal.owner||'—'} {onSelectRep&&'↗'}</td><td className="td2">{deal.region||'—'}</td><td><FcBadge fc={deal.forecast_category}/></td><td className="td2">{deal.close_quarter||'—'}</td><td><span className={`b ${deal.stall_bucket==='never'?'br':deal.stall_bucket==='long'?'bo':deal.stall_bucket==='medium'?'ba':'bg'}`}>{deal.days_stuck}d</span></td><td className="td3">{deal.stuck_since||'—'}</td><td className="stage-action">{deal.recommended_action}</td></tr>;})}{!tableDeals.length&&<tr><td colSpan="12" className="stage-empty">No deals match these filters.</td></tr>}</tbody></table></div>
    </div>

    <div className="g2">
      <div className="pl-card"><div className="pl-card-title">Rep Stale Pipeline — Click row to filter table</div><div className="pl-card-sub">90+ days no stage movement by rep</div><div className="pl-twrap"><table><thead><tr><th>Rep</th><th>Region</th><th>Stuck Deals</th><th>Stuck Pipeline</th><th>% of Rep Pipeline</th><th>Avg Days Stuck</th><th>Largest Stuck Deal</th></tr></thead><tbody>{repRows.map(row=><tr key={row.owner} className="pl-tr-click" onClick={()=>{setRepFilter(row.owner);document.querySelector('.stage-register')?.scrollIntoView({behavior:'smooth'});}}><td className="stage-owner-link">{row.owner}</td><td className="td2">{row.region||'—'}</td><td>{row.count}</td><td className="stage-money stage-red">{fmt(row.amount)}</td><td style={{fontWeight:700,color:row.stale_pct>=80?'#dc2626':row.stale_pct>=50?'#ea580c':row.stale_pct>=30?'#d97706':'#059669'}}>{row.stale_pct}%</td><td>{row.avg_days_stuck}d</td><td className="td3">{row.largest?`${row.largest.deal_name} (${fmt(row.largest.amount)})`:'—'}</td></tr>)}</tbody></table></div></div>
      <div className="pl-card"><div className="pl-card-title">Priority Action Matrix — Ranked by Urgency Score</div><div className="pl-card-sub">(Pipeline Value × Days Stuck) · Top 10 · Click row for deal detail</div><div className="pl-twrap"><table><thead><tr><th>#</th><th>Deal</th><th>Amount</th><th>Days Stuck</th><th>Score</th><th>Action</th></tr></thead><tbody>{priority.map((deal,index)=>{const risk=riskFor(deal);return <tr key={deal.record_id||index} className="pl-tr-click" onClick={()=>openDeal(deal)}><td className="td3">{index+1}</td><td className="stage-deal-name">{deal.deal_name}</td><td className="stage-money">{fmt(deal.amount)}</td><td><span className={`b ${deal.stall_bucket==='never'?'br':'bo'}`}>{deal.days_stuck}d</span></td><td style={{fontSize:13,fontWeight:900,color:risk.color}}>{deal.urgency_score}</td><td className="stage-action">{deal.recommended_action}</td></tr>;})}</tbody></table></div></div>
    </div>

    {drill&&<DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal}/>} 
    {activeDeal&&<DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={stage=>openDeals(`${stage} — Deals`,deals.filter(deal=>deal.stage===stage))}/>} 
  </>;
}

export { StageStall };
export default StageStall;
