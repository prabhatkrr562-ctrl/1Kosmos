import { useMemo, useState } from 'react';
import { fmtCompact, regionTag, cycleColor, cycleLabel, KCard, ARBarChart } from './arShared';

const REGION_COLORS = { NAM: '#1e5fa8', APAC: '#6d28d9', OEM: '#15803d' };
const CHART_COLORS = ['#1e5fa8', '#6d28d9', '#15803d', '#ea580c', '#b91c1c', '#0f766e'];
const SPEED_COLORS = ['#15803d', '#15803d', '#2563eb', '#ea580c', '#c2410c', '#b91c1c', '#7c2d12'];

const money = (value) => fmtCompact(value, 2);
const dayText = (value) => `${Math.round(Number(value || 0))} days`;

function CollectionHistory({ data }) {
    const kpi = data.kpis;
    const otl = data.on_time_late || {};
    const ot = otl.on_time || {};
    const lt = otl.late || {};
    const regionEntries = Object.entries(data.by_region_detail || {})
        .sort((a, b) => Number(b[1]?.total || 0) - Number(a[1]?.total || 0));
    const maxCycle = Math.max(...(data.customer_cycles || []).map((c) => c.value), 1);
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [modalType, setModalType] = useState(null);

    const periodStart = data.invoice_detail?.length
        ? data.invoice_detail.reduce((m, r) => r.invoice_date < m ? r.invoice_date : m, data.invoice_detail[0].invoice_date)
        : null;
    const periodEnd = data.invoice_detail?.length
        ? data.invoice_detail.reduce((m, r) => r.payment_date > m ? r.payment_date : m, data.invoice_detail[0].payment_date)
        : null;

    const filteredInvoices = useMemo(() => {
        if (!invoiceSearch) return data.invoice_detail || [];
        const q = invoiceSearch.toLowerCase();
        return (data.invoice_detail || []).filter((r) =>
            r.customer.toLowerCase().includes(q) ||
            r.invoice_number.toLowerCase().includes(q) ||
            r.region.toLowerCase().includes(q)
        );
    }, [data.invoice_detail, invoiceSearch]);
    const collectionRegionItems = useMemo(
        () => regionEntries.map(([region, value]) => ({ label: region, value: value.total })),
        [regionEntries]
    );
    const speedDistribution = useMemo(() => {
        const ranges = [
            { label: '<=15 Days', min: 0, max: 15 },
            { label: '16-30 Days', min: 16, max: 30 },
            { label: '31-45 Days', min: 31, max: 45 },
            { label: '46-60 Days', min: 46, max: 60 },
            { label: '61-90 Days', min: 61, max: 90 },
            { label: '91-120 Days', min: 91, max: 120 },
            { label: '120+ Days', min: 121, max: Infinity },
        ];
        return ranges.map((range) => ({
            label: range.label,
            value: (data.invoice_detail || []).filter((invoice) => invoice.cycle >= range.min && invoice.cycle <= range.max).length,
        }));
    }, [data.invoice_detail]);
    const modalConfig = useMemo(
        () => buildCollectionModal(
            modalType,
            data.invoice_detail || [],
            kpi,
            data.paid_invoice_detail || []
        ),
        [modalType, data.invoice_detail, data.paid_invoice_detail, kpi]
    );
    const openKpiModal = (event) => {
        const card = event.target.closest('.ar-kcard');
        if (!card) return;
        const label = card.querySelector('.ar-kcard-label')?.textContent || '';
        if (label === 'Total Collected') setModalType('collected');
        else if (label === 'Avg Payment Cycle') setModalType('avgcycle');
        else if (label.startsWith('Fast')) setModalType('fast');
        else if (label.startsWith('Medium')) setModalType('medium');
        else if (label.startsWith('Slow')) setModalType('slow');
    };

    return (
        <>
            <div className="ar-kpi-grid ar-kpi-grid-clickable" onClick={openKpiModal}>
                <KCard variant={4} label="Total Collected" value={money(kpi.total_collected)} sub={`${kpi.paid_invoices} invoices paid`} ico="💳" />
                <KCard variant={1} label="Avg Payment Cycle" value={dayText(kpi.average_cycle)} sub={`${kpi.tracked_invoices} invoices tracked`} ico="⏰" />
                <KCard variant={4} label="Fast (≤30 Days)" value={kpi.fast} sub={`${Math.round(kpi.fast / (kpi.tracked_invoices || 1) * 100)}%`} ico="✅" />
                <KCard variant={6} label="Medium (31-60 Days)" value={kpi.medium} sub={`${Math.round(kpi.medium / (kpi.tracked_invoices || 1) * 100)}%`} ico="⚡" />
                <KCard variant={2} label="Slow (60+ Days)" value={kpi.slow} sub={`${Math.round(kpi.slow / (kpi.tracked_invoices || 1) * 100)}%`} ico="🔴" />
            </div>

            {periodStart && (
                <div className="ar-period-banner">
                    <div className="ar-pb-icon">📅</div>
                    <div>
                        <div className="ar-pb-text">
                            Payment Cycle Period: {periodStart.slice(0, 10)} — {periodEnd?.slice(0, 10)}
                        </div>
                        <div className="ar-pb-sub">
                            {kpi.tracked_invoices} invoices analysed · {kpi.paid_invoices} fully paid
                        </div>
                    </div>
                </div>
            )}

            <div className="ar-due-split">
                <div
                    className="ar-due-card ar-due-cur ar-due-clickable"
                    onClick={() => setModalType('beforedue')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setModalType('beforedue');
                        }
                    }}
                >
                    <div className="ar-due-label">✓ Paid Before / On Due Date</div>
                    <div className="ar-due-main">
                        <span className="ar-due-val" style={{ color: '#15803d' }}>{ot.count || 0}</span>
                        <span className="ar-due-cnt">of {kpi.tracked_invoices} invoices ({ot.pct || 0}%)</span>
                    </div>
                    <div className="ar-due-amt">{money(ot.amount)}</div>
                    <div className="ar-due-avg">Avg cycle: {dayText(ot.avg_cycle)}</div>
                </div>
                <div
                    className="ar-due-card ar-due-late ar-due-clickable"
                    onClick={() => setModalType('afterdue')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setModalType('afterdue');
                        }
                    }}
                >
                    <div className="ar-due-label">⚠ Paid After Due Date</div>
                    <div className="ar-due-main">
                        <span className="ar-due-val" style={{ color: '#b91c1c' }}>{lt.count || 0}</span>
                        <span className="ar-due-cnt">of {kpi.tracked_invoices} invoices ({lt.pct || 0}%)</span>
                    </div>
                    <div className="ar-due-amt">{money(lt.amount)}</div>
                    <div className="ar-due-avg">Avg cycle: {dayText(lt.avg_cycle)}</div>
                </div>
            </div>

            {regionEntries.length > 0 && (
                <div className="ar-region-grid">
                    {regionEntries.map(([region, v]) => {
                        const regionColor = REGION_COLORS[region] || '#64748b';
                        return (
                            <div className="ar-region-card" key={region} style={{ borderTop: `3px solid ${regionColor}` }}>
                                <div className="ar-region-hd">
                                    <span className={`ar-badge ${regionTag(region)}`}>{region}</span>
                                    <span className="ar-region-customers">{v.count} invoices</span>
                                    <span className="ar-region-total" style={{ color: cycleColor(v.avg || 0) }}>{dayText(v.avg)} avg</span>
                                </div>
                                <div className="ar-region-row"><span className="ar-region-rlbl">Total Collected</span><span className="ar-region-rval" style={{ color: '#15803d' }}>{money(v.total)}</span></div>
                                <div className="ar-region-row"><span className="ar-region-rlbl">Min Cycle</span><span className="ar-region-rval" style={{ color: '#15803d' }}>{dayText(v.min)}</span></div>
                                <div className="ar-region-row"><span className="ar-region-rlbl">Max Cycle</span><span className="ar-region-rval" style={{ color: '#b91c1c' }}>{dayText(v.max)}</span></div>
                                <div className="ar-region-row"><span className="ar-region-rlbl">Before Due</span><span className="ar-region-rval" style={{ color: '#15803d' }}>{v.before_due}</span></div>
                                <div className="ar-region-row"><span className="ar-region-rlbl">After Due</span><span className="ar-region-rval" style={{ color: '#b91c1c' }}>{v.after_due}</span></div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="ar-chart-grid" style={{ marginBottom: 16 }}>
            <div className="ar-panel" style={{ marginBottom: 0 }}>
                <h4>Payment Cycle by Customer (Avg Days)</h4>
                <div className="ar-panel-sub">Average days from invoice date to payment received</div>
                <div className="ar-cycle-list">
                    {(data.customer_cycles || []).map((item) => (
                        <div className="ar-cycle-row" key={item.label}>
                            <span className="ar-cycle-lbl" title={item.label}>{item.label}</span>
                            <div className="ar-cycle-bg">
                                <div
                                    className="ar-cycle-fill"
                                    style={{
                                        width: `${Math.round(item.value / maxCycle * 100)}%`,
                                        background: cycleColor(item.value),
                                    }}
                                >
                                    {item.value > maxCycle * 0.3 ? dayText(item.value) : ''}
                                </div>
                            </div>
                            <span className="ar-cycle-val">{dayText(item.value)}</span>
                            <span className="ar-cycle-badge">
                                <span className={`ar-badge ${item.value <= 30 ? 'ar-b-cur' : item.value <= 60 ? 'ar-b-d31' : 'ar-b-d91'}`}>
                                    {cycleLabel(item.value)}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
                <ARBarChart
                    title="Collections by Region"
                    sub="Total collected - by region"
                    items={collectionRegionItems}
                    colors={collectionRegionItems.map((item) => REGION_COLORS[item.label] || '#64748b')}
                    formatter={money}
                    axisFormatter={money}
                    valueFormatter={money}
                />
            </div>

            <div className="ar-chart-grid" style={{ marginBottom: 16 }}>
                <ARBarChart
                    title="Payment Cycle by Sales Rep"
                    sub="Average collection cycle per rep"
                    items={data.rep_cycles}
                    colors={(data.rep_cycles || []).map((item, i) => cycleColor(item.value) || CHART_COLORS[i % CHART_COLORS.length])}
                    formatter={dayText}
                    axisFormatter={dayText}
                    valueFormatter={dayText}
                />
                <ARBarChart
                    title="Payment Speed Distribution"
                    sub="Invoice payment speed bucketed"
                    items={speedDistribution}
                    colors={SPEED_COLORS}
                    formatter={(v) => `${v} invoices`}
                    axisFormatter={(v) => `${Math.round(v)}`}
                    valueFormatter={(v) => `${Math.round(v)}`}
                />
            </div>

            <div className="ar-tcard">
                <div className="ar-tcard-hd">
                    <span className="ar-tcard-title">All Paid Invoices — Payment Cycle Detail</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                            className="ar-search-input" style={{ width: 200 }}
                            placeholder="Search..." value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                        />
                        <span className="ar-ttag">{filteredInvoices.length} invoices</span>
                    </div>
                </div>
                <div className="ar-twrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Customer</th>
                                <th>Region</th>
                                <th>Sales Rep</th>
                                <th className="num">Amount</th>
                                <th>Invoice Date</th>
                                <th>Due Date</th>
                                <th>Payment Date</th>
                                <th className="num">Cycle</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map((row, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.invoice_number}</td>
                                    <td style={{ fontWeight: 600 }}>{row.customer}</td>
                                    <td><span className={`ar-badge ${regionTag(row.region)}`}>{row.region}</span></td>
                                    <td>{row.sales_rep}</td>
                                    <td className="num">{money(row.amount)}</td>
                                    <td style={{ fontSize: 11 }}>{row.invoice_date}</td>
                                    <td style={{ fontSize: 11 }}>{row.due_date || '—'}</td>
                                    <td style={{ fontSize: 11 }}>{row.payment_date}</td>
                                    <td className="num">{dayText(row.cycle)}</td>
                                    <td>
                                        <span className={`ar-badge ${row.status === 'Late' ? 'ar-b-late' : 'ar-b-ontime'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalConfig && (
                <CollectionModal config={modalConfig} onClose={() => setModalType(null)} />
            )}
        </>
    );
}

function CollectionModal({ config, onClose }) {
    return (
        <div className="ar-modal-bg" onMouseDown={onClose}>
            <div className="ar-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon" style={{ background: config.iconBg, color: config.color }}>{config.icon}</div>
                    <div>
                        <div className="ar-modal-title">{config.title}</div>
                        <div className="ar-modal-sub">{config.subtitle}</div>
                    </div>
                    <button className="ar-modal-close" type="button" onClick={onClose} aria-label="Close">x</button>
                </div>
                <div className="ar-modal-body">
                    {config.stats.length > 0 && (
                        <div className="ar-modal-stats" style={{ gridTemplateColumns: `repeat(${Math.min(config.stats.length, 3)},1fr)` }}>
                            {config.stats.map((stat) => (
                                <div className="ar-mstat" key={stat.label} style={{ borderLeftColor: stat.color || config.color }}>
                                    <div className="ar-mstat-label">{stat.label}</div>
                                    <div className="ar-mstat-val" style={{ color: stat.color || config.color }}>{stat.value}</div>
                                    {stat.sub && <div className="ar-mstat-sub">{stat.sub}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                    {config.sections.map((section) => (
                        <div key={section.title}>
                            <div className="ar-msec">{section.title}</div>
                            {section.rows.length ? section.rows.map((row, i) => (
                                <div className="ar-mrow" key={`${section.title}-${row.name}-${i}`} style={{ borderLeftColor: row.color || undefined }}>
                                    <span className="ar-mrow-n" style={{ color: row.color || undefined }}>{row.rank || i + 1}</span>
                                    <span className="ar-mrow-name">
                                        {row.name}
                                        {row.meta && <span className="ar-mrow-meta"> · {row.meta}</span>}
                                    </span>
                                    {row.barPct !== undefined && (
                                        <span className="ar-mrow-bar-bg">
                                            <span className="ar-mrow-bar" style={{ width: `${row.barPct}%`, background: row.color || config.color }} />
                                        </span>
                                    )}
                                    <span className="ar-mrow-val" style={{ color: row.color || config.color }}>{row.value}</span>
                                    {row.pct && <span className="ar-mrow-pct">{row.pct}</span>}
                                </div>
                            )) : <div className="empty-copy" style={{ fontSize: 12, color: '#718096' }}>No invoices found.</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function buildCollectionModal(type, invoices, kpi, paidInvoices = []) {
    if (!type) return null;
    const tracked = invoices.length || Number(kpi.tracked_invoices || 0);
    const paidRows = paidInvoices.length ? paidInvoices : invoices;
    const totalCollected = paidRows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const avgCycle = tracked ? Math.round(invoices.reduce((sum, invoice) => sum + Number(invoice.cycle || 0), 0) / tracked) : 0;

    if (type === 'collected') {
        const byCustomer = groupInvoices(paidRows, (invoice) => invoice.customer);
        const byRegion = groupInvoices(paidRows, (invoice) => invoice.region);
        const byRep = groupInvoices(paidRows, (invoice) => invoice.sales_rep);
        const maxCustomer = Math.max(...byCustomer.map((row) => row.total), 1);

        return {
            title: 'Total Collected',
            subtitle: 'Paid invoice collection breakdown',
            icon: '💳',
            color: '#15803d',
            iconBg: '#dcfce7',
            stats: [
                { label: 'Total Collected', value: money(totalCollected), sub: `${paidRows.length} invoices`, color: '#15803d' },
                { label: 'Customers', value: byCustomer.length, sub: 'Unique payers', color: '#1e5fa8' },
            ],
            sections: [
                {
                    title: 'By Region',
                    rows: byRegion.map((row, i) => ({
                        name: row.name,
                        value: money(row.total),
                        pct: pct(row.total, totalCollected),
                        color: '#15803d',
                        rank: i + 1,
                    })),
                },
                {
                    title: 'By Customer',
                    rows: byCustomer.slice(0, 15).map((row, i) => ({
                        name: row.name,
                        meta: `${row.count} inv`,
                        value: money(row.total),
                        barPct: Math.round(row.total / maxCustomer * 100),
                        color: '#15803d',
                        rank: i + 1,
                    })),
                },
                {
                    title: 'By Sales Rep',
                    rows: byRep.map((row, i) => ({
                        name: row.name,
                        value: money(row.total),
                        color: '#6d28d9',
                        rank: i + 1,
                    })),
                },
            ],
        };
    }

    if (type === 'avgcycle') {
        const sorted = [...invoices].sort((a, b) => Number(b.cycle || 0) - Number(a.cycle || 0));
        const fastest = [...invoices].sort((a, b) => Number(a.cycle || 0) - Number(b.cycle || 0))[0];
        const slowest = sorted[0];
        const byCustomer = groupInvoices(invoices, (invoice) => invoice.customer)
            .map((row) => ({ ...row, avg: Math.round(row.days.reduce((a, b) => a + b, 0) / row.days.length) }))
            .sort((a, b) => b.avg - a.avg);

        return {
            title: 'Average Payment Cycle',
            subtitle: 'Invoice date to payment date',
            icon: '⏰',
            color: '#1e5fa8',
            iconBg: '#e8f1fb',
            stats: [
                { label: 'Avg Cycle', value: dayText(avgCycle), sub: `${tracked} invoices`, color: '#1e5fa8' },
                { label: 'Fastest', value: fastest ? dayText(fastest.cycle) : dayText(0), sub: fastest?.customer || '', color: '#15803d' },
                { label: 'Slowest', value: slowest ? dayText(slowest.cycle) : dayText(0), sub: slowest?.customer || '', color: '#b91c1c' },
            ],
            sections: [
                {
                    title: 'By Customer (Slowest First)',
                    rows: byCustomer.map((row, i) => ({
                        name: row.name,
                        meta: `${row.count} inv`,
                        value: dayText(row.avg),
                        color: cycleColor(row.avg),
                        rank: i + 1,
                    })),
                },
            ],
        };
    }

    const bucket = getSpeedBucket(type, invoices);
    const bucketTotal = bucket.rows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const bucketAvg = bucket.rows.length
        ? Math.round(bucket.rows.reduce((sum, invoice) => sum + Number(invoice.cycle || 0), 0) / bucket.rows.length)
        : 0;
    const byCustomer = groupInvoices(bucket.rows, (invoice) => invoice.customer)
        .map((row) => ({ ...row, avg: Math.round(row.days.reduce((a, b) => a + b, 0) / row.days.length) }))
        .sort((a, b) => b.total - a.total);

    return {
        title: bucket.title,
        subtitle: bucket.subtitle,
        icon: bucket.icon,
        color: bucket.color,
        iconBg: bucket.iconBg,
        stats: [
            { label: `${bucket.label} Invoices`, value: bucket.rows.length, sub: `${tracked ? Math.round(bucket.rows.length / tracked * 100) : 0}% of all paid`, color: bucket.color },
            { label: 'Total Amount', value: money(bucketTotal), sub: `Avg cycle: ${dayText(bucketAvg)}`, color: bucket.color },
        ],
        sections: [
            {
                title: 'By Customer',
                rows: byCustomer.map((row, i) => ({
                    name: row.name,
                    meta: `${row.count} inv · avg ${dayText(row.avg)}`,
                    value: money(row.total),
                    color: bucket.color,
                    rank: i + 1,
                })),
            },
            {
                title: 'All Invoices',
                rows: bucket.rows.slice(0, 25).map((invoice) => ({
                    name: invoice.customer,
                    meta: invoice.invoice_number,
                    value: money(invoice.amount),
                    color: bucket.color,
                    rank: dayText(invoice.cycle),
                })),
            },
        ],
    };
}

function groupInvoices(invoices, labelFn) {
    const grouped = new Map();
    invoices.forEach((invoice) => {
        const name = labelFn(invoice) || 'Unspecified';
        const existing = grouped.get(name) || { name, total: 0, count: 0, days: [] };
        existing.total += Number(invoice.amount || 0);
        existing.count += 1;
        existing.days.push(Number(invoice.cycle || 0));
        grouped.set(name, existing);
    });
    return [...grouped.values()].sort((a, b) => b.total - a.total);
}

function getSpeedBucket(type, invoices) {
    const buckets = {
        fast: {
            title: 'Fast Payments',
            subtitle: 'Invoices paid within 30 days',
            label: '<=30 Days',
            icon: '✓',
            color: '#15803d',
            iconBg: '#dcfce7',
            rows: invoices.filter((invoice) => Number(invoice.cycle || 0) <= 30),
        },
        medium: {
            title: 'Medium Payments',
            subtitle: 'Invoices paid in 31-60 days',
            label: '31-60 Days',
            icon: '⚡',
            color: '#ea580c',
            iconBg: '#fff7ed',
            rows: invoices.filter((invoice) => Number(invoice.cycle || 0) > 30 && Number(invoice.cycle || 0) <= 60),
        },
        slow: {
            title: 'Slow Payments',
            subtitle: 'Invoices paid after 60 days',
            label: '60+ Days',
            icon: '●',
            color: '#b91c1c',
            iconBg: '#fee2e2',
            rows: invoices.filter((invoice) => Number(invoice.cycle || 0) > 60),
        },
        beforedue: {
            title: 'Paid Before / On Due Date',
            subtitle: 'Invoices paid on or before due date',
            label: 'Before/On Due',
            icon: '✓',
            color: '#15803d',
            iconBg: '#dcfce7',
            rows: invoices.filter((invoice) =>
                invoice.due_date &&
                invoice.payment_date &&
                new Date(invoice.payment_date) <= new Date(invoice.due_date)
            ),
        },
        afterdue: {
            title: 'Paid After Due Date',
            subtitle: 'Invoices paid after due date',
            label: 'After Due',
            icon: '!',
            color: '#b91c1c',
            iconBg: '#fee2e2',
            rows: invoices.filter((invoice) =>
                invoice.due_date &&
                invoice.payment_date &&
                new Date(invoice.payment_date) > new Date(invoice.due_date)
            ),
        },
    };
    const bucket = buckets[type] || buckets.fast;
    return { ...bucket, rows: [...bucket.rows].sort((a, b) => Number(b.cycle || 0) - Number(a.cycle || 0)) };
}

function pct(value, total) {
    return total ? `${(Number(value || 0) / total * 100).toFixed(1)}%` : '0.0%';
}

export { CollectionHistory };
export default CollectionHistory;
