import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './dashShared.css';
import './ARR_Main.css';

import { ArrDashTab }       from './ARR_Elements/ARRDashboard';
import { BuAnalyticsTab }   from './ARR_Elements/BUAnalytics';
import { IntelligenceTab }  from './ARR_Elements/Intelligence';
import { QuotaTab }         from './ARR_Elements/QuotaVsAOP';
import { Customer360Tab }   from './ARR_Elements/Customer360';
import { Rep360Tab }        from './ARR_Elements/Rep360';
import { BookingMasterTab } from './ARR_Elements/ManageArrData';
import { DevOverlay }       from '../components/DevOverlay/DevOverlay';
import { DashboardLoader }  from '../components/DashboardLoader/DashboardLoader';
import { DashboardAIChat }  from '../components/DashboardAIChat/DashboardAIChat';
import { API_URL } from '../config/api';

const TABS = [
  { id: 'arr',      label: 'ARR Dashboard', dot: '#1877f2', component: 'ARRDashboard' },
  { id: 'bu',       label: 'BU Analytics',  dot: '#7c3aed', component: 'BuAnalyticsTab' },
  { id: 'intel',    label: 'Intelligence',  dot: '#0891b2', component: 'IntelligenceTab' },
  { id: 'quota',    label: 'Quota vs AOP',  dot: '#d97706', component: 'QuotaTab' },
  { id: 'c360',     label: 'Customer 360',  dot: '#059669', component: 'Customer360Tab' },
  { id: 'rep360',   label: 'Rep 360',       dot: '#0d9488', component: 'Rep360Tab' },
  { id: 'bookings', label: 'Manage Data',   dot: '#dc2626', component: 'BookingMasterTab' },
];

const FILTER_DEFS = [
  ['business_unit', 'Business Unit', 'All BUs'],
  ['sales_person', 'Sales Rep', 'All Sales Reps'],
  ['sub_product_type', 'Sub-Product', 'All Sub-Products'],
  ['line_of_business', 'LOB', 'All LOBs'],
];

function Dashboard() {
  const [data,      setData]      = useState(null);
  const [tab,       setTab]       = useState('arr');
  const [filters,   setFilters]   = useState({});
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState('');
  const fileRef = useRef(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/dashboard/${query ? `?${query}` : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Dashboard API unavailable. Check Django is running on port 8000.');
      setData(await res.json());
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_URL}/api/import/`, { method: 'POST', body: fd, credentials: 'include' });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'Import failed.');
      setFilters({});
      setMsg(r.message);
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setUploading(false);
    }
  };

  const fo = data?.filters || {};
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="dash-shell">

      {/* ── Sub-navigation ── */}
      <DevOverlay name="TabNavigation">
        <div className="dash-subnav">
          <div className="dash-tabs">
            {TABS.map(t => (
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
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} style={{ display: 'none' }} />
          </div>
        </div>
      </DevOverlay>

      {/* ── Filter bar ── */}
      {data?.has_data && (
        <DevOverlay name="FilterBar">
          <div className="dash-filterbar">
            <div className="dash-fb-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filters
            </div>
            <div className="dash-fb-divider" />
            {FILTER_DEFS.map(([k, l, allLabel]) => (
              <label key={k} className="dash-filter-group">
                <span className="dash-filter-label">{l}</span>
                <select
                  className="dash-filter-select"
                  value={filters[k] || ''}
                  onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                >
                  <option value="">{allLabel}</option>
                  {(fo[k] || []).map(v => <option key={v}>{v}</option>)}
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
      )}

      {/* ── Messages ── */}
      {msg && <div className="dash-notice">{msg}</div>}

      {/* ── Loading ── */}
      {loading && (
        <div className="dash-loading">
          <DashboardLoader label="Preparing ARR dashboard..." />
          Loading ARR data…
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && data && !data.has_data && (
        <div className="dash-empty">
          <div className="dash-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h2>ARR Dashboard ready</h2>
          <p>{data.message || 'Upload your Booking Database Excel file to get started.'}</p>
          <button className="dash-empty-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? 'Importing…' : 'Upload Booking Database'}
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && data?.has_data && (
        <div className="dash-content arr-shell">
          {tab === 'arr' && (
            <DevOverlay name="ARRDashboard">
              <ArrDashTab data={data} />
            </DevOverlay>
          )}
          {tab === 'bu' && (
            <DevOverlay name="BUAnalytics">
              <BuAnalyticsTab data={data} />
            </DevOverlay>
          )}
          {tab === 'intel' && (
            <DevOverlay name="Intelligence">
              <IntelligenceTab data={data} />
            </DevOverlay>
          )}
          {tab === 'quota' && (
            <DevOverlay name="QuotaVsAOP">
              <QuotaTab data={data} />
            </DevOverlay>
          )}
          {tab === 'c360' && (
            <DevOverlay name="Customer360">
              <Customer360Tab data={data} />
            </DevOverlay>
          )}
          {tab === 'rep360' && (
            <DevOverlay name="Rep360">
              <Rep360Tab data={data} />
            </DevOverlay>
          )}
          {tab === 'bookings' && (
            <DevOverlay name="ManageData">
              <BookingMasterTab data={data} onSuccess={load} />
            </DevOverlay>
          )}
        </div>
      )}
      {data?.has_data && <DashboardAIChat dashboard="arr" activeTab={tab} filters={filters} />}
    </div>
  );
}

export default Dashboard;
