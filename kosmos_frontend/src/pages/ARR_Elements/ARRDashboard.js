import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtFull, dSign, mLbl } from './arrShared';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';
import {
  KpiCard,
  GaugeChart,
  SectionHeader,
  BarChart,
  Treemap,
  SankeyChart,
  WaterfallChart,
  SparkLine,
  MetricCard,
} from './arrShared';

const COLORS = ['#1e5fa8', '#15803d', '#6d28d9', '#0891b2', '#d97706', '#dc2626'];

const getPrevMonth = (month) => {
  if (!month) return '';
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (month, offset) => {
  if (!month) return '';
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const pct = (value, total) => (Number(total) > 0 ? ((Number(value || 0) / Number(total)) * 100).toFixed(1) : '0.0');
const moneyDash = (v) => (Math.abs(Number(v || 0)) > 0 ? fmtFull(v) : '-');
const fmtModalMoney = (v) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

function isNonEmptyChange(changes) {
  return !!changes && Object.values(changes).some((value) => Number(value || 0) !== 0);
}

function changeForDeal(deal, month) {
  const raw = deal.changes?.[month] || {};
  const normalized = {};
  Object.entries(raw).forEach(([k, v]) => {
    const key = k.trim().toLowerCase();
    normalized[key] = (normalized[key] || 0) + Number(v || 0);
  });
  return normalized;
}

function toDeal(row) {
  return {
    key_id: row.key_id,
    end_user: row.end_user || row.bill_to || 'Unspecified',
    region: row.business_unit || 'Unspecified',
    sales_person: row.sales_person || 'Unassigned',
    size: row.company_size || '',
    industry: row.industry || '',
    sub_product: row.sub_product_type || row.product_type || '',
    booking_type: row.line_of_business || row.deal_type || 'Commercial',
    mode: row.mode || '',
    contract_id: row.contract_id || '',
    contract_name: row.contract_name || '',
    order_status: row.order_status || row.booking_status || '',
    rec_non_rec: row.revenue_type || '',
    term_start: row.term_start || '',
    term_end: row.term_end || '',
    arr: row.monthly_arr || {},
    changes: row.monthly_changes || {},
  };
}

function buildReferenceData(records) {
  const deals = records.map(toDeal);
  const monthlyArr = {};
  const monthlyChanges = {};
  const monthSet = new Set();
  deals.forEach((deal) => {
    Object.entries(deal.arr || {}).forEach(([month, value]) => {
      monthSet.add(month);
      monthlyArr[month] = (monthlyArr[month] || 0) + Number(value || 0);
    });
    Object.entries(deal.changes || {}).forEach(([month, changes]) => {
      if (!isNonEmptyChange(changes)) return;
      monthSet.add(month);
      monthlyChanges[month] = monthlyChanges[month] || {};
      Object.entries(changes || {}).forEach(([type, amount]) => {
        monthlyChanges[month][type] = (monthlyChanges[month][type] || 0) + Number(amount || 0);
      });
    });
  });

  const allMonths = [...monthSet].sort();
  const latestFromArr = [...allMonths].reverse().find((m) => Number(monthlyArr[m] || 0) > 0) || '';
  const latestFromChanges = Object.keys(monthlyChanges).sort().at(-1) || '';
  const latestMonth = (latestFromChanges > latestFromArr ? latestFromChanges : latestFromArr) || allMonths.at(-1) || '';
  return { deals, monthlyArr, monthlyChanges, allMonths, latestMonth };
}

function computeFiltered(deals, allMonths, latestMonth, from, to) {
  const arr = {};
  const chg = {};
  allMonths.forEach((month) => {
    if (latestMonth && month > latestMonth) return;
    if (from && month < from) return;
    if (to && month > to) return;
    let monthArr = 0;
    const monthChg = {};
    deals.forEach((deal) => {
      if (deal.arr?.[month]) monthArr += Number(deal.arr[month] || 0);
      const changes = changeForDeal(deal, month);
      if (isNonEmptyChange(changes)) {
        Object.entries(changes).forEach(([type, amount]) => {
          monthChg[type] = (monthChg[type] || 0) + Number(amount || 0);
        });
      }
    });
    arr[month] = monthArr;
    if (Object.keys(monthChg).length) chg[month] = monthChg;
  });
  return { arr, chg };
}

function buildReferenceView(records, periodInfo = {}) {
  const ref = buildReferenceData(records);
  const { deals, allMonths, latestMonth, monthlyArr } = ref;
  const from = periodInfo.from || (latestMonth ? `${latestMonth.slice(0, 4)}-01` : '');
  const to = periodInfo.to || latestMonth;
  const comp = computeFiltered(deals, allMonths, latestMonth, from, to);
  const months = Object.keys(comp.arr).filter((m) => !latestMonth || m <= latestMonth).sort();
  const latest = months.at(-1) || latestMonth;
  const prev = getPrevMonth(latest);
  const curr = comp.arr[latest] || 0;
  const prv = comp.arr[prev] || 0;
  const allRangeMonths = allMonths.filter((m) => (!from || m >= from) && (!to || m <= to));

  let pNew = 0;
  let pUp = 0;
  let pRen = 0;
  let pChurn = 0;
  let pDn = 0;
  allRangeMonths.forEach((month) => {
    const c = comp.chg[month];
    if (!c) return;
    pNew += Math.max(0, Number(c.new || 0));
    pUp += Math.max(0, Number(c.upsell || 0));
    pRen += Number(c.renewal || 0);
    pChurn += Math.min(0, Number(c.churn || 0));
    pDn += Math.abs(Number(c.downsell || 0));
  });

  const sankeyPrevStart = from ? getPrevMonth(from) : '';
  const sankeyOpeningARR = deals.reduce((sum, deal) => (
    sum + Number(deal.arr?.[sankeyPrevStart] || deal.arr?.[from] || 0)
  ), 0);
  let sankeyNew = 0;
  let sankeyUp = 0;
  let sankeyRen = 0;
  let sankeyChurn = 0;
  let sankeyDn = 0;
  deals.forEach((deal) => {
    allRangeMonths.forEach((month) => {
      const c = changeForDeal(deal, month);
      if (!isNonEmptyChange(c)) return;
      sankeyNew += Math.abs(Number(c.new || 0));
      sankeyUp += Math.abs(Number(c.upsell || 0));
      sankeyRen += Math.abs(Number(c.renewal || 0));
      sankeyChurn += Math.abs(Number(c.churn || 0));
      sankeyDn += Math.abs(Number(c.downsell || 0));
    });
  });

  const priorYearDec = latest ? `${Number(latest.slice(0, 4)) - 1}-12` : '';
  const baseFromFiltered = deals.reduce((sum, deal) => sum + Number(deal.arr?.[priorYearDec] || 0), 0);
  const periodStartARR = comp.arr[priorYearDec] || baseFromFiltered || monthlyArr[priorYearDec] || comp.arr[months[0]] || 0;
  const nrrBase = periodStartARR;
  const periodChange = curr - periodStartARR;
  const periodChangePct = periodStartARR > 0 ? (periodChange / periodStartARR) * 100 : 0;
  const grr = nrrBase > 0 ? ((nrrBase + pChurn - pDn) / nrrBase) * 100 : 0;
  const nrr = nrrBase > 0 ? ((nrrBase + pChurn - pDn + pUp) / nrrBase) * 100 : 0;

  const ltmStart = shiftMonth(latest, -11);
  const ltmPrior = shiftMonth(ltmStart, -1);
  const ltmMonths = allMonths.filter((m) => (!ltmStart || m >= ltmStart) && (!latest || m <= latest));
  const ltmComp = computeFiltered(deals, allMonths, latestMonth, ltmStart, latest);
  const ltmPriorARR = deals.reduce((sum, deal) => sum + Number(deal.arr?.[ltmPrior] || 0), 0);
  let ltmNew = 0;
  let ltmUp = 0;
  let ltmChurn = 0;
  let ltmDn = 0;
  ltmMonths.forEach((month) => {
    const c = ltmComp.chg[month];
    if (!c) return;
    ltmNew += Math.max(0, Number(c.new || 0));
    ltmUp += Math.max(0, Number(c.upsell || 0));
    ltmChurn += Math.min(0, Number(c.churn || 0));
    ltmDn += Math.abs(Number(c.downsell || 0));
  });
  const ltmGrr = ltmPriorARR > 0 ? ((ltmPriorARR + ltmChurn - ltmDn) / ltmPriorARR) * 100 : grr;
  const ltmNrr = ltmPriorARR > 0 ? ((ltmPriorARR + ltmChurn - ltmDn + ltmUp) / ltmPriorARR) * 100 : nrr;

  const trend = months
    .filter((month) => !latestMonth || (month <= latestMonth && Number(comp.arr[month] || 0) > 0))
    .map((month) => ({ month, value: Number(comp.arr[month] || 0) }));
  const playTrend = allMonths
    .filter((month) => !latestMonth || (month <= latestMonth && Number(monthlyArr[month] || 0) > 0))
    .map((month) => ({ month, value: Number(monthlyArr[month] || 0) }));

  const waterfall = allRangeMonths.slice(-18).map((month) => {
    const c = comp.chg[month] || {};
    return {
      month,
      new: Number(c.new || 0),
      upsell: Number(c.upsell || 0),
      renewal: Number(c.renewal || 0),
      churn: Number(c.churn || 0),
      downsell: Number(c.downsell || 0),
    };
  });

  return {
    ...ref,
    from,
    to,
    months,
    latest,
    prev,
    curr,
    prv,
    pNew,
    pUp,
    pRen,
    pChurn,
    pDn,
    nrrBase,
    periodStartARR,
    periodChange,
    periodChangePct,
    grr,
    nrr,
    ltmMonths,
    ltmPriorARR,
    ltmNew,
    ltmUp,
    ltmChurn,
    ltmDn,
    ltmGrr,
    ltmNrr,
    sankeyOpeningARR,
    sankeyNew,
    sankeyUp,
    sankeyRen,
    sankeyChurn,
    sankeyDn,
    trend,
    playTrend,
    waterfall,
    allRangeMonths,
  };
}

function groupCurrent(deals, latest, field) {
  const groups = {};
  deals.forEach((deal) => {
    const label = deal[field] || 'Unspecified';
    groups[label] = groups[label] || { label, value: 0, contracts: 0 };
    groups[label].value += Number(deal.arr?.[latest] || 0);
    groups[label].contracts += 1;
  });
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function groupMetrics(deals, latest, prev, months, field) {
  const groups = {};
  deals.forEach((deal) => {
    const label = deal[field] || 'Unspecified';
    groups[label] = groups[label] || { label, value: 0, prev: 0, newWon: 0, churn: 0, contracts: 0 };
    const group = groups[label];
    group.value += Number(deal.arr?.[latest] || 0);
    group.prev += Number(deal.arr?.[prev] || 0);
    group.contracts += 1;
    months.forEach((month) => {
      const c = changeForDeal(deal, month);
      if (!isNonEmptyChange(c)) return;
      group.newWon += Math.max(0, Number(c.new || 0)) + Math.max(0, Number(c.upsell || 0));
      group.churn += Number(c.churn || 0) + Number(c.downsell || 0);
    });
  });
  return Object.values(groups)
    .map((group) => {
      const lost = Math.abs(Number(group.churn || 0));
      const nrr = group.prev > 0 ? ((group.prev - lost + group.newWon) / group.prev) * 100 : 0;
      return { ...group, mom: group.value - group.prev, nrr };
    })
    .sort((a, b) => b.value - a.value);
}

function groupProducts(deals, latest, months) {
  const groups = {};
  deals.forEach((deal) => {
    const label = deal.sub_product || 'Unspecified';
    groups[label] = groups[label] || { label, value: 0, newWon: 0, churn: 0, contracts: 0 };
    groups[label].value += Number(deal.arr?.[latest] || 0);
    groups[label].contracts += 1;
    months.forEach((month) => {
      const c = changeForDeal(deal, month);
      if (!isNonEmptyChange(c)) return;
      groups[label].newWon += Math.max(0, Number(c.new || 0)) + Math.max(0, Number(c.upsell || 0));
      groups[label].churn += Number(c.churn || 0) + Number(c.downsell || 0);
    });
  });
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function trendByField(deals, months, field, mode = 'arr') {
  const labels = [...new Set(deals.map((deal) => deal[field] || 'Unspecified'))];
  return labels.map((label) => ({
    label,
    data: months.map((month) => {
      let value = 0;
      deals.forEach((deal) => {
        if ((deal[field] || 'Unspecified') !== label) return;
        if (mode === 'arr') {
          value += Number(deal.arr?.[month] || 0);
        } else {
          const c = changeForDeal(deal, month);
          value += Math.max(0, Number(c.new || 0)) + Math.max(0, Number(c.upsell || 0));
        }
      });
      return { month, value };
    }),
  })).filter((series) => series.data.some((point) => Number(point.value || 0) !== 0));
}

function buildCustomerRows(deals, latest, prev, months) {
  const rows = {};
  deals.forEach((deal) => {
    const key = `${deal.end_user}||${deal.sub_product}`;
    rows[key] = rows[key] || {
      customer: deal.end_user,
      region: deal.region,
      sub_product: deal.sub_product || '-',
      sales_person: deal.sales_person,
      curr_arr: 0,
      prev_arr: 0,
      new_won: 0,
      period_churn: 0,
      trend: months.map((month) => ({ month, value: 0 })),
    };
    const row = rows[key];
    row.curr_arr += Number(deal.arr?.[latest] || 0);
    row.prev_arr += Number(deal.arr?.[prev] || 0);
    row.trend.forEach((point) => {
      point.value += Number(deal.arr?.[point.month] || 0);
    });
    months.forEach((month) => {
      const c = changeForDeal(deal, month);
      if (!isNonEmptyChange(c)) return;
      if (Number(c.new || 0) > 0) row.new_won += Number(c.new || 0);
      if (Number(c.upsell || 0) > 0) row.new_won += Number(c.upsell || 0);
      if (c.churn) row.period_churn += Number(c.churn || 0);
      row.period_churn += Number(c.downsell || 0);
    });
  });
  return Object.values(rows)
    .map((row) => ({ ...row, mom: row.curr_arr - row.prev_arr }))
    .sort((a, b) => b.curr_arr - a.curr_arr);
}

function TrendPlaybackChart({ data = [] }) {
  const [idx, setIdx] = useState(Math.max(0, data.length - 1));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(450);

  useEffect(() => {
    setIdx(Math.max(0, data.length - 1));
    setPlaying(false);
  }, [data]);

  useEffect(() => {
    if (!playing || data.length < 2) return undefined;
    const timer = setInterval(() => {
      setIdx((current) => {
        if (current >= data.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [playing, speed, data.length]);

  const visible = data.slice(0, Math.min(idx + 1, data.length));
  const month = data[idx]?.month || '-';

  const stop = () => {
    setPlaying(false);
    setIdx(Math.max(0, data.length - 1));
  };
  const step = (dir) => {
    setPlaying(false);
    setIdx((current) => Math.max(0, Math.min(data.length - 1, current + dir)));
  };
  const play = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setIdx((current) => (current >= data.length - 1 ? 0 : current));
    setPlaying(true);
  };

  return (
    <>
      <div className="arr-play-bar">
        <button type="button" className={`arr-play-btn play ${playing ? 'pause' : ''}`} onClick={play}>{playing ? 'II' : '>'}</button>
        <button type="button" className="arr-play-btn stop" onClick={stop}>■</button>
        <button type="button" className="arr-play-btn step" onClick={() => step(-1)}>Prev</button>
        <button type="button" className="arr-play-btn step" onClick={() => step(1)}>Next</button>
        <div className="arr-play-range">
          <span className="arr-play-label">MONTH</span>
          <input
            type="range"
            className="arr-play-slider"
            min="0"
            max={Math.max(0, data.length - 1)}
            value={idx}
            onChange={(event) => {
              setPlaying(false);
              setIdx(Number(event.target.value));
            }}
          />
          <span className="arr-play-month">{month}</span>
        </div>
        <span className="arr-play-label">SPEED</span>
        <select className="arr-play-speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
          <option value="800">0.5x</option>
          <option value="450">1x</option>
          <option value="200">2x</option>
          <option value="80">5x</option>
        </select>
      </div>
      <TrendSvg data={visible} />
    </>
  );
}

function TrendSvg({ data = [] }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 900;
  const H = 290;
  const pad = { l: 72, r: 26, t: 24, b: 42 };
  if (data.length < 2) {
    return <div className="arr-trend-canvas" />;
  }
  const vals = data.map((d) => Number(d.value || 0));
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 1);
  const range = maxV - minV || 1;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x = (i) => pad.l + (i / Math.max(1, data.length - 1)) * plotW;
  const y = (v) => pad.t + plotH - ((Number(v || 0) - minV) / range) * plotH;
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value), ...d }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad.l},${pad.t + plotH} ${line} ${pts.at(-1).x.toFixed(1)},${pad.t + plotH}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = minV + range * t;
    return { value, y: y(value) };
  });
  const xTicks = data.filter((_, i) => i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 10) === 0);
  const hoverPoint = hoverIdx !== null ? pts[hoverIdx] : pts.at(-1);
  const tooltipW = 152;
  const tooltipH = 76;
  const tooltipX = Math.min(Math.max((hoverPoint?.x || 0) + 12, pad.l), W - tooltipW - 12);
  const tooltipY = Math.min(Math.max((hoverPoint?.y || 0) - 52, pad.t + 4), H - tooltipH - pad.b);

  return (
    <svg className="arr-trend-canvas" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setHoverIdx(null)}>
      <defs>
        <linearGradient id="arrTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e5fa8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1e5fa8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1={pad.l} x2={W - pad.r} y1={tick.y} y2={tick.y} stroke="rgba(0,0,0,.05)" />
          <text x={pad.l - 10} y={tick.y + 4} textAnchor="end" fontSize="10" fill="#8898aa">{fmt(tick.value)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + plotH} stroke="rgba(0,0,0,.08)" />
      <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="rgba(0,0,0,.08)" />
      <polygon points={area} fill="url(#arrTrendFill)" />
      <polyline points={line} fill="none" stroke="#1e5fa8" strokeWidth="2.3" vectorEffect="non-scaling-stroke" />
      {pts.map((point, i) => (
        <g key={point.month}>
          <circle cx={point.x} cy={point.y} r={i === pts.length - 1 || i === hoverIdx ? 4.8 : 2.3} fill={i === pts.length - 1 || i === hoverIdx ? '#1e5fa8' : 'rgba(30,95,168,.45)'} />
          <circle
            cx={point.x}
            cy={point.y}
            r="12"
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseMove={() => setHoverIdx(i)}
          />
        </g>
      ))}
      {xTicks.map((tick) => (
        <text key={tick.month} x={x(data.indexOf(tick))} y={H - 14} textAnchor="middle" fontSize="9" fill="#8898aa">{mLbl(tick.month)}</text>
      ))}
      {hoverPoint && (
        <g className="arr-trend-tooltip" pointerEvents="none">
          <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="8" fill="rgba(31,31,31,.92)" />
          <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="8" fill="none" stroke="rgba(255,255,255,.08)" />
          <text x={tooltipX + 12} y={tooltipY + 24} fill="#fff" fontSize="17" fontWeight="800" fontFamily="Inter, system-ui, sans-serif">
            {hoverPoint.month}
          </text>
          <rect x={tooltipX + 12} y={tooltipY + 39} width="18" height="18" fill="rgba(59,130,246,.18)" stroke="#3b82c4" strokeWidth="3" />
          <text x={tooltipX + 38} y={tooltipY + 54} fill="#fff" fontSize="16" fontWeight="800" fontFamily="Inter, system-ui, sans-serif">
            ARR: {fmt(hoverPoint.value)}
          </text>
        </g>
      )}
    </svg>
  );
}

function ChartToggle({ options, value, onChange }) {
  return (
    <div className="arr-chart-toggle">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`arr-ctbtn ${value === option.value ? 'on' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BUChart({ items = [], mode = 'arr' }) {
  const [hover, setHover] = useState(null);
  const colors = ['#1e5fa8', '#15803d', '#7c3aed', '#0891b2', '#d97706'];
  const rows = items
    .filter((item) => Number(item.value || 0) !== 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const total = rows.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (!rows.length) {
    return <div className="arr-bu-empty">No BU data</div>;
  }

  if (mode === 'new') {
    const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
    return (
      <div className="arr-bu-bar-wrap" onMouseLeave={() => setHover(null)}>
        <div className="arr-bu-yaxis">
          {[1, 0.8, 0.6, 0.4, 0.2, 0].map((tick) => (
            <span key={tick}>{fmt(max * tick)}</span>
          ))}
        </div>
        <div className="arr-bu-bars">
          {rows.map((row, i) => {
            const height = Math.max(3, (Number(row.value || 0) / max) * 100);
            return (
              <div className="arr-bu-bar-col" key={row.label}>
                <div className="arr-bu-bar-track">
                  <button
                    type="button"
                    className="arr-bu-bar"
                    style={{ height: `${height}%`, background: colors[i % colors.length] }}
                    onMouseEnter={() => setHover({ row, i })}
                    onFocus={() => setHover({ row, i })}
                    aria-label={`${row.label} ${fmt(row.value)}`}
                  />
                  {hover?.row.label === row.label && (
                    <div className="arr-bu-tip arr-bu-tip-bar">
                      <strong>{row.label}</strong>
                      <span><i style={{ background: colors[i % colors.length] }} />{fmt(row.value)}</span>
                    </div>
                  )}
                </div>
                <div className="arr-bu-xlabel">{row.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  let cumulative = 0;
  const gradient = rows.map((row, i) => {
    const start = cumulative;
    const pctVal = total > 0 ? (Number(row.value || 0) / total) * 100 : 0;
    cumulative += pctVal;
    return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
  }).join(', ');

  const active = hover?.row || null;
  const activeIndex = active ? Math.max(0, rows.findIndex((row) => row.label === active.label)) : -1;

  return (
    <div className="arr-bu-donut-wrap" onMouseLeave={() => setHover(null)}>
      <div
        className="arr-bu-donut"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="arr-bu-donut-hole" />
        {active && (
          <div className="arr-bu-tip">
            <strong>{active.label}</strong>
            <span><i style={{ background: colors[activeIndex % colors.length] }} />{active.label}: {fmt(active.value)} ({pct(active.value, total)}%)</span>
          </div>
        )}
        {rows.map((row, i) => (
          <button
            key={row.label}
            type="button"
            className="arr-bu-donut-hotspot"
            style={{ transform: `rotate(${((i + 0.5) / rows.length) * 360}deg) translateY(-86px)` }}
            onMouseEnter={() => setHover({ row, i })}
            onFocus={() => setHover({ row, i })}
            aria-label={`${row.label} ${fmt(row.value)}`}
          />
        ))}
      </div>
      <div className="arr-bu-legend">
        {rows.map((row, i) => (
          <button key={row.label} type="button" onMouseEnter={() => setHover({ row, i })} onFocus={() => setHover({ row, i })}>
            <i style={{ background: colors[i % colors.length] }} />{row.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubProductDonut({ items = [] }) {
  const [hover, setHover] = useState(null);
  const colors = ['#1e5fa8', '#15803d', '#d97706', '#7c3aed', '#0f766e', '#dc2626', '#0891b2'];
  const rows = items
    .filter((item) => Number(item.value || 0) > 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const total = rows.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (!rows.length) return <div className="arr-bu-empty">No sub-product data</div>;

  let cumulative = 0;
  const gradient = rows.map((row, i) => {
    const start = cumulative;
    const pctVal = total > 0 ? (Number(row.value || 0) / total) * 100 : 0;
    cumulative += pctVal;
    return `${colors[i % colors.length]} ${start}% ${cumulative}%`;
  }).join(', ');
  const active = hover?.row || null;
  const activeIndex = active ? Math.max(0, rows.findIndex((row) => row.label === active.label)) : -1;

  return (
    <div className="arr-prod-donut-layout" onMouseLeave={() => setHover(null)}>
      <div className="arr-prod-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="arr-prod-donut-hole" />
        {active && (
          <div className="arr-bu-tip arr-prod-tip">
            <strong>{active.label}</strong>
            <span><i style={{ background: colors[activeIndex % colors.length] }} />{active.label}: {fmt(active.value)} ({pct(active.value, total)}%)</span>
          </div>
        )}
        {rows.map((row, i) => (
          <button
            key={row.label}
            type="button"
            className="arr-prod-hotspot"
            style={{ transform: `rotate(${((i + 0.5) / rows.length) * 360}deg) translateY(-92px)` }}
            onMouseEnter={() => setHover({ row, i })}
            onFocus={() => setHover({ row, i })}
            aria-label={`${row.label} ${fmt(row.value)}`}
          />
        ))}
      </div>
      <div className="arr-prod-legend">
        {rows.map((row, i) => (
          <button key={row.label} type="button" onMouseEnter={() => setHover({ row, i })} onFocus={() => setHover({ row, i })}>
            <i style={{ background: colors[i % colors.length] }} />{row.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContractionTrendChart({ data = [] }) {
  const rows = data.map((row) => ({
    month: row.month,
    churn: Math.abs(Number(row.churn || 0)),
    downsell: Math.abs(Number(row.downsell || 0)),
  }));
  const W = 900;
  const H = 230;
  const pad = { l: 64, r: 26, t: 18, b: 48 };
  const chartH = H - pad.t - pad.b;
  const maxV = Math.max(...rows.flatMap((row) => [row.churn, row.downsell]), 1);
  const yMax = maxV < 1000 ? maxV : Math.ceil(maxV / 5000) * 5000;
  const slot = (W - pad.l - pad.r) / Math.max(1, rows.length);
  const barW = Math.min(42, slot * 0.32);
  const toY = (value) => pad.t + chartH - (Number(value || 0) / yMax) * chartH;
  const ticks = [1, 0.8, 0.6, 0.4, 0.2, 0].map((t) => ({ value: yMax * t, y: toY(yMax * t) }));

  return (
    <div>
      <svg className="arr-trend-canvas" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 230 }}>
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={pad.l} x2={W - pad.r} y1={tick.y} y2={tick.y} stroke="rgba(0,0,0,.055)" />
            <text x={pad.l - 8} y={tick.y + 4} textAnchor="end" fontSize="10" fill="#8b9bb0" fontWeight="700">{fmt(tick.value)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + chartH} stroke="#d8e0ea" />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + chartH} y2={pad.t + chartH} stroke="#d8e0ea" />
        {rows.map((row, i) => {
          const center = pad.l + i * slot + slot / 2;
          const churnH = pad.t + chartH - toY(row.churn);
          const downH = pad.t + chartH - toY(row.downsell);
          return (
            <g key={row.month}>
              <rect x={center - barW - 2} y={toY(row.churn)} width={barW} height={Math.max(0, churnH)} fill="#dc2626cc" stroke="#dc2626" rx="3">
                <title>{`${row.month} Churn: ${fmt(row.churn)}`}</title>
              </rect>
              <rect x={center + 2} y={toY(row.downsell)} width={barW} height={Math.max(0, downH)} fill="#f97316cc" stroke="#f97316" rx="3">
                <title>{`${row.month} Downsell+FX: ${fmt(row.downsell)}`}</title>
              </rect>
              <text x={center} y={H - 18} textAnchor="middle" fontSize="10" fill="#8b9bb0">{row.month}</text>
            </g>
          );
        })}
      </svg>
      <div className="arr-contract-legend">
        <span><i style={{ background: '#dc2626' }} />Churn</span>
        <span><i style={{ background: '#f97316' }} />Downsell+FX</span>
      </div>
    </div>
  );
}

function MultiTrendChart({ series = [], months = [], height = 290 }) {
  const visible = series.filter((item) => item.data?.some((point) => Number(point.value || 0) !== 0)).slice(0, 6);
  if (!visible.length || months.length < 2) {
    return <div className="arr-trend-canvas" style={{ height }} />;
  }
  const W = 900;
  const H = height;
  const pad = { l: 72, r: 26, t: 24, b: 42 };
  const allVals = visible.flatMap((item) => item.data.map((point) => Number(point.value || 0)));
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(1, ...allVals);
  const range = maxV - minV || 1;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x = (i) => pad.l + (i / Math.max(1, months.length - 1)) * plotW;
  const y = (v) => pad.t + plotH - ((Number(v || 0) - minV) / range) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const value = minV + range * t;
    return { value, y: y(value) };
  });

  return (
    <div>
      <div className="arr-wf-legend">
        {visible.map((item, i) => (
          <span className="arr-wf-legend-item" key={item.label}>
            <span className="arr-wf-dot" style={{ background: COLORS[i % COLORS.length] }} />{item.label}
          </span>
        ))}
      </div>
      <svg className="arr-trend-canvas" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={pad.l} x2={W - pad.r} y1={tick.y} y2={tick.y} stroke="rgba(0,0,0,.05)" />
            <text x={pad.l - 10} y={tick.y + 4} textAnchor="end" fontSize="10" fill="#8898aa">{fmt(tick.value)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + plotH} stroke="rgba(0,0,0,.08)" />
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="rgba(0,0,0,.08)" />
        {visible.map((item, si) => {
          const points = item.data.map((point, i) => ({ x: x(i), y: y(point.value), ...point }));
          const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
          const color = COLORS[si % COLORS.length];
          return (
            <g key={item.label}>
              <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {points.at(-1) && <circle cx={points.at(-1).x} cy={points.at(-1).y} r="3.5" fill={color} />}
            </g>
          );
        })}
        {months.filter((_, i) => i === 0 || i === months.length - 1 || i % Math.ceil(months.length / 8) === 0).map((month) => (
          <text key={month} x={x(months.indexOf(month))} y={H - 14} textAnchor="middle" fontSize="9" fill="#8898aa">{mLbl(month)}</text>
        ))}
      </svg>
    </div>
  );
}

function LOBDrillPanel({ refData, lob, view, setView }) {
  const filteredDeals = refData.deals.filter((deal) => (deal.booking_type || 'Unspecified') === lob);
  const field = view === 'salesrep' ? 'sales_person' : view === 'subprod' ? 'sub_product' : 'end_user';
  const label = view === 'salesrep' ? 'Sales Reps' : view === 'subprod' ? 'Sub-Products' : 'Customers';
  const rows = groupMetrics(filteredDeals, refData.latest, refData.prev, refData.allRangeMonths, field);
  const trend = trendByField(filteredDeals, refData.months, field, 'arr');
  return (
    <div className="arr-lob-drill-body">
      <div className="arr-2col" style={{ marginBottom: 14 }}>
        <div className="arr-chart-card">
          <div className="arr-chart-hdr">
            <div>
              <div className="arr-chart-title">{lob} - {label}</div>
              <div className="arr-card-note">Closing ARR | click bar to drill in</div>
            </div>
            <ChartToggle
              value={view}
              onChange={setView}
              options={[
                { label: 'Customers', value: 'customer' },
                { label: 'Sales Reps', value: 'salesrep' },
                { label: 'Sub-Products', value: 'subprod' },
              ]}
            />
          </div>
          <BarChart items={rows.map((row) => ({ label: row.label, value: row.value }))} maxItems={10} />
        </div>
        <div className="arr-chart-card">
          <div className="arr-chart-title" style={{ marginBottom: 2 }}>{lob} Trend</div>
          <div className="arr-card-note" style={{ marginBottom: 12 }}>Top {label.toLowerCase()} month on month</div>
          <MultiTrendChart series={trend} months={refData.months} height={230} />
        </div>
      </div>
      <div className="arr-tcard">
        <div className="arr-tcard-hdr">
          <span className="arr-tcard-title">{lob} Detail Table</span>
        </div>
        <div className="arr-twrap">
          <table>
            <thead>
              <tr>
                <th>{label.slice(0, -1)}</th>
                <th style={{ textAlign: 'right' }}>Closing ARR</th>
                <th style={{ textAlign: 'right' }}>New Won</th>
                <th style={{ textAlign: 'right' }}>Churn/Downsell</th>
                <th style={{ textAlign: 'right' }}>NRR%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td><strong>{row.label}</strong></td>
                  <td className="arr-td-money">{fmtFull(row.value)}</td>
                  <td className="arr-td-money arr-up">{moneyDash(row.newWon)}</td>
                  <td className="arr-td-money arr-dn">{moneyDash(Math.abs(row.churn))}</td>
                  <td className="arr-td-right">{row.nrr ? `${row.nrr.toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const modalBarItems = (entries, color = '#1e5fa8', signed = false, limit = 6, basis = 'max') => {
  const rows = entries
    .filter(([, value]) => Number(value || 0) !== 0)
    .sort((a, b) => Math.abs(Number(b[1] || 0)) - Math.abs(Number(a[1] || 0)))
    .slice(0, limit);
  const denominator = typeof basis === 'number'
    ? Math.max(Math.abs(basis), 1)
    : Math.max(...rows.map(([, value]) => Math.abs(Number(value || 0))), 1);
  return rows.map(([label, value]) => ({
    label,
    value: signed ? dSign(value) : fmtModalMoney(Math.abs(value)),
    percent: Math.abs(Number(value || 0)) / denominator * 100,
    color: signed ? (Number(value || 0) >= 0 ? '#15803d' : '#b91c1c') : color,
  }));
};

function mapAdd(map, key, value) {
  if (!key || !Number(value || 0)) return;
  map[key] = (map[key] || 0) + Number(value || 0);
}

function movementMaps(ref, type) {
  const customer = {};
  const rep = {};
  const product = {};
  const lob = {};
  ref.deals.forEach((deal) => {
    ref.allRangeMonths.forEach((month) => {
      const c = changeForDeal(deal, month);
      let value = 0;
      if (type === 'new') value = Math.max(0, Number(c.new || 0));
      if (type === 'upsell') value = Math.max(0, Number(c.upsell || 0));
      if (type === 'churn') value = -Math.abs(Number(c.churn || 0));
      if (type === 'downsell') value = -Math.abs(Number(c.downsell || 0));
      if (type === 'retention-loss') value = -(Math.abs(Number(c.churn || 0)) + Math.abs(Number(c.downsell || 0)));
      if (type === 'expansion') value = Math.max(0, Number(c.upsell || 0));
      if (!value) return;
      mapAdd(customer, deal.end_user, value);
      mapAdd(rep, deal.sales_person, value);
      mapAdd(product, deal.sub_product || 'Unknown', value);
      mapAdd(lob, deal.booking_type || 'Unknown', value);
    });
  });
  return { customer, rep, product, lob };
}

function currentArrMaps(ref) {
  const customer = {};
  const product = {};
  const lob = {};
  const rep = {};
  ref.deals.forEach((deal) => {
    const value = Number(deal.arr?.[ref.latest] || 0);
    if (!value) return;
    mapAdd(customer, deal.end_user, value);
    mapAdd(product, deal.sub_product || 'Unknown', value);
    mapAdd(lob, deal.booking_type || 'Unknown', value);
    mapAdd(rep, deal.sales_person || 'Unassigned', value);
  });
  return { customer, product, lob, rep };
}

function momMaps(ref) {
  const customer = {};
  const rep = {};
  const product = {};
  ref.deals.forEach((deal) => {
    const value = Number(deal.arr?.[ref.latest] || 0) - Number(deal.arr?.[ref.prev] || 0);
    if (!value) return;
    mapAdd(customer, deal.end_user, value);
    mapAdd(rep, deal.sales_person || 'Unassigned', value);
    mapAdd(product, deal.sub_product || 'Unknown', value);
  });
  return { customer, rep, product };
}

function makeKpiDetails(ref) {
  const arr = currentArrMaps(ref);
  const mom = momMaps(ref);
  const newMaps = movementMaps(ref, 'new');
  const upsellMaps = movementMaps(ref, 'upsell');
  const churnMaps = movementMaps(ref, 'churn');
  const downsellMaps = movementMaps(ref, 'downsell');
  const lossMaps = movementMaps(ref, 'retention-loss');
  const expansionMaps = movementMaps(ref, 'expansion');
  const activeLogos = Object.keys(arr.customer).length;
  const baseStats = [
    { label: 'Period Start ARR', value: fmtModalMoney(ref.periodStartARR), color: '#718096' },
    { label: 'Closing ARR', value: fmtModalMoney(ref.curr), color: '#1e5fa8' },
  ];

  return {
    total: {
      title: 'Total ARR',
      formula: `Annual Recurring Revenue - all active subscriptions as of ${ref.latest || 'latest month'}`,
      big: fmtModalMoney(ref.curr),
      color: '#7c3aed',
      stats: [
        { label: 'Closing ARR', value: fmtModalMoney(ref.curr), color: '#1e5fa8' },
        { label: 'Prior Month', value: fmtModalMoney(ref.prv), color: '#718096' },
        { label: 'MoM Change', value: dSign(ref.curr - ref.prv), color: ref.curr - ref.prv >= 0 ? '#15803d' : '#b91c1c' },
        { label: 'Active Customers', value: `${activeLogos} accounts`, color: '#059669' },
      ],
      insight: 'ARR is the total annualised value of active contracts. Growing ARR = more customers staying + new ones joining.',
      benchmark: 'Benchmark: Target: positive growth every month',
      sections: [
        { title: 'Customers making up this ARR', color: '#1e5fa8', items: modalBarItems(Object.entries(arr.customer), '#1e5fa8', false, 6) },
        { title: 'By Type', color: '#6d28d9', items: modalBarItems(Object.entries(arr.lob), '#6d28d9', false, 5, ref.curr) },
        { title: 'By Sub-Product', color: '#0891b2', items: modalBarItems(Object.entries(arr.product), '#0891b2', false, 5, ref.curr) },
      ],
    },
    change: {
      title: `${ref.periodLabel} Change`,
      formula: 'Closing ARR - Period Start ARR',
      big: dSign(ref.periodChange),
      color: ref.periodChange >= 0 ? '#15803d' : '#b91c1c',
      stats: [
        ...baseStats,
        { label: 'Change %', value: `${ref.periodChangePct >= 0 ? '+' : ''}${ref.periodChangePct.toFixed(1)}%`, color: ref.periodChange >= 0 ? '#15803d' : '#b91c1c' },
        { label: 'Won - Lost', value: `${fmt(ref.pNew + ref.pUp)} - ${fmt(Math.abs(ref.pChurn) + ref.pDn)}`, color: '#0891b2' },
      ],
      insight: `${ref.periodLabel} Change explains whether the ARR base is expanding or contracting during the period.`,
      benchmark: 'Positive growth is healthy; negative movement requires churn and downsell review.',
      sections: [
        { title: 'Biggest customer movers', color: '#1e5fa8', items: modalBarItems(Object.entries(mom.customer), '#1e5fa8', true, 8) },
        { title: 'By Sales Rep', color: '#059669', items: modalBarItems(Object.entries(mom.rep), '#059669', true, 6) },
      ],
    },
    new: {
      title: `${ref.periodLabel} New ARR`,
      formula: 'Sum of monthly New movements in the selected period',
      big: fmtFull(ref.pNew),
      color: '#059669',
      stats: [...baseStats, { label: 'New ARR', value: fmtFull(ref.pNew), color: '#059669' }, { label: 'Share of Won', value: `${pct(ref.pNew, ref.pNew + ref.pUp)}%`, color: '#059669' }],
      insight: 'New ARR identifies first-time bookings and new-logo contribution.',
      benchmark: 'Use rep and product splits to confirm new revenue ownership.',
      sections: [
        { title: 'New Logo Customers', color: '#059669', items: modalBarItems(Object.entries(newMaps.customer), '#059669', false, 6) },
        { title: 'By Sales Rep - New ARR', color: '#059669', items: modalBarItems(Object.entries(newMaps.rep), '#059669', false, 5) },
        { title: 'By Sub-Product - New ARR', color: '#059669', items: modalBarItems(Object.entries(newMaps.product), '#059669', false, 5) },
      ],
    },
    upsell: {
      title: `${ref.periodLabel} Upsell`,
      formula: 'Sum of monthly Upsell movements in the selected period',
      big: fmtFull(ref.pUp),
      color: '#0891b2',
      stats: [...baseStats, { label: 'Upsell ARR', value: fmtFull(ref.pUp), color: '#0891b2' }, { label: 'Share of Won', value: `${pct(ref.pUp, ref.pNew + ref.pUp)}%`, color: '#0891b2' }],
      insight: 'Upsell shows expansion from the existing customer base.',
      benchmark: 'Strong expansion improves NRR and reduces dependency on new logos.',
      sections: [
        { title: 'Customers with Upsell / Expansion', color: '#0891b2', items: modalBarItems(Object.entries(upsellMaps.customer), '#0891b2', false, 6) },
        { title: 'By Sales Rep - Upsell', color: '#0891b2', items: modalBarItems(Object.entries(upsellMaps.rep), '#0891b2', false, 5) },
        { title: 'By Sub-Product - Upsell', color: '#0891b2', items: modalBarItems(Object.entries(upsellMaps.product), '#0891b2', false, 5) },
      ],
    },
    churn: {
      title: `${ref.periodLabel} Churn`,
      formula: 'Absolute value of monthly Churn movements',
      big: fmtFull(Math.abs(ref.pChurn)),
      color: '#dc2626',
      stats: [...baseStats, { label: 'Churn ARR', value: fmtFull(Math.abs(ref.pChurn)), color: '#dc2626' }, { label: 'GRR Impact', value: fmtFull(Math.abs(ref.pChurn) + ref.pDn), color: '#b91c1c' }],
      insight: 'Churn highlights cancelled ARR that directly reduces gross retention.',
      benchmark: 'Review customer, rep, and product concentration whenever churn appears.',
      sections: [
        { title: 'Customers who churned', color: '#dc2626', items: modalBarItems(Object.entries(churnMaps.customer), '#dc2626', true, 6) },
        { title: 'By Sales Rep - Churn', color: '#dc2626', items: modalBarItems(Object.entries(churnMaps.rep), '#dc2626', true, 5) },
        { title: 'By Sub-Product - Churn', color: '#dc2626', items: modalBarItems(Object.entries(churnMaps.product), '#dc2626', true, 5) },
      ],
    },
    downsell: {
      title: `${ref.periodLabel} Downsell`,
      formula: 'Absolute value of monthly Downsell movements',
      big: fmtFull(ref.pDn),
      color: '#d97706',
      stats: [...baseStats, { label: 'Downsell ARR', value: fmtFull(ref.pDn), color: '#d97706' }, { label: 'Lost ARR Total', value: fmtFull(Math.abs(ref.pChurn) + ref.pDn), color: '#b91c1c' }],
      insight: 'Downsell captures contraction from existing customers.',
      benchmark: 'Downsell can be an early warning sign even when logos are retained.',
      sections: [
        { title: 'Customers who downselled', color: '#d97706', items: modalBarItems(Object.entries(downsellMaps.customer), '#d97706', true, 6) },
        { title: 'By Sales Rep - Downsell', color: '#d97706', items: modalBarItems(Object.entries(downsellMaps.rep), '#d97706', true, 5) },
        { title: 'By Sub-Product - Downsell', color: '#d97706', items: modalBarItems(Object.entries(downsellMaps.product), '#d97706', true, 5) },
      ],
    },
    growth: {
      title: `${ref.periodLabel} Growth`,
      formula: '(Closing ARR - Period Start ARR) / Period Start ARR',
      big: `${ref.periodChangePct >= 0 ? '+' : ''}${ref.periodChangePct.toFixed(1)}%`,
      color: ref.periodChangePct >= 0 ? '#15803d' : '#b91c1c',
      stats: [...baseStats, { label: 'Won ARR', value: fmtFull(ref.pNew + ref.pUp), color: '#15803d' }, { label: 'Lost ARR', value: fmtFull(Math.abs(ref.pChurn) + ref.pDn), color: '#b91c1c' }],
      insight: 'Growth combines new, upsell, churn, and downsell into the period ARR outcome.',
      benchmark: `Positive ${ref.periodLabel} growth indicates net expansion of the ARR base.`,
      sections: [
        { title: 'Biggest movers driving growth', color: '#1e5fa8', items: modalBarItems(Object.entries(mom.customer), '#1e5fa8', true, 8) },
      ],
    },
    grr: {
      title: 'GRR% - Gross Revenue Retention',
      formula: '(Starting ARR - Churn - Downsell) / Starting ARR',
      big: `${ref.grr.toFixed(1)}%`,
      color: ref.grr >= 90 ? '#15803d' : ref.grr >= 75 ? '#d97706' : '#b91c1c',
      stats: [...baseStats, { label: 'Churn + Downsell', value: fmtFull(Math.abs(ref.pChurn) + ref.pDn), color: '#b91c1c' }, { label: 'GRR', value: `${ref.grr.toFixed(1)}%`, color: '#15803d' }],
      insight: 'GRR excludes upsell and shows how much existing ARR was retained.',
      benchmark: 'Healthy: 90%+ | Watch: 75-90% | Risk: below 75%',
      sections: [
        { title: 'Customers dragging GRR down', color: '#b91c1c', items: modalBarItems(Object.entries(lossMaps.customer), '#b91c1c', true, 6) },
        { title: 'By Type', color: '#d97706', items: modalBarItems(Object.entries(lossMaps.lob), '#d97706', true, 5) },
        { title: 'By Sub-Product', color: '#d97706', items: modalBarItems(Object.entries(lossMaps.product), '#d97706', true, 5) },
      ],
    },
    nrr: {
      title: 'NRR% - Net Revenue Retention',
      formula: '(Starting ARR - Churn - Downsell + Upsell) / Starting ARR',
      big: `${ref.nrr.toFixed(1)}%`,
      color: ref.nrr >= 110 ? '#15803d' : ref.nrr >= 100 ? '#d97706' : '#b91c1c',
      stats: [...baseStats, { label: 'Upsell', value: fmtFull(ref.pUp), color: '#0891b2' }, { label: 'Churn + Downsell', value: fmtFull(Math.abs(ref.pChurn) + ref.pDn), color: '#b91c1c' }],
      insight: 'NRR includes expansion and shows whether retained customers are growing.',
      benchmark: 'Above 100% means the existing base expanded after contraction.',
      sections: [
        { title: 'Expansion helping NRR', color: '#0891b2', items: modalBarItems(Object.entries(expansionMaps.customer), '#0891b2', false, 6) },
        { title: 'Contraction hurting NRR', color: '#b91c1c', items: modalBarItems(Object.entries(lossMaps.customer), '#b91c1c', true, 6) },
      ],
    },
  };
}

function ArrDashTab({ data }) {
  const records = useMemo(() => data.records || [], [data.records]);
  const ref = useMemo(() => {
    const base = buildReferenceView(records, data.period || {});
    const kpis = data.kpis || {};
    const apiTrend = data.trend || [];

    // Backend is authoritative for latest month and KPI values
    const apiLatest = apiTrend.length ? apiTrend.at(-1).month : base.latest;
    const prev = getPrevMonth(apiLatest);
    const curr = base.deals.reduce((s, d) => s + Number(d.arr?.[apiLatest] || 0), 0);
    const prv = base.deals.reduce((s, d) => s + Number(d.arr?.[prev] || 0), 0);

    const pNew = Number(kpis.ltm_new_arr || 0);
    const pUp = Number(kpis.ltm_upsell || 0);
    const pChurn = -Math.abs(Number(kpis.ltm_churn || 0));
    const pDn = Math.abs(Number(kpis.ltm_downsell || 0));
    const grr = Number(kpis.grr ?? 100);
    const nrr = Number(kpis.nrr ?? 100);
    const ltmOpening = Number(kpis.ltm_opening_arr || 0);
    const periodChange = curr - ltmOpening;
    const periodChangePct = ltmOpening > 0 ? (periodChange / ltmOpening) * 100 : 0;

    const from = data.period?.from || base.from;
    const to = data.period?.to || apiLatest;
    const allRangeMonths = base.allMonths.filter(m => (!from || m >= from) && (!to || m <= to));
    const periodValue = String(data.period?.value || 'ytd').toLowerCase();
    const periodLabel = periodValue === 'custom' ? 'Period' : periodValue.toUpperCase();

    const trend = apiTrend
      .filter(t => Number(t.value) > 0)
      .map(t => ({ month: t.month, value: Number(t.value || 0) }));
    const waterfall = base.waterfall;

    return {
      ...base,
      latest: apiLatest,
      prev,
      curr,
      prv,
      pNew,
      pUp,
      pChurn,
      pDn,
      grr,
      nrr,
      nrrBase: ltmOpening,
      periodStartARR: ltmOpening,
      periodChange,
      periodChangePct,
      waterfall,
      trend,
      from,
      to,
      allRangeMonths,
      periodLabel,
    };
  }, [records, data]);
  const [sortField, setSortField] = useState('curr_arr');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [buMode, setBuMode] = useState('arr');
  const [repMode, setRepMode] = useState('arr');
  const [quarterMode, setQuarterMode] = useState('new');
  const [subView, setSubView] = useState('table');
  const [subSelect, setSubSelect] = useState('');
  const [lobTrendMode, setLobTrendMode] = useState('arr');
  const [lobDrill, setLobDrill] = useState('');
  const [lobDrillView, setLobDrillView] = useState('customer');
  const details = useMemo(() => makeKpiDetails(ref), [ref]);

  const groups = useMemo(() => {
    const bu = groupMetrics(ref.deals, ref.latest, ref.prev, ref.allRangeMonths, 'region');
    const reps = groupMetrics(ref.deals, ref.latest, ref.prev, ref.allRangeMonths, 'sales_person');
    const lob = groupMetrics(ref.deals, ref.latest, ref.prev, ref.allRangeMonths, 'booking_type');
    const products = groupProducts(ref.deals, ref.latest, ref.allRangeMonths);
    const customers = groupCurrent(ref.deals, ref.latest, 'end_user').slice(0, 15);
    return { bu, reps, lob, products, customers };
  }, [ref]);

  const customerRows = useMemo(() => {
    const q = search.toLowerCase();
    const rows = buildCustomerRows(ref.deals, ref.latest, ref.prev, ref.allRangeMonths)
      .filter((row) => !q || [row.customer, row.region, row.sales_person, row.sub_product].some((v) => String(v || '').toLowerCase().includes(q)));
    return [...rows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string') return sortDir * String(bv || '').localeCompare(String(av || ''));
      return sortDir * (Number(bv || 0) - Number(av || 0));
    });
  }, [ref, search, sortField, sortDir]);

  const quarterData = useMemo(() => {
    const newTotals = {};
    ref.waterfall.forEach((row) => {
      const q = `Q${Math.ceil(Number(row.month.slice(5, 7)) / 3)} ${row.month.slice(0, 4)}`;
      newTotals[q] = (newTotals[q] || 0) + Math.max(0, Number(row.new || 0)) + Math.max(0, Number(row.upsell || 0));
    });
    const arrTotals = {};
    ref.playTrend.forEach((point) => {
      if (point.month < ref.from || point.month > ref.to) return;
      const q = `Q${Math.ceil(Number(point.month.slice(5, 7)) / 3)} ${point.month.slice(0, 4)}`;
      arrTotals[q] = Number(point.value || 0);
    });
    return {
      new: Object.entries(newTotals).map(([label, value]) => ({ label, value })),
      arr: Object.entries(arrTotals).map(([label, value]) => ({ label, value })),
    };
  }, [ref.waterfall, ref.playTrend, ref.from, ref.to]);

  const subProducts = useMemo(() => [''].concat(groups.products.map((product) => product.label)), [groups.products]);
  const selectedSubTrend = useMemo(() => {
    const deals = subSelect ? ref.deals.filter((deal) => (deal.sub_product || 'Unspecified') === subSelect) : ref.deals;
    return trendByField(deals, ref.months, 'sub_product', 'arr');
  }, [ref, subSelect]);

  const lobTrend = useMemo(() => trendByField(ref.deals, ref.months, 'booking_type', lobTrendMode), [ref, lobTrendMode]);

  const buItems = (buMode === 'arr' ? groups.bu.map((row) => ({ label: row.label, value: row.value })) : groups.bu.map((row) => ({ label: row.label, value: row.newWon })));
  const repItems = (repMode === 'arr' ? groups.reps.map((row) => ({ label: row.label, value: row.value })) : groups.reps.map((row) => ({ label: row.label, value: row.newWon })));

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => -d);
    else {
      setSortField(field);
      setSortDir(-1);
    }
  };

  const Th = ({ field, label, right }) => (
    <th onClick={() => toggleSort(field)} style={{ textAlign: right ? 'right' : 'left' }}>
      {label} <span style={{ fontSize: 9, color: '#94a3b8' }}>{sortField === field ? (sortDir < 0 ? 'v' : '^') : '-'}</span>
    </th>
  );

  const kpiForSankey = {
    ltm_opening_arr: ref.sankeyOpeningARR,
    total_arr: ref.curr,
    ltm_new_arr: ref.sankeyNew,
    ltm_upsell: ref.sankeyUp,
    ltm_renewal: ref.sankeyRen,
    ltm_churn: ref.sankeyChurn,
    ltm_downsell: ref.sankeyDn,
  };

  return (
    <>
      <div className="arr-kpi-strip">
        <DevOverlay name="KPI: Total ARR">
          <KpiCard label="Total ARR" value={fmt(ref.curr)} sub={`Closing as of ${ref.latest || 'latest month'}`} variant={1} detail={details.total} icon="💰"
          />
        </DevOverlay>
        <DevOverlay name={`KPI: ${ref.periodLabel} Change`}>
          <KpiCard label={`${ref.periodLabel} Change`} value={`${ref.periodChange >= 0 ? '+' : ''}${fmt(ref.periodChange)}`} delta={`${ref.periodChangePct >= 0 ? '+' : ''}${ref.periodChangePct.toFixed(1)}%`} sub="vs period start" variant={2} detail={details.change} icon="📈"
          />
        </DevOverlay>
        <DevOverlay name={`KPI: ${ref.periodLabel} New ARR`}>
          <KpiCard label={`${ref.periodLabel} New ARR`} value={fmt(ref.pNew)} sub="New logos & first-time bookings" variant={3} detail={details.new} icon="🆕"
          />
        </DevOverlay>
        <DevOverlay name={`KPI: ${ref.periodLabel} Upsell`}>
          <KpiCard label={`${ref.periodLabel} Upsell`} value={fmt(ref.pUp)} sub="Expansion from existing customers" variant={4} detail={details.upsell} icon="⬆"
          />
        </DevOverlay>
        <DevOverlay name={`KPI: ${ref.periodLabel} Churn`}>
          <KpiCard label={`${ref.periodLabel} Churn`} value={fmt(Math.abs(ref.pChurn))} sub="Lost ARR from cancellations" variant={5} detail={details.churn} icon="🔴"
          />
        </DevOverlay>
        <DevOverlay name={`KPI: ${ref.periodLabel} Downsell`}>
          <KpiCard label={`${ref.periodLabel} Downsell`} value={fmt(ref.pDn)} sub="Contraction from existing customers" variant={6} detail={details.downsell} icon="🔙"
          />
        </DevOverlay>
      </div>

      <div className="arr-metric-row">
        <DevOverlay name={`${ref.periodLabel} Growth`}>
          <MetricCard label={`${ref.periodLabel} Growth`} value={`${ref.periodChangePct >= 0 ? '+' : ''}${ref.periodChangePct.toFixed(1)}%`} sub={`vs period start | Won: ${fmt(ref.pNew + ref.pUp)} | Lost: ${fmt(Math.abs(ref.pChurn) + ref.pDn)}`} icon="📈" color={ref.periodChangePct >= 0 ? '#15803d' : '#b91c1c'} detail={details.growth} />
        </DevOverlay>
        <DevOverlay name="GRR% Gross Revenue Retention">
          <MetricCard label="GRR% — Gross Revenue Retention" value={`${ref.grr.toFixed(1)}%`} sub={`Retention excl. upsell | Churn+DS: ${fmt(Math.abs(ref.pChurn) + ref.pDn)}`} icon="🛡️" color={ref.grr >= 90 ? '#15803d' : ref.grr >= 75 ? '#d97706' : '#b91c1c'} detail={details.grr} />
        </DevOverlay>
        <DevOverlay name="NRR% Net Revenue Retention">
          <MetricCard label="NRR% — Net Revenue Retention" value={`${ref.nrr.toFixed(1)}%`} sub={`Incl. upsell: ${fmt(ref.pUp)} | >100% = existing base is growing`} icon="⚡" color={ref.nrr >= 110 ? '#15803d' : ref.nrr >= 100 ? '#d97706' : '#b91c1c'} detail={details.nrr} />
        </DevOverlay>
      </div>

      <div className="arr-2col arr-reference-gauges" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <DevOverlay name="GRR Gauge Chart">
          <div className="arr-chart-card arr-gauge-card arr-gauge-grr">
            <div className="arr-chart-title">GRR% - Gross Revenue Retention</div>
            <GaugeChart value={ref.grr} label="Retention excl. upsell · Churn+DS impact" color="#7c3aed" maxVal={150} />
          </div>
        </DevOverlay>
        <DevOverlay name="NRR Gauge Chart">
          <div className="arr-chart-card arr-gauge-card arr-gauge-nrr">
            <div className="arr-chart-title">NRR% - Net Revenue Retention</div>
            <GaugeChart value={ref.nrr} label="Incl. upsell · >100% = existing base growing" color="#0891b2" maxVal={150} />
          </div>
        </DevOverlay>
      </div>

      <DevOverlay name="ARR Concentration Treemap">
        <div className="arr-chart-card" style={{ marginBottom: 18 }}>
          <div className="arr-chart-hdr">
            <div>
              <div className="arr-chart-title">ARR Concentration Treemap</div>
              <div className="arr-card-note">Customer ARR size from the same filtered deal set</div>
            </div>
            <span className="arr-sh-tag">{groups.customers.length} customers</span>
          </div>
          <Treemap items={groups.customers} height={300} />
        </div>
      </DevOverlay>

      <DevOverlay name="ARR Flow Sankey">
        <div className="arr-chart-card" style={{ marginBottom: 18 }}>
          <div className="arr-chart-title" style={{ marginBottom: 2 }}>ARR Flow - Sankey Diagram</div>
          <div className="arr-card-note" style={{ marginBottom: 12 }}>How ARR flows: Opening -&gt; New / Upsell / Renewals -&gt; Churn -&gt; Closing (current filter period)</div>
          <SankeyChart kpis={kpiForSankey} />
        </div>
      </DevOverlay>

      <DevOverlay name="ARR Trend Chart">
        <div className="arr-chart-card" style={{ marginBottom: 18 }}>
          <div className="arr-chart-title" style={{ marginBottom: 2 }}>ARR Trend - Monthly Closing ARR</div>
          <div className="arr-card-note" style={{ marginBottom: 12 }}>Total closing ARR month on month across all deals</div>
          <TrendPlaybackChart data={ref.playTrend} />
        </div>
      </DevOverlay>

      <DevOverlay name="ARR Waterfall">
        <div className="arr-chart-card" style={{ marginBottom: 18 }}>
          <div className="arr-chart-title" style={{ marginBottom: 2 }}>Changes in ARR - Waterfall by Month</div>
          <div className="arr-card-note" style={{ marginBottom: 12 }}>New, Upsell, Renewal, Churn, Downsell (incl. FX) per month</div>
          <WaterfallChart data={ref.waterfall} />
        </div>
      </DevOverlay>

      <div className="arr-2col">
        <DevOverlay name="ARR by Business Unit">
          <div className="arr-chart-card">
            <div className="arr-chart-hdr">
              <div>
                <div className="arr-chart-title" style={{ marginBottom: 2 }}>ARR by BU</div>
                <div className="arr-card-note">Current closing ARR vs period New ARR</div>
              </div>
              <ChartToggle
                value={buMode}
                onChange={setBuMode}
                options={[
                  { label: 'Closing ARR', value: 'arr' },
                  { label: 'New Wins (Period)', value: 'new' },
                ]}
              />
            </div>
            <BUChart items={buItems} mode={buMode} />
          </div>
        </DevOverlay>
        <DevOverlay name="ARR by Sales Rep">
          <div className="arr-chart-card">
            <div className="arr-chart-hdr">
              <div>
                <div className="arr-chart-title" style={{ marginBottom: 2 }}>ARR by Sales Rep</div>
                <div className="arr-card-note">Current closing ARR vs period New ARR</div>
              </div>
              <ChartToggle
                value={repMode}
                onChange={setRepMode}
                options={[
                  { label: 'Closing ARR', value: 'arr' },
                  { label: 'New Wins (Period)', value: 'new' },
                ]}
              />
            </div>
            <BarChart items={repItems} maxItems={12} />
          </div>
        </DevOverlay>
      </div>

      <div className="arr-2col">
        <DevOverlay name="New ARR by Quarter">
          <div className="arr-chart-card">
            <div className="arr-chart-hdr">
              <div>
                <div className="arr-chart-title" style={{ marginBottom: 2 }}>New ARR by Quarter</div>
                <div className="arr-card-note">New bookings per quarter - closing ARR vs new ARR</div>
              </div>
              <ChartToggle
                value={quarterMode}
                onChange={setQuarterMode}
                options={[
                  { label: 'New ARR', value: 'new' },
                  { label: 'Closing ARR', value: 'arr' },
                ]}
              />
            </div>
            <BarChart items={quarterData[quarterMode]} maxItems={8} />
          </div>
        </DevOverlay>
        <DevOverlay name="ARR by Sub-Product">
          <div className="arr-chart-card">
            <div className="arr-chart-title" style={{ marginBottom: 2 }}>ARR by Sub-Product</div>
            <div className="arr-card-note" style={{ marginBottom: 14 }}>Current closing ARR split by sub-product type</div>
            <SubProductDonut items={groups.products.map((product) => ({ label: product.label, value: product.value }))} />
          </div>
        </DevOverlay>
      </div>

      <div className="arr-2col">
        <DevOverlay name="Churn & Downsell Trend">
          <div className="arr-chart-card">
            <div className="arr-chart-title" style={{ marginBottom: 2 }}>Churn & Downsell Trend</div>
            <div className="arr-card-note" style={{ marginBottom: 14 }}>Monthly contraction - Churn and Downsell (incl. FX)</div>
            <ContractionTrendChart data={ref.waterfall} />
          </div>
        </DevOverlay>
        <DevOverlay name="Sub-Product Trend Table">
          <div className="arr-chart-card">
            <div className="arr-chart-hdr">
              <div>
                <div className="arr-chart-title" style={{ marginBottom: 2 }}>Sub-Product ARR - Trend & Table</div>
                <div className="arr-card-note">Select sub-product to drill in, or view all as table</div>
              </div>
              <div className="arr-sub-controls">
                <select className="arr-inline-select" value={subSelect} onChange={(event) => setSubSelect(event.target.value)}>
                  <option value="">All Sub-Products</option>
                  {subProducts.filter(Boolean).map((product) => <option key={product} value={product}>{product}</option>)}
                </select>
                <ChartToggle
                  value={subView}
                  onChange={setSubView}
                  options={[
                    { label: 'Chart', value: 'chart' },
                    { label: 'Table', value: 'table' },
                  ]}
                />
              </div>
            </div>
            {subView === 'chart' ? (
              <MultiTrendChart series={selectedSubTrend} months={ref.months} height={210} />
            ) : (
              <div className="arr-twrap" style={{ maxHeight: 220 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sub-Product</th>
                      <th style={{ textAlign: 'right' }}>Current ARR</th>
                      <th style={{ textAlign: 'right' }}>New Won</th>
                      <th style={{ textAlign: 'right' }}>Churn/Downsell</th>
                      <th style={{ textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.products.map((product) => (
                      <tr key={product.label}>
                        <td><strong>{product.label}</strong></td>
                        <td className="arr-td-money">{fmtFull(product.value)}</td>
                        <td className="arr-td-money arr-up">{moneyDash(product.newWon)}</td>
                        <td className="arr-td-money arr-dn">{moneyDash(Math.abs(product.churn))}</td>
                        <td className="arr-td-right">{pct(product.value, ref.curr)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DevOverlay>
      </div>

      <SectionHeader title="ARR by LOB" tag={`Total ARR: ${fmt(ref.curr)} | ${ref.latest || 'latest'}`} />
      <div className="arr-lob-grid">
        {groups.lob.slice(0, 6).map((lob, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <DevOverlay key={lob.label} name={`LOB: ${lob.label}`}>
              <div className="arr-lob-card" style={{ '--lob-color': color }}>
                <div className="arr-lob-top">
                  <h4>{lob.label}</h4>
                  <span>{pct(lob.value, ref.curr)}% of total</span>
                </div>
                <div className="arr-lob-value">{fmt(lob.value)}</div>
                <div className="arr-card-note">Closing ARR as of {ref.latest || 'latest month'}</div>
                <div className="arr-lob-stats">
                  <div><small>MoM</small><strong className={lob.mom >= 0 ? 'arr-up' : 'arr-dn'}>{dSign(lob.mom)}</strong></div>
                  <div><small>YTD New</small><strong className="arr-up">{fmt(lob.newWon)}</strong></div>
                  <div><small>YTD Churn</small><strong className="arr-dn">{fmt(lob.churn)}</strong></div>
                  <div><small>NRR</small><strong className={lob.nrr >= 100 ? 'arr-up' : 'arr-dn'}>{lob.nrr ? `${lob.nrr.toFixed(1)}%` : '-'}</strong></div>
                </div>
                <div className="arr-lob-actions">
                  <button type="button" onClick={() => { setLobDrill(lob.label); setLobDrillView('customer'); }}>Drill Down</button>
                  <button type="button" onClick={() => { setLobDrill(lob.label); setLobDrillView('subprod'); }}>Products</button>
                </div>
              </div>
            </DevOverlay>
          );
        })}
      </div>

      <DevOverlay name="LOB ARR Trend">
        <div className="arr-chart-card" style={{ marginBottom: 16 }}>
          <div className="arr-chart-hdr">
            <div>
              <div className="arr-chart-title" style={{ marginBottom: 2 }}>LOB ARR - Trend</div>
              <div className="arr-card-note">LOB Breakdown month on month</div>
            </div>
            <ChartToggle
              value={lobTrendMode}
              onChange={setLobTrendMode}
              options={[
                { label: 'Closing ARR', value: 'arr' },
                { label: 'New Won', value: 'new' },
              ]}
            />
          </div>
          <MultiTrendChart series={lobTrend} months={ref.months} height={290} />
        </div>
      </DevOverlay>

      <div className="arr-lob-drill-bar">
        <div className="arr-lob-drill-title">Drill Down by LOB</div>
        <select value={lobDrill} onChange={(event) => setLobDrill(event.target.value)}>
          <option value="">- Select Type -</option>
          {groups.lob.map((lob) => <option key={lob.label} value={lob.label}>{lob.label}</option>)}
        </select>
        <div className="arr-lob-drill-tabs">
          <button type="button" className={lobDrillView === 'customer' ? 'on' : ''} onClick={() => setLobDrillView('customer')}>Customers</button>
          <button type="button" className={lobDrillView === 'salesrep' ? 'on' : ''} onClick={() => setLobDrillView('salesrep')}>Sales Reps</button>
          <button type="button" className={lobDrillView === 'subprod' ? 'on' : ''} onClick={() => setLobDrillView('subprod')}>Sub-Products</button>
        </div>
        <button type="button" className="arr-lob-clear" onClick={() => setLobDrill('')}>Clear</button>
      </div>
      {lobDrill && (
        <DevOverlay name={`LOB Drill: ${lobDrill}`}>
          <LOBDrillPanel refData={ref} lob={lobDrill} view={lobDrillView} setView={setLobDrillView} />
        </DevOverlay>
      )}

      <SectionHeader title="Customer ARR Detail" tag={`${customerRows.length} rows | Latest: ${ref.latest || '-'}`} />
      <DevOverlay name="Customer ARR Table">
        <div className="arr-tcard">
          <div className="arr-tcard-hdr">
            <span className="arr-tcard-title">All Customers</span>
            <input className="arr-search" placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="arr-twrap">
            <table>
              <thead>
                <tr>
                  <Th field="customer" label="Customer" />
                  <Th field="region" label="BU" />
                  <Th field="sub_product" label="Sub-Product" />
                  <Th field="sales_person" label="Sales Rep" />
                  <Th field="curr_arr" label="Current ARR" right />
                  <Th field="prev_arr" label="Prior Month" right />
                  <Th field="mom" label="MoM Change" right />
                  <Th field="new_won" label="New + Upsell" right />
                  <Th field="period_churn" label="Churn / Downsell" right />
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.slice(0, 100).flatMap((row) => {
                  const id = `${row.customer}-${row.sub_product}`;
                  const isOpen = expanded === id;
                  const rows = [
                    <tr key={`row-${id}`} onClick={() => setExpanded((current) => current === id ? null : id)} style={{ cursor: 'pointer' }}>
                      <td><span style={{ marginRight: 6, fontSize: 10, color: '#94a3b8' }}>{isOpen ? 'v' : '>'}</span><strong>{row.customer}</strong></td>
                      <td><span className="arr-tag">{row.region || '-'}</span></td>
                      <td style={{ fontSize: 11 }}>{row.sub_product || '-'}</td>
                      <td style={{ fontSize: 12 }}>{row.sales_person || '-'}</td>
                      <td className="arr-td-money">{row.curr_arr ? fmtFull(row.curr_arr) : '-'}</td>
                      <td className="arr-td-money">{row.prev_arr ? fmtFull(row.prev_arr) : '-'}</td>
                      <td className={`arr-td-money ${row.mom >= 0 ? 'arr-up' : 'arr-dn'}`}>{row.mom ? dSign(row.mom) : '-'}</td>
                      <td className="arr-td-money arr-up">{row.new_won ? fmtFull(row.new_won) : '-'}</td>
                      <td className="arr-td-money arr-dn">{row.period_churn ? fmtFull(Math.abs(row.period_churn)) : '-'}</td>
                      <td><SparkLine data={row.trend} color={row.mom >= 0 ? '#059669' : '#dc2626'} /></td>
                    </tr>,
                  ];
                  if (isOpen) {
                    rows.push(
                      <tr key={`exp-${id}`} className="arr-expand-row">
                        <td colSpan={10}>
                          <div className="arr-customer-expand">
                            <div><div className="arr-cust-detail-label">Current ARR</div><div className="arr-cust-detail-val">{fmtFull(row.curr_arr)}</div></div>
                            <div><div className="arr-cust-detail-label">Prior Month</div><div className="arr-cust-detail-val">{fmtFull(row.prev_arr)}</div></div>
                            <div><div className="arr-cust-detail-label">MoM Change</div><div className={`arr-cust-detail-val ${row.mom >= 0 ? 'arr-up' : 'arr-dn'}`}>{dSign(row.mom)}</div></div>
                            <div><div className="arr-cust-detail-label">Sub-Product</div><div className="arr-cust-detail-val" style={{ fontSize: 12 }}>{row.sub_product || '-'}</div></div>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>
    </>
  );
}

export default ArrDashTab;
export { ArrDashTab };
