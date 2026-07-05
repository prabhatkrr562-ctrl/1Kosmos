import { useMemo, useState } from 'react';
import { DevOverlay } from '../../components/DevOverlay/DevOverlay';
import { fmtCompact, bucketBadge, regionTag, KCard, ARBarChart } from './arShared';

const AGING_BUCKETS = ['Not Due', '0-30', '31-60', '61-90', '91+'];
const REGION_COLORS = { NAM: '#1e5fa8', APAC: '#6d28d9', OEM: '#15803d' };

function calcAgeDays(dueDate) {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((today - new Date(dueDate)) / 86400000);
}

function bucketFromAge(days) {
    if (days <= 0) return 'Not Due';
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '91+';
}

function agingBucketLabel(bucket) {
    if (bucket === 'Not Due' || bucket === 'Current') return 'Current';
    if (bucket === '0-30' || bucket === '1-30d') return '1-30 Days';
    if (bucket === '31-60' || bucket === '31-60d') return '31-60 Days';
    if (bucket === '61-90' || bucket === '61-90d') return '61-90 Days';
    if (bucket === '91+' || bucket === '91+d') return '91+ Days';
    return bucket;
}

function money(value) {
    return fmtCompact(value, 2);
}

function fmt(value) {
    return money(value);
}

function fmtFull(value) {
    return money(value);
}

function dayText(value) {
    return `${value} Days`;
}

function buildAgingFromRecords(data) {
    if (!data?.records?.length) return data;

    const records = data.records.map((record) => {
        const days = calcAgeDays(record.due_date);
        return {
            ...record,
            days_overdue: Math.max(days, 0),
            aging_bucket: bucketFromAge(days),
        };
    });

    const totalAR = records.reduce((sum, row) => sum + Number(row.open_balance || 0), 0);
    const agingBuckets = Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, 0]));
    const customers = {};
    const regionBuckets = {};
    const byRegion = {};
    const bySalesRep = {};

    records.forEach((row) => {
        const amount = Number(row.open_balance || 0);
        const bucket = row.aging_bucket;
        const customer = row.customer || row.legal_customer || 'Unspecified';
        const region = row.region || 'Other';
        const salesRep = row.sales_rep || 'Unspecified';

        agingBuckets[bucket] += amount;
        byRegion[region] = (byRegion[region] || 0) + amount;
        bySalesRep[salesRep] = (bySalesRep[salesRep] || 0) + amount;

        if (!customers[customer]) {
            customers[customer] = {
                customer,
                region,
                sales_rep: salesRep,
                open_ar: 0,
                overdue: 0,
                invoice_count: 0,
                buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])),
            };
        }
        customers[customer].region = region;
        customers[customer].sales_rep = salesRep;
        customers[customer].open_ar += amount;
        customers[customer].invoice_count += 1;
        customers[customer].buckets[bucket] += amount;
        if (bucket !== 'Not Due') customers[customer].overdue += amount;

        if (!regionBuckets[region]) {
            regionBuckets[region] = {
                total: 0,
                customers: new Set(),
                bucketCustomers: Object.fromEntries(AGING_BUCKETS.map((b) => [b, new Set()])),
                buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, { amount: 0, count: 0 }])),
            };
        }
        regionBuckets[region].total += amount;
        regionBuckets[region].customers.add(customer);
        regionBuckets[region].bucketCustomers[bucket].add(customer);
        regionBuckets[region].buckets[bucket].amount += amount;
    });

    Object.values(regionBuckets).forEach((region) => {
        AGING_BUCKETS.forEach((bucket) => {
            region.buckets[bucket].count = region.bucketCustomers[bucket].size;
        });
        region.customers = region.customers.size;
        delete region.bucketCustomers;
    });

    const customerSummary = Object.values(customers)
        .filter((customer) => Math.abs(customer.open_ar) > 0.01)
        .sort((a, b) => b.open_ar - a.open_ar);

    const overdueAlerts = [];
    customerSummary.forEach((customer) => {
        if ((customer.buckets['61-90'] || 0) > 0) {
            overdueAlerts.push({ customer: customer.customer, sales_rep: customer.sales_rep, open_balance: customer.buckets['61-90'], bucket: '61-90', days_overdue: 75 });
        }
        if ((customer.buckets['91+'] || 0) > 0) {
            overdueAlerts.push({ customer: customer.customer, sales_rep: customer.sales_rep, open_balance: customer.buckets['91+'], bucket: '91+', days_overdue: 999 });
        }
    });
    customerSummary.forEach((customer) => {
        if ((customer.buckets['31-60'] || 0) > 0) {
            overdueAlerts.push({ customer: customer.customer, sales_rep: customer.sales_rep, open_balance: customer.buckets['31-60'], bucket: '31-60', days_overdue: 45 });
        }
    });
    overdueAlerts.sort((a, b) => b.days_overdue - a.days_overdue || b.open_balance - a.open_balance);

    const overdue = agingBuckets['0-30'] + agingBuckets['31-60'] + agingBuckets['61-90'] + agingBuckets['91+'];
    const toEntries = (source) => Object.entries(source)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));

    return {
        ...data,
        records,
        kpis: {
            ...data.kpis,
            total_ar: totalAR,
            overdue,
            overdue_percent: totalAR ? Math.round((overdue / totalAR) * 1000) / 10 : 0,
            critical_91_plus: agingBuckets['91+'],
            not_due: agingBuckets['Not Due'],
            regions: Object.keys(byRegion).filter(Boolean).length,
        },
        buckets: AGING_BUCKETS.map((label) => ({ label, value: agingBuckets[label] })),
        bucket_percents: AGING_BUCKETS.map((label) => ({
            label,
            value: agingBuckets[label],
            pct: totalAR ? Math.round((agingBuckets[label] / totalAR) * 1000) / 10 : 0,
        })),
        region_buckets: regionBuckets,
        overdue_alerts: overdueAlerts,
        by_region: toEntries(byRegion),
        by_sales_rep: toEntries(bySalesRep),
        customer_summary: customerSummary,
    };
}

function BilledARModal({ data, onClose }) {
    const kpi = data.kpis;
    const bucketColors = ['#1e5fa8', '#2563eb', '#ea580c', '#c2410c', '#b91c1c'];
    const bucketLabels = ['Current\n(Not Due)', '1-30 Days\nOverdue', '31-60 Days\nOverdue', '61-90 Days\nOverdue', '91+ Days\n(Critical)'];
    const totalAR = kpi.total_ar || 1;

    if (!data) return null;

    const customers = data.customer_summary || [];
    const maxCustomerAR = customers.length ? Math.max(...customers.map(c => c.open_ar)) : 1;

    // Calculate totals per bucket
    let totCur = 0, tot130 = 0, tot3160 = 0, tot6190 = 0, tot91 = 0, totOverdue = 0;
    customers.forEach(c => {
        totCur += c.buckets?.['Not Due'] || 0;
        tot130 += c.buckets?.['0-30'] || 0;
        tot3160 += c.buckets?.['31-60'] || 0;
        tot6190 += c.buckets?.['61-90'] || 0;
        tot91 += c.buckets?.['91+'] || 0;
        totOverdue += (c.buckets?.['0-30'] || 0) + (c.buckets?.['31-60'] || 0) + (c.buckets?.['61-90'] || 0) + (c.buckets?.['91+'] || 0);
    });

    const regionTotals = {};
    const repTotals = {};
    customers.forEach(c => {
        regionTotals[c.region] = (regionTotals[c.region] || 0) + c.open_ar;
        repTotals[c.sales_rep] = (repTotals[c.sales_rep] || 0) + c.open_ar;
    });

    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal" style={{ maxWidth: 1000, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">💰</div>
                    <div>
                        <div className="ar-modal-title">Billed AR O/S — Full Breakdown</div>
                        <div className="ar-modal-sub">Outstanding invoices · aging · by customer & rep</div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                        <div className="ar-mstat" style={{ borderLeftColor: '#1877f2' }}>
                            <div className="ar-mstat-label">Total AR O/S</div>
                            <div className="ar-mstat-val" style={{ color: '#1877f2' }}>{fmt(totalAR)}</div>
                            <div className="ar-mstat-sub">{customers.length} customers · {data.records?.length || 0} invoices</div>
                        </div>
                        <div className="ar-mstat" style={{ borderLeftColor: '#b91c1c' }}>
                            <div className="ar-mstat-label">Total Overdue</div>
                            <div className="ar-mstat-val" style={{ color: '#b91c1c' }}>{fmt(totOverdue)}</div>
                            <div className="ar-mstat-sub">{totalAR > 0 ? ((totOverdue / totalAR) * 100).toFixed(1) + '% of AR outstanding' : '—'}</div>
                        </div>
                    </div>

                    <div className="ar-msec" style={{ marginTop: 14 }}>💡 What these numbers mean</div>
                    <div style={{ background: '#f0f6ff', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e5fa8', borderLeft: '3px solid #1e5fa8', marginBottom: 12 }}>
                        <b>AR O/S (Outstanding)</b> = Total unpaid invoice balance.<br />
                        <b>Overdue</b> = Portion past due date (1-30 Days, 31-60 Days, 61-90 Days, 91+ Days).<br />
                        <b>Current</b> = Not yet due — still within payment terms.<br />
                        Overdue is always ≤ AR O/S because Current balance is not overdue.
                    </div>

                    <div className="ar-msec">Aging Breakdown (Amount Outstanding per Bucket)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, margin: '10px 0 16px' }}>
                        {[totCur, tot130, tot3160, tot6190, tot91].map((amount, i) => {
                            const pct = totalAR > 0 ? ((amount / totalAR) * 100).toFixed(1) : '0.0';
                            return (
                                <div key={i} style={{
                                    textAlign: 'center',
                                    padding: '10px 6px',
                                    background: '#fafcff',
                                    borderRadius: 8,
                                    borderTop: `3px solid ${bucketColors[i]}`
                                }}>
                                    <div style={{ fontSize: 9, color: '#718096', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'pre-line', marginBottom: 4, lineHeight: 1.2 }}>
                                        {bucketLabels[i]}
                                    </div>
                                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: bucketColors[i] }}>
                                        {fmt(amount)}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="ar-msec">By Region</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                        {Object.entries(regionTotals).sort((a, b) => b[1] - a[1]).map((entry, i) => (
                            <div key={entry[0]} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                                <span style={{ width: 24, fontWeight: 700, color: '#718096' }}>{i + 1}</span>
                                <span style={{ flex: 1, fontWeight: 600 }}>{entry[0]}</span>
                                <span style={{ color: '#1877f2', fontWeight: 700, minWidth: 80, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(entry[1])}</span>
                                <span style={{ color: '#94a3b8', minWidth: 50, textAlign: 'right' }}>{totalAR > 0 ? ((entry[1] / totalAR) * 100).toFixed(1) : '0'}%</span>
                            </div>
                        ))}
                    </div>

                    <div className="ar-msec">By Customer (click to view detail)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                        {customers.slice(0, 15).map((c, i) => {
                            const overdueAmt = (c.buckets?.['0-30'] || 0) + (c.buckets?.['31-60'] || 0) + (c.buckets?.['61-90'] || 0) + (c.buckets?.['91+'] || 0);
                            const barWidth = (c.open_ar / maxCustomerAR) * 100;
                            return (
                                <div key={c.customer} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer' }}>
                                    <span style={{ width: 24, fontWeight: 700, color: '#718096' }}>{i + 1}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{c.customer}</span>
                                    <div style={{ width: 100, height: 18, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginRight: 12 }}>
                                        <div style={{ width: `${barWidth}%`, height: '100%', background: '#1877f2', transition: 'width 0.2s' }} />
                                    </div>
                                    <span style={{ color: '#1877f2', fontWeight: 700, minWidth: 80, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(c.open_ar)}</span>
                                    {overdueAmt > 0 ? (
                                        <span style={{ color: '#b91c1c', minWidth: 80, textAlign: 'right' }}>{fmt(overdueAmt)} OD</span>
                                    ) : (
                                        <span style={{ color: '#15803d', minWidth: 80, textAlign: 'right' }}>✓ Current</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="ar-msec">By Sales Rep</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Object.entries(repTotals).sort((a, b) => b[1] - a[1]).map((entry, i) => (
                            <div key={entry[0]} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                                <span style={{ width: 24, fontWeight: 700, color: '#718096' }}>{i + 1}</span>
                                <span style={{ flex: 1, fontWeight: 600 }}>{entry[0]}</span>
                                <span style={{ color: '#6d28d9', fontWeight: 700, minWidth: 80, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(entry[1])}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TotalOverdueModal({ data, onClose }) {
    if (!data) return null;

    const overdueRecords = (data.records || []).filter(r => {
        if (!r.due_date || r.open_balance <= 0) return false;
        return calcAgeDays(r.due_date) > 0;
    }).sort((a, b) => {
        return calcAgeDays(b.due_date) - calcAgeDays(a.due_date);
    });

    const totalOverdue = overdueRecords.reduce((s, r) => s + r.open_balance, 0);

    const getAgeDays = (dueDate) => {
        return calcAgeDays(dueDate);
    };

    const getAgeColor = (days) => {
        if (days > 90) return '#b91c1c';
        if (days > 60) return '#c2410c';
        return '#ea580c';
    };

    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">⚠️</div>
                    <div>
                        <div className="ar-modal-title">Overdue Analysis</div>
                        <div className="ar-modal-sub">Past-due items</div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
                        <div className="ar-mstat" style={{ borderLeftColor: '#b91c1c' }}>
                            <div className="ar-mstat-label">Total Overdue</div>
                            <div className="ar-mstat-val" style={{ color: '#b91c1c' }}>{fmt(totalOverdue)}</div>
                            <div className="ar-mstat-sub">{overdueRecords.length} items</div>
                        </div>
                    </div>

                    <div className="ar-msec">Overdue Items</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {overdueRecords.slice(0, 20).map((r, i) => {
                            const days = getAgeDays(r.due_date);
                            const col = getAgeColor(days);
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderLeft: `3px solid ${col}`, borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                                    <span style={{ width: 70, fontWeight: 800, color: col }}>{dayText(days)}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{r.end_user || r.customer} <span style={{ color: '#718096', fontSize: 11 }}>· {r.document_number}</span></span>
                                    <span style={{ color: col, fontWeight: 700, minWidth: 100, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.open_balance)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Critical91Modal({ data, onClose }) {
    if (!data) return null;

    const critical91Records = (data.records || []).filter(r => {
        if (!r.due_date || r.open_balance <= 0) return false;
        return calcAgeDays(r.due_date) > 90;
    }).sort((a, b) => {
        return calcAgeDays(b.due_date) - calcAgeDays(a.due_date);
    });

    const criticalTotal = critical91Records.reduce((s, r) => s + r.open_balance, 0);

    const getAgeDays = (dueDate) => {
        return calcAgeDays(dueDate);
    };

    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">🔴</div>
                    <div>
                        <div className="ar-modal-title">91+ Days Critical</div>
                        <div className="ar-modal-sub">Immediate escalation needed</div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
                        <div className="ar-mstat" style={{ borderLeftColor: '#b91c1c' }}>
                            <div className="ar-mstat-label">91+ Day AR</div>
                            <div className="ar-mstat-val" style={{ color: '#b91c1c' }}>{fmt(criticalTotal)}</div>
                            <div className="ar-mstat-sub">{critical91Records.length} items</div>
                        </div>
                    </div>

                    <div className="ar-msec">91+ Day Items</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {critical91Records.map((r, i) => {
                            const days = getAgeDays(r.due_date);
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderLeft: '4px solid #b91c1c', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                                    <span style={{ width: 70, fontWeight: 800, color: '#b91c1c' }}>{dayText(days)}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{r.end_user || r.customer} <span style={{ color: '#718096', fontSize: 11 }}>· {r.document_number}</span></span>
                                    <span style={{ color: '#b91c1c', fontWeight: 700, minWidth: 100, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.open_balance)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CurrentNotDueModal({ data, onClose }) {
    if (!data) return null;

    const currentRecords = (data.records || []).filter(r => {
        if (!r.due_date || r.open_balance <= 0) return false;
        return calcAgeDays(r.due_date) <= 0;
    }).sort((a, b) => {
        return calcAgeDays(a.due_date) - calcAgeDays(b.due_date);
    });

    const currentTotal = currentRecords.reduce((s, r) => s + r.open_balance, 0);

    const getDaysUntilDue = (dueDate) => {
        return Math.abs(calcAgeDays(dueDate));
    };

    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">✓</div>
                    <div>
                        <div className="ar-modal-title">Current</div>
                        <div className="ar-modal-sub">Within terms — not yet due</div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
                        <div className="ar-mstat" style={{ borderLeftColor: '#15803d' }}>
                            <div className="ar-mstat-label">Current AR</div>
                            <div className="ar-mstat-val" style={{ color: '#15803d' }}>{fmt(currentTotal)}</div>
                            <div className="ar-mstat-sub">{currentRecords.length} not yet due</div>
                        </div>
                    </div>

                    <div className="ar-msec">Not Yet Due</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {currentRecords.map((r, i) => {
                            const daysUntil = getDaysUntilDue(r.due_date);
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderLeft: '3px solid #15803d', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>
                                    <span style={{ width: 70, fontWeight: 800, color: '#15803d' }}>{dayText(daysUntil)}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{r.end_user || r.customer} <span style={{ color: '#718096', fontSize: 11 }}>· {r.document_number}</span></span>
                                    <span style={{ color: '#15803d', fontWeight: 700, minWidth: 100, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.open_balance)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RegionsModal({ data, onClose }) {
    const bucketLabels = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '91+ Days'];
    const bucketKeys = ['Not Due', '0-30', '31-60', '61-90', '91+'];
    const bucketColors = ['#1e5fa8', '#2563eb', '#ea580c', '#c2410c', '#b91c1c'];

    if (!data) return null;

    const regionTotals = Object.entries(data.region_buckets || {}).map(([region, rb]) => ({
        region,
        total: rb.total,
        customers: rb.customers,
        buckets: rb.buckets
    })).sort((a, b) => b.total - a.total);

    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal" style={{ maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">🌐</div>
                    <div>
                        <div className="ar-modal-title">Region-wise AR Aging</div>
                        <div className="ar-modal-sub">Aging breakdown by region</div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
                        <div className="ar-mstat" style={{ borderLeftColor: '#1877f2' }}>
                            <div className="ar-mstat-label">Total Regions</div>
                            <div className="ar-mstat-val" style={{ color: '#1877f2' }}>{regionTotals.length}</div>
                            <div className="ar-mstat-sub">{(data.customer_summary || []).length} customers total</div>
                        </div>
                    </div>

                    {regionTotals.map(({ region, total, customers, buckets }) => (
                        <div key={region}>
                            <div className="ar-msec" style={{ marginTop: 16 }}>{region} — {fmt(total)}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
                                {bucketKeys.map((b, i) => (
                                    <div key={b} style={{
                                        textAlign: 'center',
                                        padding: 8,
                                        background: '#fafcff',
                                        borderRadius: 6
                                    }}>
                                        <div style={{ fontSize: 10, color: '#718096', fontWeight: 600, marginBottom: 2 }}>
                                            {bucketLabels[i]}
                                        </div>
                                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: bucketColors[i] }}>
                                            {fmt(buckets[b]?.amount || 0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CustomerModal({ customer, onClose }) {
    const bucketOrder = ['Not Due', '0-30', '31-60', '61-90', '91+'];
    if (!customer) return null;
    return (
        <div className="ar-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ar-modal">
                <div className="ar-modal-hdr">
                    <div className="ar-modal-icon">🏢</div>
                    <div>
                        <div className="ar-modal-title">{customer.customer}</div>
                        <div className="ar-modal-sub">
                            {customer.region} · {customer.sales_rep} · {customer.invoice_count} invoice{customer.invoice_count !== 1 ? 's' : ''}
                        </div>
                    </div>
                    <button className="ar-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="ar-modal-body">
                    <div className="ar-modal-stats">
                        <div className="ar-mstat" style={{ borderLeftColor: '#1e5fa8' }}>
                            <div className="ar-mstat-label">Open AR</div>
                            <div className="ar-mstat-val">{fmt(customer.open_ar)}</div>
                            <div className="ar-mstat-sub">{customer.invoice_count} open invoices</div>
                        </div>
                        <div className="ar-mstat" style={{ borderLeftColor: '#b91c1c' }}>
                            <div className="ar-mstat-label">Overdue</div>
                            <div className="ar-mstat-val" style={{ color: customer.overdue > 0 ? '#b91c1c' : undefined }}>
                                {fmt(customer.overdue)}
                            </div>
                            <div className="ar-mstat-sub">Past due balance</div>
                        </div>
                        <div className="ar-mstat" style={{ borderLeftColor: '#6d28d9' }}>
                            <div className="ar-mstat-label">Region</div>
                            <div className="ar-mstat-val" style={{ fontSize: 16 }}>{customer.region}</div>
                            <div className="ar-mstat-sub">{customer.sales_rep}</div>
                        </div>
                    </div>
                    <div className="ar-msec">Aging bucket breakdown</div>
                    <div className="ar-mrow-list">
                        {bucketOrder.map((b) => {
                            const amt = customer.buckets?.[b] || 0;
                            const total = customer.open_ar || 1;
                            const pct = Math.round(amt / total * 100);
                            return (
                                <div className="ar-mrow" key={b}>
                                    <span className={`ar-badge ${bucketBadge(b)}`}>{agingBucketLabel(b)}</span>
                                    <span className="ar-mrow-name">{agingBucketLabel(b)}</span>
                                    <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: '#3b82c4', borderRadius: 2 }} />
                                    </div>
                                    <span className="ar-mrow-val">{fmt(amt)}</span>
                                    <span style={{ fontSize: 10, color: '#718096', width: 32, textAlign: 'right' }}>{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgingView({ data: sourceData, asOf }) {
    const data = useMemo(() => buildAgingFromRecords(sourceData), [sourceData]);
    const kpi = data.kpis;
    const [showAlert, setShowAlert] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [modalCustomer, setModalCustomer] = useState(null);
    const [showBilledARModal, setShowBilledARModal] = useState(false);
    const [showOverdueModal, setShowOverdueModal] = useState(false);
    const [show91Modal, setShow91Modal] = useState(false);
    const [showCurrentModal, setShowCurrentModal] = useState(false);
    const [showRegionsModal, setShowRegionsModal] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('open_ar');
    const [sortAsc, setSortAsc] = useState(false);

    const bucketOrder = ['Not Due', '0-30', '31-60', '61-90', '91+'];
    const bucketColors = ['#15803d', '#1e5fa8', '#c2410c', '#b91c1c', '#991b1b'];

    const regionEntries = Object.entries(data.region_buckets || {})
        .sort((a, b) => Number(b[1]?.total || 0) - Number(a[1]?.total || 0));

    const customerSummary = useMemo(() => {
        let rows = data.customer_summary || [];
        if (selectedCustomer) rows = rows.filter((r) => r.customer === selectedCustomer);
        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter((r) =>
                r.customer.toLowerCase().includes(q) ||
                r.sales_rep.toLowerCase().includes(q) ||
                r.region.toLowerCase().includes(q)
            );
        }
        return [...rows].sort((a, b) => {
            const av = sortKey === 'open_ar' ? a.open_ar : sortKey === 'overdue' ? a.overdue : a.invoice_count;
            const bv = sortKey === 'open_ar' ? b.open_ar : sortKey === 'overdue' ? b.overdue : b.invoice_count;
            return sortAsc ? av - bv : bv - av;
        });
    }, [data.customer_summary, selectedCustomer, search, sortKey, sortAsc]);

    function toggleSort(key) {
        if (sortKey === key) setSortAsc((v) => !v);
        else { setSortKey(key); setSortAsc(false); }
    }

    const overdueAlerts = useMemo(() => data.overdue_alerts || [], [data.overdue_alerts]);
    const overdueCustomers = useMemo(
        () => [...new Map(overdueAlerts.map((a) => [a.customer, a])).values()],
        [overdueAlerts]
    );
    const selectedCustomerDetail = useMemo(() => {
        if (!selectedCustomer) return null;
        const customer = (data.customer_summary || []).find((c) => c.customer === selectedCustomer);
        if (!customer) return null;

        const records = (data.records || [])
            .filter((r) => (r.customer || r.legal_customer) === selectedCustomer)
            .map((record) => {
                const age = calcAgeDays(record.due_date);
                return { ...record, age };
            })
            .sort((a, b) => b.age - a.age);

        return {
            customer,
            records,
            overdue: (customer.buckets?.['0-30'] || 0) + (customer.buckets?.['31-60'] || 0) + (customer.buckets?.['61-90'] || 0) + (customer.buckets?.['91+'] || 0),
            maxAge: Math.max(...records.map((r) => r.age), 0),
            agingChart: [
                { label: 'Current', value: customer.buckets?.['Not Due'] || 0 },
                { label: '1-30 Days', value: customer.buckets?.['0-30'] || 0 },
                { label: '31-60 Days', value: customer.buckets?.['31-60'] || 0 },
                { label: '61-90 Days', value: customer.buckets?.['61-90'] || 0 },
                { label: '91+ Days', value: customer.buckets?.['91+'] || 0 },
            ],
        };
    }, [data.customer_summary, data.records, selectedCustomer]);

    function selectCustomer(customer) {
        setSelectedCustomer(customer);
        setSearch('');
    }

    function ageColor(age, amount) {
        if (amount <= 0 || age <= 0) return '#15803d';
        if (age > 90) return '#b91c1c';
        if (age > 60) return '#c2410c';
        return '#ea580c';
    }

    return (
        <>
            <div className="ar-kpi-grid">
                <div onClick={() => setShowBilledARModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <KCard variant={1} label="Billed AR O/S" value={fmt(kpi.total_ar)} sub={`${data.records.length} line items`} ico="💰" />
                </div>
                <div onClick={() => setShowOverdueModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <KCard variant={2} label="Total Overdue" value={fmt(kpi.overdue)} sub={`${Math.round(kpi.overdue_percent || 0)}% of AR`} ico="⚠" />
                </div>
                <div onClick={() => setShow91Modal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <KCard variant={3} label="91+ Days" value={fmt(kpi.critical_91_plus)} sub="Critical bucket" ico="🔴" />
                </div>
                <div onClick={() => setShowCurrentModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <KCard variant={4} label="Current (Not Due)" value={fmt(kpi.not_due)} sub="Within terms" ico="✓" />
                </div>
                <div onClick={() => setShowRegionsModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <KCard variant={5} label="Regions" value={kpi.regions} sub={Object.keys(data.region_buckets || {}).join(' · ')} ico="🌐" />
                </div>
            </div>

            {regionEntries.length > 0 && (
                <div className="ar-region-grid">
                    {regionEntries.map(([region, rb]) => {
                        const regionColor = REGION_COLORS[region] || '#64748b';
                        return (
                            <DevOverlay key={region} name={`Aging Section: Region ${region}`}>
                            <div className="ar-region-card" style={{ borderTop: `3px solid ${regionColor}` }}>
                                <div className="ar-region-hd">
                                    <span className={`ar-badge ${regionTag(region)}`}>{region}</span>
                                    <span className="ar-region-customers">{rb.customers} customers</span>
                                    <span className="ar-region-total" style={{ color: regionColor }}>{fmt(rb.total)}</span>
                                </div>
                                {bucketOrder.map((b, bi) => (
                                    <div className="ar-region-row" key={b}>
                                        <span className="ar-region-rlbl">{agingBucketLabel(b)}</span>
                                        <span className="ar-region-rval" style={{ color: bucketColors[bi] }}>
                                            {fmt(rb.buckets[b]?.amount || 0)}
                                        </span>
                                        <span className="ar-region-rcust">{rb.buckets[b]?.count || 0} cust</span>
                                    </div>
                                ))}
                            </div>
                            </DevOverlay>
                        );
                    })}
                </div>
            )}

            {data.bucket_percents && (
                <div className="ar-bucket-strip">
                    {data.bucket_percents.map((b, i) => {
                        const cls = ['ar-bucket-notdue','ar-bucket-d30','ar-bucket-d60','ar-bucket-d90','ar-bucket-d91'][i];
                        return (
                            <DevOverlay key={b.label} name={`Aging Section: Bucket ${agingBucketLabel(b.label)}`}>
                            <div className="ar-bucket-card">
                                <div className="ar-bucket-lbl">{agingBucketLabel(b.label)}</div>
                                <div className={`ar-bucket-val ${cls}`}>{fmt(b.value)}</div>
                                <div className="ar-bucket-pct">{b.pct}%</div>
                            </div>
                            </DevOverlay>
                        );
                    })}
                </div>
            )}

            <div className="ar-chart-grid">
                <ARBarChart title="AR O/S by Region" sub="Outstanding balance by region" items={data.by_region} colors={['#1e5fa8', '#6d28d9']} />
                <ARBarChart
                    title="AR O/S by Sales Rep"
                    sub="Per-rep open balance"
                    items={data.by_sales_rep}
                    colors={['#1e5fa8', '#3b82c4', '#6d28d9', '#15803d', '#ea580c', '#0f766e']}
                    showLegend={false}
                />
            </div>

            {overdueCustomers.length > 0 && (
                <DevOverlay name="Aging Section: Overdue Alert">
                <div className="ar-alert-banner">
                    <div className="ar-alert-hd" onClick={() => setShowAlert((v) => !v)}>
                        <div className="ar-alert-hd-left">
                            <span className="ar-alert-icon">⚠️</span>
                            <span className="ar-alert-title">Overdue Alert — Immediate Action Required</span>
                            <span className="ar-alert-count">{overdueCustomers.length} customers · {fmt(overdueAlerts.reduce((s, a) => s + a.open_balance, 0))}</span>
                        </div>
                        <span className="ar-alert-toggle">{showAlert ? 'Hide ⇧' : 'Show ⇩'}</span>
                    </div>
                    {showAlert && (
                        <div className="ar-alert-body">
                            {overdueAlerts.map((a, i) => (
                                <div className="ar-alert-item" key={i}>
                                    <div className="ar-alert-item-name">{a.customer}</div>
                                    <div className="ar-alert-item-rep">{a.sales_rep}</div>
                                    <div className="ar-alert-item-row">
                                        <span className="ar-alert-item-bal">{fmtFull(a.open_balance)}</span>
                                        <span className={`ar-badge ${bucketBadge(a.bucket)}`}>{agingBucketLabel(a.bucket)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </DevOverlay>
            )}

            <div className="ar-csel-bar">
                <div>
                    <div className="ar-csel-lbl">Select Customer</div>
                    <span className="ar-csel-hint">Drill into detail</span>
                </div>
                <div className="ar-csel-wrap">
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                        <option value="">— All Customers ({data.customer_summary?.length || 0}) —</option>
                        {(data.customer_summary || []).map((c) => (
                            <option key={c.customer} value={c.customer}>{c.customer}</option>
                        ))}
                    </select>
                </div>
                {selectedCustomer && (
                    <button className="ar-csel-clr" onClick={() => setSelectedCustomer('')}>↩ Show All/Reset</button>
                )}
            </div>

            {selectedCustomer && ((() => {
                const cust = (data.customer_summary || []).find((c) => c.customer === selectedCustomer);
                if (!cust) return null;
                return (
                    <div className="ar-cbanner">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="ar-cbanner-avatar">{selectedCustomer[0]}</div>
                            <div>
                                <div className="ar-cbanner-name">{cust.customer}</div>
                                <div className="ar-cbanner-meta">{cust.region} · {cust.sales_rep} · {cust.invoice_count} invoices</div>
                            </div>
                        </div>
                        <div className="ar-cbanner-stats">
                            <div>
                                <div className="ar-cbanner-stat-val">{fmt(cust.open_ar)}</div>
                                <div className="ar-cbanner-stat-lbl">Open AR</div>
                            </div>
                            <div>
                                <div className={`ar-cbanner-stat-val ${cust.overdue > 0 ? 'red' : ''}`}>{fmt(cust.overdue)}</div>
                                <div className="ar-cbanner-stat-lbl">Overdue</div>
                            </div>
                            <div>
                                <div className="ar-cbanner-stat-val">{dayText(selectedCustomerDetail?.maxAge || 0)}</div>
                                <div className="ar-cbanner-stat-lbl">Max Days O/S</div>
                            </div>
                        </div>
                    </div>
                );
            })())}

            {selectedCustomerDetail && (
                <>
                    <div className="ar-bucket-strip">
                        {selectedCustomerDetail.agingChart.map((b, i) => {
                            const cls = ['ar-bucket-notdue','ar-bucket-d30','ar-bucket-d60','ar-bucket-d90','ar-bucket-d91'][i];
                            return (
                                <DevOverlay key={b.label} name={`Aging Section: Customer Bucket ${agingBucketLabel(b.label)}`}>
                                <div className="ar-bucket-card">
                                    <div className="ar-bucket-lbl">{agingBucketLabel(b.label)}</div>
                                    <div className={`ar-bucket-val ${cls}`}>{fmt(b.value)}</div>
                                </div>
                                </DevOverlay>
                            );
                        })}
                    </div>

                    <div className="ar-sh">
                        <h3>Detail — {selectedCustomer}</h3>
                        <span className="ar-sh-tag">{selectedCustomerDetail.records.length} records</span>
                    </div>
                    <DevOverlay name="Aging Section: Customer Detail Table">
                    <div className="ar-tcard">
                        <div className="ar-twrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Type</th>
                                        <th>Document</th>
                                        <th>Date</th>
                                        <th>Due Date</th>
                                        <th>Age</th>
                                        <th className="num">Open Balance</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedCustomerDetail.records.map((record, i) => {
                                        const color = ageColor(record.age, record.open_balance);
                                        const overdue = record.age > 0 && record.open_balance > 0;
                                        return (
                                            <tr key={`${record.document_number}-${i}`} style={{ background: record.age > 90 && record.open_balance > 0 ? '#fff8f8' : record.age > 30 && record.open_balance > 0 ? '#fffaf5' : undefined }}>
                                                <td style={{ color: '#718096', fontSize: 12 }}>{i + 1}</td>
                                                <td><span className="ar-badge ar-b-d1">Invoice</span></td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{record.document_number}</td>
                                                <td style={{ fontSize: 12 }}>{record.document_date || '-'}</td>
                                                <td style={{ fontSize: 12, color: overdue ? '#b91c1c' : undefined, fontWeight: overdue ? 600 : undefined }}>{record.due_date || '-'}</td>
                                                <td>{record.age <= 0 ? <span style={{ color: '#15803d', fontSize: 12, fontWeight: 600 }}>Not due</span> : <span style={{ color, fontWeight: 700, fontSize: 12 }}>{dayText(record.age)}</span>}</td>
                                                <td className="num" style={{ fontWeight: 700, color: record.open_balance < 0 ? '#15803d' : undefined }}>{fmtFull(record.open_balance)}</td>
                                                <td><span className={`ar-badge ${overdue ? 'ar-b-late' : 'ar-b-ontime'}`}>{overdue ? 'Overdue' : 'Current'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={6} style={{ fontWeight: 700 }}>NET TOTAL</td>
                                        <td className="num">{fmtFull(selectedCustomerDetail.customer.open_ar)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    </DevOverlay>

                    <div className="ar-chart-grid" style={{ marginTop: 16 }}>
                        <ARBarChart
                            title={`Aging — ${selectedCustomer}`}
                            items={selectedCustomerDetail.agingChart}
                            colors={['#1e5fa8', '#2563eb', '#ea580c', '#c2410c', '#b91c1c']}
                            showLegend={false}
                        />
                        <DevOverlay name="Aging Section: Account Summary">
                        <div className="ar-panel ar-account-summary">
                            <h4>Account Summary</h4>
                            <div className="ar-account-list">
                                <div className="ar-account-row blue"><span>Net AR O/S</span><strong>{fmtFull(selectedCustomerDetail.customer.open_ar)}</strong></div>
                                <div className={`ar-account-row ${selectedCustomerDetail.overdue > 0 ? 'red' : 'green'}`}><span>Total Overdue</span><strong>{fmtFull(selectedCustomerDetail.overdue)}</strong></div>
                                <div className="ar-account-row"><span>Region</span><span className={`ar-badge ${regionTag(selectedCustomerDetail.customer.region)}`}>{selectedCustomerDetail.customer.region}</span></div>
                                <div className="ar-account-row"><span>Sales Rep</span><strong>{selectedCustomerDetail.customer.sales_rep}</strong></div>
                            </div>
                        </div>
                        </DevOverlay>
                    </div>
                </>
            )}

            {!selectedCustomerDetail && (
                <DevOverlay name="Aging Section: Customer Summary Table">
                <div className="ar-tcard">
                <div className="ar-tcard-hd">
                    <span className="ar-tcard-title">
                        Customer — AR Summary
                        {selectedCustomer
                            ? <span style={{ fontWeight: 400, marginLeft: 8 }}>filtered</span>
                            : <span style={{ fontWeight: 400, marginLeft: 8 }}>{data.customer_summary?.length || 0} customers</span>
                        }
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                            className="ar-search-input" style={{ width: 220 }}
                            placeholder="🔍 Search by customer, rep or region..."
                            value={search} onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && <button className="ar-search-clear" onClick={() => setSearch('')}>Clear</button>}
                        <span className="ar-result-count">{customerSummary.length} results</span>
                    </div>
                </div>
                <div className="ar-twrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Region</th>
                                <th>Sales Rep</th>
                                <th className="num" style={{ cursor: 'pointer' }} onClick={() => toggleSort('open_ar')}>
                                    Total AR {sortKey === 'open_ar' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="num">Current</th>
                                <th className="num">1-30 Days</th>
                                <th className="num">31-60 Days</th>
                                <th className="num">61-90 Days</th>
                                <th className="num">91+ Days</th>
                                <th className="num" onClick={() => toggleSort('invoice_count')} style={{ cursor: 'pointer' }}>
                                    Inv {sortKey === 'invoice_count' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerSummary.map((row) => (
                                <tr key={row.customer}>
                                    <td style={{ fontWeight: 700 }}>{row.customer}</td>
                                    <td><span className={`ar-badge ${regionTag(row.region)}`}>{row.region}</span></td>
                                    <td>{row.sales_rep}</td>
                                    <td className="num">{fmt(row.open_ar)}</td>
                                    <td className="num">{fmt(row.buckets?.['Not Due'] || 0)}</td>
                                    <td className="num">{fmt(row.buckets?.['0-30'] || 0)}</td>
                                    <td className="num">{fmt(row.buckets?.['31-60'] || 0)}</td>
                                    <td className="num">{fmt(row.buckets?.['61-90'] || 0)}</td>
                                    <td className="num" style={{ color: row.buckets?.['91+'] > 0 ? '#b91c1c' : undefined, fontWeight: row.buckets?.['91+'] > 0 ? 800 : undefined }}>
                                        {fmt(row.buckets?.['91+'] || 0)}
                                    </td>
                                    <td className="num">{row.invoice_count}</td>
                                    <td>
                                        <button
                                            onClick={() => selectCustomer(row.customer)}
                                            style={{ background: '#eef4ff', color: '#1e5fa8', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                        >View →</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} style={{ fontWeight: 700 }}>TOTAL</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + r.open_ar, 0))}</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + (r.buckets?.['Not Due'] || 0), 0))}</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + (r.buckets?.['0-30'] || 0), 0))}</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + (r.buckets?.['31-60'] || 0), 0))}</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + (r.buckets?.['61-90'] || 0), 0))}</td>
                                <td className="num">{fmt(customerSummary.reduce((s, r) => s + (r.buckets?.['91+'] || 0), 0))}</td>
                                <td className="num">{customerSummary.reduce((s, r) => s + r.invoice_count, 0)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                </div>
                </DevOverlay>
            )}

            {modalCustomer && <CustomerModal customer={modalCustomer} onClose={() => setModalCustomer(null)} />}
            {showBilledARModal && <BilledARModal data={data} onClose={() => setShowBilledARModal(false)} />}
            {showOverdueModal && <TotalOverdueModal data={data} onClose={() => setShowOverdueModal(false)} />}
            {show91Modal && <Critical91Modal data={data} onClose={() => setShow91Modal(false)} />}
            {showCurrentModal && <CurrentNotDueModal data={data} onClose={() => setShowCurrentModal(false)} />}
            {showRegionsModal && <RegionsModal data={data} onClose={() => setShowRegionsModal(false)} />}
        </>
    );
}

export { AgingView };
export default AgingView;
