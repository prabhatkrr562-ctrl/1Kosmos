import { useMemo, useState } from 'react';
import { fmtFull } from './arrShared';

const EMPTY_ARRAY = [];

const rowMonthArr = (row, month) => Number(row?.monthly_arr?.[month] || 0);

const moneyShort = (value) => {
  const n = Number(value || 0);
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
};

function addMonths(month, count) {
  const [year, raw] = month.split('-').map(Number);
  const date = new Date(year, raw - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function changeValue(changes, key) {
  const names = {
    upsell: ['Upsell', 'upsell'],
  }[key] || [key];
  return names.reduce((sum, name) => sum + Number(changes?.[name] || 0), 0);
}

function SimpleLineChart({ labels, actual, forecast }) {
  const width = 900;
  const height = 290;
  const pad = { l: 62, r: 24, t: 24, b: 42 };
  const values = [...actual, ...forecast].filter(v => Number(v) > 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const x = i => pad.l + (i / Math.max(labels.length - 1, 1)) * (width - pad.l - pad.r);
  const y = v => pad.t + (height - pad.t - pad.b) - ((Number(v || 0) - min) / range) * (height - pad.t - pad.b);
  const pathFor = (series) => series
    .map((v, i) => (v == null ? null : `${i === 0 || series[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((range * i) / 4));

  return (
    <svg className="arr-intel-line-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="#eef2f6" />
          <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#8898aa">{moneyShort(tick)}</text>
        </g>
      ))}
      {labels.map((label, i) => (
        i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1 ? (
          <text key={label} x={x(i)} y={height - 14} textAnchor="middle" fontSize="10" fill="#8898aa">{label}</text>
        ) : null
      ))}
      <path d={pathFor(actual)} fill="none" stroke="#1e5fa8" strokeWidth="2.5" />
      <path d={pathFor(forecast)} fill="none" stroke="#15803d" strokeWidth="2.5" strokeDasharray="7 4" />
      {actual.map((v, i) => v == null ? null : <circle key={`a-${i}`} cx={x(i)} cy={y(v)} r="3" fill="#1e5fa8" />)}
      {forecast.map((v, i) => v == null ? null : <circle key={`f-${i}`} cx={x(i)} cy={y(v)} r="3.5" fill="#15803d" />)}
    </svg>
  );
}

function LogoRetentionChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap(row => [row.started, row.active]));
  return (
    <div className="arr-logo-retention-chart">
      {rows.map(row => (
        <div className="arr-logo-retention-row" key={row.year}>
          <div className="arr-logo-year">{row.year}</div>
          <div className="arr-logo-bars">
            <div className="arr-logo-bar started" style={{ width: `${Math.max(3, (row.started / max) * 100)}%` }}>
              <span>{row.started}</span>
            </div>
            <div className="arr-logo-bar active" style={{ width: `${Math.max(3, (row.active / max) * 100)}%` }}>
              <span>{row.active} ({row.retention}%)</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IntelligenceTab({ data }) {
  const [forecastMonths, setForecastMonths] = useState(6);
  const records = data.records || EMPTY_ARRAY;
  const trend = data.trend || EMPTY_ARRAY;

  const intelligence = useMemo(() => {
    const monthTotals = {};
    records.forEach(row => {
      Object.entries(row.monthly_arr || {}).forEach(([month, value]) => {
        monthTotals[month] = (monthTotals[month] || 0) + Number(value || 0);
      });
    });
    trend.forEach(row => {
      if (row.month && Number(row.value || 0) > 0) monthTotals[row.month] = Number(row.value || 0);
    });

    const allMonths = Object.keys(monthTotals).filter(month => Number(monthTotals[month] || 0) > 0).sort();
    const latest = allMonths.at(-1);
    const currentARR = Number(monthTotals[latest] || 0);

    const milestones = [5e6, 10e6, 15e6, 20e6, 25e6, 30e6, 40e6, 50e6, 75e6, 100e6].map(target => {
      const pct = Math.min(100, currentARR / target * 100);
      const done = currentARR >= target;
      const color = done ? '#15803d' : pct > 80 ? '#d97706' : '#1e5fa8';
      return { target, pct, done, color };
    });

    const last12 = allMonths.slice(-12);
    const values = last12.map(month => Number(monthTotals[month] || 0));
    const lastARR = values.at(-1) || 0;
    const momRates = [];
    for (let i = 1; i < values.length; i += 1) {
      if (values[i - 1] > 0) momRates.push((values[i] - values[i - 1]) / values[i - 1]);
    }
    momRates.sort((a, b) => a - b);
    const trimmed = momRates.length > 4 ? momRates.slice(1, -1) : momRates;
    const avgRate = trimmed.length ? trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length : 0;
    const fwdMonths = Array.from({ length: forecastMonths }, (_, i) => addMonths(latest, i + 1));
    const fwdValues = fwdMonths.map((_, index) => Math.round(lastARR * Math.pow(1 + avgRate, index + 1)));
    const forecastLabels = [...last12, ...fwdMonths];
    const actualSeries = [...values, ...fwdMonths.map(() => null)];
    const forecastSeries = [...last12.slice(0, -1).map(() => null), lastARR, ...fwdValues];

    const custFirstYear = {};
    const custActive = {};
    const custInfo = {};
    records.forEach(row => {
      const customer = row.end_user || row.bill_to || 'Unspecified';
      const rep = row.sales_person || row.sales_rep || '-';
      const activeMonths = Object.keys(row.monthly_arr || {}).filter(month => rowMonthArr(row, month) > 0).sort();
      if (activeMonths.length) {
        const year = activeMonths[0].slice(0, 4);
        if (!custFirstYear[customer] || year < custFirstYear[customer]) custFirstYear[customer] = year;
      }
      if (rowMonthArr(row, latest) > 0) custActive[customer] = 1;
      if (!custInfo[customer]) custInfo[customer] = { customer, rep, firstM: '', arr: 0, totalUp: 0, upMonths: 0 };
      if (!custInfo[customer].rep || custInfo[customer].rep === '-') custInfo[customer].rep = rep;
      if (activeMonths.length && (!custInfo[customer].firstM || activeMonths[0] < custInfo[customer].firstM)) {
        custInfo[customer].firstM = activeMonths[0];
      }
      custInfo[customer].arr += rowMonthArr(row, latest);
      Object.values(row.monthly_changes || {}).forEach(change => {
        const upsell = changeValue(change, 'upsell');
        if (upsell > 0) {
          custInfo[customer].totalUp += upsell;
          custInfo[customer].upMonths += 1;
        }
      });
    });

    const cohortMap = {};
    Object.keys(custFirstYear).forEach(customer => {
      const year = custFirstYear[customer];
      if (!cohortMap[year]) cohortMap[year] = { year, started: 0, active: 0 };
      cohortMap[year].started += 1;
      if (custActive[customer]) cohortMap[year].active += 1;
    });
    const logoRetention = Object.values(cohortMap).sort((a, b) => a.year.localeCompare(b.year)).map(row => ({
      ...row,
      retention: row.started > 0 ? Number((row.active / row.started * 100).toFixed(1)) : 0,
    }));

    const maxARR = Math.max(1, ...Object.values(custInfo).map(row => Number(row.arr || 0)));
    const latestIndex = allMonths.indexOf(latest);
    const expansion = Object.values(custInfo).filter(row => row.arr > 0 && row.totalUp === 0 && row.firstM).map(row => {
      const months = latestIndex - allMonths.indexOf(row.firstM);
      const tenureScore = Math.min(50, Math.round(months / 36 * 50));
      const arrScore = Math.min(50, Math.round(row.arr / maxARR * 50));
      return { ...row, months, tenureScore, arrScore, score: tenureScore + arrScore };
    }).sort((a, b) => b.score - a.score).slice(0, 15);

    return {
      latest,
      currentARR,
      milestones,
      forecast: {
        labels: forecastLabels,
        actual: actualSeries,
        forecast: forecastSeries,
        avgRate,
        projected: fwdValues.at(-1) || lastARR,
        gain: (fwdValues.at(-1) || lastARR) - lastARR,
      },
      logoRetention,
      expansion,
    };
  }, [records, trend, forecastMonths]);

  const rateText = `${intelligence.forecast.avgRate >= 0 ? '+' : ''}${(intelligence.forecast.avgRate * 100).toFixed(2)}%`;

  return (
    <>
      <div className="arr-chart-card arr-t5-card">
        <h4 className="arr-t5-title">🎯 ARR Milestone Tracker</h4>
        <div className="arr-chart-sub">Progress toward next ARR milestones</div>
        <div className="arr-milestone-list">
          {intelligence.milestones.map(item => (
            <div className="arr-milestone-row" key={item.target}>
              <div className="arr-milestone-target">{moneyShort(item.target).replace('.00', '')}</div>
              <div className="arr-milestone-bar">
                <div className="arr-milestone-fill" style={{ width: `${item.pct}%`, background: item.color }}>
                  {item.pct > 15 ? moneyShort(intelligence.currentARR) : ''}
                </div>
              </div>
              <div className="arr-milestone-pct" style={{ color: item.color }}>{item.pct.toFixed(0)}%</div>
              <div className="arr-milestone-status">{item.done ? '✅' : '⬜'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="arr-chart-card arr-t5-card">
        <div className="arr-t5-card-head">
          <div>
            <h4 className="arr-t5-title">📈 ARR Forecast (6-Month Run Rate)</h4>
            <div className="arr-chart-sub">Projected ARR based on recent growth trend — linear extrapolation</div>
          </div>
          <select className="arr-t5-select" value={forecastMonths} onChange={event => setForecastMonths(Number(event.target.value))}>
            <option value={3}>3 months ahead</option>
            <option value={6}>6 months ahead</option>
            <option value={12}>12 months ahead</option>
          </select>
        </div>
        <div className="arr-t5-chart-wrap">
          <SimpleLineChart labels={intelligence.forecast.labels} actual={intelligence.forecast.actual} forecast={intelligence.forecast.forecast} />
        </div>
        <div className="arr-forecast-summary">
          <div className="arr-forecast-stat green"><small>Avg MoM Growth Rate</small><strong>{rateText}</strong><span>Trimmed avg</span></div>
          <div className="arr-forecast-stat blue"><small>Current ARR</small><strong>{moneyShort(intelligence.currentARR)}</strong><span>as of {intelligence.latest}</span></div>
          <div className="arr-forecast-stat green"><small>Projected ARR ({forecastMonths}m)</small><strong>{moneyShort(intelligence.forecast.projected)}</strong><span>After {forecastMonths}mo compounding</span></div>
          <div className="arr-forecast-stat green"><small>Projected Gain</small><strong>{moneyShort(intelligence.forecast.gain)}</strong><span>Incremental ARR</span></div>
        </div>
        <div className="arr-forecast-method">
          <b>📐 Method:</b> Average MoM % growth rate over the last 12 months (trimmed to remove outliers), then compounded forward.
          <br />
          <span>ARR(n) = {moneyShort(intelligence.currentARR)} x (1 {intelligence.forecast.avgRate >= 0 ? '+' : ''}{rateText})^n</span>
        </div>
      </div>

      <div className="arr-chart-card arr-t5-card">
        <h4 className="arr-t5-title">📊 Logo Retention by Cohort</h4>
        <div className="arr-chart-sub">% of customers retained by acquisition year</div>
        <LogoRetentionChart rows={intelligence.logoRetention} />
      </div>

      <div className="arr-chart-card arr-t5-card">
        <h4 className="arr-t5-title">🚀 Customer Expansion Opportunities</h4>
        <div className="arr-chart-sub">Customers ranked by expansion potential — tenure, ARR trend, upsell history</div>
        <div className="arr-expand-table-wrap">
          <table className="arr-expand-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Rep</th>
                <th>Current ARR</th>
                <th>Tenure</th>
                <th>Score Breakdown</th>
                <th>Score /100</th>
              </tr>
            </thead>
            <tbody>
              {intelligence.expansion.map(row => {
                const scoreClass = row.score >= 75 ? 'high' : row.score >= 40 ? 'mid' : 'low';
                return (
                  <tr key={row.customer}>
                    <td className="arr-expand-name">{row.customer}</td>
                    <td>{row.rep || '-'}</td>
                    <td className="arr-expand-money">{fmtFull(row.arr)}</td>
                    <td>{row.months}m</td>
                    <td>
                      <div className="arr-expand-scorebar">
                        <i style={{ width: `${row.tenureScore}%`, background: '#1e5fa8' }} />
                        <i style={{ width: `${row.arrScore}%`, background: '#15803d' }} />
                        <i style={{ width: `${Math.max(0, 100 - row.tenureScore - row.arrScore)}%`, background: '#f1f5f9' }} />
                      </div>
                      <div className="arr-expand-score-note">{row.tenureScore}t + {row.arrScore}a</div>
                    </td>
                    <td><span className={`arr-score-pill ${scoreClass}`}>{row.score}</span></td>
                  </tr>
                );
              })}
              {!intelligence.expansion.length && <tr><td colSpan={6} className="bm-empty-row">No expansion candidates found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default IntelligenceTab;
export { IntelligenceTab };
