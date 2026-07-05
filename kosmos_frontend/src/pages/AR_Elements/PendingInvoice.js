import { useMemo, useState } from 'react';
import { fmtCompact, fmtFull, regionTag, KCard, ARBarChart } from './arShared';

const REGION_COLORS = { NAM: '#1e5fa8', APAC: '#6d28d9', OEM: '#15803d' };
const REP_COLORS = ['#d97706', '#6d28d9', '#1e5fa8', '#15803d', '#b91c1c', '#ea580c'];

const money = (value) => {
    const amount = Number(value || 0);
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return fmtCompact(amount, 0);
};
const customerName = (row) => row.customer || row.end_user || 'Unspecified';
const normalizeStatus = (status = '') =>
    status.toLowerCase().includes('deal signed') ? 'Deal Signed — Not Yet Invoiced' : status;

function toDays(value) {
    const match = String(value || '').match(/(\d+)\s*(day|month|year)/i);
    if (!match) return 0;
    const number = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('month')) return number * 30;
    if (unit.startsWith('year')) return number * 365;
    return number;
}

function agingColor(value) {
    const days = typeof value === 'number' ? value : toDays(value);
    if (days >= 180) return '#b91c1c';
    if (days >= 90) return '#c2410c';
    if (days >= 30) return '#ea580c';
    return '#15803d';
}

function statusColor(status = '') {
    const lower = status.toLowerCase();
    if (lower.includes('deal signed')) return '#22c55e';
    if (lower.includes('multi')) return '#8b5cf6';
    return '#f59e0b';
}

function statusClass(status = '') {
    const lower = status.toLowerCase();
    if (lower.includes('deal signed')) return 'ar-b-deal';
    if (lower.includes('multi')) return 'ar-b-multi';
    if (lower.includes('annual')) return 'ar-b-annual';
    return 'ar-b-d1';
}

function groupRecords(records, labelFn) {
    const grouped = new Map();
    records.forEach((row) => {
        const label = labelFn(row) || 'Unspecified';
        const existing = grouped.get(label) || { label, value: 0, count: 0, rows: [] };
        existing.value += Number(row.amount || 0);
        existing.count += 1;
        existing.rows.push(row);
        grouped.set(label, existing);
    });
    return [...grouped.values()].sort((a, b) => b.value - a.value);
}

function PendingInvoiceModal({ type, rowIndex, summary, onClose }) {
    const records = summary.records;
    const total = summary.total;
    const stat = (label, value, sub, color) => ({ label, value, sub, color });

    let config = null;

    if (type === 'total') {
        config = {
            title: 'Pending Invoices',
            subtitle: 'All pending items',
            icon: '💰',
            iconBg: '#fff7ed',
            color: '#d97706',
            stats: [stat('Total Pending', money(total), `${records.length} deals`, '#d97706')],
            sections: [{
                title: 'All Pending Items',
                rows: records.map((row, i) => ({
                    rank: i + 1,
                    name: customerName(row),
                    meta: row.sales_rep,
                    badge: normalizeStatus(row.status),
                    badgeClass: statusClass(row.status),
                    value: fmtFull(row.amount),
                    color: '#d97706',
                })),
            }],
        };
    } else if (type === 'signed') {
        const rows = summary.signed;
        config = {
            title: 'Deal Signed — Not Yet Invoiced',
            subtitle: 'Deals signed but pending invoicing',
            icon: '✓',
            iconBg: '#dcfce7',
            color: '#0369a1',
            stats: [stat('Total', money(summary.signedTotal), `${rows.length} deals`, '#0369a1')],
            sections: [
                {
                    title: 'Items',
                    rows: rows.map((row, i) => ({
                        rank: i + 1,
                        name: customerName(row),
                        meta: row.renewal_status,
                        value: fmtFull(row.amount),
                        color: '#0369a1',
                    })),
                },
                {
                    title: 'Remarks',
                    rows: rows.map((row) => ({
                        name: customerName(row),
                        value: row.remarks || '—',
                        color: '#64748b',
                    })),
                },
            ],
        };
    } else if (type === 'annual') {
        const rows = summary.annual;
        config = {
            title: 'Annual Renewals',
            subtitle: 'Annual contracts pending renewal',
            icon: '🔄',
            iconBg: '#fef3c7',
            color: '#92400e',
            stats: [stat('Total', money(summary.annualTotal), `${rows.length} contracts`, '#92400e')],
            sections: [{
                title: 'Items',
                rows: rows.map((row, i) => ({
                    rank: i + 1,
                    name: customerName(row),
                    meta: row.renewal_status,
                    value: fmtFull(row.amount),
                    color: '#92400e',
                })),
            }],
        };
    } else if (type === 'multi') {
        const rows = summary.multi;
        config = {
            title: 'Multi-Year Pending',
            subtitle: 'Multi-year contracts awaiting Y2+',
            icon: '📋',
            iconBg: '#ede9fe',
            color: '#6d28d9',
            stats: [stat('Total', money(summary.multiTotal), `${rows.length} deals`, '#6d28d9')],
            sections: [{
                title: 'Items',
                rows: rows.map((row, i) => ({
                    rank: i + 1,
                    name: customerName(row),
                    meta: `${row.renewal_status} · ${row.remarks || ''}`,
                    value: fmtFull(row.amount),
                    color: '#6d28d9',
                })),
            }],
        };
    } else if (type === 'aging') {
        config = {
            title: 'Aging Analysis',
            subtitle: 'Items by how long pending',
            icon: '⏰',
            iconBg: '#fee2e2',
            color: '#b91c1c',
            stats: [stat('Total Pipeline', money(total), `${records.length} deals`, '#b91c1c')],
            sections: summary.agingGroups.map((group) => ({
                title: group.label,
                rows: group.rows.map((row) => ({
                    name: customerName(row),
                    badge: normalizeStatus(row.status),
                    badgeClass: statusClass(row.status),
                    value: fmtFull(row.amount),
                    color: agingColor(group.label),
                })),
            })),
        };
    } else if (type === 'item') {
        const row = records[rowIndex];
        if (row) {
            config = {
                title: customerName(row),
                subtitle: `${row.region || '—'} · ${row.sales_rep || '—'}`,
                icon: '📄',
                iconBg: '#e8f1fb',
                color: '#1e5fa8',
                stats: [
                    stat('Amount', fmtFull(row.amount), '', '#1e5fa8'),
                    stat('Renewal Status', row.renewal_status || '—', '', '#d97706'),
                ],
                sections: [{
                    title: 'Details',
                    rows: [
                        { name: 'Status', value: normalizeStatus(row.status), badge: normalizeStatus(row.status), badgeClass: statusClass(row.status), color: statusColor(row.status) },
                        { name: 'Region', value: row.region || '—', color: REGION_COLORS[row.region] || '#64748b' },
                        { name: 'Sales Rep', value: row.sales_rep || '—', color: '#0f172a' },
                        { name: 'Remarks', value: row.remarks || '—', color: '#64748b' },
                    ],
                }],
            };
        }
    }

    if (!config) return null;

    return (
        <div className="ar-modal-bg" onMouseDown={onClose}>
            <div className="ar-modal" style={{ maxWidth: 900 }} onMouseDown={(e) => e.stopPropagation()}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon" style={{ background: config.iconBg, color: config.color }}>{config.icon}</div>
                    <div>
                        <div className="ar-modal-title">{config.title}</div>
                        <div className="ar-modal-sub">{config.subtitle}</div>
                    </div>
                    <button className="ar-modal-close" type="button" onClick={onClose} aria-label="Close">x</button>
                </div>
                <div className="ar-modal-body">
                    <div className="ar-modal-stats" style={{ gridTemplateColumns: `repeat(${Math.min(config.stats.length, 3)},1fr)` }}>
                        {config.stats.map((item) => (
                            <div className="ar-mstat" key={item.label} style={{ borderLeftColor: item.color }}>
                                <div className="ar-mstat-label">{item.label}</div>
                                <div className="ar-mstat-val" style={{ color: item.color }}>{item.value}</div>
                                {item.sub && <div className="ar-mstat-sub">{item.sub}</div>}
                            </div>
                        ))}
                    </div>
                    {config.sections.map((section) => (
                        <div key={section.title}>
                            <div className="ar-msec">{section.title}</div>
                            {section.rows.length ? section.rows.map((row, i) => (
                                <div className="ar-mrow" key={`${section.title}-${row.name}-${i}`} style={{ borderLeftColor: row.color || config.color }}>
                                    {row.rank && <span className="ar-mrow-n">{row.rank}</span>}
                                    <span className="ar-mrow-name">
                                        {row.name}
                                        {row.meta && <span className="ar-mrow-meta"> · {row.meta}</span>}
                                    </span>
                                    {row.badge && <span className={`ar-badge ${row.badgeClass}`}>{row.badge}</span>}
                                    <span className="ar-mrow-val" style={{ color: row.color || config.color }}>{row.value}</span>
                                </div>
                            )) : <div className="empty-copy" style={{ fontSize: 12, color: '#718096' }}>No items found.</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PendingInvoice({ data }) {
    const [activeModal, setActiveModal] = useState(null);
    const [activeRow, setActiveRow] = useState(null);

    const summary = useMemo(() => {
        const records = [...(data.records || [])].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
        const total = records.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const signed = records.filter((row) => row.status?.toLowerCase().includes('deal signed'));
        const annual = records.filter((row) => row.status?.toLowerCase().includes('annual'));
        const multi = records.filter((row) => row.status?.toLowerCase().includes('multi'));
        const byRegion = groupRecords(records, (row) => row.region);
        const byRep = groupRecords(records, (row) => row.sales_rep);
        const agingGroups = groupRecords(records, (row) => row.renewal_status)
            .sort((a, b) => toDays(b.label) - toDays(a.label));
        const statusGroups = groupRecords(records, (row) => normalizeStatus(row.status));
        const customerAging = records
            .map((row) => ({ label: customerName(row), value: toDays(row.renewal_status), amount: Number(row.amount || 0), status: row.status }))
            .sort((a, b) => b.value - a.value);
        const longest = [...records].sort((a, b) => toDays(b.renewal_status) - toDays(a.renewal_status))[0];

        return {
            records,
            total,
            signed,
            annual,
            multi,
            signedTotal: signed.reduce((sum, row) => sum + Number(row.amount || 0), 0),
            annualTotal: annual.reduce((sum, row) => sum + Number(row.amount || 0), 0),
            multiTotal: multi.reduce((sum, row) => sum + Number(row.amount || 0), 0),
            byRegion,
            byRep,
            agingGroups,
            statusGroups,
            customerAging,
            longest,
        };
    }, [data.records]);

    const kpi = data.kpis || {};
    const modalType = activeModal === 'item' ? 'item' : activeModal;

    return (
        <>
            <div className="ar-kpi-grid">
                <KCard variant={5} label="Pending Invoices" value={money(summary.total)} sub={`${summary.records.length} invoices pending`} ico="💰" onClick={() => setActiveModal('total')} />
                <KCard variant={1} label="Deal Signed — Not Yet Invoiced" value={money(summary.signedTotal)} sub={`${summary.signed.length} deals awaiting invoice`} ico="✓" onClick={() => setActiveModal('signed')} />
                <KCard variant={6} label="Annual Renewal" value={money(summary.annualTotal)} sub={`${summary.annual.length} annual contracts`} ico="🔄" onClick={() => setActiveModal('annual')} />
                <KCard variant={5} label="Multi Year Pending" value={money(summary.multiTotal)} sub={`${summary.multi.length} multi-year pending`} ico="📋" onClick={() => setActiveModal('multi')} />
                <KCard variant={2} label="Aging" value={summary.longest?.renewal_status || kpi.longest_status || '—'} sub={`Longest: ${summary.longest ? customerName(summary.longest) : kpi.longest_customer || '—'}`} ico="⏰" onClick={() => setActiveModal('aging')} />
            </div>

            <div className="ar-mini-strip">
                {summary.byRegion.map((item) => {
                    const color = REGION_COLORS[item.label] || '#64748b';
                    return (
                        <div className="ar-mini-card" key={`region-${item.label}`} style={{ borderTopColor: color }}>
                            <div className="ar-mini-label">{item.label}</div>
                            <div className="ar-mini-value" style={{ color }}>{money(item.value)}</div>
                            <div className="ar-mini-sub">{item.count} items · {summary.total ? Math.round(item.value / summary.total * 100) : 0}%</div>
                        </div>
                    );
                })}
                {summary.byRep.map((item) => (
                    <div className="ar-mini-card" key={`rep-${item.label}`} style={{ borderTopColor: '#94a3b8' }}>
                        <div className="ar-mini-label">{item.label}</div>
                        <div className="ar-mini-value">{money(item.value)}</div>
                        <div className="ar-mini-sub">{item.count} items</div>
                    </div>
                ))}
            </div>

            <div className="ar-chart-grid" style={{ marginBottom: 16 }}>
                <ARBarChart
                    title="Pending Invoices by Region"
                    sub="Amount by region"
                    items={summary.byRegion}
                    colors={summary.byRegion.map((item) => REGION_COLORS[item.label] || '#64748b')}
                    formatter={money}
                    axisFormatter={money}
                    valueFormatter={money}
                />
                <ARBarChart
                    title="Pending Invoices by Sales Rep"
                    sub="Amount by rep"
                    items={summary.byRep}
                    colors={REP_COLORS}
                    formatter={money}
                    axisFormatter={money}
                    valueFormatter={money}
                    showLegend={false}
                />
            </div>

            <div className="ar-chart-grid" style={{ marginBottom: 16 }}>
                <ARBarChart
                    title="Amount by Renewal Status"
                    sub="Aging bucket breakdown"
                    items={summary.agingGroups}
                    colors={summary.agingGroups.map((item) => agingColor(item.label))}
                    formatter={money}
                    axisFormatter={money}
                    valueFormatter={money}
                />
                <ARBarChart
                    title="Aging Duration by Customer"
                    sub="Time pending per end user"
                    items={summary.customerAging}
                    colors={summary.customerAging.map((item) => agingColor(item.value))}
                    formatter={(value) => `${Math.round(value)}d pending`}
                    axisFormatter={(value) => `${Math.round(value)}d`}
                    valueFormatter={(value) => `${Math.round(value)}d`}
                    showLegend={false}
                />
            </div>

            <div className="ar-chart-grid ar-chart-grid-single" style={{ marginBottom: 16 }}>
                <ARBarChart 
                    title="Status Breakdown by Amount"
                    sub="Each deal coloured by status type"
                    items={summary.statusGroups}
                    colors={summary.statusGroups.map((item) => statusColor(item.label))}
                    formatter={money}
                    axisFormatter={money}
                    valueFormatter={money}
                    showLegend={false}
                />
            </div>

            <div className="ar-tcard" style={{ marginTop: 16 }}>
                <div className="ar-tcard-hd">
                    <span className="ar-tcard-title">Pending Invoice Detail</span>
                    <span className="ar-ttag">{summary.records.length} items · {money(summary.total)}</span>
                </div>
                <div className="ar-twrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>End User</th>
                                <th>Region</th>
                                <th>Sales Rep</th>
                                <th>Status</th>
                                <th>Renewal Status</th>
                                <th className="num">Amount</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.records.map((row, i) => (
                                <tr
                                    key={`${customerName(row)}-${i}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        setActiveRow(i);
                                        setActiveModal('item');
                                    }}
                                >
                                    <td style={{ color: '#718096', fontSize: 11 }}>{i + 1}</td>
                                    <td style={{ fontWeight: 700 }}>{customerName(row)}</td>
                                    <td><span className={`ar-badge ${regionTag(row.region)}`}>{row.region}</span></td>
                                    <td style={{ fontSize: 12 }}>{row.sales_rep}</td>
                                    <td><span className={`ar-badge ${statusClass(row.status)}`}>{normalizeStatus(row.status)}</span></td>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: agingColor(row.renewal_status) }}>
                                            {row.renewal_status}
                                        </span>
                                    </td>
                                    <td className="num" style={{ fontWeight: 700 }}>{fmtFull(row.amount)}</td>
                                    <td style={{ fontSize: 11, color: '#718096', maxWidth: 200 }}>{row.remarks}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} style={{ fontWeight: 700 }}>TOTAL</td>
                                <td className="num" style={{ fontWeight: 700 }}>{fmtFull(summary.total)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {activeModal && (
                <PendingInvoiceModal
                    type={modalType}
                    rowIndex={activeRow}
                    summary={summary}
                    onClose={() => {
                        setActiveModal(null);
                        setActiveRow(null);
                    }}
                />
            )}
        </>
    );
}

export { PendingInvoice };
export default PendingInvoice;
