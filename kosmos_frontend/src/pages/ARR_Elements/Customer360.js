import { useMemo, useState } from 'react';
import { fmt, fmtFull } from './arrShared';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';

const EMPTY_ARRAY = [];
const PRODUCT_COLORS = ['#1e5fa8', '#15803d', '#d97706', '#6d28d9', '#0f766e', '#b91c1c', '#ea580c', '#64748b'];
const EVENT_COLORS = {
  New: '#15803d',
  Upsell: '#22c55e',
  Renewal: '#d97706',
  Churn: '#b91c1c',
  Downsell: '#ea580c',
  DOWNSELL: '#ea580c',
};
const EVENT_ICONS = {
  New: '🆕',
  Upsell: '⬆️',
  Renewal: '🔄',
  Churn: '❌',
  Downsell: '⬇️',
  DOWNSELL: '⬇️',
};

function customerName(row) {
  return row.end_user || row.customer || row.bill_to || row.contract_name || '';
}

function productName(row) {
  return row.sub_product || row.sub_product_type || row.product || row.product_type || 'Other';
}

function arrMap(row) {
  return row.arr || row.monthly_arr || {};
}

function changesMap(row) {
  return row.changes || row.monthly_changes || {};
}

function changeValue(change, key) {
  if (!change) return 0;
  const aliases = {
    New: ['New', 'new'],
    Upsell: ['Upsell', 'upsell', 'UpSell', 'up_sell'],
    Renewal: ['Renewal', 'renewal'],
    Churn: ['Churn', 'churn'],
    Downsell: ['Downsell', 'DOWNSELL', 'downsell'],
  }[key] || [key];
  return aliases.reduce((sum, alias) => sum + Number(change[alias] || 0), 0);
}

function moneyOrDash(value) {
  return Number(value || 0) ? fmtFull(value) : '-';
}

function signedMoney(value) {
  const n = Number(value || 0);
  if (!n) return '-';
  return `${n > 0 ? '+' : '-'}${fmtFull(Math.abs(n))}`;
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

function SimpleLineChart({ data, color = '#1e5fa8', height = 240 }) {
  if (!data.length) return <div className="arr-c360-chart-empty" style={{ height }}>No chart data</div>;
  const width = 760;
  const pad = { l: 58, r: 18, t: 22, b: 38 };
  const vals = data.map(row => Number(row.value || 0));
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const range = max - min || 1;
  const xFor = index => pad.l + (index / Math.max(data.length - 1, 1)) * (width - pad.l - pad.r);
  const yFor = value => pad.t + (height - pad.t - pad.b) - ((Number(value || 0) - min) / range) * (height - pad.t - pad.b);
  const points = data.map((row, index) => `${xFor(index).toFixed(1)},${yFor(row.value).toFixed(1)}`).join(' ');
  const area = `${pad.l},${height - pad.b} ${points} ${width - pad.r},${height - pad.b}`;
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((range / 4) * index));

  return (
    <svg className="arr-c360-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`c360Line${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".18" />
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
      <polygon points={area} fill={`url(#c360Line${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {data.map((row, index) => (
        <circle key={row.month} cx={xFor(index)} cy={yFor(row.value)} r={index === data.length - 1 ? 4 : 2.4} fill={color} vectorEffect="non-scaling-stroke">
          <title>{`${row.month}: ${fmtFull(row.value)}`}</title>
        </circle>
      ))}
      {data.map((row, index) => {
        if (data.length > 16 && index % Math.ceil(data.length / 10) !== 0 && index !== data.length - 1) return null;
        return <text key={`m-${row.month}`} x={xFor(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="#8898aa">{row.month}</text>;
      })}
    </svg>
  );
}

function MultiLineChart({ months, series, height = 240 }) {
  const visible = series.filter(item => item.values.some(value => Number(value) > 0)).slice(0, 6);
  if (!visible.length) return <div className="arr-c360-chart-empty" style={{ height }}>No product trend data</div>;
  const width = 760;
  const pad = { l: 58, r: 18, t: 22, b: 42 };
  const vals = visible.flatMap(item => item.values.map(value => Number(value || 0)));
  const max = Math.max(1, ...vals);
  const xFor = index => pad.l + (index / Math.max(months.length - 1, 1)) * (width - pad.l - pad.r);
  const yFor = value => pad.t + (height - pad.t - pad.b) - (Number(value || 0) / max) * (height - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, index) => (max / 4) * index);

  return (
    <div className="arr-c360-multi-wrap">
      <svg className="arr-c360-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {ticks.map((tick, index) => {
          const y = yFor(tick);
          return (
            <g key={index}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="rgba(0,0,0,.05)" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#8898aa">{fmt(tick)}</text>
            </g>
          );
        })}
        {visible.map((item, itemIndex) => {
          const color = PRODUCT_COLORS[itemIndex % PRODUCT_COLORS.length];
          const points = item.values.map((value, index) => `${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`).join(' ');
          return (
            <polyline key={item.label} points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke">
              <title>{item.label}</title>
            </polyline>
          );
        })}
        {months.map((month, index) => {
          if (months.length > 16 && index % Math.ceil(months.length / 10) !== 0 && index !== months.length - 1) return null;
          return <text key={month} x={xFor(index)} y={height - 14} textAnchor="middle" fontSize="10" fill="#8898aa">{month}</text>;
        })}
      </svg>
      <div className="arr-c360-legend">
        {visible.map((item, index) => (
          <span key={item.label}><i style={{ background: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }} />{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!items.length || !total) return <div className="arr-c360-chart-empty">No product data</div>;
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
              stroke={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
              strokeWidth="34"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 110 110)"
            >
              <title>{`${item.label}: ${fmtFull(item.value)} (${((item.value / total) * 100).toFixed(1)}%)`}</title>
            </circle>
          );
          offset += dash;
          return circle;
        })}
        <text x="110" y="106" textAnchor="middle" fontSize="20" fontWeight="900" fill="#0f2d52">{fmt(total)}</text>
        <text x="110" y="124" textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">TOTAL ARR</text>
      </svg>
      <div className="arr-c360-donut-legend">
        {items.map((item, index) => (
          <div key={item.label}>
            <span><i style={{ background: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }} />{item.label}</span>
            <strong>{fmtFull(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customer360Tab({ data }) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const records = data.records || EMPTY_ARRAY;

  const base = useMemo(() => {
    const monthSet = new Set(data.all_months || []);
    records.forEach(row => {
      Object.keys(arrMap(row)).forEach(month => monthSet.add(month));
      Object.keys(changesMap(row)).forEach(month => monthSet.add(month));
    });
    const allMonths = [...monthSet].filter(Boolean).sort();
    const latest = data.latest_month || data.kpis?.latest_month || allMonths.filter(month => records.some(row => Number(arrMap(row)[month] || 0) > 0)).at(-1) || allMonths.at(-1) || '';
    const activeMonths = allMonths.filter(month => records.some(row => Number(arrMap(row)[month] || 0) > 0));

    const customerStats = {};
    records.forEach(row => {
      const name = customerName(row);
      if (!name) return;
      const monthly = arrMap(row);
      if (!customerStats[name]) customerStats[name] = { customer: name, arr: 0, peak: 0 };
      customerStats[name].arr += Number(monthly[latest] || 0);
      Object.values(monthly).forEach(value => {
        customerStats[name].peak = Math.max(customerStats[name].peak, Number(value || 0));
      });
    });

    const customers = Object.values(customerStats)
      .filter(customer => customer.peak > 0)
      .sort((a, b) => Number(b.arr || 0) - Number(a.arr || 0) || Number(b.peak || 0) - Number(a.peak || 0));

    return { allMonths, activeMonths, latest, customers };
  }, [data, records]);

  const customerDetail = useMemo(() => {
    if (!selectedCustomer) return null;
    const deals = records.filter(row => customerName(row) === selectedCustomer);
    if (!deals.length) return null;

    const latest = base.latest;
    const prevM = base.allMonths[base.allMonths.indexOf(latest) - 1] || '';
    const arrByMonth = {};
    deals.forEach(row => {
      Object.entries(arrMap(row)).forEach(([month, value]) => {
        arrByMonth[month] = (arrByMonth[month] || 0) + Number(value || 0);
      });
    });

    const activeMonths = Object.keys(arrByMonth).filter(month => arrByMonth[month] > 0).sort();
    const firstM = activeMonths[0] || latest;
    const lastM = activeMonths.at(-1) || latest;
    const firstIdx = Math.max(0, base.allMonths.indexOf(firstM));
    const trimMonths = base.allMonths.slice(firstIdx);
    const currARR = Number(arrByMonth[latest] || arrByMonth[lastM] || 0);
    const prevARR = Number(arrByMonth[prevM] || 0);
    const mom = currARR - prevARR;
    const periodMonths = base.activeMonths.filter(month => month <= latest);
    const tenureMonths = Math.max(0, base.activeMonths.indexOf(latest) - base.activeMonths.indexOf(firstM));

    let totalNew = 0;
    let totalUpsell = 0;
    let totalRenewal = 0;
    let totalChurn = 0;
    let totalDownsell = 0;
    const productCurrent = {};
    const eventRows = [];
    const repData = {};
    const productTrendMap = {};

    deals.forEach(row => {
      const prod = productName(row);
      const rep = row.sales_person || row.sales_rep || '-';
      const monthly = arrMap(row);
      const changes = changesMap(row);

      productCurrent[prod] = (productCurrent[prod] || 0) + Number(monthly[latest] || monthly[lastM] || 0);
      if (!productTrendMap[prod]) productTrendMap[prod] = {};
      trimMonths.forEach(month => {
        productTrendMap[prod][month] = (productTrendMap[prod][month] || 0) + Number(monthly[month] || 0);
      });

      if (!repData[rep]) repData[rep] = { arr: 0, newWon: 0, upsell: 0, products: new Set() };
      repData[rep].arr += Number(monthly[latest] || 0);
      repData[rep].products.add(prod);

      periodMonths.forEach(month => {
        const change = changes[month] || {};
        const values = {
          New: changeValue(change, 'New'),
          Upsell: changeValue(change, 'Upsell'),
          Renewal: changeValue(change, 'Renewal'),
          Churn: changeValue(change, 'Churn'),
          Downsell: changeValue(change, 'Downsell'),
        };
        totalNew += Math.max(0, values.New);
        totalUpsell += Math.max(0, values.Upsell);
        totalRenewal += Math.max(0, values.Renewal);
        totalChurn += Math.abs(Math.min(0, values.Churn));
        totalDownsell += Math.abs(Math.min(0, values.Downsell));
        repData[rep].newWon += Math.max(0, values.New);
        repData[rep].upsell += Math.max(0, values.Upsell);

        Object.entries(values).forEach(([type, value]) => {
          if (!value) return;
          eventRows.push({
            month,
            type,
            amount: value,
            product: prod,
            rep,
            arrAfter: arrByMonth[month] || 0,
          });
        });
      });
    });

    eventRows.sort((a, b) => a.month.localeCompare(b.month));

    const productMix = Object.entries(productCurrent)
      .map(([label, value]) => ({ label, value }))
      .filter(item => Number(item.value) > 0)
      .sort((a, b) => b.value - a.value);

    const productTrend = Object.entries(productTrendMap)
      .map(([label, monthMap]) => ({
        label,
        total: Object.values(monthMap).reduce((sum, value) => sum + Number(value || 0), 0),
        values: trimMonths.map(month => Number(monthMap[month] || 0)),
      }))
      .sort((a, b) => b.total - a.total);

    const repHistory = Object.entries(repData)
      .map(([rep, row]) => ({
        rep,
        arr: row.arr,
        newWon: row.newWon,
        upsell: row.upsell,
        products: [...row.products].filter(Boolean).join(', '),
      }))
      .sort((a, b) => b.arr - a.arr);

    const info = deals[0] || {};
    const region = info.region || info.business_unit || '-';
    const industry = info.industry || '-';
    const size = info.size || info.company_size || '-';
    const nrr = prevARR > 0 ? ((prevARR - totalChurn - totalDownsell + totalUpsell) / prevARR) * 100 : 0;
    const lastThree = activeMonths.slice(-3).map(month => arrByMonth[month] || 0);
    const declining = lastThree.length >= 2 && lastThree.at(-1) < lastThree[0];
    const risk = currARR === 0
      ? { label: '🔴 Churned', color: '#b91c1c', bg: '#fee2e2' }
      : declining
        ? { label: '🟠 Declining', color: '#f97316', bg: '#fff7ed' }
        : { label: '🟢 Healthy', color: '#15803d', bg: '#f0fdf4' };

    let insight = null;
    if (currARR === 0) {
      insight = { tone: 'danger', text: `${selectedCustomer} has churned - last active ARR was ${fmtFull(Math.max(...activeMonths.map(month => arrByMonth[month] || 0), 0))} in ${lastM}` };
    } else if (declining) {
      const dropPct = lastThree[0] > 0 ? ((lastThree[0] - lastThree.at(-1)) / lastThree[0]) * 100 : 0;
      insight = { tone: 'warn', text: `${selectedCustomer} ARR has declined ${dropPct.toFixed(1)}% over the last 3 months - may require attention` };
    } else if (nrr > 110) {
      insight = { tone: 'good', text: `${selectedCustomer} is a top expander - NRR ${nrr.toFixed(1)}% with ${fmtFull(totalUpsell)} upsell in period` };
    } else if (totalChurn + totalDownsell > 0) {
      insight = { tone: 'warn', text: `${selectedCustomer} had ${fmtFull(totalChurn + totalDownsell)} in churn/downsell this period` };
    }

    return {
      deals,
      region,
      industry,
      size,
      firstM,
      lastM,
      latest,
      prevM,
      currARR,
      prevARR,
      mom,
      totalNew,
      totalUpsell,
      totalRenewal,
      totalChurn,
      totalDownsell,
      tenureMonths,
      nrr,
      nrrColor: nrr >= 100 ? '#15803d' : nrr >= 80 ? '#d97706' : '#b91c1c',
      productMix,
      productTrend,
      trimMonths,
      trend: trimMonths.map(month => ({ month, value: arrByMonth[month] || 0 })),
      events: eventRows,
      repHistory,
      risk,
      insight,
    };
  }, [selectedCustomer, records, base]);

  return (
    <>
      <DevOverlay name="C360 Selector">
        <div className="arr-c360-selector">
          <div className="arr-c360-selector-inner">
            <div className="arr-c360-selector-ctrl">
              <label className="arr-c360-select-label">Select Customer</label>
              <select className="arr-c360-select" value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)}>
                <option value="">- Choose a customer -</option>
                {base.customers.map(customer => (
                  <option key={customer.customer} value={customer.customer}>
                    {customer.customer} ({customer.arr > 0 ? fmt(customer.arr) : 'historical'})
                  </option>
                ))}
              </select>
            </div>
            {customerDetail && (
              <div className="arr-c360-badges">
                <span className="arr-tag">{customerDetail.region}</span>
                <span className="arr-tag">{customerDetail.industry}</span>
                <span className="arr-tag">{customerDetail.size}</span>
                <span className="arr-tag">{customerDetail.productMix.length} product{customerDetail.productMix.length === 1 ? '' : 's'}</span>
                <span className="arr-tag">Since {customerDetail.firstM}</span>
                <span className="arr-tag" style={{ background: customerDetail.risk.bg, color: customerDetail.risk.color }}>{customerDetail.risk.label}</span>
              </div>
            )}
          </div>
        </div>
      </DevOverlay>

      {!selectedCustomer && (
        <div className="arr-c360-empty">
          <div className="arr-c360-empty-icon">👁️</div>
          <h3>Select a customer above</h3>
          <p>Full ARR history, deal events, product breakdown and rep activity</p>
        </div>
      )}

      {selectedCustomer && !customerDetail && (
        <div className="arr-c360-empty">
          <h3>No data for {selectedCustomer}</h3>
        </div>
      )}

      {customerDetail && (
        <div className="arr-c360-content">
          <div className="arr-c360-kpis">
            {[
              { label: 'Closing ARR', value: fmtFull(customerDetail.currARR), sub: `as of ${customerDetail.latest}`, color: '#1e5fa8' },
              { label: 'MoM Change', value: signedMoney(customerDetail.mom), sub: `vs ${customerDetail.prevM || 'prior'}`, color: customerDetail.mom >= 0 ? '#15803d' : '#b91c1c' },
              { label: 'Period New Won', value: fmtFull(customerDetail.totalNew + customerDetail.totalUpsell), sub: 'new + upsell in period', color: '#15803d' },
              { label: 'Tenure', value: `${customerDetail.tenureMonths}m`, sub: `since ${customerDetail.firstM}`, color: '#6d28d9' },
              { label: 'NRR %', value: `${customerDetail.nrr.toFixed(1)}%`, sub: 'net revenue retention', color: customerDetail.nrrColor },
            ].map(card => (
              <DevOverlay key={card.label} name={`C360 ${card.label}`}>
                <div className="arr-c360-kpi" style={{ borderTopColor: card.color }}>
                  <div className="arr-c360-kpi-click">Click</div>
                  <div className="arr-c360-kpi-label">{card.label}</div>
                  <div className="arr-c360-kpi-val" style={{ color: card.color }}>{card.value}</div>
                  <div className="arr-c360-kpi-sub">{card.sub}</div>
                </div>
              </DevOverlay>
            ))}
          </div>

          {customerDetail.insight && (
            <div className={`arr-c360-insight ${customerDetail.insight.tone}`}>
              {customerDetail.insight.text}
            </div>
          )}

          <div className="arr-c360-grid2">
            <DevOverlay name="C360 ARR History">
              <ChartCard
                title="ARR History - Full Lifetime"
                sub={`${customerDetail.trend.filter(row => row.value > 0).length} months of ARR history | ${customerDetail.firstM} -> ${customerDetail.lastM}`}
              >
                <SimpleLineChart data={customerDetail.trend} color="#1e5fa8" height={250} />
              </ChartCard>
            </DevOverlay>
            <DevOverlay name="C360 Product Mix">
              <ChartCard title="Product Mix" sub="Current ARR split by sub-product">
                <DonutChart items={customerDetail.productMix} />
              </ChartCard>
            </DevOverlay>
          </div>

          <DevOverlay name="C360 Events Timeline">
            <ChartCard title="📅 Deal Events Timeline" sub="Every New, Upsell, Renewal, Downsell, Churn event - chronological" className="arr-c360-card-spaced">
              <div className="arr-c360-table-scroll">
                <table className="arr-c360-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event Type</th>
                      <th className="right">Amount</th>
                      <th>Product</th>
                      <th>Sales Rep</th>
                      <th className="right">ARR After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetail.events.map((event, index) => {
                      const color = EVENT_COLORS[event.type] || '#64748b';
                      return (
                        <tr key={`${event.month}-${event.type}-${event.product}-${index}`}>
                          <td><strong>{event.month}</strong></td>
                          <td><span className="arr-c360-event" style={{ background: `${color}18`, color }}>{EVENT_ICONS[event.type] || '•'} {event.type}</span></td>
                          <td className="right money" style={{ color }}>{signedMoney(event.amount)}</td>
                          <td>{event.product}</td>
                          <td><span className="arr-c360-link">{event.rep}</span></td>
                          <td className="right money">{fmtFull(event.arrAfter)}</td>
                        </tr>
                      );
                    })}
                    {!customerDetail.events.length && (
                      <tr><td colSpan={6} className="bm-empty-row">No deal events in selected period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </DevOverlay>

          <div className="arr-c360-grid2">
            <DevOverlay name="C360 Product Trend">
              <ChartCard title="ARR by Product - Trend" sub="Monthly ARR per sub-product for this customer">
                <MultiLineChart months={customerDetail.trimMonths} series={customerDetail.productTrend} height={250} />
              </ChartCard>
            </DevOverlay>
            <DevOverlay name="C360 Sales Rep History">
              <ChartCard title="Sales Rep History" sub="ARR managed by each rep for this customer">
                <div className="arr-c360-table-scroll short">
                  <table className="arr-c360-table">
                    <thead>
                      <tr>
                        <th>Rep</th>
                        <th className="right">ARR Managed</th>
                        <th className="right">New Won</th>
                        <th className="right">Upsell</th>
                        <th>Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDetail.repHistory.map((row, index) => {
                        const maxArr = Math.max(...customerDetail.repHistory.map(rep => rep.arr), 1);
                        return (
                          <tr key={row.rep}>
                            <td><span className="arr-c360-link">{row.rep}</span></td>
                            <td className="right">
                              <div className="arr-c360-rep-arr">
                                <span><i style={{ width: `${Math.round((row.arr / maxArr) * 100)}%`, background: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }} /></span>
                                <strong style={{ color: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}>{fmtFull(row.arr)}</strong>
                              </div>
                            </td>
                            <td className="right money arr-up">{moneyOrDash(row.newWon)}</td>
                            <td className="right money arr-up">{moneyOrDash(row.upsell)}</td>
                            <td>{row.products || '-'}</td>
                          </tr>
                        );
                      })}
                      {!customerDetail.repHistory.length && (
                        <tr><td colSpan={5} className="bm-empty-row">No rep history available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </DevOverlay>
          </div>
        </div>
      )}
    </>
  );
}

export default Customer360Tab;
export { Customer360Tab };
