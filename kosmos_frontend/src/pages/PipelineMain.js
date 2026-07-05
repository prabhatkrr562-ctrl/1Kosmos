import { useState, useEffect, useCallback, useRef } from 'react';
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

const FILTER_DEFS = [
  ['week',    'Week'   ],
  ['owner',   'Owner'  ],
  ['team',    'Team'   ],
  ['quarter', 'Quarter'],
  ['region',  'Region' ],
  ['sector',  'Sector' ],
];

function Pipeline() {
  const [tab,       setTab]       = useState('exec');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  const [filters, setFilters] = useState({
    week: '', owner: '', team: '', quarter: '', region: '', sector: '',
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    fetch(`/api/pipeline/?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleImport = useCallback((file, mode = 'replace') => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    setImporting(true);
    setImportMsg('');
    fetch('/api/pipeline/import/', { method: 'POST', body: fd, credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setImportMsg(d.message || d.error || 'Done');
        setImporting(false);
        if (d.message) fetchData();
      })
      .catch(() => { setImportMsg('Upload failed.'); setImporting(false); });
  }, [fetchData]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters({ week: '', owner: '', team: '', quarter: '', region: '', sector: '' });
  const hasFilters = Object.values(filters).some(Boolean);

  const opts = data?.filters || {};

  /* ── Loading ── */
  if (loading) return (
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
        <p>No pipeline data yet. Upload your Pipeline Database Excel file to get started.</p>
        <button className="dash-empty-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {importing ? 'Importing…' : 'Upload Pipeline Excel'}
        </button>
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
        <div className="dash-filterbar">
          <div className="dash-fb-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
          </div>
          <div className="dash-fb-divider" />
          {FILTER_DEFS.map(([key, label]) => (
            <label key={key} className="dash-filter-group">
              <span className="dash-filter-label">{label}</span>
              <select
                className="dash-filter-select"
                value={filters[key]}
                onChange={e => setFilter(key, e.target.value)}
              >
                {key === 'week'
                  ? <option value="">Latest ({data.selected_week})</option>
                  : <option value="">All</option>
                }
                {(opts[`${key}s`] || opts[key] || []).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ))}
          {hasFilters && (
            <button className="dash-filter-reset" onClick={clearFilters}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear all
            </button>
          )}
          <span className="dash-week-badge">{data.selected_week}</span>
        </div>
      </DevOverlay>

      {/* ── Content ── */}
      <div className="dash-content pl-body">
        {tab === 'exec' && (
          <DevOverlay name="Executive">
            <Executive data={data} />
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
            <RepKpis data={data} />
          </DevOverlay>
        )}
        {tab === 'forecast' && (
          <DevOverlay name="Forecast">
            <Forecast data={data} />
          </DevOverlay>
        )}
        {tab === 'region' && (
          <DevOverlay name="Region">
            <Region data={data} />
          </DevOverlay>
        )}
        {tab === 'repdetail' && (
          <DevOverlay name="RepDeepDive">
            <RepDeepDive data={data} />
          </DevOverlay>
        )}
        {tab === 'explorer' && (
          <DevOverlay name="DealExplorer">
            <DealExplorer data={data} />
          </DevOverlay>
        )}
        {tab === 'fpa' && (
          <DevOverlay name="FPA">
            <FPA data={data} />
          </DevOverlay>
        )}
        {tab === 'aging' && (
          <DevOverlay name="StageStall">
            <StageStall data={data} />
          </DevOverlay>
        )}
        {tab === 'benchmark' && (
          <DevOverlay name="IndustryBenchmark">
            <IndustryBenchmark data={data} />
          </DevOverlay>
        )}
        {tab === 'commentary' && (
          <DevOverlay name="Commentary">
            <Commentary data={data} />
          </DevOverlay>
        )}
        {tab === 'pl_master' && (
          <DevOverlay name="PipelineMaster">
            <PipelineMaster data={data} handleImport={handleImport} importing={importing} />
          </DevOverlay>
        )}
      </div>
      <DashboardAIChat dashboard="pipeline" activeTab={tab} filters={filters} />
    </div>
  );
}

export default Pipeline;
