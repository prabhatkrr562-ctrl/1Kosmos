import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './dashShared.css';
import './ARMain.css';

import { AgingView }         from './AR_Elements/ArAging';
import { CollectionHistory } from './AR_Elements/CollectionHistory';
import { PendingInvoice }    from './AR_Elements/PendingInvoice';
import { LiveEditor }        from './AR_Elements/LiveEditor';
import { ArMaster }          from './AR_Elements/ArMaster';
import { DevOverlay }        from '../components/DevOverlay/DevOverlay';
import { DashboardLoader }   from '../components/DashboardLoader/DashboardLoader';
import { DashboardAIChat }   from '../components/DashboardAIChat/DashboardAIChat';
import { API_URL } from '../config/api';
import { readApiJson, PERMISSION_DENIED_MESSAGE } from '../utils/apiErrors';

const TABS = [
    { id: 'aging',       label: 'AR Aging',           dot: '#1877f2', component: 'AgingView' },
    { id: 'collections', label: 'Collection Payment/History',  dot: '#15803d', component: 'CollectionHistory' },
    { id: 'renewals',    label: 'Pending for Invoice',     dot: '#c2410c', component: 'PendingInvoice' },
    { id: 'editor',      label: 'Data Editor',         dot: '#6d28d9', component: 'LiveEditor' },
    { id: 'ar_master',   label: 'AR Master',           dot: '#7c3aed', component: 'ArMaster' },
];

const FILTER_KEYS = [['region', 'Region'], ['sales_rep', 'Sales Rep'], ['customer', 'Customer']];

const DATE_TYPE_LABELS = { inv: 'Invoice Date', pay: 'Payment Date', due: 'Due Date' };
const DATE_PRESETS = [
    ['Q1 2026', '2026-01-01', '2026-03-31'],
    ['Q2 2025', '2025-04-01', '2025-06-30'],
    ['Q3 2025', '2025-07-01', '2025-09-30'],
    ['Q4 2025', '2025-10-01', '2025-12-31'],
    ['FY 2025', '2025-04-01', '2026-03-31'],
    ['FY 2026', '2026-01-01', '2026-12-31'],
];

function ARDashboard({ user }) {
    const [data,      setData]      = useState(null);
    const [tab,       setTab]       = useState('aging');
    const [filters,   setFilters]   = useState({});
    const [dateType,  setDateType]  = useState('inv');
    const [loading,   setLoading]   = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message,   setMessage]   = useState('');
    const fileRef = useRef(null);
    const canManageData = user?.isSuperuser || user?.access?.includes('data_manager');

    const query = useMemo(() => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
        if (filters.date_from || filters.date_to) params.set('date_type', dateType);
        return params.toString();
    }, [filters, dateType]);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/ar/dashboard/${query ? `?${query}` : ''}`, { credentials: 'include' });
            setData(await readApiJson(res, 'The AR dashboard API could not be loaded.'));
        } catch (err) {
            setMessage(err.message === PERMISSION_DENIED_MESSAGE ? err.message : `${err.message} Check that Django is running on port 8000.`);
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const uploadFile = async (file, mode = 'replace', table = null) => {
        if (!file || !canManageData) return;
        setUploading(true); setMessage('');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('mode', mode);
        if (table) fd.append('table', table);
        try {
            const res = await fetch(`${API_URL}/api/ar/import/`, { method: 'POST', body: fd, credentials: 'include' });
            const result = await readApiJson(res, 'AR import failed.');
            if (mode === 'replace') setFilters({});
            setMessage(result.message);
            await loadDashboard();
        } catch (err) {
            setMessage(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) uploadFile(f);
    };

    const showFilters = tab !== 'editor';
    const hasFilters  = Object.values(filters).some(Boolean);

    const dateFilter  = data?.collections?.date_filter;
    const dateRanges  = dateFilter?.ranges || {};
    const activeRange = dateRanges[dateType] || {};

    const setDateRange = (from, to) =>
        setFilters((f) => ({ ...f, date_from: from, date_to: to }));

    const handleDateTypeChange = (type) => {
        setDateType(type);
        const range = dateRanges[type] || {};
        setDateRange(range.min || '', range.max || '');
    };

    return (
        <div className="dash-shell ar-dashboard">

            {/* ── Sub-navigation ── */}
            <DevOverlay name="TabNavigation">
                <div className="dash-subnav">
                    <div className="dash-tabs">
                        {TABS.filter(t => canManageData || !['editor', 'ar_master'].includes(t.id)).map(t => (
                            <button
                                key={t.id}
                                data-component={t.component}
                                className={`dash-tab${tab === t.id ? ' active' : ''}`}
                                onClick={() => setTab(t.id)}
                            >
                                <span
                                    className="dash-tab-dot"
                                    style={{ background: tab === t.id ? t.dot : 'transparent', border: `2px solid ${t.dot}` }}
                                />
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="dash-subnav-actions">
                        {/* <button
                            className={`dash-import-btn${uploading ? ' loading' : ''}`}
                            onClick={() => !uploading && fileRef.current?.click()}
                            disabled={uploading}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            {uploading ? 'Importing…' : 'Import Data'}
                        </button> */}
                        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: 'none' }} />
                    </div>
                </div>
            </DevOverlay>

            {/* ── Filter bars ── */}
            {data?.has_data && showFilters && (
                <div className="ar-sticky-filters">
                    <DevOverlay name="FilterBar">
                        <div className="dash-filterbar">
                            <div className="dash-fb-label">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                                Filters
                            </div>
                            <div className="dash-fb-divider" />
                            {FILTER_KEYS.map(([key, label]) => (
                                <label key={key} className="dash-filter-group">
                                    <span className="dash-filter-label">{label}</span>
                                    <select
                                        className="dash-filter-select"
                                        value={filters[key] || ''}
                                        onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                                    >
                                        <option value="">All</option>
                                        {(data.filters[key] || []).map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                </label>
                            ))}
                            {hasFilters && (
                                <button className="dash-filter-reset" onClick={() => setFilters({})}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Clear all
                                </button>
                            )}
                        </div>
                    </DevOverlay>

                    {/* ── Collection date filter bar ── */}
                    {tab === 'collections' && dateFilter && (
                        <DevOverlay name="DateFilterBar">
                            <div className="ar-datebar">
                                <span className="ar-datebar-lbl">📅 Filter by Date:</span>
                                <select
                                    className="ar-datebar-sel"
                                    value={dateType}
                                    onChange={(e) => handleDateTypeChange(e.target.value)}
                                >
                                    {Object.entries(DATE_TYPE_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <span className="ar-datebar-lbl">From</span>
                                <input
                                    type="date" className="ar-datebar-input"
                                    value={filters.date_from || ''}
                                    min={activeRange.min || undefined} max={activeRange.max || undefined}
                                    onChange={(e) => setDateRange(e.target.value, filters.date_to || '')}
                                />
                                <span className="ar-datebar-dash">—</span>
                                <input
                                    type="date" className="ar-datebar-input"
                                    value={filters.date_to || ''}
                                    min={activeRange.min || undefined} max={activeRange.max || undefined}
                                    onChange={(e) => setDateRange(filters.date_from || '', e.target.value)}
                                />
                                <div className="ar-datebar-div" />
                                <span className="ar-datebar-lbl">Quick:</span>
                                {DATE_PRESETS.map(([label, from, to]) => (
                                    <button key={label} className="ar-datebar-btn" onClick={() => setDateRange(from, to)}>
                                        {label}
                                    </button>
                                ))}
                                <div className="ar-datebar-div" />
                                <button className="ar-datebar-btn" onClick={() => setDateRange('', '')}>↩ Clear</button>
                                <span className="ar-datebar-badge">
                                    {dateFilter.filtered_invoices} / {dateFilter.total_invoices} invoices
                                    {' · '}{DATE_TYPE_LABELS[dateType]}: {filters.date_from || '—'} → {filters.date_to || '—'}
                                </span>
                            </div>
                        </DevOverlay>
                    )}
                </div>
            )}

            {/* ── Messages ── */}
            {message && <div className="dash-notice">{message}</div>}

            {/* ── Loading ── */}
            {loading && (
                <div className="dash-loading">
                    <DashboardLoader label="Preparing AR dashboard..." />
                    Calculating receivables…
                </div>
            )}

            {/* ── Empty state ── */}
            {!loading && data && !data.has_data && (
                <div className="dash-empty">
                    <div className="dash-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </div>
                    <h2>AR Dashboard Ready</h2>
                    <p>{canManageData ? (data.message || 'Upload your AR Master Sheet to get started.') : 'No AR data has been loaded. Please contact a Data Manager.'}</p>
                    {canManageData && <button className="dash-empty-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        {uploading ? 'Importing…' : 'Upload AR Master Sheet'}
                    </button>}
                </div>
            )}

            {/* ── Content ── */}
            {!loading && data?.has_data && (
                <div className="dash-content">
                    {tab === 'aging' && (
                        <DevOverlay name="AgingView">
                            <AgingView data={data.aging} asOf={data.import.as_of_date} />
                        </DevOverlay>
                    )}
                    {tab === 'collections' && (
                        <DevOverlay name="CollectionHistory">
                            <CollectionHistory data={data.collections} />
                        </DevOverlay>
                    )}
                    {tab === 'renewals' && (
                        <DevOverlay name="PendingInvoice">
                            <PendingInvoice data={data.renewals} />
                        </DevOverlay>
                    )}
                    {canManageData && tab === 'editor' && (
                        <DevOverlay name="LiveEditor">
                            <LiveEditor onApply={loadDashboard} canManageData={canManageData} />
                        </DevOverlay>
                    )}
                    {canManageData && tab === 'ar_master' && (
                        <DevOverlay name="ArMaster">
                            <ArMaster data={data.aging} upload={uploadFile} uploading={uploading} canManageData={canManageData} />
                        </DevOverlay>
                    )}
                </div>
            )}
            {data?.has_data && <DashboardAIChat dashboard="ar" activeTab={tab} filters={filters} />}
        </div>
    );
}

export default ARDashboard;
