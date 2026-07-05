import { useMemo, useState } from 'react';
import { fmt, fmtFull } from './arrShared';
import { SectionHeader, BarChart } from './arrShared';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';

const getPrevMonth = (month) => {
  if (!month) return '';
  const [year, rawMonth] = month.split('-').map(Number);
  if (!year || !rawMonth) return '';
  const prev = new Date(year, rawMonth - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

const shortMoney = (value) => {
  const n = Number(value || 0);
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
};

const axisMoney = (value) => {
  const n = Number(value || 0);
  if (n === 0) return '$0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
};

const rowMonthArr = (row, month) => Number(row?.monthly_arr?.[month] || 0);
const EMPTY_ARRAY = [];

const monthRange = (from, to) => {
  if (!from || !to) return [];
  const months = [];
  let [year, month] = from.split('-').map(Number);
  const [endYear, endMonth] = to.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
};

const addMonths = (ym, count) => {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const changeValue = (changes, month, key) => {
  const raw = changes?.[month] || {};
  const canonical = {
    new: ['new', 'New'],
    upsell: ['upsell', 'Upsell'],
    renewal: ['renewal', 'Renewal'],
    churn: ['churn', 'Churn'],
    downsell: ['downsell', 'Downsell', 'DOWNSELL'],
  }[key] || [key];
  return canonical.reduce((sum, name) => sum + Number(raw[name] || 0), 0);
};

function ArrModal({ open, onClose, title, sub, bigValue, bigColor = '#1e5fa8', stats = [], insight, bench }) {
  if (!open) return null;
  return (
    <div className="arr-modal-ov" onClick={onClose}>
      <div className="arr-modal-box" onClick={e => e.stopPropagation()}>
        <button className="arr-modal-close" onClick={onClose}>âœ•</button>
        <h3 className="arr-modal-title">{title}</h3>
        {sub && <div className="arr-modal-sub">{sub}</div>}
        <div className="arr-modal-big-val" style={{ color: bigColor }}>{bigValue}</div>
        <div className="arr-modal-grid">
          {stats.map((s, i) => (
            <div key={i} className="arr-modal-stat" style={{ borderLeftColor: s.color || '#94a3b8' }}>
              <div className="arr-modal-sl">{s.l}</div>
              <div className="arr-modal-sv" style={{ color: s.color || '#1e293b' }}>{s.v}</div>
            </div>
          ))}
        </div>
        {insight && <div className="arr-modal-insight">ðŸ’¡ {insight}</div>}
        {bench && <div className="arr-modal-bench">ðŸ“Š Benchmark: {bench}</div>}
      </div>
    </div>
  );
}

function BuAnalyticsTab({ data }) {
  const [modal, setModal] = useState(null);
  const [buFilter, setBuFilter] = useState('All');
  const [leaderSort, setLeaderSort] = useState({ key: 'arr', asc: false });
  const [heatmapLimit, setHeatmapLimit] = useState(15);

  const bus = data.breakdowns?.business_units || EMPTY_ARRAY;
  const products = data.breakdowns?.products || EMPTY_ARRAY;
  const records = data.records || EMPTY_ARRAY;
  const trend = data.trend || EMPTY_ARRAY;
  const leaderboard = data.rep_leaderboard || EMPTY_ARRAY;
  const c360 = data.customer_360 || EMPTY_ARRAY;

  const total = bus.reduce((s, b) => s + Number(b.value), 0);
  const totalProd = products.reduce((s, p) => s + Number(p.value), 0);
  const colors = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626'];

  const latestMonth = useMemo(() => {
    const months = new Set(trend.map(row => row.month).filter(Boolean));
    records.forEach(row => {
      Object.entries(row.monthly_arr || {}).forEach(([month, value]) => {
        if (Number(value) > 0) months.add(month);
      });
    });
    return [...months].sort().at(-1) || '';
  }, [records, trend]);

  const activeSummary = useMemo(() => {
    const prevMonth = getPrevMonth(latestMonth);
    const customers = {};
    const prevCustomers = {};
    const reps = {};
    records.forEach(row => {
      const latestArr = rowMonthArr(row, latestMonth);
      const prevArr = rowMonthArr(row, prevMonth);
      const customer = row.end_user || row.bill_to || 'Unspecified';
      const rep = row.sales_person || row.sales_rep || '';
      if (latestArr > 0) {
        customers[customer] = (customers[customer] || 0) + latestArr;
        if (rep) reps[rep] = (reps[rep] || 0) + latestArr;
      }
      if (prevArr > 0) {
        prevCustomers[customer] = (prevCustomers[customer] || 0) + prevArr;
      }
    });

    const customerRows = Object.entries(customers)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => Number(b.value) - Number(a.value));
    const totalARR = customerRows.reduce((sum, row) => sum + Number(row.value), 0);
    const activeCustomers = customerRows.length;
    const activeReps = Object.keys(reps).length;
    const top = n => customerRows.slice(0, n).reduce((sum, row) => sum + Number(row.value), 0);
    const concentration = [1, 3, 5, 10].map(n => {
      const value = top(n);
      return {
        label: `Top ${n}`,
        value,
        percent: totalARR > 0 ? Number(((value / totalARR) * 100).toFixed(1)) : 0,
      };
    });
    const top10Pct = concentration.at(-1)?.percent || 0;
    concentration.push({
      label: 'Rest',
      value: Math.max(totalARR - top(10), 0),
      percent: Number(Math.max(0, 100 - top10Pct).toFixed(1)),
    });

    return {
      latestMonth,
      prevMonth,
      totalARR,
      activeCustomers,
      activeReps,
      logoDelta: activeCustomers - Object.keys(prevCustomers).length,
      acv: activeCustomers > 0 ? totalARR / activeCustomers : 0,
      arrPerRep: activeReps > 0 ? totalARR / activeReps : 0,
      customerRows,
      concentration,
    };
  }, [records, latestMonth]);

  const acv = activeSummary.acv;
  const arrPerRep = activeSummary.arrPerRep;

  const annualWaterfall = useMemo(() => {
    if (!latestMonth) return { rows: [], min: -5000000, max: 30000000, ticks: [] };
    const year = latestMonth.slice(0, 4);
    const firstMonth = `${year}-01`;
    const months = [];
    for (let m = 1; m <= Number(latestMonth.slice(5, 7)); m += 1) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    let startARR = 0;
    let endARR = 0;
    const totals = { new: 0, upsell: 0, renewal: 0, churn: 0, downsell: 0 };
    records.forEach(row => {
      startARR += rowMonthArr(row, firstMonth);
      endARR += rowMonthArr(row, latestMonth);
      months.forEach(month => {
        const changes = row.monthly_changes || {};
        totals.new += Math.max(0, changeValue(changes, month, 'new'));
        totals.upsell += Math.max(0, changeValue(changes, month, 'upsell'));
        totals.renewal += changeValue(changes, month, 'renewal');
        totals.churn += changeValue(changes, month, 'churn');
        totals.downsell += changeValue(changes, month, 'downsell');
      });
    });

    const rows = [
      { label: 'Start ARR', value: startARR, color: '#3d79b8', border: '#1e5fa8' },
      { label: 'New Logos', value: totals.new, color: '#37965d', border: '#15803d' },
      { label: 'Upsell', value: totals.upsell, color: '#42cf79', border: '#22c55e' },
      { label: 'Renewals', value: totals.renewal, color: '#d69b2c', border: '#d97706' },
      { label: 'Churn', value: totals.churn, color: '#c73f3f', border: '#b91c1c' },
      { label: 'Downsell', value: totals.downsell, color: '#f26f34', border: '#ea580c' },
      { label: 'End ARR', value: endARR, color: '#3d79b8', border: '#1e5fa8' },
    ];
    const maxValue = Math.max(...rows.map(row => Number(row.value || 0)), 1);
    const minValue = Math.min(...rows.map(row => Number(row.value || 0)), 0);
    const step = 5000000;
    const max = Math.max(step, Math.ceil(maxValue / step) * step);
    const min = Math.min(-step, Math.floor(minValue / step) * step);
    const ticks = [];
    for (let tick = max; tick >= min; tick -= step) ticks.push(tick);
    return { rows, min, max, ticks };
  }, [records, latestMonth]);

  const repLeaderboardRows = useMemo(() => {
    if (!latestMonth) return { rows: [], totals: { arr: 0, won: 0, churn: 0 } };
    const prevMonth = getPrevMonth(latestMonth);
    const year = latestMonth.slice(0, 4);
    const months = [];
    for (let m = 1; m <= Number(latestMonth.slice(5, 7)); m += 1) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    const repData = {};
    records.forEach(row => {
      const rep = row.sales_person || row.sales_rep || 'Unknown';
      if (!repData[rep]) repData[rep] = { rep, arr: 0, prev: 0, won: 0, churn: 0, dn: 0, up: 0 };
      repData[rep].arr += rowMonthArr(row, latestMonth);
      repData[rep].prev += rowMonthArr(row, prevMonth);
      months.forEach(month => {
        const changes = row.monthly_changes || {};
        const newVal = changeValue(changes, month, 'new');
        const upsellVal = changeValue(changes, month, 'upsell');
        const churnVal = changeValue(changes, month, 'churn');
        const downsellVal = changeValue(changes, month, 'downsell');
        repData[rep].won += Math.max(0, newVal) + Math.max(0, upsellVal);
        repData[rep].churn += churnVal < 0 ? Math.abs(churnVal) : 0;
        repData[rep].dn += downsellVal < 0 ? Math.abs(downsellVal) : 0;
        repData[rep].up += Math.max(0, upsellVal);
      });
    });

    const rows = Object.values(repData)
      .filter(row => Number(row.arr) > 0 || Number(row.won) > 0)
      .map(row => ({
        ...row,
        nrr: Number(row.prev) > 0 ? ((Number(row.prev) - Number(row.churn) - Number(row.dn) + Number(row.up)) / Number(row.prev)) * 100 : null,
      }));
    const sortedRows = [...rows].sort((a, b) => {
      const key = leaderSort.key;
      if (key === 'rep') {
        return leaderSort.asc ? a.rep.localeCompare(b.rep) : b.rep.localeCompare(a.rep);
      }
      const av = Number(a[key] ?? -Infinity);
      const bv = Number(b[key] ?? -Infinity);
      return leaderSort.asc ? av - bv : bv - av;
    });
    const totals = rows.reduce((acc, row) => ({
      arr: acc.arr + Number(row.arr || 0),
      won: acc.won + Number(row.won || 0),
      churn: acc.churn + Number(row.churn || 0),
    }), { arr: 0, won: 0, churn: 0 });
    return { rows: sortedRows, totals };
  }, [records, latestMonth, leaderSort]);

  const cohortRetention = useMemo(() => {
    const checkpoints = [0, 1, 3, 6, 12, 18, 24, 36];
    const labels = ['Start', 'M+1', 'M+3', 'M+6', 'M+12', 'M+18', 'M+24', 'M+36'];
    const cohorts = {};
    records.forEach(row => {
      const monthly = row.monthly_arr || {};
      const activeMonths = Object.keys(monthly).filter(month => Number(monthly[month] || 0) > 0).sort();
      if (!activeMonths.length) return;
      const year = activeMonths[0].slice(0, 4);
      if (!cohorts[year]) cohorts[year] = { months: {}, customers: 0 };
      cohorts[year].customers += 1;
      activeMonths.forEach(month => {
        cohorts[year].months[month] = (cohorts[year].months[month] || 0) + Number(monthly[month] || 0);
      });
    });

    const rows = Object.keys(cohorts).sort().map(year => {
      const monthKeys = Object.keys(cohorts[year].months).sort();
      const startValue = cohorts[year].months[monthKeys[0]] || 1;
      const values = checkpoints.map(cp => {
        if (cp >= monthKeys.length) return null;
        return Number(((cohorts[year].months[monthKeys[cp]] || 0) / startValue * 100).toFixed(1));
      });
      return { year, customers: cohorts[year].customers, values };
    });
    return { labels, rows };
  }, [records]);

  const repPeriodComparison = useMemo(() => {
    if (!latestMonth) {
      return { currFrom: '', currTo: '', prevFrom: '', prevTo: '', rows: [], totals: { curr: 0, prev: 0, delta: 0, pct: 0 }, maxCurr: 1 };
    }
    const year = latestMonth.slice(0, 4);
    const currFrom = `${year}-01`;
    const currTo = latestMonth;
    const prevFrom = addMonths(currFrom, -12);
    const prevTo = addMonths(currTo, -12);

    const calcRep = (from, to) => {
      const months = monthRange(from, to);
      const latest = months.at(-1) || latestMonth;
      const repData = {};
      records.forEach(row => {
        const rep = row.sales_person || row.sales_rep || 'Unknown';
        if (!repData[rep]) repData[rep] = { arr: 0, won: 0, churn: 0 };
        repData[rep].arr += rowMonthArr(row, latest);
        months.forEach(month => {
          const changes = row.monthly_changes || {};
          const newVal = changeValue(changes, month, 'new');
          const upsellVal = changeValue(changes, month, 'upsell');
          const churnVal = changeValue(changes, month, 'churn');
          const downVal = changeValue(changes, month, 'downsell');
          repData[rep].won += Math.max(0, newVal) + Math.max(0, upsellVal);
          repData[rep].churn += (churnVal < 0 ? Math.abs(churnVal) : 0) + (downVal < 0 ? Math.abs(downVal) : 0);
        });
      });
      return repData;
    };

    const currData = calcRep(currFrom, currTo);
    const prevData = calcRep(prevFrom, prevTo);
    const reps = [...new Set([...Object.keys(currData), ...Object.keys(prevData)])].filter(Boolean);
    const rows = reps.map(rep => {
      const curr = Number(currData[rep]?.arr || 0);
      const prev = Number(prevData[rep]?.arr || 0);
      const delta = curr - prev;
      const pct = prev > 0 ? (delta / prev) * 100 : (curr > 0 ? 100 : 0);
      return { rep, curr, prev, delta, pct };
    }).filter(row => row.curr > 0 || row.prev > 0).sort((a, b) => b.curr - a.curr);
    const totals = rows.reduce((acc, row) => ({
      curr: acc.curr + row.curr,
      prev: acc.prev + row.prev,
      delta: acc.delta + row.delta,
      pct: 0,
    }), { curr: 0, prev: 0, delta: 0, pct: 0 });
    totals.pct = totals.prev > 0 ? (totals.delta / totals.prev) * 100 : 0;
    return {
      currFrom,
      currTo,
      prevFrom,
      prevTo,
      rows,
      totals,
      maxCurr: Math.max(1, ...rows.map(row => Math.max(row.curr, row.prev))),
    };
  }, [records, latestMonth]);

  const customerHealthHeatmap = useMemo(() => {
    const monthTotals = {};
    records.forEach(row => {
      Object.entries(row.monthly_arr || {}).forEach(([month, value]) => {
        monthTotals[month] = (monthTotals[month] || 0) + Number(value || 0);
      });
    });
    const last18 = Object.keys(monthTotals)
      .filter(month => Number(monthTotals[month] || 0) > 0)
      .sort()
      .slice(-18);
    const latest = last18.at(-1) || latestMonth;
    const customers = {};
    records.forEach(row => {
      const customer = row.end_user || row.bill_to || 'Unspecified';
      if (!customers[customer]) customers[customer] = {};
      last18.forEach(month => {
        customers[customer][month] = (customers[customer][month] || 0) + rowMonthArr(row, month);
      });
    });
    const rows = Object.entries(customers)
      .filter(([, months]) => Number(months[latest] || 0) > 0)
      .sort((a, b) => Number(b[1][latest] || 0) - Number(a[1][latest] || 0))
      .slice(0, heatmapLimit)
      .map(([customer, months]) => ({
        customer,
        shortName: customer.length > 20 ? `${customer.slice(0, 19)}...` : customer,
        cells: last18.map((month, index) => {
          const value = Number(months[month] || 0);
          const prev = index > 0 ? Number(months[last18[index - 1]] || 0) : value;
          const status = value <= 0 ? 'zero'
            : prev <= 0 ? 'same'
            : value > prev * 1.01 ? 'up'
            : value < prev * 0.99 ? 'down'
            : 'same';
          return { month, value, status };
        }),
      }));
    return { months: last18, rows };
  }, [records, latestMonth, heatmapLimit]);

  const customerActionLists = useMemo(() => {
    const monthTotals = {};
    records.forEach(row => {
      Object.entries(row.monthly_arr || {}).forEach(([month, value]) => {
        monthTotals[month] = (monthTotals[month] || 0) + Number(value || 0);
      });
    });
    const allActiveMonths = Object.keys(monthTotals)
      .filter(month => Number(monthTotals[month] || 0) > 0)
      .sort();
    const last6 = allActiveMonths.slice(-6);
    const latest = last6.at(-1) || latestMonth;
    const year = latest ? latest.slice(0, 4) : '';
    const periodMonths = latest ? monthRange(`${year}-01`, latest) : [];

    const customerData = {};
    records.forEach(row => {
      const customer = row.end_user || row.bill_to || 'Unspecified';
      if (!customerData[customer]) customerData[customer] = { months: {}, rep: row.sales_person || row.sales_rep || '-' };
      if (!customerData[customer].rep || customerData[customer].rep === '-') customerData[customer].rep = row.sales_person || row.sales_rep || '-';
      last6.forEach(month => {
        customerData[customer].months[month] = (customerData[customer].months[month] || 0) + rowMonthArr(row, month);
      });
    });

    const atRisk = Object.entries(customerData).map(([customer, info]) => {
      const values = last6.map(month => Number(info.months[month] || 0));
      let consecutive = 0;
      for (let i = values.length - 1; i > 0; i -= 1) {
        if (values[i] < values[i - 1] && values[i] > 0) consecutive += 1;
        else break;
      }
      if (consecutive < 2) return null;
      const current = values.at(-1) || 0;
      const peak = values[values.length - 1 - consecutive] || 0;
      const decline = current - peak;
      const risk = decline < -peak * 0.3 ? 'high' : decline < -peak * 0.1 ? 'med' : 'low';
      return { customer, rep: info.rep, current, decline, consecutive, risk };
    }).filter(Boolean).sort((a, b) => a.decline - b.decline).slice(0, 15);

    const newLogoMap = {};
    records.forEach(row => {
      periodMonths.forEach(month => {
        const newVal = changeValue(row.monthly_changes || {}, month, 'new');
        if (newVal <= 0) return;
        const customer = row.end_user || row.bill_to || 'Unspecified';
        const product = row.sub_product_type || row.sub_product || row.product_type || row.product || '-';
        const key = `${customer}||${product}`;
        if (!newLogoMap[key]) {
          newLogoMap[key] = { customer, product, rep: row.sales_person || row.sales_rep || '-', arr: 0, since: month };
        }
        newLogoMap[key].arr += newVal;
        if (month < newLogoMap[key].since) newLogoMap[key].since = month;
      });
    });
    const newLogos = Object.values(newLogoMap).sort((a, b) => Number(b.arr) - Number(a.arr));

    const expansionMap = {};
    records.forEach(row => {
      const customer = row.end_user || row.bill_to || 'Unspecified';
      if (!expansionMap[customer]) {
        expansionMap[customer] = { customer, rep: row.sales_person || row.sales_rep || '-', first: '', last: '', arr: 0, hasUpsell: false };
      }
      const info = expansionMap[customer];
      if (!info.rep || info.rep === '-') info.rep = row.sales_person || row.sales_rep || '-';
      const activeMonths = Object.entries(row.monthly_arr || {})
        .filter(([, value]) => Number(value || 0) > 0)
        .map(([month]) => month)
        .sort();
      if (activeMonths.length) {
        if (!info.first || activeMonths[0] < info.first) info.first = activeMonths[0];
        if (!info.last || activeMonths.at(-1) > info.last) info.last = activeMonths.at(-1);
      }
      info.arr += rowMonthArr(row, latest);
      Object.values(row.monthly_changes || {}).forEach(change => {
        if (Number(change?.Upsell || change?.upsell || 0) > 0) info.hasUpsell = true;
      });
    });
    const latestIndex = allActiveMonths.indexOf(latest);
    const expansion = Object.values(expansionMap).filter(info => {
      if (!info.first || Number(info.arr) <= 0 || info.hasUpsell) return false;
      const monthsActive = latestIndex - allActiveMonths.indexOf(info.first);
      return monthsActive >= 12;
    }).map(info => ({
      ...info,
      months: latestIndex - allActiveMonths.indexOf(info.first),
    })).sort((a, b) => Number(b.arr) - Number(a.arr)).slice(0, 15);

    return { atRisk, newLogos, expansion };
  }, [records, latestMonth]);

  const updateLeaderSort = (key) => {
    setLeaderSort(current => ({ key, asc: current.key === key ? !current.asc : false }));
  };

  const repBuMap = useMemo(() => {
    const map = {};
    records.forEach(r => { if (r.sales_person && r.business_unit) map[r.sales_person] = r.business_unit; });
    return map;
  }, [records]);

  const buGroups = useMemo(() => {
    const groups = {};
    leaderboard.forEach(r => {
      const bu = repBuMap[r.rep] || 'Other';
      if (!groups[bu]) groups[bu] = { arr: 0, new_arr: 0, churn: 0, upsell: 0, customers: 0 };
      groups[bu].arr += Number(r.arr || 0);
      groups[bu].new_arr += Number(r.new_arr || 0);
      groups[bu].churn += Number(r.churn || 0);
      groups[bu].upsell += Number(r.upsell || 0);
      groups[bu].customers += Number(r.customers || 0);
    });
    return groups;
  }, [leaderboard, repBuMap]);

  const filteredCustomers = useMemo(() => {
    const sorted = [...c360].sort((a, b) => Number(b.arr) - Number(a.arr));
    if (buFilter === 'All') return sorted;
    return sorted.filter(c => c.bu === buFilter);
  }, [c360, buFilter]);

  const openModal = (type) => {
    if (type === 'acv') {
      setModal({
        title: 'Average Contract Value (ACV)',
        sub: `Total ARR / ${activeSummary.activeCustomers} active customers | as of ${activeSummary.latestMonth}`,
        bigValue: fmtFull(acv),
        bigColor: '#7c3aed',
        stats: [
          { l: 'Total ARR', v: fmtFull(activeSummary.totalARR), color: '#7c3aed' },
          { l: 'Active Customers', v: `${activeSummary.activeCustomers} accounts`, color: '#718096' },
          { l: 'ACV = ARR / Customers', v: fmtFull(acv), color: '#0891b2' },
          { l: 'ARR per Rep', v: shortMoney(arrPerRep), color: '#059669' },
        ],
        insight: 'ACV measures the average annualised value per customer. Higher ACV indicates enterprise-grade deal sizes.',
        bench: 'Enterprise SaaS target: $100K+ ACV per account',
      });
    } else if (type === 'logos') {
      setModal({
        title: 'Active Logo Count',
        sub: `Unique customers with ARR > $0 as of ${activeSummary.latestMonth}`,
        bigValue: String(activeSummary.activeCustomers || '-'),
        bigColor: '#0891b2',
        stats: [
          { l: 'Active Customers', v: `${activeSummary.activeCustomers} accounts`, color: '#0891b2' },
          { l: 'Total ARR', v: fmtFull(activeSummary.totalARR), color: '#7c3aed' },
          { l: 'ARR per Logo', v: fmtFull(acv), color: '#059669' },
          { l: 'Business Units', v: `${bus.length} BUs`, color: '#d97706' },
        ],
        insight: 'Logo count measures breadth of the customer base. Diversification reduces concentration risk.',
        bench: 'No single customer should exceed 20% of total ARR',
      });
    } else if (type === 'rep') {
      setModal({
        title: 'ARR per Sales Rep',
        sub: `${activeSummary.activeReps} active reps | ${activeSummary.latestMonth}`,
        bigValue: shortMoney(arrPerRep),
        bigColor: '#059669',
        stats: [
          { l: 'Total ARR', v: fmtFull(activeSummary.totalARR), color: '#7c3aed' },
          { l: 'Active Reps', v: `${activeSummary.activeReps} reps`, color: '#718096' },
          { l: 'Customers / Rep', v: activeSummary.activeReps > 0 ? (activeSummary.activeCustomers / activeSummary.activeReps).toFixed(1) : '-', color: '#0891b2' },
          { l: 'Top BU', v: bus[0]?.label || 'â€”', color: '#d97706' },
        ],
        insight: 'ARR per rep measures sales efficiency and coverage productivity.',
        bench: 'Best-in-class enterprise SaaS: $1M+ ARR per rep',
      });
    }
  };

  const buList = ['All', ...bus.map(b => b.label)];

  return (
    <>
      <ArrModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.title}
        sub={modal?.sub}
        bigValue={modal?.bigValue}
        bigColor={modal?.bigColor}
        stats={modal?.stats || []}
        insight={modal?.insight}
        bench={modal?.bench}
      />

      {/* â”€â”€â”€ 3 Header KPI Cards â”€â”€â”€ */}
      <div className="arr-t2-kpis">
        <DevOverlay name="BU ACV KPI">
          <div className="arr-t2kcard" onClick={() => openModal('acv')}>
            <div className="arr-t2kcard-label">Average Contract Value (ACV)</div>
            <div className="arr-t2kcard-val">{shortMoney(acv)}</div>
            <div className="arr-t2kcard-sub">{activeSummary.activeCustomers} active customers | as of {activeSummary.latestMonth}</div>
          </div>
        </DevOverlay>
        <DevOverlay name="BU Logo Count KPI">
          <div className="arr-t2kcard arr-t2kcard-cyan" onClick={() => openModal('logos')}>
            <div className="arr-t2kcard-label">Active Logo Count</div>
            <div className="arr-t2kcard-val">{activeSummary.activeCustomers || '-'}</div>
            <div className="arr-t2kcard-sub">{activeSummary.logoDelta >= 0 ? '\u25B2 +' : '\u25BC '}{Math.abs(activeSummary.logoDelta)} vs prior month</div>
          </div>
        </DevOverlay>
        <DevOverlay name="BU ARR per Rep KPI">
          <div className="arr-t2kcard arr-t2kcard-green" onClick={() => openModal('rep')}>
            <div className="arr-t2kcard-label">ARR per Sales Rep</div>
            <div className="arr-t2kcard-val">{shortMoney(arrPerRep)}</div>
            <div className="arr-t2kcard-sub">{activeSummary.activeReps} active reps | {activeSummary.latestMonth}</div>
          </div>
        </DevOverlay>
      </div>

      <DevOverlay name="ARR Concentration Risk">
        <div className="arr-chart-card arr-concentration-card">
          <div className="arr-chart-title">ARR Concentration Risk</div>
          <div className="arr-chart-sub">What % of ARR comes from top 1, 3, 5, 10 customers</div>
          <div className="arr-concentration-chart">
            <div className="arr-concentration-yaxis">
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map(tick => (
                <span key={tick}>{tick}%</span>
              ))}
            </div>
            <div className="arr-concentration-plot">
              {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0].map(tick => (
                <div className="arr-concentration-gridline" style={{ bottom: `${tick}%` }} key={tick} />
              ))}
              <div className="arr-concentration-bars">
                {activeSummary.concentration.map((tier, index) => (
                  <div className="arr-concentration-bar-col" key={tier.label}>
                    <div className="arr-concentration-bar-wrap">
                      <div
                        className="arr-concentration-bar"
                        style={{
                          height: `${Math.min(100, Math.max(0, tier.percent))}%`,
                          background: ['#c73f3f', '#f26f34', '#df922f', '#3d79b8', '#3f9860'][index],
                          borderColor: ['#b91c1c', '#ea580c', '#d97706', '#1e5fa8', '#15803d'][index],
                        }}
                        title={`${tier.label}: ${tier.percent}% | ${fmtFull(tier.value)}`}
                      />
                    </div>
                    <div className="arr-concentration-xlabel">{tier.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DevOverlay>

      <DevOverlay name="Annual ARR Waterfall">
        <div className="arr-chart-card arr-annual-waterfall-card">
          <div className="arr-chart-title">Annual ARR Waterfall</div>
          <div className="arr-chart-sub">Year-start → New → Upsell → Renewals → Churn → Downsell → Year-end</div>
          <div className="arr-annual-waterfall-chart">
            <div className="arr-annual-yaxis">
              {annualWaterfall.ticks.map(tick => (
                <span key={tick}>{axisMoney(tick)}</span>
              ))}
            </div>
            <div className="arr-annual-plot">
              {annualWaterfall.ticks.map(tick => {
                const y = ((Number(tick) - annualWaterfall.min) / (annualWaterfall.max - annualWaterfall.min || 1)) * 100;
                return <div className="arr-annual-gridline" style={{ bottom: `${y}%` }} key={tick} />;
              })}
              <div
                className="arr-annual-zero-line"
                style={{ bottom: `${((0 - annualWaterfall.min) / (annualWaterfall.max - annualWaterfall.min || 1)) * 100}%` }}
              />
              <div className="arr-annual-bars">
                {annualWaterfall.rows.map(row => {
                  const range = annualWaterfall.max - annualWaterfall.min || 1;
                  const zeroPct = ((0 - annualWaterfall.min) / range) * 100;
                  const valuePct = ((Number(row.value || 0) - annualWaterfall.min) / range) * 100;
                  const isNegative = Number(row.value || 0) < 0;
                  return (
                    <div className="arr-annual-bar-col" key={row.label}>
                      <div className="arr-annual-bar-area">
                        <div
                          className={`arr-annual-bar${isNegative ? ' negative' : ''}`}
                          style={{
                            bottom: `${Math.min(zeroPct, valuePct)}%`,
                            height: `${Math.max(0.6, Math.abs(valuePct - zeroPct))}%`,
                            background: row.color,
                            borderColor: row.border,
                          }}
                          title={`${row.label}: ${axisMoney(row.value)}`}
                        />
                      </div>
                      <div className="arr-annual-xlabel">{row.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DevOverlay>

      <DevOverlay name="Sales Rep Leaderboard">
        <div className="arr-chart-card arr-rep-leaderboard-card">
          <div className="arr-chart-title">Sales Rep Leaderboard</div>
          <div className="arr-chart-sub">Closing ARR · New Won · Churn attributed · NRR per rep</div>
          <div className="arr-rep-leaderboard-wrap">
            <table className="arr-rep-leaderboard-table">
              <thead>
                <tr>
                  <th onClick={() => updateLeaderSort('rep')}>Sales Rep</th>
                  <th onClick={() => updateLeaderSort('arr')}>Closing ARR ↕</th>
                  <th onClick={() => updateLeaderSort('won')}>New Won ↕</th>
                  <th onClick={() => updateLeaderSort('churn')}>Churn ↕</th>
                  <th>NRR%</th>
                </tr>
              </thead>
              <tbody>
                {repLeaderboardRows.rows.map(row => {
                  const nrrColor = row.nrr == null || row.nrr < 100 ? '#b91c1c' : '#15803d';
                  return (
                    <tr key={row.rep}>
                      <td className="arr-rep-name">{row.rep}</td>
                      <td className="arr-rep-money arr-rep-arr">{fmtFull(row.arr)}</td>
                      <td className="arr-rep-money arr-rep-won">{row.won ? fmtFull(row.won) : '—'}</td>
                      <td className="arr-rep-money arr-rep-churn">{row.churn ? fmtFull(row.churn) : '—'}</td>
                      <td className="arr-rep-nrr" style={{ color: nrrColor }}>{row.nrr == null ? '—' : `${row.nrr.toFixed(1)}%`}</td>
                    </tr>
                  );
                })}
                {!repLeaderboardRows.rows.length && (
                  <tr><td colSpan={5} className="bm-empty-row">No sales rep data available.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total ({repLeaderboardRows.rows.length} reps)</td>
                  <td>{fmtFull(repLeaderboardRows.totals.arr)}</td>
                  <td className="arr-rep-won">{fmtFull(repLeaderboardRows.totals.won)}</td>
                  <td className="arr-rep-churn">{fmtFull(repLeaderboardRows.totals.churn)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </DevOverlay>

      <DevOverlay name="Cohort Retention Table">
        <div className="arr-chart-card arr-cohort-card">
          <div className="arr-chart-title">Cohort Retention Table (by Start Year)</div>
          <div className="arr-chart-sub">% of starting ARR retained at each milestone — ≥90% 70-90% &lt;70%</div>
          <div className="arr-cohort-wrap">
            <table className="arr-cohort-table">
              <thead>
                <tr>
                  <th className="arr-cohort-year-th">Cohort</th>
                  <th>Customers</th>
                  {cohortRetention.labels.map(label => <th key={label}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohortRetention.rows.map(row => (
                  <tr key={row.year}>
                    <td className="arr-cohort-year">{row.year}</td>
                    <td className="arr-cohort-customers">{row.customers}</td>
                    {row.values.map((value, index) => {
                      const band = value == null ? 'empty' : value >= 90 ? 'good' : value >= 70 ? 'mid' : 'bad';
                      return (
                        <td className={`arr-cohort-cell ${band}`} key={`${row.year}-${index}`}>
                          {value == null ? '—' : `${value}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!cohortRetention.rows.length && (
                  <tr><td colSpan={10} className="bm-empty-row">No cohort data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>

      <DevOverlay name="Sales Rep Period Comparison">
        <div className="arr-chart-card arr-rep-period-card">
          <div className="arr-rep-period-head">
            <div>
              <div className="arr-chart-title">Sales Rep — Period vs Prior Period Comparison</div>
              <div className="arr-chart-sub">Closing ARR | {repPeriodComparison.currFrom} to {repPeriodComparison.currTo} vs {repPeriodComparison.prevFrom} to {repPeriodComparison.prevTo}</div>
            </div>
            <div className="arr-rep-period-controls">
              <span>YTD</span>
              <span>Closing ARR</span>
              <span>Same Period Last Year</span>
            </div>
          </div>
          <div className="arr-rep-period-wrap">
            <table className="arr-rep-period-table">
              <thead>
                <tr>
                  <th>Sales Rep</th>
                  <th>Current Period</th>
                  <th>Same Period Last Year</th>
                  <th>Change ($)</th>
                  <th>Growth %</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {repPeriodComparison.rows.map(row => {
                  const pctColor = row.pct >= 10 ? '#15803d' : row.pct >= 0 ? '#d97706' : '#b91c1c';
                  const pctBg = row.pct >= 10 ? '#dcfce7' : row.pct >= 0 ? '#fef9c3' : '#fee2e2';
                  const deltaColor = row.delta >= 0 ? '#15803d' : '#b91c1c';
                  const nowWidth = repPeriodComparison.maxCurr > 0 ? Math.round((row.curr / repPeriodComparison.maxCurr) * 100) : 0;
                  const prevWidth = repPeriodComparison.maxCurr > 0 ? Math.round((row.prev / repPeriodComparison.maxCurr) * 100) : 0;
                  return (
                    <tr key={row.rep}>
                      <td className="arr-rep-period-name">{row.rep}</td>
                      <td className="arr-rep-period-money current">{fmtFull(row.curr)}</td>
                      <td className="arr-rep-period-money previous">{fmtFull(row.prev)}</td>
                      <td className="arr-rep-period-money" style={{ color: deltaColor }}>{row.delta >= 0 ? '+' : ''}{fmtFull(row.delta)}</td>
                      <td className="arr-rep-period-growth"><span style={{ background: pctBg, color: pctColor }}>{row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%</span></td>
                      <td>
                        <div className="arr-rep-period-bars">
                          <div className="arr-rep-period-bar-row">
                            <span>Now</span>
                            <i><b style={{ width: `${nowWidth}%`, background: '#1e5fa8' }} /></i>
                          </div>
                          <div className="arr-rep-period-bar-row">
                            <span>Prev</span>
                            <i><b style={{ width: `${prevWidth}%`, background: '#94a3b8' }} /></i>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!repPeriodComparison.rows.length && (
                  <tr><td colSpan={6} className="bm-empty-row">No sales rep comparison data available.</td></tr>
                )}
                {!!repPeriodComparison.rows.length && (
                  <tr className="arr-rep-period-total">
                    <td>Total ({repPeriodComparison.rows.length} reps)</td>
                    <td>{fmtFull(repPeriodComparison.totals.curr)}</td>
                    <td>{fmtFull(repPeriodComparison.totals.prev)}</td>
                    <td style={{ color: repPeriodComparison.totals.delta >= 0 ? '#15803d' : '#b91c1c' }}>{repPeriodComparison.totals.delta >= 0 ? '+' : ''}{fmtFull(repPeriodComparison.totals.delta)}</td>
                    <td><span className={repPeriodComparison.totals.pct >= 0 ? 'pos' : 'neg'}>{repPeriodComparison.totals.pct >= 0 ? '+' : ''}{repPeriodComparison.totals.pct.toFixed(1)}%</span></td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>

      <DevOverlay name="Customer ARR Health Heatmap">
        <div className="arr-chart-card arr-health-heatmap-card">
          <div className="arr-health-heatmap-head">
            <div>
              <div className="arr-chart-title">Customer ARR Health Heatmap</div>
              <div className="arr-chart-sub">Monthly ARR per customer — 🟢 growing · 🔴 declining · ⬜ no ARR</div>
            </div>
            <label className="arr-health-limit">
              Show
              <select value={heatmapLimit} onChange={event => setHeatmapLimit(Number(event.target.value))}>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={25}>Top 25</option>
                <option value={50}>Top 50</option>
              </select>
            </label>
          </div>
          <div className="arr-health-heatmap-wrap">
            <table className="arr-health-heatmap-table">
              <thead>
                <tr>
                  <th className="arr-health-customer-th">Customer</th>
                  {customerHealthHeatmap.months.map(month => <th key={month}>{month.slice(2)}</th>)}
                </tr>
              </thead>
              <tbody>
                {customerHealthHeatmap.rows.map(row => (
                  <tr key={row.customer}>
                    <td className="arr-health-customer" title={row.customer}>{row.shortName}</td>
                    {row.cells.map(cell => (
                      <td className={`arr-health-cell ${cell.status}`} key={`${row.customer}-${cell.month}`}>
                        {cell.value > 0 ? shortMoney(cell.value) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
                {!customerHealthHeatmap.rows.length && (
                  <tr><td colSpan={customerHealthHeatmap.months.length + 1} className="bm-empty-row">No customer health data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>

      <div className="arr-action-grid">
        <DevOverlay name="At-Risk Customers">
          <div className="arr-chart-card arr-action-card">
            <div className="arr-action-title">⚠️ At-Risk Customers</div>
            <div className="arr-action-sub">Declining ARR for 2+ consecutive months</div>
            <div className="arr-action-table-wrap">
              <table className="arr-action-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Rep</th>
                    <th>Current ARR</th>
                    <th>Decline</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {customerActionLists.atRisk.map(row => {
                    const badgeClass = row.risk === 'high' ? 'high' : row.risk === 'med' ? 'med' : 'low';
                    const badgeText = row.risk === 'high' ? 'High Risk' : row.risk === 'med' ? 'Watch' : 'Monitor';
                    return (
                      <tr key={row.customer}>
                        <td className="arr-action-name">{row.customer}</td>
                        <td>{row.rep || '-'}</td>
                        <td className="arr-action-money">{fmtFull(row.current)}</td>
                        <td className="arr-action-money danger">{fmtFull(row.decline)}</td>
                        <td><span className={`arr-risk-badge ${badgeClass}`}>{badgeText}</span></td>
                      </tr>
                    );
                  })}
                  {!customerActionLists.atRisk.length && (
                    <tr><td colSpan={5} className="arr-action-empty success">No at-risk customers detected</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DevOverlay>

        <DevOverlay name="New Logos This Period">
          <div className="arr-chart-card arr-action-card">
            <div className="arr-action-title">🆕 New Logos This Period</div>
            <div className="arr-action-sub">Customers with positive New ARR in the period</div>
            <div className="arr-action-table-wrap">
              <table className="arr-action-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Rep</th>
                    <th>New ARR</th>
                    <th>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customerActionLists.newLogos.map(row => (
                    <tr key={`${row.customer}-${row.product}`}>
                      <td className="arr-action-name">{row.customer}</td>
                      <td>{row.product}</td>
                      <td>{row.rep || '-'}</td>
                      <td className="arr-action-money success">+{fmtFull(row.arr)}</td>
                      <td className="arr-action-date">{row.since}</td>
                    </tr>
                  ))}
                  {!customerActionLists.newLogos.length && (
                    <tr><td colSpan={5} className="arr-action-empty">No new logos in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DevOverlay>
      </div>

      <DevOverlay name="Expansion Candidates">
        <div className="arr-chart-card arr-action-card arr-expansion-card">
          <div className="arr-action-title">🎯 Expansion Candidates</div>
          <div className="arr-action-sub">Active 12+ months · no recorded upsell · still has ARR</div>
          <div className="arr-action-table-wrap">
            <table className="arr-action-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Rep</th>
                  <th>Current ARR</th>
                  <th>Since</th>
                  <th>Tenure</th>
                </tr>
              </thead>
              <tbody>
                {customerActionLists.expansion.map(row => (
                  <tr key={row.customer}>
                    <td className="arr-action-name">{row.customer}</td>
                    <td>{row.rep || '-'}</td>
                    <td className="arr-action-money primary">{fmtFull(row.arr)}</td>
                    <td className="arr-action-date">{row.first}</td>
                    <td className={`arr-action-tenure ${row.months >= 24 ? 'strong' : ''}`}>{row.months}m</td>
                  </tr>
                ))}
                {!customerActionLists.expansion.length && (
                  <tr><td colSpan={5} className="arr-action-empty">No upsell opportunities found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>
      <div className="arr-2col">
        <DevOverlay name="BU Breakdown Chart">
          <div className="arr-chart-card">
            <div className="arr-eyebrow">ARR Mix</div>
            <div className="arr-chart-title" style={{ marginBottom: 14 }}>Business Unit Breakdown</div>
            <BarChart items={bus} />
          </div>
        </DevOverlay>
        <DevOverlay name="Industry Breakdown Chart">
          <div className="arr-chart-card">
            <div className="arr-eyebrow">ARR Mix</div>
            <div className="arr-chart-title" style={{ marginBottom: 14 }}>Industry Breakdown</div>
            <BarChart items={data.breakdowns?.industries || []} />
          </div>
        </DevOverlay>
      </div>

      {/* â”€â”€â”€ BU Head-to-Head Comparison â”€â”€â”€ */}
      <SectionHeader title="BU Head-to-Head Comparison" tag="Click any card for detailed breakdown" />
      <div className="arr-bu-h2h">
        {bus.map((bu, i) => {
          const color = colors[i % colors.length];
          const bg = buGroups[bu.label] || {};
          const nrr = bg.arr > 0 ? ((bg.arr - bg.churn + bg.upsell) / Math.max(bg.arr, 1) * 100) : 0;
          const pct = total > 0 ? ((Number(bu.value) / total) * 100).toFixed(1) : '0';
          return (
            <DevOverlay key={bu.label} name={`BU H2H: ${bu.label}`}>
              <div
                className="arr-bu-h2h-card"
                style={{ borderTop: `3px solid ${color}`, cursor: 'pointer' }}
                onClick={() => setModal({
                  title: `${bu.label} â€” Business Unit Detail`,
                  bigValue: fmt(bu.value),
                  bigColor: color,
                  stats: [
                    { l: 'Closing ARR', v: fmt(bu.value), color },
                    { l: 'New Won', v: fmt(bg.new_arr), color: '#059669' },
                    { l: 'Churn', v: fmt(bg.churn), color: '#dc2626' },
                    { l: 'NRR %', v: `${nrr.toFixed(1)}%`, color: nrr >= 100 ? '#059669' : '#d97706' },
                    { l: 'Active Logos', v: String(bg.customers || 0), color: '#0891b2' },
                    { l: 'ARR Share', v: `${pct}%`, color: '#718096' },
                  ],
                  insight: `${bu.label} represents ${pct}% of total ARR with ${bg.customers || 0} active logos.`,
                  bench: `NRR target >110%. Current: ${nrr.toFixed(1)}%`,
                })}
              >
                <div className="arr-bu-h2h-name" style={{ color }}>{bu.label}</div>
                <div className="arr-bu-h2h-arr">{fmt(bu.value)}</div>
                <div className="arr-bu-h2h-rows">
                  <div className="arr-bu-h2h-row"><span>New Won</span><strong style={{ color: '#059669' }}>{fmt(bg.new_arr)}</strong></div>
                  <div className="arr-bu-h2h-row"><span>Churn</span><strong style={{ color: '#dc2626' }}>{fmt(bg.churn)}</strong></div>
                  <div className="arr-bu-h2h-row"><span>NRR%</span><strong style={{ color: nrr >= 100 ? '#059669' : '#d97706' }}>{nrr.toFixed(1)}%</strong></div>
                  <div className="arr-bu-h2h-row"><span>Active Logos</span><strong>{bg.customers || 0}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>Click for detail â†’</div>
              </div>
            </DevOverlay>
          );
        })}
        {!bus.length && <div style={{ padding: 24, color: '#94a3b8', gridColumn: '1/-1' }}>No BU data available.</div>}
      </div>

      {/* â”€â”€â”€ Top Customers by BU â”€â”€â”€ */}
      <SectionHeader title="Top Customers by BU" tag="Filterable by business unit" />
      <div className="arr-bu-filter-bar">
        {buList.map(b => (
          <button
            key={b}
            className={`arr-region-btn${buFilter === b ? ' active' : ''}`}
            onClick={() => setBuFilter(b)}
          >
            {b}
          </button>
        ))}
      </div>
      <DevOverlay name="Top Customers Table">
        <div className="arr-tcard">
          <div className="arr-twrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>BU</th>
                  <th>Sales Rep</th>
                  <th style={{ textAlign: 'right' }}>Closing ARR</th>
                  <th style={{ textAlign: 'right' }}>YTD Change</th>
                  <th style={{ minWidth: 140 }}>ARR %</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.slice(0, 25).map(c => {
                  const pct = total > 0 ? ((Number(c.arr) / total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={c.customer}>
                      <td><strong>{c.customer}</strong></td>
                      <td><span className="arr-tag">{c.bu || 'â€”'}</span></td>
                      <td style={{ fontSize: 12 }}>{c.sales_rep || 'â€”'}</td>
                      <td className="arr-td-money">{fmtFull(c.arr)}</td>
                      <td className={`arr-td-money ${Number(c.ltm_change) >= 0 ? 'arr-up' : 'arr-dn'}`}>
                        {Number(c.ltm_change) >= 0 ? '+' : ''}{fmt(c.ltm_change)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#7c3aed', borderRadius: 3 }} />
                          </div>
                          <span style={{ minWidth: 38, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredCustomers.length && (
                  <tr><td colSpan={6} className="bm-empty-row">No customer data for this BU.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>

      {/* â”€â”€â”€ Sub-Product ARR â”€â”€â”€ */}
      <SectionHeader title="Sub-Product ARR Detail" />
      <DevOverlay name="Sub-Product Table">
        <div className="arr-tcard">
          <div className="arr-tcard-hdr">
            <span className="arr-tcard-title">Sub-Product Breakdown</span>
          </div>
          <div className="arr-twrap">
            <table>
              <thead>
                <tr>
                  <th>Sub-Product</th>
                  <th style={{ textAlign: 'right' }}>Current ARR</th>
                  <th style={{ textAlign: 'right' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const share = totalProd > 0 ? ((Number(p.value) / totalProd) * 100).toFixed(1) : '0';
                  return (
                    <tr key={p.label}>
                      <td><strong>{p.label}</strong></td>
                      <td className="arr-td-money">{fmtFull(p.value)}</td>
                      <td className="arr-td-right">{share}%</td>
                    </tr>
                  );
                })}
                {!products.length && <tr><td colSpan={3} className="bm-empty-row">No product data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </DevOverlay>
    </>
  );
}

export default BuAnalyticsTab;
export { BuAnalyticsTab };

