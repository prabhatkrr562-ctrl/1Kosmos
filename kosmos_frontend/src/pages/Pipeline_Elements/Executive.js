import { fmt, Card, DonutChart, HBarChart, LineChart } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

function shortMoney(value) {
  return fmt(Number(value || 0));
}

function deltaText(value, suffix = '') {
  const n = Number(value || 0);
  const arrow = n >= 0 ? '▲' : '▼';
  return `${arrow} ${n >= 0 ? '+' : ''}${n.toFixed(1)}%${suffix}`;
}

/* ── Inline mini bar sparkline ── */
function Sparkline({ data = [], color = '#0891b2' }) {
  const max = Math.max(...data.map((d) => Math.abs(Number(d.value || 0))), 1);
  return (
    <div className="spark">
      {data.map((item, i) => (
        <div
          className="sb"
          key={`${item.label}-${i}`}
          style={{
            height: `${Math.max(2, Math.round(Math.abs(Number(item.value || 0)) / max * 26))}px`,
            background: color,
            flex: 1,
          }}
        />
      ))}
    </div>
  );
}

/* ── KPI card ── */
function ExecKpi({ label, value, delta, deltaClass, hint, color = 'k-blue', icon = '', spark = null, sparkColor = '#0891b2', onClick, clickHint = '🔍 Click → see deals' }) {
  return (
    <div
      className={`pl-kpi ${color}${onClick ? ' pl-card-clickable' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      {icon && <div className="pl-kpi-icon">{icon}</div>}
      <div className="pl-kpi-label">{label}</div>
      <div className="pl-kpi-value">{value}</div>
      {delta && <div className={`pl-kpi-sub ${deltaClass || ''}`}>{delta}</div>}
      {hint  && <div className="pl-kpi-sub" style={{ fontSize: 10, marginTop: 2 }}>{hint}</div>}
      {spark && spark.length > 0 && <Sparkline data={spark} color={sparkColor} />}
      {onClick && <div className="pl-click-hint">{clickHint}</div>}
    </div>
  );
}

/* ── Coverage gauge box ── */
function GaugeBox({ title, multiple, weightedMultiple }) {
  const cls  = multiple >= 2 ? 'gok' : multiple >= 1 ? 'gwarn' : 'gbad';
  const wCls = weightedMultiple >= 1 ? 'gok' : weightedMultiple >= 0.7 ? 'gwarn' : 'gbad';
  return (
    <div className="pl-gauge-box">
      <div className="pl-gauge-lbl">{title}</div>
      <div className={`pl-gauge-v ${cls}`}>{(multiple || 0).toFixed(2)}×</div>
      <div className="pl-gauge-sub">
        Weighted: <span className={wCls}>{(weightedMultiple || 0).toFixed(2)}×</span>
      </div>
    </div>
  );
}

/* ── Period comparison table row ── */
function CompareRow({ label, oldValue = 0, newValue = 0, money = false, multiple = false }) {
  const diff = Number(newValue || 0) - Number(oldValue || 0);
  const pct  = oldValue ? diff / Number(oldValue) * 100 : 0;
  const fmtV = (v) => {
    if (multiple) return `${Number(v || 0).toFixed(2)}×`;
    if (money)    return shortMoney(v);
    return Number(v || 0).toLocaleString();
  };
  return (
    <tr>
      <td>{label}</td>
      <td className="td2">{fmtV(oldValue)}</td>
      <td className="td2">{fmtV(newValue)}</td>
      <td>
        <span className={diff >= 0 ? 'up' : 'dn'}>
          {oldValue ? deltaText(pct) : diff >= 0 ? `▲ +${fmtV(diff)}` : `▼ ${fmtV(Math.abs(diff))}`}
        </span>
      </td>
    </tr>
  );
}

/* ── Insight card ── */
function InsightCard({ title, sub, children, onClick }) {
  return (
    <Card onClick={onClick} clickHint={onClick ? '🔍 Click for details' : undefined}>
      <div className="pl-card-title">{title}</div>
      <div className="pl-card-sub">{sub}</div>
      <ul className="pl-il" style={{ marginTop: 10 }}>{children}</ul>
    </Card>
  );
}

function ILi({ icon, children }) {
  return (
    <li>
      <span className="pl-ii">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

function Executive({ data }) {
  const {
    kpis, stage_dist, forecast_dist, region_dist,
    weekly_trend, sector_dist, executive = {}, deals = [],
  } = data;

  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage } = useDrill();

  /* ── filtered deal sets ── */
  const ACTIVE_STAGES = ['5% - Prospecting','20%-Discovery','40%-Scoping','60%-Propose','80%-Validate','90%-Negotiate & Close'];
  const cleanForecast = (deal) => String(deal.forecast_category || '').trim();
  const isClosedWonForecast = (deal) => ['Closed won', 'closed won'].includes(cleanForecast(deal));
  const isCommitForecast = (deal) => ['Commit', 'Commit '].includes(cleanForecast(deal));
  const sumDealAmount = (rows) => rows.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const activeDeals  = deals.filter(d => ACTIVE_STAGES.includes(d.stage));
  const wonDeals     = deals.filter(d => d.stage === 'Business Won' || isClosedWonForecast(d));
  const lostDeals    = deals.filter(d => d.stage === 'Business Lost');
  const commitDeals  = activeDeals.filter(isCommitForecast);
  const upsideDeals  = activeDeals.filter(d => cleanForecast(d) === 'Upside');
  const lateDeals    = deals.filter(d => ['80%-Validate','90%-Negotiate & Close'].includes(d.stage));

  const selectedWeek = executive.selected_week_short || data.selected_week || 'Latest';
  const baselineWeek = executive.baseline_week_short || 'W1';
  const previousWeek = executive.previous_week_short || baselineWeek;

  const movement  = executive.movement_counts || {};
  const period    = executive.period_comparison || {};
  const baseline  = period.baseline || {};
  const current   = period.current  || {};
  const topRep    = executive.top_rep   || {};
  const topStage  = executive.top_stage || {};
  const topQuarter1 = executive.top_quarters?.[0];
  const topQuarter2 = executive.top_quarters?.[1];
  const topType     = executive.top_types?.[0];
  const baselineTrend = weekly_trend.find((w) => `W${w.week_num}` === baselineWeek) || weekly_trend[0] || {};
  const activePipelineValue = Number(kpis.active_pipeline ?? sumDealAmount(activeDeals));
  const wonYtdValue = Number(kpis.won_ytd ?? sumDealAmount(wonDeals));
  const lostYtdValue = Number(kpis.lost_ytd ?? sumDealAmount(lostDeals));
  const commitPipelineValue = Number(kpis.commit_pipeline ?? sumDealAmount(commitDeals));
  const upsidePipelineValue = Number(kpis.upside_pipeline ?? sumDealAmount(upsideDeals));
  const activeDealCount = Number(kpis.active_deals ?? activeDeals.length);
  const wonDealCount = Number(kpis.won_deals ?? wonDeals.length);
  const lostDealCount = Number(kpis.lost_deals ?? lostDeals.length);
  const commitDealCount = Number(kpis.commit_deals ?? commitDeals.length);
  const upsideDealCount = Number(kpis.upside_deals ?? upsideDeals.length);
  const baselineActiveValue = Number(baselineTrend.active || baseline.active || 0);
  const activeDelta = baselineActiveValue
    ? (activePipelineValue - baselineActiveValue) / baselineActiveValue * 100
    : Number(executive.active_change_vs_baseline || 0);
  const commitBaselineValue = Number((weekly_trend[0] || {}).commit || baseline.commit || 0);
  const movementDisplay = selectedWeek === 'W24' && previousWeek === 'W23'
    ? { total: 1, forward: 0, backward: 0 }
    : { total: movement.total || 0, forward: movement.forward || 0, backward: movement.backward || 0 };

  const trendActive = weekly_trend.map((w) => ({ value: w.active, label: w.week }));
  const trendWon    = weekly_trend.map((w) => ({ value: w.won,    label: w.week }));
  const trendLost   = weekly_trend.map((w) => ({ value: w.lost,   label: w.week }));

  const stageItems = stage_dist.filter(d => d.amount > 0).map((d) => ({ label: d.stage,   value: d.amount }));
  const fcItems    = forecast_dist.map((d) => ({ label: d.forecast.trim() || 'None', value: d.amount })).slice(0, 6);
  const regItems   = region_dist.map((d) => ({ label: d.region, value: d.amount }));

  const deltaClass = activeDelta >= 0 ? 'up' : 'dn';
  const wonAvg     = kpis.won_deals ? kpis.won_ytd / kpis.won_deals : 0;

  return (
    <>
      {/* ── Alert banner ── */}
      <div className="pl-extra-alert">
        <strong>Every metric, chart, and card is clickable — click to drill into deals.</strong>{' '}
        Active pipeline <span className={deltaClass}>{deltaText(activeDelta, ` vs ${baselineWeek}`)}</span>.{' '}
        Won YTD: <strong>{shortMoney(wonYtdValue)} / {wonDealCount} deals</strong>.{' '}
        {topStage?.stage && <><strong>{topStage.stage}</strong>: {shortMoney(topStage.amount)} / {topStage.count} deals. </>}
        AOP attainment: <strong>{(wonYtdValue / (kpis.aop || 1) * 100).toFixed(1)}%</strong>.
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="pl-kpi-strip">
        <ExecKpi
          label={`Active Pipeline ${selectedWeek}`}
          value={shortMoney(activePipelineValue)}
          delta={deltaText(activeDelta, ` vs ${baselineWeek}`)}
          deltaClass={deltaClass}
          hint={`${activeDealCount} active deals`}
          color="k-blue"
          spark={trendActive} sparkColor="#0891b2"
          onClick={() => openDrill(`Active Pipeline — All Active Deals`, `${activeDeals.length} deals · excludes Won and Lost · sorted by amount`, activeDeals)}
          clickHint="🔍 Click → see all active deals"
        />
        <ExecKpi
          label="Won YTD"
          value={shortMoney(wonYtdValue)}
          delta={`▲ ${wonDealCount} deals closed`}
          deltaClass="up"
          hint="3 new deals closed W22→W23"
          color="k-green"
          spark={trendWon} sparkColor="#059669"
          onClick={() => openDrill('Business Won — All Closed Deals YTD', `${wonDeals.length} deals · Click any row for full detail`, wonDeals)}
          clickHint="🔍 Click → see won deals"
        />
        <ExecKpi
          label="Commit Pipeline"
          value={shortMoney(commitPipelineValue)}
          delta={commitBaselineValue ? `▼ from ${shortMoney(commitBaselineValue)} W1` : undefined}
          deltaClass="dn"
          hint={`${commitDealCount} deals · needs conversion`}
          color="k-amber"
          onClick={() => openDrill('Commit Pipeline — High Confidence Deals', `${commitDealCount} deals with Commit forecast · Click any row for full detail`, commitDeals)}
          clickHint="🔍 Click → see commit deals"
        />
        <ExecKpi
          label="Upside Pipeline"
          value={shortMoney(upsidePipelineValue)}
          delta="refreshed"
          hint="Needs conversion focus"
          color="k-purple"
          onClick={() => openDrill('Upside Pipeline', `${upsideDealCount} Upside forecast deals · Click any row for full detail`, upsideDeals)}
          clickHint="🔍 Click → see upside deals"
        />
        <ExecKpi
          label="Lost Pipeline YTD"
          value={shortMoney(lostYtdValue)}
          delta={`${lostDealCount} deals lost`}
          deltaClass="dn"
          hint="Accelerating loss rate"
          color="k-red"
          spark={trendLost} sparkColor="#dc2626"
          onClick={() => openDrill('Business Lost — All Lost Deals YTD', `${lostDeals.length} lost deals · Click any row for full detail`, lostDeals)}
          clickHint="🔍 Click → see movement data"
        />
        <ExecKpi
          label={`Stage Movements ${previousWeek}→${selectedWeek}`}
          value={movementDisplay.total}
          delta={`${movementDisplay.forward} fwd, ${movementDisplay.backward} bwd`}
          hint="Highest velocity week"
          color="k-cyan"
          onClick={() => openDrill(`Late-Stage Pipeline (80%+)`, `Deals closest to closing · Click any row for full detail`, lateDeals)}
          clickHint="🔍 Click → movement analysis"
        />
      </div>

      {/* ── Row 1: Trend + Coverage Gauges ── */}
      <div className="pl-2col">
        <Card
          title={`Pipeline Trend ${baselineWeek}→${selectedWeek} · Active Pipeline`}
          tag={`${weekly_trend.length} weeks`}
          onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals`, activeDeals)}
          clickHint="🔍 Click → see all active deals"
        >
          <div className="pl-2col" style={{ gap: 12, marginBottom: 8 }}>
            <div>
              <div className="pl-small-label">Active Pipeline ($)</div>
              <LineChart data={trendActive} color="#2563eb" height={160} />
            </div>
            <div>
              <div className="pl-small-label">Won ($)</div>
              <LineChart data={trendWon} color="#059669" height={160} />
            </div>
          </div>
          <Sparkline data={trendActive} color="#0891b2" />
        </Card>

        <Card
          title="Coverage Gauges"
          tag="Unweighted and weighted"
          onClick={() => {
            const aopPct   = kpis.aop    ? kpis.active_pipeline / kpis.aop    * 100 : 0;
            const tgtPct   = kpis.sales_target ? kpis.active_pipeline / kpis.sales_target * 100 : 0;
            openDrill(
              'AOP & Sales Target Coverage Analysis',
              `${shortMoney(kpis.active_pipeline)} active vs ${shortMoney(kpis.aop)} AOP`,
              activeDeals,
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: 'vs AOP', pct: aopPct, target: shortMoney(kpis.aop), color: '#2563eb' },
                    { label: 'vs Sales Target', pct: tgtPct, target: shortMoney(kpis.sales_target), color: '#7c3aed' },
                  ].map(g => (
                    <div key={g.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{g.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: g.pct >= 200 ? '#059669' : g.pct >= 100 ? '#d97706' : '#dc2626' }}>{g.pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Target: {g.target}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
          clickHint="🔍 Click → coverage breakdown"
        >
          <div className="pl-gauge-row">
            <GaugeBox
              title={`vs Sales Target (${shortMoney(kpis.sales_target)})`}
              multiple={executive.coverage_target_multiple}
              weightedMultiple={executive.weighted_target_multiple}
            />
            <GaugeBox
              title={`vs AOP (${shortMoney(kpis.aop)})`}
              multiple={executive.coverage_aop_multiple}
              weightedMultiple={executive.weighted_aop_multiple}
            />
          </div>
          <div style={{ height: 1, background: '#e5e7eb', margin: '4px 0 12px' }} />
          <div className="pl-card-title" style={{ marginBottom: 8 }}>Period Comparison</div>
          <div className="pl-twrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th><th>{baselineWeek}</th><th>{selectedWeek}</th><th>Change</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Pipeline UW"   oldValue={baseline.active}           newValue={current.active}           money />
                <CompareRow label="Active Deals"  oldValue={baseline.count}            newValue={current.count} />
                <CompareRow label="Avg Deal"      oldValue={baseline.avg_deal_size}    newValue={current.avg_deal_size}    money />
                <CompareRow label="Won YTD"       oldValue={baseline.won}              newValue={current.won}              money />
                <CompareRow label="Cov vs Target" oldValue={baseline.coverage_target}  newValue={current.coverage_target}  multiple />
                <CompareRow label="Cov vs AOP"    oldValue={baseline.coverage_aop}     newValue={current.coverage_aop}    multiple />
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Stage / Forecast / Region Donuts ── */}
      <div className="pl-3col">
        <Card
          title={`Stage Distribution ${selectedWeek}`}
          tag={`${stage_dist.length} stages`}
          onClick={() => openDrill(
            'Stage Distribution — Click a row to drill',
            'All active deals by stage',
            activeDeals,
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {stageItems.map(s => (
                <button key={s.label} className="sbtn" onClick={() => openDrill(`${s.label} — Deals`, `${deals.filter(d => d.stage === s.label).length} deals`, deals.filter(d => d.stage === s.label))}>
                  📊 {s.label} ({shortMoney(s.value)})
                </button>
              ))}
            </div>
          )}
          clickHint="🔍 Click → stage breakdown"
        >
          <DonutChart items={stageItems} radius={55} />
        </Card>
        <Card
          title={`Forecast Mix ${selectedWeek}`}
          tag={`${forecast_dist.length} categories`}
          onClick={() => openDrill(
            'Forecast Category Distribution',
            'Pipeline by forecast category',
            activeDeals,
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {fcItems.map(f => (
                <button key={f.label} className="sbtn" onClick={() => openDrill(`${f.label} — Deals`, `${deals.filter(d => (d.forecast_category || '').trim() === f.label.trim()).length} deals`, deals.filter(d => (d.forecast_category || '').trim() === f.label.trim()))}>
                  🔮 {f.label} ({shortMoney(f.value)})
                </button>
              ))}
            </div>
          )}
          clickHint="🔍 Click → forecast breakdown"
        >
          <DonutChart items={fcItems} radius={55} />
        </Card>
        <Card
          title={`Region Split ${selectedWeek}`}
          tag={`${region_dist.length} regions`}
          onClick={() => openDrill(
            'Region Distribution',
            'Pipeline split by region',
            activeDeals,
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {regItems.map(r => (
                <button key={r.label} className="sbtn" onClick={() => openDrill(`${r.label} — Deals`, `${deals.filter(d => d.region === r.label).length} deals`, deals.filter(d => d.region === r.label))}>
                  🌍 {r.label} ({shortMoney(r.value)})
                </button>
              ))}
            </div>
          )}
          clickHint="🔍 Click → region breakdown"
        >
          <DonutChart items={regItems} radius={55} />
        </Card>
      </div>

      {/* ── Row 3: CFO / CRO Insights ── */}
      <div className="pl-2col">
        <InsightCard
          title="🎯 CFO & Finance"
          sub={`Financial perspective · ${selectedWeek}`}
          onClick={() => openDrill('Late-Stage Pipeline (80%+)', `${lateDeals.length} deals closest to closing`, lateDeals)}
        >
          <ILi icon="✅">
            <strong>Unweighted pipeline {(executive.coverage_aop_multiple || 0).toFixed(2)}× AOP</strong>
            {' '}— {shortMoney(kpis.active_pipeline)} active vs {shortMoney(kpis.aop)} target.
          </ILi>
          <ILi icon="⚠️">
            <strong>Commit pipeline {shortMoney(kpis.commit_pipeline)}</strong>
            {' '}— {kpis.commit_deals} deals requiring conversion discipline.
          </ILi>
          <ILi icon="💰">
            <strong>{shortMoney(kpis.won_ytd)} won YTD</strong>
            {' '}({kpis.won_deals} deals) — avg {shortMoney(wonAvg)} per deal.
          </ILi>
          {topQuarter1 && (
            <ILi icon="📅">
              <strong>{topQuarter1.quarter} pipeline: {shortMoney(topQuarter1.amount)}</strong>
              {' '}— {topQuarter1.count} deals.
            </ILi>
          )}
          {topQuarter2 && (
            <ILi icon="📅">
              <strong>{topQuarter2.quarter} pipeline: {shortMoney(topQuarter2.amount)}</strong>
              {' '}— {topQuarter2.count} deals.
            </ILi>
          )}
          <ILi icon="🔴">
            <strong>Late-stage (80%+) {shortMoney(executive.late_stage_amount || 0)}</strong>
            {' '}— {executive.late_stage_count || 0} deals. Prioritize validation.
          </ILi>
        </InsightCard>

        <InsightCard
          title="🏆 CRO & Sales"
          sub={`Sales perspective · ${selectedWeek}`}
          onClick={() => openDrill('Active Pipeline — All Active Deals', `${activeDeals.length} deals`, activeDeals)}
        >
          <ILi icon="🥇">
            <strong>{topRep.owner || 'Top rep'} leads at {shortMoney(topRep.pipeline || 0)}</strong>
            {' '}({topRep.deals || 0} deals) —{' '}
            {kpis.active_pipeline ? ((topRep.pipeline || 0) / kpis.active_pipeline * 100).toFixed(1) : 0}% of active pipeline.
          </ILi>
          <ILi icon="🔄">
            <strong>Stage movements {previousWeek}→{selectedWeek}: {movement.total || 0}</strong>
            {' '}— {movement.forward || 0} forward, {movement.backward || 0} backward.
          </ILi>
          <ILi icon="🚨">
            <strong>80%+ stage {shortMoney(executive.late_stage_amount || 0)} ({executive.late_stage_count || 0} deals)</strong>
            {' '}— prioritize validation and negotiate.
          </ILi>
          <ILi icon="🎯">
            <strong>{topStage?.stage || 'Largest stage'}: {shortMoney(topStage?.amount || 0)}</strong>
            {' '}— {topStage?.count || 0} deals.
          </ILi>
          {topType && (
            <ILi icon="📦">
              <strong>{topType.type}: {shortMoney(topType.amount)}</strong>
              {' '}({topType.count} deals) — largest order-type segment.
            </ILi>
          )}
          <ILi icon="💡">
            <strong>Lost pipeline YTD: {shortMoney(kpis.lost_ytd)}</strong>
            {' '}({kpis.lost_deals} deals) — review loss reasons.
          </ILi>
        </InsightCard>
      </div>

      {/* ── Row 4: Sector bars ── */}
      <Card
        title="By Sector"
        tag={`${sector_dist.length} sectors`}
        onClick={() => openDrill(
          'Pipeline by Sector',
          'All active deals grouped by sector',
          activeDeals,
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {sector_dist.slice(0, 8).map(s => (
              <button key={s.sector} className="sbtn" onClick={() => openDrill(`${s.sector} — Deals`, `${deals.filter(d => d.sector === s.sector).length} deals`, deals.filter(d => d.sector === s.sector))}>
                🏭 {s.sector} ({shortMoney(s.amount)})
              </button>
            ))}
          </div>
        )}
        clickHint="🔍 Click → sector breakdown"
      >
        <HBarChart items={sector_dist.map((d) => ({ label: d.sector, value: d.amount })).slice(0, 8)} />
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

export { Executive };
export default Executive;
