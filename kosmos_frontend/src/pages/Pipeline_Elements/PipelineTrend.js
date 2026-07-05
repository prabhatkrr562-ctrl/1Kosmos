import { fmt, fmtN, Card, LineChart, MultiLineChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const ACTIVE_STAGE_KEYS = [
  '5% - Prospecting', '20%-Discovery', '40%-Scoping',
  '60%-Propose', '80%-Validate', '90%-Negotiate & Close',
];

const STAGE_SHORT = {
  '5% - Prospecting':       '5% Prosp',
  '20%-Discovery':           '20% Disc',
  '40%-Scoping':             '40% Scope',
  '60%-Propose':             '60% Prop',
  '80%-Validate':            '80% Val',
  '90%-Negotiate & Close':   '90% Neg',
};

const STAGE_COLORS_MAP = {
  '5% - Prospecting':       '#6b7280',
  '20%-Discovery':           '#0891b2',
  '40%-Scoping':             '#2563eb',
  '60%-Propose':             '#7c3aed',
  '80%-Validate':            '#d97706',
  '90%-Negotiate & Close':   '#dc2626',
};

/* ── Full pipeline trend: Active + Won vs AOP/Target reference lines ── */
function TrendMainChart({ weeklyTrend = [], aop = 0, target = 0, height = 200 }) {
  if (!weeklyTrend.length) return null;
  const activeData = weeklyTrend.map(w => ({ value: w.active, label: `W${w.week_num}` }));
  const wonData    = weeklyTrend.map(w => ({ value: w.won,    label: `W${w.week_num}` }));
  const allVals    = [...activeData, ...wonData].map(d => d.value).concat(
    aop    > 0 ? [aop]    : [],
    target > 0 ? [target] : [],
  );
  const max  = Math.max(...allVals, 1);
  const W = 600, H = height;
  const pad = { l: 12, r: 56, t: 14, b: 26 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;
  const n   = activeData.length;
  const yOf = v => pad.t + (1 - v / max) * iH;
  const pts  = data => data.map((d, i) => [pad.l + (i / (n - 1 || 1)) * iW, yOf(d.value)]);
  const line = p => p.map(q => q.join(',')).join(' ');
  const aPts = pts(activeData);
  const wPts = pts(wonData);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {aop > 0 && (
        <>
          <line x1={pad.l} y1={yOf(aop)} x2={W - pad.r} y2={yOf(aop)} stroke="#d97706" strokeWidth="1.2" strokeDasharray="6,3" opacity=".8" />
          <text x={W - pad.r + 4} y={yOf(aop) + 4} fontSize="9" fill="#d97706" fontWeight="700">AOP</text>
        </>
      )}
      {target > 0 && (
        <>
          <line x1={pad.l} y1={yOf(target)} x2={W - pad.r} y2={yOf(target)} stroke="#dc2626" strokeWidth="1.2" strokeDasharray="6,3" opacity=".8" />
          <text x={W - pad.r + 4} y={yOf(target) + 4} fontSize="9" fill="#dc2626" fontWeight="700">Target</text>
        </>
      )}
      <polyline points={line(aPts)} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(wPts)} fill="none" stroke="#059669" strokeWidth="2"   strokeLinejoin="round" strokeLinecap="round" />
      {activeData.map((d, i) => (
        <text key={i} x={aPts[i][0]} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{d.label}</text>
      ))}
    </svg>
  );
}

/* ── Week-over-Week active pipeline change bar chart ── */
function WoWBarChart({ weeklyTrend = [], height = 150 }) {
  if (weeklyTrend.length < 2) return null;
  const changes = weeklyTrend.slice(1).map((w, i) => ({
    label: `W${w.week_num}`,
    value: w.active - weeklyTrend[i].active,
  }));
  const maxAbs = Math.max(...changes.map(c => Math.abs(c.value)), 1);
  const W = 600, H = height;
  const pad = { l: 10, r: 10, t: 10, b: 24 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;
  const midY = pad.t + iH / 2;
  const bW   = (iW / changes.length) * 0.65;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      <line x1={pad.l} y1={midY} x2={W - pad.r} y2={midY} stroke="#d1d5db" strokeWidth="1" />
      {changes.map((c, i) => {
        const x  = pad.l + (i + 0.5) * (iW / changes.length);
        const bH = Math.max((Math.abs(c.value) / maxAbs) * (iH / 2 - 2), 1);
        const y  = c.value >= 0 ? midY - bH : midY;
        return (
          <g key={i}>
            <rect x={x - bW / 2} y={y} width={bW} height={bH} fill={c.value >= 0 ? '#059669' : '#dc2626'} rx="1" opacity=".85" />
            <text x={x} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{c.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Stacked bar chart for stage evolution by week ── */
function StackedBarChart({ weeklyStage = [], height = 220 }) {
  if (!weeklyStage.length) return null;
  const stages   = ACTIVE_STAGE_KEYS;
  const maxTotal = Math.max(
    ...weeklyStage.map(w => stages.reduce((s, st) => s + (w.stages[st] || 0), 0)),
    1,
  );
  const W = 600, H = height;
  const pad = { l: 10, r: 10, t: 10, b: 24 };
  const iW  = W - pad.l - pad.r;
  const iH  = H - pad.t - pad.b;
  const bW  = (iW / weeklyStage.length) * 0.7;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-trend-svg" style={{ display: 'block' }}>
      {weeklyStage.map((w, wi) => {
        const x    = pad.l + (wi + 0.5) * (iW / weeklyStage.length);
        let   yBot = pad.t + iH;
        return (
          <g key={wi}>
            {stages.map(st => {
              const val = w.stages[st] || 0;
              if (!val) return null;
              const bH = (val / maxTotal) * iH;
              yBot -= bH;
              return <rect key={st} x={x - bW / 2} y={yBot} width={bW} height={bH} fill={STAGE_COLORS_MAP[st]} opacity=".85" />;
            })}
            <text x={x} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{`W${w.week_num}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Status badge logic for stage movement table ── */
function stageStatus(stage, change, baseline) {
  const high = ['90%-Negotiate & Close', '80%-Validate'];
  const pct  = baseline ? Math.abs(change) / baseline * 100 : 0;
  if (high.includes(stage)) {
    if (change < -300000) return { label: '🚨 Critical',  cls: 'br' };
    if (change > 0)       return { label: '✅ Excellent', cls: 'bg' };
    return { label: '→ Stable', cls: 'bc' };
  }
  if (stage === '5% - Prospecting') {
    return change > 0 ? { label: '↑ Growing', cls: 'bb' } : { label: '→ Stable', cls: 'bc' };
  }
  if (change > 0 && pct > 3)                       return { label: '↑ Growing',   cls: 'bb' };
  if (Math.abs(change) < 200000 || pct < 3)         return { label: '→ Stable',   cls: 'bc' };
  return { label: '⚠ Declining', cls: 'ba' };
}

/* ══════════════════════════════════════════════════════════════════════════ */

function PipelineTrend({ data }) {
  const {
    weekly_trend        = [],
    weekly_stage_trend  = [],
    baseline_stage_dist = {},
    stage_dist          = [],
    kpis                = {},
    executive           = {},
    deals               = [],
  } = data;

  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage } = useDrill();

  if (!weekly_trend.length) return <div className="pl-empty"><p>No trend data available.</p></div>;

  const ACTIVE_STAGES = ACTIVE_STAGE_KEYS;
  const activeDeals = deals.filter(d => ACTIVE_STAGES.includes(d.stage));
  const wonDeals    = deals.filter(d => d.stage === 'Business Won');
  const lostDeals   = deals.filter(d => d.stage === 'Business Lost');

  const baselineWeek = executive.baseline_week_short || `W${weekly_trend[0]?.week_num || 1}`;
  const selectedWeek = executive.selected_week_short  || `W${weekly_trend[weekly_trend.length - 1]?.week_num || '?'}`;

  const countData = weekly_trend.map(w => ({ value: w.count, label: `W${w.week_num}` }));
  const wonData   = weekly_trend.map(w => ({ value: w.won,   label: `W${w.week_num}` }));
  const lostData  = weekly_trend.map(w => ({ value: w.lost,  label: `W${w.week_num}` }));

  const currentStageDist = {};
  stage_dist.forEach(d => { currentStageDist[d.stage] = d.amount; });

  return (
    <>
      {/* ── Row 1: Full Pipeline Trend ── */}
      <Card
        title={`Full Pipeline Trend ${baselineWeek}→${selectedWeek} ↗`}
        tag="Active pipeline + Won cumulative vs AOP and Sales Target"
        onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals · sorted by amount`, activeDeals)}
        clickHint="🔍 Click any point → that week's deals"
      >
        <TrendMainChart
          weeklyTrend={weekly_trend}
          aop={kpis.aop || 0}
          target={kpis.sales_target || 0}
          height={200}
        />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, flexWrap: 'wrap' }}>
          <span><span style={{ color: '#2563eb', fontWeight: 700 }}>─</span> Active Pipeline</span>
          <span><span style={{ color: '#059669', fontWeight: 700 }}>─</span> Won Cumulative</span>
          {(kpis.aop || 0) > 0 && <span><span style={{ color: '#d97706', fontWeight: 700 }}>- -</span> AOP ({fmt(kpis.aop)})</span>}
          {(kpis.sales_target || 0) > 0 && <span><span style={{ color: '#dc2626', fontWeight: 700 }}>- -</span> Sales Target ({fmt(kpis.sales_target)})</span>}
        </div>
      </Card>

      {/* ── Row 2: WoW Change + Deal Count ── */}
      <div className="pl-2col">
        <Card
          title="Week-over-Week Change ($M)"
          tag="Green = growth · Red = decline"
          onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals · click any row for full detail`, activeDeals)}
          clickHint="🔍 Click bar → week deals"
        >
          <WoWBarChart weeklyTrend={weekly_trend} height={150} />
        </Card>
        <Card
          title="Active Deal Count by Week"
          tag="Total deals tracked per snapshot"
          onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals in current snapshot`, activeDeals)}
          clickHint="🔍 Click → see deals"
        >
          <LineChart data={countData} color="#0891b2" height={150} showLabels />
        </Card>
      </div>

      {/* ── Row 3: Won vs Lost cumulative + Stage Movement ── */}
      <div className="pl-2col">
        <Card
          title="Won vs Lost Cumulative ($M)"
          tag="Running total of won and lost pipeline"
          onClick={() => openDrill('Business Won — All Closed Deals YTD', `${wonDeals.length} won deals · sorted by amount`, wonDeals)}
          clickHint="🔍 Click → won deals"
        >
          <MultiLineChart
            series={[
              { data: wonData,  color: '#059669' },
              { data: lostData, color: '#dc2626' },
            ]}
            height={180}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
            <span><span style={{ color: '#059669', fontWeight: 700 }}>─</span> Won</span>
            <span><span style={{ color: '#dc2626', fontWeight: 700 }}>─</span> Lost</span>
          </div>
        </Card>

        <Card
          title={`Stage Movement ${baselineWeek} → ${selectedWeek}`}
          tag="Click rows to drill · pipeline value change by stage"
        >
          <div className="pl-twrap" style={{ marginTop: 4 }}>
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>{baselineWeek}</th>
                  <th>{selectedWeek}</th>
                  <th>Change</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...ACTIVE_STAGE_KEYS].reverse().map(stage => {
                  const base = baseline_stage_dist[stage] || 0;
                  const curr = currentStageDist[stage]   || 0;
                  const diff = curr - base;
                  const stageDeals = deals.filter(d => d.stage === stage);
                  const { label: statusLabel, cls: statusCls } = stageStatus(stage, diff, base);
                  return (
                    <tr
                      key={stage}
                      onClick={() => openDrill(`${stage} — Deals`, `${stageDeals.length} deals in this stage · Click any row for full detail`, stageDeals)}
                      style={{ cursor: 'pointer' }}
                      title={`Click to see ${stageDeals.length} deals`}
                    >
                      <td>{STAGE_SHORT[stage] || stage}</td>
                      <td className="td2">{fmtN(base)}</td>
                      <td className="td2">{fmtN(curr)}</td>
                      <td>
                        <span className={diff >= 0 ? 'up' : 'dn'}>
                          {diff >= 0 ? `+${fmtN(diff)}` : `−${fmtN(Math.abs(diff))}`}
                        </span>
                      </td>
                      <td><span className={`b ${statusCls}`}>{statusLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pl-click-hint" style={{ marginTop: 8 }}>🔍 Click any row → see stage deals</div>
        </Card>
      </div>

      {/* ── Row 4: Stage Evolution stacked ── */}
      <Card
        title="Stage Evolution — Stacked Pipeline by Week"
        tag={`Pipeline value by stage across all ${weekly_stage_trend.length} weeks`}
        onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals · full pipeline view`, activeDeals)}
        clickHint="🔍 Click → stage deals"
      >
        <StackedBarChart weeklyStage={weekly_stage_trend} height={220} />
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, flexWrap: 'wrap' }}>
          {ACTIVE_STAGE_KEYS.map(st => (
            <span key={st} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 10, height: 10,
                background: STAGE_COLORS_MAP[st],
                borderRadius: 2,
                display: 'inline-block',
                opacity: .85,
              }} />
              {STAGE_SHORT[st]}
            </span>
          ))}
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
          onDrillStage={(stage) => drillStage(stage, deals)}
        />
      )}
    </>
  );
}

export { PipelineTrend };
export default PipelineTrend;
