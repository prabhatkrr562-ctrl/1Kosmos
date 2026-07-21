import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './dashShared.css';
import './PipelineMain.css';

import { Executive }      from './Pipeline_Elements/Executive';
import { PipelineTrend }  from './Pipeline_Elements/PipelineTrend';
import { DealMovement }   from './Pipeline_Elements/DealMovement';
import { RepKpis }        from './Pipeline_Elements/RepKpis';
import { Forecast }       from './Pipeline_Elements/Forecast';
import { Region }         from './Pipeline_Elements/Region';
import { DealExplorer }   from './Pipeline_Elements/DealExplorer';
import { PipelineMaster } from './Pipeline_Elements/PipelineMaster';
import { RepDeepDive }    from './Pipeline_Elements/RepDeepDive';
import { FPA }            from './Pipeline_Elements/FPA';
import { StageStall }     from './Pipeline_Elements/StageStall';
import { IndustryBenchmark } from './Pipeline_Elements/IndustryBenchmark';
import { Commentary }     from './Pipeline_Elements/Commentary';
import { DevOverlay }     from '../components/DevOverlay/DevOverlay';
import { DashboardLoader } from '../components/DashboardLoader/DashboardLoader';
import { DashboardAIChat } from '../components/DashboardAIChat/DashboardAIChat';
import { readApiJson } from '../utils/apiErrors';
import { API_URL } from '../config/api';

const TABS = [
  { id: 'exec',      label: '📊 Executive',                  dot: '#1877f2', component: 'Executive' },
  { id: 'trend',     label: '📈 Pipeline Trend',             dot: '#0891b2', component: 'PipelineTrend' },
  { id: 'movement',  label: '🔄 Deal Movement',              dot: '#7c3aed', component: 'DealMovement' },
  { id: 'reps',      label: '👥 Rep KPIs',                   dot: '#059669', component: 'RepKpis' },
  { id: 'repdetail', label: '🎯 Rep Deep Dive',              dot: '#0d9488', component: 'RepDeepDive' },
  { id: 'region',    label: '🌍 Region & Source',            dot: '#c2410c', component: 'Region' },
  { id: 'forecast',  label: '🔮 Forecast',                   dot: '#d97706', component: 'Forecast' },
  { id: 'fpa',       label: '💼 FP&A',                       dot: '#4f46e5', component: 'FPA' },
  { id: 'aging',     label: '⏱ Stage Stall Intelligence',    dot: '#dc2626', component: 'StageStall' },
  { id: 'benchmark', label: '📐 Industry Benchmark',         dot: '#7c3aed', component: 'IndustryBenchmark' },
  { id: 'explorer',  label: '📋 Deal Explorer',              dot: '#dc2626', component: 'DealExplorer' },
  { id: 'commentary', label: '📝 Commentary',                dot: '#0891b2', component: 'Commentary' },
  { id: 'pl_master', label: 'Pipeline Master',               dot: '#6d28d9', component: 'PipelineMaster' },
];

const EMPTY_FILTERS = {
  team: '', owner: '', stage: '', forecast: '', region: '', order_type: '',
  quarter: '', year: '',
};

const FILTER_DEFS = [
  { key: 'team', label: 'Team', empty: 'All Teams' },
  { key: 'owner', label: 'Rep', empty: 'All Reps' },
  { key: 'stage', label: 'Stage', empty: 'All Stages' },
  { key: 'forecast', label: 'Forecast', empty: 'All Forecasts' },
  { key: 'region', label: 'Region', empty: 'All Regions' },
  { key: 'order_type', label: 'Type', empty: 'All Types' },
  { key: 'quarter', label: 'Quarter', empty: 'All Quarters' },
];

const REFERENCE_OPTIONS = {
  team: [['Sales - N.A. Direct', 'NA Direct'], ['Sales - APJ Direct', 'APJ Direct']],
  owner: [
    ['Fadi Jarrar', 'Fadi Jarrar'], ['Frank Mendicino', 'Frank Mendicino'],
    ['William Easton', 'William Easton'], ['Cody Dussault', 'Cody Dussault'],
    ['Dan Ryan', 'Dan Ryan'], ['robert sokolowski', 'R. Sokolowski'],
    ['Siddharth Gandhi', 'Siddharth Gandhi'], ['Rohit Kumar', 'Rohit Kumar'],
    ['Dev Singh', 'Dev Singh'],
  ],
  stage: [
    ['5% - Prospecting', '5% Prospecting'], ['20%-Discovery', '20% Discovery'],
    ['40%-Scoping', '40% Scoping'], ['60%-Propose', '60% Propose'],
    ['80%-Validate', '80% Validate'], ['90%-Negotiate & Close', '90% Negotiate'],
    ['Business Won', 'Business Won'],
  ],
  forecast: [
    ['Commit', 'Commit'], ['Upside', 'Upside'],
    ['Not forecasted', 'Not Forecasted'], ['Closed won', 'Closed Won'],
  ],
  region: [['North America', 'North America'], ['APAC', 'APAC']],
  order_type: [
    ['New Business', 'New Business'], ['Upsell', 'Upsell'], ['Cross-Sell', 'Cross-Sell'],
  ],
};

const ALL_QUARTERS = [
  'Q1 26', 'Q2 26', 'Q3 26', 'Q4 26',
  'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q3 27+',
];

const fmtFilterMoney = value => {
  const amount = Number(value) || 0;
  if (amount === 0) return '$0';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount).toLocaleString()}`;
};

function Pipeline({ user }) {
  const [tab,       setTab]       = useState('exec');
  const [selectedRep, setSelectedRep] = useState(null);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [viewMode, setViewMode] = useState('unweighted');
  const fileRef = useRef(null);
  const canManageData = user?.isSuperuser || user?.access?.includes('data_manager');

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('view_mode', viewMode);
    fetch(`${API_URL}/api/pipeline/?${params}`, { credentials: 'include' })
      .then(r => readApiJson(r, 'Pipeline dashboard API unavailable. Check Django is running on port 8000.'))
      .then(d => { setData(d); setLoading(false); })
      .catch(error => { setImportMsg(error.message); setLoading(false); });
  }, [filters, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleImport = useCallback((file, mode = 'replace') => {
    if (!file || !canManageData) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    setImporting(true);
    setImportMsg('');
    fetch(`${API_URL}/api/pipeline/import/`, { method: 'POST', body: fd, credentials: 'include' })
      .then(r => readApiJson(r, 'Upload failed.'))
      .then(d => {
        setImportMsg(d.message || 'Done');
        setImporting(false);
        if (d.message) fetchData();
      })
      .catch(error => { setImportMsg(error.message); setImporting(false); });
  }, [canManageData, fetchData]);

  const setFilter = (key, val) => setFilters(current => {
    if (key !== 'year') return { ...current, [key]: val };
    const quarterMatchesYear = !current.quarter
      || (val === '26' && current.quarter.endsWith(' 26'))
      || (val === '27' && (current.quarter.endsWith(' 27') || current.quarter === 'Q3 27+'));
    return { ...current, year: val, quarter: !val || quarterMatchesYear ? current.quarter : '' };
  });
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const hasFilters = Object.values(filters).some(Boolean);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const openRep = useCallback((owner) => {
    setSelectedRep(owner || null);
    setTab('repdetail');
  }, []);
  const openMovement = useCallback(() => setTab('movement'), []);

  const optionsFor = useCallback(key => {
    if (key === 'quarter') {
      if (filters.year === '26') return ALL_QUARTERS.filter(value => value.endsWith(' 26'));
      if (filters.year === '27') return ALL_QUARTERS.filter(value => value.endsWith(' 27') || value === 'Q3 27+');
      return ALL_QUARTERS;
    }
    return REFERENCE_OPTIONS[key] || [];
  }, [filters.year]);
  const filterResult = useMemo(() => ({
    deals: data?.kpis?.active_deals || 0,
    amount: data?.kpis?.active_pipeline || 0,
  }), [data]);

  /* ── Loading ── */
  if (loading && !data) return (
    <div className="dash-shell">
      <div className="dash-loading">
        <DashboardLoader label="Preparing pipeline dashboard..." />
        Loading pipeline data…
      </div>
    </div>
  );

  /* ── Empty state ── */
  if (!data?.has_data) return (
    <div className="dash-shell">
      <div className="dash-empty">
        <div className="dash-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1877f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h2>Pipeline Intelligence</h2>
        <p>{canManageData ? 'No pipeline data yet. Upload your Pipeline Database Excel file to get started.' : 'No pipeline data has been loaded. Please contact a Data Manager.'}</p>
        {canManageData && <button className="dash-empty-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {importing ? 'Importing…' : 'Upload Pipeline Excel'}
        </button>}
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImport(f); }} />
        {importMsg && <p className="dash-import-msg">{importMsg}</p>}
      </div>
    </div>
  );

  return (
    <div className="dash-shell pl">

      {/* ── Sub-navigation ── */}
      <DevOverlay name="TabNavigation">
        <div className="dash-subnav">
          <div className="dash-tabs">
            {TABS.filter(t => canManageData || t.id !== 'pl_master').map(t => (
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
            {importMsg && <span className="dash-import-inline-msg">{importMsg}</span>}
            {/* <button
              className={`dash-import-btn${importing ? ' loading' : ''}`}
              onClick={() => !importing && fileRef.current?.click()}
              disabled={importing}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {importing ? 'Importing…' : 'Import Data'}
            </button> */}
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImport(f); }} />
          </div>
        </div>
      </DevOverlay>

      {/* ── Filter bar ── */}
      <DevOverlay name="FilterBar">
        <>
        <div className="dash-filterbar pipeline-filterbar" aria-busy={loading}>
          <span className="pipeline-filter-label">Filters</span>
          {FILTER_DEFS.map(({ key, label, empty }) => (
            <label key={key} className="pipeline-filter-control">
              <span className="sr-only">{label}</span>
              <select
                className="pipeline-filter-select"
                value={filters[key]}
                onChange={e => setFilter(key, e.target.value)}
                aria-label={label}
              >
                <option value="">{empty}</option>
                {optionsFor(key).map(option => {
                  const [value, text] = Array.isArray(option) ? option : [option, option];
                  return <option key={value} value={value}>{text}</option>;
                })}
              </select>
            </label>
          ))}
          <span className="pipeline-filter-label pipeline-year-label">📅 Year</span>
          <label className="pipeline-filter-control">
            <span className="sr-only">Year</span>
            <select
              className="pipeline-filter-select pipeline-year-select"
              value={filters.year}
              onChange={e => setFilter('year', e.target.value)}
              aria-label="Year"
            >
              <option value="">All Years</option>
              <option value="26">FY 2026</option>
              <option value="27">FY 2027</option>
            </select>
          </label>
          <span className="pipeline-filter-divider" />
          <span className="pipeline-filter-label pipeline-view-label">📊 View</span>
          <span className="pipeline-view-toggle" role="group" aria-label="Pipeline value view">
            {['unweighted', 'weighted'].map(mode => (
              <button
                key={mode}
                type="button"
                className={`pipeline-view-button${viewMode === mode ? ' active' : ''}`}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'unweighted' ? 'Unweighted' : 'Weighted'}
              </button>
            ))}
          </span>
          <span className="pipeline-filter-divider" />
          <button type="button" className="pipeline-filter-reset" onClick={clearFilters}>↺ Reset</button>
          {hasFilters && <span className="pipeline-filter-status">({activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active)</span>}
        </div>
        {hasFilters && (
          <div className="pipeline-filter-banner">
            <span>
              🔍 {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
              {filters.year ? ` · 📅 FY20${filters.year}` : ''}
              {' — '}{filterResult.deals} deals · {fmtFilterMoney(filterResult.amount)}
            </span>
            <button type="button" onClick={clearFilters}>✕ Clear All Filters</button>
          </div>
        )}
        </>
      </DevOverlay>

      {/* ── Content ── */}
      <div className="dash-content pl-body">
        {tab === 'exec' && (
          <DevOverlay name="Executive">
            <Executive data={data} onNavigate={setTab} />
          </DevOverlay>
        )}
        {tab === 'trend' && (
          <DevOverlay name="PipelineTrend">
            <PipelineTrend data={data} />
          </DevOverlay>
        )}
        {tab === 'movement' && (
          <DevOverlay name="DealMovement">
            <DealMovement data={data} />
          </DevOverlay>
        )}
        {tab === 'reps' && (
          <DevOverlay name="RepKPIs">
            <RepKpis data={data} onSelectRep={openRep} />
          </DevOverlay>
        )}
        {tab === 'forecast' && (
          <DevOverlay name="Forecast">
            <Forecast data={data} onSelectRep={openRep} />
          </DevOverlay>
        )}
        {tab === 'region' && (
          <DevOverlay name="Region">
            <Region data={data} />
          </DevOverlay>
        )}
        {tab === 'repdetail' && (
          <DevOverlay name="RepDeepDive">
            <RepDeepDive data={data} initialRep={selectedRep} />
          </DevOverlay>
        )}
        {tab === 'explorer' && (
          <DevOverlay name="DealExplorer">
            <DealExplorer data={data} />
          </DevOverlay>
        )}
        {tab === 'fpa' && (
          <DevOverlay name="FPA">
            <FPA data={data} onSelectRep={openRep} />
          </DevOverlay>
        )}
        {tab === 'aging' && (
          <DevOverlay name="StageStall">
            <StageStall data={data} onSelectRep={openRep} onOpenMovement={openMovement} />
          </DevOverlay>
        )}
        {tab === 'benchmark' && (
          <DevOverlay name="IndustryBenchmark">
            <IndustryBenchmark data={data} />
          </DevOverlay>
        )}
        {tab === 'commentary' && (
          <DevOverlay name="Commentary">
            <Commentary data={data} onOpenMovement={openMovement} />
          </DevOverlay>
        )}
        {canManageData && tab === 'pl_master' && (
          <DevOverlay name="PipelineMaster">
            <PipelineMaster data={data} handleImport={handleImport} importing={importing} canManageData={canManageData} />
          </DevOverlay>
        )}
      </div>
      <DashboardAIChat dashboard="pipeline" activeTab={tab} filters={{ ...filters, view_mode: viewMode }} />
    </div>
  );
}

export default Pipeline;
