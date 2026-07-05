import { Fragment, useMemo, useState } from 'react';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';

const AOP_TARGET_2026 = 17330000;
const EMPTY_ARRAY = [];

const QUOTA_2026 = {
  'Cody Dussault': { quota: 1750000, region: 'NAM', type: 'AE', displayName: 'Cody Dussault' },
  'Dan Ryan': { quota: 1750000, region: 'NAM', type: 'AE', displayName: 'Dan Ryan' },
  'Fadi Jarrar': { quota: 5000000, region: 'NAM', type: 'AE', displayName: 'Fadi Jarrar' },
  'Frank Mendicino': { quota: 2500000, region: 'NAM', type: 'AE', displayName: 'Frank Mendicino' },
  'Will Easton': { quota: 1750000, region: 'NAM', type: 'AE', displayName: 'William Easton' },
  'Patrick Phillips': { quota: 1644520, region: 'NAM', type: 'AE', displayName: 'Patrick Phillips' },
  'Robert Sokolowski': { quota: 2000000, region: 'NAM', type: 'AE', displayName: 'Robert Sokolowski' },
  'Rohit Kumar': { quota: 500000, region: 'APAC', type: 'AE', displayName: 'Rohit Kumar' },
  'Dev Singh': { quota: 1200000, region: 'APAC', type: 'AE', displayName: 'Dev Singh' },
  'Hitesh Joshi': { quota: 694000, region: 'APAC', type: 'Partner', displayName: 'Hitesh Joshi' },
  'Dan Dabrowski': { quota: 2000000, region: 'NAM', type: 'Partner', displayName: 'Dan Dabrowski' },
};

const DAN_DABROWSKI_CODEALS = [
  { customer: '3M Company', product: 'Verify', amount: 190000, month: '2026-04', type: 'New', btype: 'Commercial (Partner Co-Credit)' },
  { customer: 'M&S', product: 'Verify', amount: 204400, month: '2026-05', type: 'New', btype: 'Commercial (Partner Co-Credit)' },
];

function fM(value) {
  return `$${(Math.abs(Number(value || 0)) / 1000000).toFixed(2)}M`;
}

function fK(value) {
  return `$${(Math.abs(Number(value || 0)) / 1000).toFixed(0)}K`;
}

function fFull(value) {
  return `$${Math.abs(Math.round(Number(value || 0))).toLocaleString('en-US')}`;
}

function getCustomer(row) {
  return row.customer || row.end_user || row.bill_to || row.contract_name || '-';
}

function getProduct(row) {
  return row.sub_product || row.sub_product_type || row.product || row.product_type || '-';
}

function changeBucket(row, month) {
  return row?.monthly_changes?.[month] || row?.changes?.[month] || {};
}

function changeAmount(bucket, key) {
  const aliases = key === 'New'
    ? ['New', 'new']
    : ['Upsell', 'upsell', 'UpSell', 'up_sell'];
  return aliases.reduce((sum, alias) => sum + Number(bucket?.[alias] || 0), 0);
}

function colorForPct(pct) {
  if (pct >= 100) return '#15803d';
  if (pct >= 75) return '#16a34a';
  if (pct >= 50) return '#d97706';
  if (pct >= 25) return '#f97316';
  return '#dc2626';
}

function emojiForPct(pct) {
  if (pct >= 100) return '🏆';
  if (pct >= 75) return '🟢';
  if (pct >= 50) return '🟡';
  if (pct >= 25) return '🟠';
  return '🔴';
}

function statusForPct(pct) {
  if (pct >= 100) return 'On Track';
  if (pct >= 75) return 'Good';
  if (pct >= 50) return 'Needs Attention';
  return 'At Risk';
}

function Barometer({ pct, size = 160 }) {
  const h = Math.round(size * 0.57);
  const cx = size / 2;
  const cy = h - 4;
  const rx = size * 0.44;
  const capped = Math.min(Math.max(Number(pct || 0), 0), 100);
  const needlePct = Math.min(Math.max(Number(pct || 0), 0), 150);
  const endAngle = -Math.PI + (capped / 100) * Math.PI;
  const ex = cx + rx * Math.cos(endAngle);
  const ey = cy + rx * Math.sin(endAngle);
  const largeArc = capped > 50 ? 1 : 0;
  const needleAngle = (needlePct / 150) * 180 - 90;
  const nx = cx + rx * 0.82 * Math.cos((needleAngle - 90) * Math.PI / 180);
  const ny = cy + rx * 0.82 * Math.sin((needleAngle - 90) * Math.PI / 180);
  const color = colorForPct(pct);

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      <path d={`M ${cx - rx} ${cy} A ${rx} ${rx} 0 0 1 ${cx + rx} ${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${cx - rx} ${cy} A ${rx} ${rx} 0 ${largeArc} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#1a202c" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="#1a202c" />
      <text x={cx - rx + 2} y={cy + 12} fontSize="8" fill="#94a3b8">0%</text>
      <text x={cx} y="10" fontSize="8" fill="#94a3b8" textAnchor="middle">50%</text>
      <text x={cx + rx - 2} y={cy + 12} fontSize="8" fill="#94a3b8" textAnchor="end">100%</text>
    </svg>
  );
}

function MiniBarChart({ months, deals, color }) {
  const monthTotals = months.map(month => ({
    month,
    value: deals.filter(deal => deal.month === month).reduce((sum, deal) => sum + deal.amount, 0),
  }));
  const max = Math.max(...monthTotals.map(row => row.value), 1);

  return (
    <div className="arr-t7-mini-chart">
      {monthTotals.map(row => (
        <div className="arr-t7-mini-col" key={row.month}>
          <div className="arr-t7-mini-bar-wrap">
            <div
              className="arr-t7-mini-bar"
              style={{ height: `${Math.max(row.value ? 4 : 0, (row.value / max) * 100)}%`, background: color }}
              title={`${row.month}: ${fK(row.value)}`}
            />
          </div>
          <span>{row.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function QuotaModal({ detail, onClose }) {
  if (!detail) return null;
  const color = detail.color || colorForPct(detail.pct);
  return (
    <div className="arr-modal-ov" onClick={onClose}>
      <div className="arr-t7-html-modal" onClick={event => event.stopPropagation()}>
        <div className="arr-t7-html-head">
          <div>
            <div className="arr-t7-html-title">{detail.title}</div>
            <div className="arr-t7-html-sub">{detail.subtitle}</div>
          </div>
          <button className="arr-t7-html-close" onClick={onClose}>x</button>
        </div>
        <div className="arr-t7-html-kpis">
          {detail.kpis.map((kpi, index) => (
            <div className="arr-t7-html-kpi" key={kpi.label} style={{ borderRight: index < detail.kpis.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              <div>{kpi.label}</div>
              <strong style={{ color: kpi.color }}>{kpi.value}</strong>
            </div>
          ))}
        </div>
        <div className="arr-t7-html-body">
          <div className="arr-t7-html-baro">
            <div className="arr-t7-html-baro-label">Attainment</div>
            <Barometer pct={detail.pct} size={180} />
            <strong style={{ color }}>{detail.pct.toFixed(1)}%</strong>
            <span>{emojiForPct(detail.pct)} {statusForPct(detail.pct)}</span>
          </div>
          <div className="arr-t7-html-chart">
            <div className="arr-t7-html-section-title">Monthly Bookings</div>
            <MiniBarChart months={detail.months} deals={detail.deals} color={color} />
          </div>
        </div>
        <div className="arr-t7-modal-table-wrap">
          {detail.extra}
          <div className="arr-t7-html-section-title">Deal-Level Breakdown (YTD Bookings)</div>
          <table className="arr-t7-html-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Type</th>
                <th>Month</th>
                <th className="right">Amount</th>
                <th>Booking Type</th>
                <th>Rep</th>
              </tr>
            </thead>
            <tbody>
              {detail.deals.map((deal, index) => (
                <tr key={`${deal.rep}-${deal.customer}-${deal.month}-${index}`}>
                  <td><strong>{deal.customer}</strong></td>
                  <td>{deal.product}</td>
                  <td><span className={`arr-t7-pill ${deal.type === 'New' ? 'new' : 'upsell'}`}>{deal.type}</span></td>
                  <td>{deal.month}</td>
                  <td className="right money" style={{ color: deal.type === 'New' ? '#1e5fa8' : '#15803d' }}>{fFull(deal.amount)}</td>
                  <td><span className="arr-t7-muted-pill">{deal.btype || 'Commercial'}</span></td>
                  <td>{deal.rep}</td>
                </tr>
              ))}
              {!detail.deals.length && <tr><td colSpan={7} className="bm-empty-row">No FY26 bookings found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuotaTab({ data }) {
  const records = data.records || EMPTY_ARRAY;
  const [filter, setFilter] = useState('ALL');
  const [modal, setModal] = useState(null);

  const metrics = useMemo(() => {
    const discoveredMonths = new Set(data.all_months || []);
    records.forEach(row => {
      Object.keys(row.monthly_arr || {}).forEach(month => discoveredMonths.add(month));
      Object.keys(row.monthly_changes || row.changes || {}).forEach(month => discoveredMonths.add(month));
    });
    const latest = data.latest_month || data.kpis?.latest_month || [...discoveredMonths].filter(Boolean).sort().at(-1) || '2026-06';
    const fy26Months = [...discoveredMonths]
      .filter(month => month >= '2026-01' && month <= latest)
      .sort();

    if (!fy26Months.length) {
      ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].forEach(month => fy26Months.push(month));
    }

    const actuals = {};
    const repDeals = {};
    const allDeals = [];

    records.forEach(row => {
      const rep = row.sales_person || row.sales_rep || '';
      if (!rep) return;
      fy26Months.forEach(month => {
        const bucket = changeBucket(row, month);
        [
          { type: 'New', amount: changeAmount(bucket, 'New') },
          { type: 'Upsell', amount: changeAmount(bucket, 'Upsell') },
        ].forEach(item => {
          if (item.amount <= 0) return;
          actuals[rep] = (actuals[rep] || 0) + item.amount;
          const deal = {
            customer: getCustomer(row),
            product: getProduct(row),
            type: item.type,
            month,
            amount: item.amount,
            btype: row.booking_type || row.revenue_type || row.line_of_business || 'Commercial',
            rep,
          };
          (repDeals[rep] = repDeals[rep] || []).push(deal);
          allDeals.push(deal);
        });
      });
    });

    DAN_DABROWSKI_CODEALS.forEach(deal => {
      if (!fy26Months.includes(deal.month)) return;
      actuals['Dan Dabrowski'] = (actuals['Dan Dabrowski'] || 0) + deal.amount;
      const row = { ...deal, rep: 'Dan Dabrowski' };
      (repDeals['Dan Dabrowski'] = repDeals['Dan Dabrowski'] || []).push(row);
    });

    Object.values(repDeals).forEach(list => list.sort((a, b) => b.amount - a.amount));
    allDeals.sort((a, b) => b.amount - a.amount);

    const rows = Object.entries(QUOTA_2026).map(([key, quota]) => {
      const actual = actuals[key] || 0;
      const pct = quota.quota > 0 ? (actual / quota.quota) * 100 : 0;
      return {
        dataKey: key,
        rep: quota.displayName,
        quota: quota.quota,
        region: quota.region,
        type: quota.type,
        actual,
        pct,
        gap: quota.quota - actual,
        deals: repDeals[key] || [],
      };
    }).sort((a, b) => b.pct - a.pct);

    const aeRows = rows.filter(row => row.type === 'AE');
    const aeQuota = aeRows.reduce((sum, row) => sum + row.quota, 0);
    const aeActual = aeRows.reduce((sum, row) => sum + row.actual, 0);
    const aePct = aeQuota ? (aeActual / aeQuota) * 100 : 0;
    const totalAllBookings = allDeals.reduce((sum, deal) => sum + deal.amount, 0);
    const aopPct = AOP_TARGET_2026 ? (totalAllBookings / AOP_TARGET_2026) * 100 : 0;

    return {
      latest,
      months: fy26Months,
      rows,
      allDeals,
      totalAllBookings,
      aopPct,
      aopGap: AOP_TARGET_2026 - totalAllBookings,
      aeQuota,
      aeActual,
      aePct,
      aeGap: aeQuota - aeActual,
      namQuota: aeRows.filter(row => row.region === 'NAM').reduce((sum, row) => sum + row.quota, 0),
      apacQuota: aeRows.filter(row => row.region === 'APAC').reduce((sum, row) => sum + row.quota, 0),
      namBookings: aeRows.filter(row => row.region === 'NAM').reduce((sum, row) => sum + row.actual, 0),
      apacBookings: aeRows.filter(row => row.region === 'APAC').reduce((sum, row) => sum + row.actual, 0),
      onTrack: aeRows.filter(row => row.pct >= 50).length,
      aeCount: aeRows.length,
      actuals,
    };
  }, [data, records]);

  const filteredRows = metrics.rows.filter(row => {
    if (filter === 'ALL') return true;
    if (filter === 'AE') return row.type === 'AE';
    if (filter === 'Partner') return row.type === 'Partner';
    return row.region === filter;
  });

  const openAllModal = () => {
    setModal({
      title: 'Total Bookings - All Reps',
      subtitle: `FY26 YTD: ${metrics.months[0]} -> ${metrics.months.at(-1)}`,
      pct: metrics.aopPct,
      color: colorForPct(metrics.aopPct),
      months: metrics.months,
      deals: metrics.allDeals,
      kpis: [
        { label: 'FY26 AOP Target', value: fM(AOP_TARGET_2026), color: '#1e5fa8' },
        { label: 'Total Bookings (All Reps)', value: fM(metrics.totalAllBookings), color: '#6d28d9' },
        { label: 'AOP Attainment', value: `${metrics.aopPct.toFixed(1)}%`, color: colorForPct(metrics.aopPct) },
        { label: 'Gap to AOP', value: fM(Math.abs(metrics.aopGap)), color: metrics.aopGap > 0 ? '#dc2626' : '#15803d' },
      ],
    });
  };

  const openRepModal = (row) => {
    setModal({
      title: `${row.rep} - Booking Detail`,
      subtitle: `FY26 YTD: ${metrics.months[0]} -> ${metrics.months.at(-1)} · ${row.type}`,
      pct: row.pct,
      color: colorForPct(row.pct),
      months: metrics.months,
      deals: row.deals,
      kpis: [
        { label: row.type === 'Partner' ? 'Reference Quota' : '2026 Quota', value: fM(row.quota), color: '#1e5fa8' },
        { label: 'YTD Bookings', value: fM(row.actual), color: '#15803d' },
        { label: 'Attainment', value: `${row.pct.toFixed(1)}%`, color: colorForPct(row.pct) },
        { label: row.type === 'Partner' ? 'Reference Gap' : 'Gap to Quota', value: fM(Math.abs(row.gap)), color: row.gap > 0 ? '#dc2626' : '#15803d' },
      ],
    });
  };

  const openQuotaModal = () => {
    const regionRows = (
      <div className="arr-t7-region-modal">
        <div className="arr-t7-html-section-title">Region & Rep Breakdown</div>
        <QuotaTable rows={metrics.rows} onOpen={openRepModal} compact />
      </div>
    );
    setModal({
      title: 'Sales Quota Reps - Region Breakdown',
      subtitle: `FY26 YTD: ${metrics.months[0]} -> ${metrics.months.at(-1)} · AE Reps Only (Partners Excluded)`,
      pct: metrics.aePct,
      color: colorForPct(metrics.aePct),
      months: metrics.months,
      deals: metrics.allDeals.filter(deal => QUOTA_2026[deal.rep]?.type === 'AE'),
      extra: regionRows,
      kpis: [
        { label: 'Total AE Quota', value: fM(metrics.aeQuota), color: '#1e5fa8' },
        { label: 'FY26 YTD Bookings', value: fM(metrics.aeActual), color: '#15803d' },
        { label: 'Attainment', value: `${metrics.aePct.toFixed(1)}%`, color: colorForPct(metrics.aePct) },
        { label: 'Gap to Quota', value: fM(Math.abs(metrics.aeGap)), color: metrics.aeGap > 0 ? '#dc2626' : '#15803d' },
      ],
    });
  };

  const aopCards = [
    { label: 'FY26 AOP Target', value: fM(AOP_TARGET_2026), color: '#1e5fa8', sub: 'Official FY26 Annual Operating Plan' },
    { label: 'Total Bookings - All Reps', value: fM(metrics.totalAllBookings), color: '#6d28d9', sub: `Jens: ${fM(metrics.actuals['Jens Hinrichsen'])} · Sidd: ${fM(metrics.actuals['Siddharth Gandhi'])} · CS: ${fM(metrics.actuals['Client Services'])}` },
    { label: 'AOP Attainment', value: `${metrics.aopPct.toFixed(1)}%`, color: colorForPct(metrics.aopPct), sub: 'vs $17.33M AOP Target' },
    { label: 'Gap to AOP', value: fM(Math.abs(metrics.aopGap)), color: metrics.aopGap > 0 ? '#dc2626' : '#15803d', sub: metrics.aopGap > 0 ? 'Behind AOP Target' : 'Ahead of AOP Target' },
  ];

  const quotaCards = [
    { label: 'Total Sales Quota', value: fM(metrics.aeQuota), color: '#1e5fa8', sub: `NAM: ${fM(metrics.namQuota)} · APAC: ${fM(metrics.apacQuota)}` },
    { label: 'FY26 YTD Bookings', value: fM(metrics.aeActual), color: colorForPct(metrics.aePct), sub: `NAM: ${fM(metrics.namBookings)} · APAC: ${fM(metrics.apacBookings)} · ${metrics.onTrack}/${metrics.aeCount} reps >=50%` },
    { label: 'Attainment vs Quota', value: `${metrics.aePct.toFixed(1)}%`, color: colorForPct(metrics.aePct), sub: `vs ${fM(metrics.aeQuota)} total quota · ${metrics.aeCount} AE reps` },
    { label: 'Gap to Quota', value: fM(Math.abs(metrics.aeGap)), color: metrics.aeGap > 0 ? '#dc2626' : '#15803d', sub: metrics.aeGap > 0 ? `Behind quota · ${metrics.onTrack}/${metrics.aeCount} reps >=50%` : 'Ahead of quota' },
  ];

  return (
    <>
      <QuotaModal detail={modal} onClose={() => setModal(null)} />

      <div className="arr-t7-kpi-grid">
        {aopCards.map(card => (
          <button className="arr-t7-kcard" key={card.label} onClick={openAllModal} title="Click for details">
            <div>{card.label}</div>
            <strong style={{ color: card.color }}>{card.value}</strong>
            <span>{card.sub}</span>
            <small>Click for details</small>
          </button>
        ))}
      </div>

      <div className="arr-t7-kpi-grid arr-t7-kpi-grid-second">
        {quotaCards.map(card => (
          <button className="arr-t7-kcard" key={card.label} onClick={openQuotaModal} title="Click for details">
            <div>{card.label}</div>
            <strong style={{ color: card.color }}>{card.value}</strong>
            <span>{card.sub}</span>
            <small>Click for details</small>
          </button>
        ))}
      </div>

      <div className="arr-t7-filters">
        <span>Filter:</span>
        {[
          ['ALL', 'All'],
          ['NAM', 'North America'],
          ['APAC', 'APAC'],
          ['AE', 'AEs'],
          ['Partner', 'Partners'],
        ].map(([key, label]) => (
          <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      <div className="arr-t7-baro-grid">
        {filteredRows.map(row => {
          const color = colorForPct(row.pct);
          return (
            <DevOverlay key={row.dataKey} name={`Quota Card: ${row.rep}`}>
              <button className="arr-t7-baro-card" onClick={() => openRepModal(row)} title="Click for deal breakdown">
                <div className="arr-t7-baro-head">
                  <div>
                    <strong>{row.rep}</strong>
                    <span>{row.region} · {row.type}</span>
                  </div>
                  <em className={row.pct >= 50 ? 'warm' : ''}>{emojiForPct(row.pct)} {statusForPct(row.pct)}</em>
                </div>
                <div className="arr-t7-baro-center">
                  <Barometer pct={row.pct} />
                  <b style={{ color }}>{row.pct.toFixed(1)}%</b>
                </div>
                <div className="arr-t7-baro-stats">
                  <span>Actual: <strong>{fK(row.actual)}</strong></span>
                  <span>Quota: <strong>{fK(row.quota)}</strong></span>
                </div>
                <div className="arr-t7-track"><i style={{ width: `${Math.min(row.pct, 100).toFixed(1)}%`, background: color }} /></div>
                <div className="arr-t7-baro-foot">
                  <span>Click for deals</span>
                  <span>Gap: <strong style={{ color: row.gap > 0 ? '#dc2626' : '#15803d' }}>{fK(row.gap)}</strong></span>
                </div>
              </button>
            </DevOverlay>
          );
        })}
      </div>

      <div className="arr-t7-table-card">
        <QuotaTable rows={filteredRows} allRows={metrics.rows} onOpen={openRepModal} showTotal />
      </div>
    </>
  );
}

function QuotaTable({ rows, allRows, onOpen, showTotal = false, compact = false }) {
  const sections = [
    { key: 'NAM_AE', label: '🌎 North America (NAM)', aopTarget: 15400000, color: '#1e5fa8', bg: '#e8f1fb', filter: row => row.region === 'NAM' && row.type === 'AE' },
    { key: 'APAC_AE', label: '🌏 Asia Pacific (APAC)', aopTarget: 2000000, color: '#0891b2', bg: '#e0f7fa', filter: row => row.region === 'APAC' && row.type === 'AE' },
    { key: 'PARTNER', label: '🤝 Partners', color: '#7c3aed', bg: '#f3e8ff', filter: row => row.type === 'Partner' },
  ];
  const sourceRows = allRows || rows;
  const visibleKeys = new Set(rows.map(row => row.dataKey));
  let aeOnlyQuota = 0;
  let aeOnlyActual = 0;

  return (
    <div className="arr-twrap arr-t7-table-wrap">
      <table className="arr-t7-quota-table">
        <thead>
          <tr>
            <th>Rep / Region</th>
            <th>BU</th>
            <th>Type</th>
            <th className="right">2026 Quota</th>
            <th className="right">YTD Bookings</th>
            <th className="right">Attainment</th>
            <th className="right">Gap</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(section => {
            const sectionRows = sourceRows.filter(row => visibleKeys.has(row.dataKey)).filter(section.filter);
            if (!sectionRows.length) return null;
            const isPartner = section.key === 'PARTNER';
            const quota = sectionRows.reduce((sum, row) => sum + row.quota, 0);
            const actual = sectionRows.reduce((sum, row) => sum + row.actual, 0);
            const pct = quota ? (actual / quota) * 100 : 0;
            const gap = quota - actual;
            const color = isPartner ? '#7c3aed' : colorForPct(pct);
            if (!isPartner) {
              aeOnlyQuota += quota;
              aeOnlyActual += actual;
            }
            return (
              <Fragment key={section.key}>
                <tr className="arr-t7-section-row" style={{ background: section.bg, borderTopColor: section.color }} key={`${section.key}-head`}>
                  <td colSpan={3}>
                    {section.label}
                    {section.aopTarget && <span>AOP Target: ${(section.aopTarget / 1000000).toFixed(1)}M</span>}
                    {isPartner && <span>Ref credit only · excluded from company quota</span>}
                  </td>
                  <td className="right money" style={{ color: section.color }}>{isPartner ? 'N/A' : fFull(quota)}</td>
                  <td className="right money" style={{ color: '#15803d' }}>{fFull(actual)}</td>
                  <td className="right" style={{ color }}>{isPartner ? '-' : `${pct.toFixed(1)}%`}</td>
                  <td className="right money" style={{ color: isPartner ? '#9ca3af' : gap > 0 ? '#dc2626' : '#15803d' }}>{isPartner ? '-' : fFull(gap)}</td>
                  <td>{!isPartner && <div className="arr-t7-table-track"><i style={{ width: `${Math.min(pct, 100).toFixed(1)}%`, background: color }} /></div>}</td>
                </tr>
                {sectionRows.map(row => {
                  const rowColor = isPartner ? '#7c3aed' : colorForPct(row.pct);
                  return (
                    <tr className={`arr-t7-data-row ${isPartner ? 'partner' : ''}`} key={row.dataKey} onClick={() => onOpen(row)}>
                      <td><strong>{row.rep}</strong></td>
                      <td>{row.region}</td>
                      <td><span className={`arr-t7-type ${isPartner ? 'partner' : ''}`}>{row.type}</span></td>
                      <td className="right money" style={{ color: isPartner ? '#9ca3af' : '#1e5fa8' }}>{isPartner ? 'Ref only' : fFull(row.quota)}</td>
                      <td className="right money" style={{ color: '#15803d' }}>{fFull(row.actual)}</td>
                      <td className="right" style={{ color: rowColor }}>{row.pct.toFixed(1)}%</td>
                      <td className="right money" style={{ color: isPartner ? '#9ca3af' : row.gap > 0 ? '#dc2626' : '#15803d' }}>{isPartner ? '-' : fFull(row.gap)}</td>
                      <td><div className="arr-t7-table-track"><i style={{ width: `${Math.min(row.pct, 100).toFixed(1)}%`, background: rowColor }} /></div></td>
                    </tr>
                  );
                })}
                {!isPartner && (
                  <tr className="arr-t7-subtotal-row" style={{ borderBottomColor: section.color }} key={`${section.key}-subtotal`}>
                    <td colSpan={3}>↳ {section.label.replace(/^.+? /, '')} Subtotal (Rep Quotas)</td>
                    <td className="right money" style={{ color: section.color }}>{fFull(quota)}</td>
                    <td className="right money">{fFull(actual)}</td>
                    <td className="right" style={{ color }}>{pct.toFixed(1)}%</td>
                    <td className="right money" style={{ color: gap > 0 ? '#dc2626' : '#15803d' }}>{fFull(gap)}</td>
                    <td />
                  </tr>
                )}
                {isPartner && (
                  <tr className="arr-t7-partner-note" key={`${section.key}-note`}>
                    <td colSpan={3}>↳ Partner Total Bookings (informational)</td>
                    <td className="right money">-</td>
                    <td className="right money">{fFull(actual)}</td>
                    <td colSpan={3}>Not included in company quota or TOTAL row below</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!compact && (() => {
            const pct = aeOnlyQuota ? (aeOnlyActual / aeOnlyQuota) * 100 : 0;
            const gap = aeOnlyQuota - aeOnlyActual;
            const color = colorForPct(pct);
            return (
              <tr className="arr-t7-grand-row">
                <td colSpan={3}>📊 NAM + APAC Combined (AE Reps)</td>
                <td className="right money">{fFull(aeOnlyQuota)}</td>
                <td className="right money">{fFull(aeOnlyActual)}</td>
                <td className="right" style={{ color }}>{pct.toFixed(1)}%</td>
                <td className="right money" style={{ color: gap > 0 ? '#dc2626' : '#15803d' }}>{fFull(gap)}</td>
                <td><div className="arr-t7-table-track"><i style={{ width: `${Math.min(pct, 100).toFixed(1)}%`, background: color }} /></div></td>
              </tr>
            );
          })()}
        </tbody>
        {showTotal && (() => {
          const aeRows = (allRows || rows).filter(row => row.type === 'AE');
          const quota = aeRows.reduce((sum, row) => sum + row.quota, 0);
          const actual = aeRows.reduce((sum, row) => sum + row.actual, 0);
          const pct = quota ? (actual / quota) * 100 : 0;
          const gap = quota - actual;
          return (
            <tfoot>
              <tr>
                <td colSpan={3}>TOTAL (AE Reps) <span>Partner bookings excluded from quota total</span></td>
                <td className="right money">{fFull(quota)}</td>
                <td className="right money">{fFull(actual)}</td>
                <td className="right" style={{ color: colorForPct(pct) }}>{pct.toFixed(1)}%</td>
                <td className="right money" style={{ color: gap > 0 ? '#dc2626' : '#15803d' }}>{fFull(gap)}</td>
                <td />
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}

export default QuotaTab;
export { QuotaTab };
