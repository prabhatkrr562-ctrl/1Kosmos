import { useMemo, useState } from 'react';
import { fmt, fmtFull } from './arrShared';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';

const EMPTY_ARRAY = [];
const PALETTE = ['#1e5fa8', '#15803d', '#d97706', '#6d28d9', '#0f766e', '#b91c1c', '#ea580c', '#64748b'];
const EVENT_COLORS = { New: '#1e5fa8', Upsell: '#22c55e', Renewal: '#d97706', Churn: '#b91c1c', Downsell: '#ea580c', DOWNSELL: '#ea580c' };
const EVENT_ICONS = { New: '🆕', Upsell: '⬆️', Renewal: '🔄', Churn: '❌', Downsell: '⬇️', DOWNSELL: '⬇️' };

function customerName(row) {
  return row.end_user || row.customer || row.bill_to || row.contract_name || 'Unspecified';
}

function productName(row) {
  return row.sub_product || row.sub_product_type || row.product || row.product_type || 'Other';
}

function regionName(row) {
  return row.region || row.business_unit || '-';
}

function arrMap(row) {
  return row.arr || row.monthly_arr || {};
}

function changesMap(row) {
  return row.changes || row.monthly_changes || {};
}

function getPrevMonth(month) {
  if (!month) return '';
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function changeValue(change, key) {
  const aliases = {
    New: ['New', 'new'],
    Upsell: ['Upsell', 'upsell', 'UpSell', 'up_sell'],
    Renewal: ['Renewal', 'renewal'],
    Churn: ['Churn', 'churn'],
    Downsell: ['Downsell', 'DOWNSELL', 'downsell'],
  }[key] || [key];
  return aliases.reduce((sum, alias) => sum + Number(change?.[alias] || 0), 0);
}

function shortMoney(value) {
  const n = Math.abs(Number(value || 0));
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function signedShort(value) {
  const n = Number(value || 0);
  if (!n) return '-';
  return `${n >= 0 ? '+' : '-'}${shortMoney(n)}`;
}

function ChartCard({ title, sub, children, className = '' }) {
  return (
    <div className={`arr-c360-card ${className}`}>
      <h4>{title}</h4>
      {sub && <div className="arr-c360-card-sub">{sub}</div>}
      {children}
    </div>
  );
}

function KpiCardLite({ label, value, sub, color }) {
  return (
    <div className="arr-c360-kpi" style={{ borderTopColor: color }}>
      <div className="arr-c360-kpi-click">Click</div>
      <div className="arr-c360-kpi-label">{label}</div>
      <div className="arr-c360-kpi-val" style={{ color }}>{value}</div>
      <div className="arr-c360-kpi-sub">{sub}</div>
    </div>
  );
}

function LineChart({ data, color = '#1e5fa8', height = 250 }) {
  if (!data.length) return <div className="arr-c360-chart-empty" style={{ height }}>No ARR trend data</div>;
  const width = 760;
  const pad = { l: 58, r: 18, t: 22, b: 38 };
  const vals = data.map(row => Number(row.value || 0));
  const max = Math.max(1, ...vals);
  const xFor = index => pad.l + (index / Math.max(data.length - 1, 1)) * (width - pad.l - pad.r);
  const yFor = value => pad.t + (height - pad.t - pad.b) - (Number(value || 0) / max) * (height - pad.t - pad.b);
  const points = data.map((row, index) => `${xFor(index).toFixed(1)},${yFor(row.value).toFixed(1)}`).join(' ');
  const area = `${pad.l},${height - pad.b} ${points} ${width - pad.r},${height - pad.b}`;
  const ticks = Array.from({ length: 5 }, (_, index) => (max / 4) * index);

  return (
    <svg className="arr-c360-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`r360Line${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".16" />
          <stop offset="100%" stopColor={color} stopOpacity=".02" />
        </linearGradient>
      </defs>
      {ticks.map((tick, index) => {
        const y = yFor(tick);
        return (
          <g key={index}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="rgba(0,0,0,.05)" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#8898aa">{fmt(tick)}</text>
          </g>
        );
      })}
      <polygon points={area} fill={`url(#r360Line${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {data.map((row, index) => (
        <circle key={row.month} cx={xFor(index)} cy={yFor(row.value)} r={index === data.length - 1 ? 4 : 2.5} fill={index === data.length - 1 ? color : `${color}88`} vectorEffect="non-scaling-stroke">
          <title>{`${row.month}: ${fmtFull(row.value)}`}</title>
        </circle>
      ))}
      {data.map((row, index) => (
        <text key={`m-${row.month}`} x={xFor(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="#8898aa">{row.month}</text>
      ))}
    </svg>
  );
}

function DonutChart({ items, empty = 'No data' }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!items.length || !total) return <div className="arr-c360-chart-empty">{empty}</div>;
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="arr-c360-donut-wrap">
      <svg viewBox="0 0 220 220" className="arr-c360-donut">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="#eef2f7" strokeWidth="34" />
        {items.map((item, index) => {
          const dash = (Number(item.value) / total) * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth="34"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 110 110)"
            >
              <title>{`${item.label}: ${fmtFull(item.value)}`}</title>
            </circle>
          );
          offset += dash;
          return circle;
        })}
        <text x="110" y="106" textAnchor="middle" fontSize="20" fontWeight="900" fill="#0f2d52">{fmt(total)}</text>
        <text x="110" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">TOTAL ARR</text>
      </svg>
      <div className="arr-c360-donut-legend">
        {items.slice(0, 10).map((item, index) => (
          <div key={item.label}>
            <span><i style={{ background: PALETTE[index % PALETTE.length] }} />{item.label}</span>
            <strong>{fmtFull(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaterfallBars({ data }) {
  const max = Math.max(...data.map(row => Math.max(row.newWon, row.loss)), 1);
  return (
    <div className="arr-r360-waterfall">
      <div className="arr-r360-waterfall-plot">
        {data.map(row => (
          <div className="arr-r360-waterfall-col" key={row.month}>
            <div className="arr-r360-waterfall-bars">
              <i className="won" style={{ height: `${Math.max(row.newWon ? 3 : 0, (row.newWon / max) * 100)}%` }} title={`${row.month} New+Upsell: ${fmtFull(row.newWon)}`} />
              <i className="loss" style={{ height: `${Math.max(row.loss ? 3 : 0, (row.loss / max) * 100)}%` }} title={`${row.month} Churn+Downsell: ${fmtFull(row.loss)}`} />
            </div>
            <span>{row.month}</span>
          </div>
        ))}
      </div>
      <div className="arr-c360-legend">
        <span><i style={{ background: '#15803d' }} />New+Upsell</span>
        <span><i style={{ background: '#b91c1c' }} />Churn+Downsell</span>
      </div>
    </div>
  );
}

function Rep360Tab({ data }) {
  const records = data.records || EMPTY_ARRAY;
  const [selectedRep, setSelectedRep] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('arr');
  const [sortAsc, setSortAsc] = useState(false);

  const base = useMemo(() => {
    const monthSet = new Set(data.all_months || []);
    records.forEach(row => {
      Object.keys(arrMap(row)).forEach(month => monthSet.add(month));
      Object.keys(changesMap(row)).forEach(month => monthSet.add(month));
    });
    const allMonths = [...monthSet].filter(Boolean).sort();
    const latest = data.latest_month || data.kpis?.latest_month || allMonths.filter(month => records.some(row => Number(arrMap(row)[month] || 0) > 0)).at(-1) || allMonths.at(-1) || '';
    const activeMonths = allMonths.filter(month => records.some(row => Number(arrMap(row)[month] || 0) > 0));
    const repPeak = {};
    const repCurr = {};

    records.forEach(row => {
      const rep = row.sales_person || row.sales_rep || '';
      if (!rep) return;
      Object.values(arrMap(row)).forEach(value => {
        if (Number(value || 0) > 0) repPeak[rep] = (repPeak[rep] || 0) + Number(value || 0);
      });
      repCurr[rep] = (repCurr[rep] || 0) + Number(arrMap(row)[latest] || 0);
    });

    records.forEach(row => {
      const rep = row.sales_person || row.sales_rep || '';
      if (!rep || repPeak[rep] !== undefined) return;
      const hasBooking = Object.values(changesMap(row)).some(change => Object.values(change || {}).some(value => Number(value || 0) !== 0));
      if (hasBooking) repPeak[rep] = 0;
    });

    const reps = Object.keys(repPeak)
      .sort((a, b) => (repCurr[b] || 0) - (repCurr[a] || 0) || a.localeCompare(b))
      .map(rep => ({ rep, arr: repCurr[rep] || 0 }));

    return { allMonths, activeMonths, latest, reps };
  }, [data, records]);

  const rep = selectedRep || base.reps[0]?.rep || '';

  const detail = useMemo(() => {
    if (!rep) return null;
    const deals = records.filter(row => (row.sales_person || row.sales_rep || '') === rep);
    if (!deals.length) return null;
    const latest = base.latest;
    const prevM = getPrevMonth(latest);
    const last12 = base.activeMonths.filter(month => month <= latest).slice(-12);
    const periodMonths = base.activeMonths.filter(month => month <= latest);
    const ytdMonths = base.activeMonths.filter(month => month >= `${latest.slice(0, 4)}-01` && month <= latest);

    let totalArr = 0;
    let prevArr = 0;
    let periodNew = 0;
    let periodUp = 0;
    let periodChurn = 0;
    let periodDn = 0;
    const custArr = {};
    const custPrev = {};
    const prodArr = {};
    const monthlyArr = {};
    const monthlyNew = {};
    const monthlyLoss = {};
    const lineMap = {};
    const events = [];

    deals.forEach(row => {
      const customer = customerName(row);
      const product = productName(row);
      const region = regionName(row);
      const monthly = arrMap(row);
      const changes = changesMap(row);
      const arr = Number(monthly[latest] || 0);
      const prev = Number(monthly[prevM] || 0);
      totalArr += arr;
      prevArr += prev;
      custPrev[customer] = (custPrev[customer] || 0) + prev;
      if (arr > 0) {
        custArr[customer] = (custArr[customer] || 0) + arr;
        prodArr[product] = (prodArr[product] || 0) + arr;
      }
      base.activeMonths.forEach(month => {
        monthlyArr[month] = (monthlyArr[month] || 0) + Number(monthly[month] || 0);
      });
      periodMonths.forEach(month => {
        const change = changes[month] || {};
        periodNew += Math.max(0, changeValue(change, 'New'));
        periodUp += Math.max(0, changeValue(change, 'Upsell'));
        periodChurn += Math.abs(Math.min(0, changeValue(change, 'Churn')));
        periodDn += Math.abs(Math.min(0, changeValue(change, 'Downsell')));
      });
      last12.forEach(month => {
        const change = changes[month] || {};
        const won = Math.max(0, changeValue(change, 'New')) + Math.max(0, changeValue(change, 'Upsell'));
        const loss = Math.abs(Math.min(0, changeValue(change, 'Churn'))) + Math.abs(Math.min(0, changeValue(change, 'Downsell')));
        monthlyNew[month] = (monthlyNew[month] || 0) + won;
        monthlyLoss[month] = (monthlyLoss[month] || 0) + loss;
      });
      ytdMonths.forEach(month => {
        const change = changes[month] || {};
        const key = `${customer}||${product}`;
        if (!lineMap[key]) lineMap[key] = { customer, region, product, arr: 0, prev: 0, ytdNew: 0 };
        lineMap[key].ytdNew += Math.max(0, changeValue(change, 'New')) + Math.max(0, changeValue(change, 'Upsell'));
      });
      const key = `${customer}||${product}`;
      if (!lineMap[key]) lineMap[key] = { customer, region, product, arr: 0, prev: 0, ytdNew: 0 };
      lineMap[key].arr += arr;
      lineMap[key].prev += prev;

      Object.entries(changes).forEach(([month, change]) => {
        Object.entries({
          New: changeValue(change, 'New'),
          Upsell: changeValue(change, 'Upsell'),
          Renewal: changeValue(change, 'Renewal'),
          Churn: changeValue(change, 'Churn'),
          Downsell: changeValue(change, 'Downsell'),
        }).forEach(([type, amount]) => {
          if (!amount) return;
          events.push({ month, type, amount, customer, product });
        });
      });
    });

    const mom = totalArr - prevArr;
    const logos = Object.keys(custArr).length;
    const acv = logos > 0 ? totalArr / logos : 0;
    const nrr = prevArr > 0 ? ((prevArr - periodChurn - periodDn + periodUp) / prevArr) * 100 : 0;
    const region = regionName(deals[0]);

    const customerMix = Object.entries(custArr).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const productMix = Object.entries(prodArr).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const trend = last12.map(month => ({ month, value: monthlyArr[month] || 0 }));
    const waterfall = last12.map(month => ({ month, newWon: monthlyNew[month] || 0, loss: monthlyLoss[month] || 0 }));
    const rows = Object.values(lineMap)
      .map(row => ({ ...row, mom: row.arr - row.prev }))
      .filter(row => row.arr > 0 || row.ytdNew > 0);
    events.sort((a, b) => b.month.localeCompare(a.month));

    let insight = null;
    if (mom < 0 && prevArr > 0 && Math.abs(mom) / prevArr > 0.05) {
      insight = { tone: 'warn', text: `${rep} ARR declined ${shortMoney(Math.abs(mom))} MoM - investigate churn or downsell` };
    } else if (periodChurn + periodDn > periodNew + periodUp) {
      insight = { tone: 'danger', text: `${rep} has more churn/downsell (${shortMoney(periodChurn + periodDn)}) than new bookings (${shortMoney(periodNew + periodUp)}) this period` };
    } else if (nrr > 110) {
      insight = { tone: 'good', text: `${rep} is a top performer - NRR ${nrr.toFixed(1)}% with ${shortMoney(periodNew + periodUp)} in new bookings` };
    }

    return {
      deals,
      latest,
      prevM,
      region,
      totalArr,
      prevArr,
      mom,
      periodNew,
      periodUp,
      periodChurn,
      periodDn,
      nrr,
      acv,
      logos,
      trend,
      customerMix,
      productMix,
      waterfall,
      rows,
      events,
      insight,
    };
  }, [rep, records, base]);

  const filteredRows = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    const rows = detail.rows
      .filter(row => !q || row.customer.toLowerCase().includes(q) || row.product.toLowerCase().includes(q))
      .map(row => ({ ...row }));
    rows.sort((a, b) => {
      const av = sortKey === 'cust' ? a.customer : sortKey === 'new' ? a.ytdNew : a.arr;
      const bv = sortKey === 'cust' ? b.customer : sortKey === 'new' ? b.ytdNew : b.arr;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [detail, search, sortAsc, sortKey]);

  const setSort = (key) => {
    if (sortKey === key) setSortAsc(prev => !prev);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const totals = filteredRows.reduce((acc, row) => ({
    arr: acc.arr + row.arr,
    ytdNew: acc.ytdNew + row.ytdNew,
    mom: acc.mom + row.mom,
  }), { arr: 0, ytdNew: 0, mom: 0 });

  return (
    <div className="arr-rep360">
      <DevOverlay name="Rep360 Selector">
        <div className="arr-r360-selector">
          <div className="arr-r360-select-wrap">
            <label>Select Sales Rep</label>
            <select value={rep} onChange={event => setSelectedRep(event.target.value)}>
              <option value="">- Choose a Sales Rep -</option>
              {base.reps.map(item => (
                <option key={item.rep} value={item.rep}>
                  {item.rep} ({item.arr > 0 ? `${fmt(item.arr)} ARR` : 'no active ARR'})
                </option>
              ))}
            </select>
          </div>
          {detail && (
            <div className="arr-c360-badges">
              <span className="arr-tag">{detail.region}</span>
              <span className="arr-tag">{detail.logos} Customers</span>
              <span className="arr-tag">{detail.deals.length} Deals</span>
            </div>
          )}
        </div>
      </DevOverlay>

      {!rep && (
        <div className="arr-c360-empty">
          <div className="arr-c360-empty-icon">🧑‍💼</div>
          <h3>Select a Sales Rep above</h3>
          <p>Or click any bar in the ARR by Sales Rep chart on the Dashboard tab</p>
        </div>
      )}

      {rep && !detail && (
        <div className="arr-c360-empty">
          <h3>No data for {rep}</h3>
        </div>
      )}

      {detail && (
        <>
          <div className="arr-c360-kpis">
            <DevOverlay name="Rep360 Closing ARR">
              <KpiCardLite label="Closing ARR" value={shortMoney(detail.totalArr)} sub={`as of ${detail.latest}`} color="#1e5fa8" />
            </DevOverlay>
            <DevOverlay name="Rep360 MoM Change">
              <KpiCardLite label="MoM Change" value={signedShort(detail.mom)} sub={`vs ${detail.prevM}`} color={detail.mom >= 0 ? '#15803d' : '#b91c1c'} />
            </DevOverlay>
            <DevOverlay name="Rep360 Period Bookings">
              <KpiCardLite label="Period Bookings" value={shortMoney(detail.periodNew + detail.periodUp)} sub="new + upsell" color="#059669" />
            </DevOverlay>
            <DevOverlay name="Rep360 NRR">
              <KpiCardLite label="NRR %" value={`${detail.nrr.toFixed(1)}%`} sub="net revenue retention" color={detail.nrr >= 100 ? '#15803d' : detail.nrr >= 80 ? '#d97706' : '#b91c1c'} />
            </DevOverlay>
            <DevOverlay name="Rep360 Avg Contract">
              <KpiCardLite label="Avg Contract" value={shortMoney(detail.acv)} sub={`${detail.logos} accounts`} color="#6d28d9" />
            </DevOverlay>
          </div>

          {detail.insight && <div className={`arr-c360-insight ${detail.insight.tone}`}>{detail.insight.text}</div>}

          <div className="arr-c360-grid2">
            <DevOverlay name="Rep360 ARR Trend">
              <ChartCard title="ARR Trend - Last 12 Months" sub={`Last 12 months ARR - ${rep}`}>
                <LineChart data={detail.trend} color="#1e5fa8" height={250} />
              </ChartCard>
            </DevOverlay>
            <DevOverlay name="Rep360 Customer Mix">
              <ChartCard title="Customer Mix" sub="Current ARR split by customer">
                <DonutChart items={detail.customerMix} empty="No customer ARR" />
              </ChartCard>
            </DevOverlay>
          </div>

          <div className="arr-c360-grid2">
            <DevOverlay name="Rep360 Waterfall">
              <ChartCard title="New Won vs Churn - Monthly" sub="Bookings and losses month by month">
                <WaterfallBars data={detail.waterfall} />
              </ChartCard>
            </DevOverlay>
            <DevOverlay name="Rep360 Product Mix">
              <ChartCard title="ARR by Sub-Product" sub="Current ARR split by product">
                <DonutChart items={detail.productMix} empty="No product ARR" />
              </ChartCard>
            </DevOverlay>
          </div>

          <DevOverlay name="Rep360 Customer Detail">
            <div className="arr-tcard arr-r360-table-card">
              <div className="arr-tcard-hdr">
                <span className="arr-tcard-title">👤 Customer Detail</span>
                <input className="arr-search" placeholder="Search customers..." value={search} onChange={event => setSearch(event.target.value)} />
              </div>
              <div className="arr-twrap">
                <table className="arr-r360-table">
                  <thead>
                    <tr>
                      <th onClick={() => setSort('cust')}>Customer ↕</th>
                      <th>BU</th>
                      <th>Sub-Product</th>
                      <th className="right" onClick={() => setSort('arr')}>Closing ARR ↕</th>
                      <th className="right" onClick={() => setSort('new')}>YTD New+Upsell ↕</th>
                      <th className="right">MoM</th>
                      <th className="center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => {
                      const growing = row.arr > 0 && row.mom > 0;
                      const declining = row.arr > 0 && row.mom < 0;
                      return (
                        <tr key={`${row.customer}-${row.product}`}>
                          <td><strong>{row.customer}</strong></td>
                          <td><span className="arr-tag">{row.region}</span></td>
                          <td>{row.product}</td>
                          <td className="right money">{row.arr ? shortMoney(row.arr) : '-'}</td>
                          <td className="right money arr-up">{row.ytdNew ? shortMoney(row.ytdNew) : '-'}</td>
                          <td className={`right money ${row.mom >= 0 ? 'arr-up' : 'arr-dn'}`}>{row.mom ? signedShort(row.mom) : '-'}</td>
                          <td className="center">
                            <span className={`arr-r360-status ${growing ? 'growing' : declining ? 'declining' : 'stable'}`}>
                              {growing ? '▲ Growing' : declining ? '▼ Declining' : '━ Stable'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredRows.length && <tr><td colSpan={7} className="bm-empty-row">No customer data for this rep.</td></tr>}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>Total ({filteredRows.length} lines)</td>
                      <td className="right money">{shortMoney(totals.arr)}</td>
                      <td className="right money arr-up">{shortMoney(totals.ytdNew)}</td>
                      <td className={`right money ${totals.mom >= 0 ? 'arr-up' : 'arr-dn'}`}>{signedShort(totals.mom)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </DevOverlay>

          <DevOverlay name="Rep360 Events Timeline">
            <ChartCard title="📅 Deal Events Timeline" sub="All New, Upsell, Renewal, Churn events for this rep - chronological" className="arr-c360-card-spaced">
              <div className="arr-c360-table-scroll short">
                <table className="arr-c360-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Event</th>
                      <th>Product</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.events.slice(0, 50).map((event, index) => {
                      const color = EVENT_COLORS[event.type] || '#64748b';
                      return (
                        <tr key={`${event.month}-${event.customer}-${event.type}-${index}`}>
                          <td><strong>{event.month}</strong></td>
                          <td><strong>{event.customer}</strong></td>
                          <td><span className="arr-c360-event" style={{ background: `${color}18`, color }}>{EVENT_ICONS[event.type] || '•'} {event.type}</span></td>
                          <td>{event.product}</td>
                          <td className="right money" style={{ color }}>{signedShort(event.amount)}</td>
                        </tr>
                      );
                    })}
                    {!detail.events.length && <tr><td colSpan={5} className="bm-empty-row">No deal events found</td></tr>}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </DevOverlay>
        </>
      )}
    </div>
  );
}

export { Rep360Tab };
