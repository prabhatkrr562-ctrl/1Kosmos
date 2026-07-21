import { useState, useMemo, useEffect, useRef } from 'react';
import { fmt, StageBadge, FcBadge } from './plShared';

const PM_PAGE_SIZE = 10;
const PM_COLS = [
  { key: 'record_id',         label: 'Record ID' },
  { key: 'deal_name',         label: 'Deal Name' },
  { key: 'company',           label: 'Company' },
  { key: 'stage',             label: 'Stage' },
  { key: 'forecast_category', label: 'Forecast' },
  { key: 'owner',             label: 'Owner' },
  { key: 'team',              label: 'Team' },
  { key: 'amount',            label: 'Amount ($)', num: true },
  { key: 'weighted',          label: 'Weighted ($)', num: true },
  { key: 'term',              label: 'Term' },
  { key: 'order_type',        label: 'Order Type' },
  { key: 'source',            label: 'Source' },
  { key: 'close_quarter',     label: 'Quarter' },
  { key: 'region',            label: 'Region' },
  { key: 'sector',            label: 'Sector' },
];

// Sample fields for template download
const PL_SAMPLE_FIELDS = [
  { field: 'Week',             sample: '2024-W01',    type: 'Text'   },
  { field: 'Record ID',        sample: 'DEAL-001',    type: 'Text'   },
  { field: 'Deal Name',        sample: 'Sample Deal', type: 'Text'   },
  { field: 'Company',          sample: 'Acme Corp',   type: 'Text'   },
  { field: 'Stage',            sample: 'Proposal',    type: 'Text'   },
  { field: 'Forecast Category',sample: 'Commit',      type: 'Text'   },
  { field: 'Owner',            sample: 'John Doe',    type: 'Text'   },
  { field: 'Team',             sample: 'Enterprise',  type: 'Text'   },
  { field: 'Amount',           sample: '100000',      type: 'Number' },
  { field: 'Weighted',         sample: '75000',       type: 'Number' },
  { field: 'Term',             sample: '12 Months',   type: 'Text'   },
  { field: 'Order Type',       sample: 'New',         type: 'Text'   },
  { field: 'Source',           sample: 'Outbound',    type: 'Text'   },
  { field: 'Close Quarter',    sample: 'Q1 FY2024',   type: 'Text'   },
  { field: 'Region',           sample: 'North America', type: 'Text' },
  { field: 'Sector',           sample: 'Technology',  type: 'Text'   },
];

// ── PipelineUploadModeModal ───────────────────────────────────────────────────

function PipelineUploadModeModal({ onClose, onProceed, importing }) {
  const [mode, setMode] = useState('replace');

  return (
    <div
      className="bim-backdrop"
      style={{ zIndex: 1200 }}
      onClick={e => { if (e.target === e.currentTarget && !importing) onClose(); }}
    >
      <div className="bim-card" style={{ maxWidth: 500 }}>
        <div className="bim-header">
          <div className="bim-header-left">
            <div className="bim-header-icon">⚙️</div>
            <div>
              <div className="bim-title">Choose Import Mode</div>
              <div className="bim-subtitle">How should the uploaded data be applied?</div>
            </div>
          </div>
          <button className="bim-close" disabled={importing} onClick={onClose}>✕</button>
        </div>

        <div className="bim-body" style={{ gap: 12 }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
            Choose how this file's data should be applied to the Pipeline database.
          </p>

          <label
            className={`upm-option${mode === 'replace' ? ' upm-option--active' : ''}`}
            onClick={() => setMode('replace')}
          >
            <div className="upm-radio">
              <div className={`upm-radio-dot${mode === 'replace' ? ' upm-radio-dot--on' : ''}`} />
            </div>
            <div className="upm-option-body">
              <div className="upm-option-title">Replace</div>
              <div className="upm-option-desc">
                Delete all existing pipeline data and import this file fresh. All current weeks and deals will be replaced.
              </div>
            </div>
          </label>

          <label
            className={`upm-option${mode === 'insert' ? ' upm-option--active' : ''}`}
            onClick={() => setMode('insert')}
          >
            <div className="upm-radio">
              <div className={`upm-radio-dot${mode === 'insert' ? ' upm-radio-dot--on' : ''}`} />
            </div>
            <div className="upm-option-body">
              <div className="upm-option-title">Insert</div>
              <div className="upm-option-desc">
                Append all rows from this file into the most recent pipeline import. Existing deals and weeks are preserved; new rows are added and week list is merged.
              </div>
            </div>
          </label>
        </div>

        <div className="bim-footer">
          <button className="bim-cancel-btn" disabled={importing} onClick={onClose}>Back</button>
          <button
            className="bim-upload-btn"
            disabled={importing}
            onClick={() => onProceed(mode)}
          >
            {importing ? <><span className="bim-spinner" />Uploading…</> : <>↑ &nbsp;Proceed to Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PipelineImportModal ───────────────────────────────────────────────────────

function PipelineImportModal({ onClose, onProceed, importing }) {
  const [file, setFile]                   = useState(null);
  const [showModeModal, setShowModeModal] = useState(false);
  const fileRef = useRef();

  const triggerBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
  };

  const downloadXLS = () => {
    const safe = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const styleXML = `<Styles>`
      + `<Style ss:ID="hdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#7C3AED" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5B21B6"/></Borders></Style>`
      + `<Style ss:ID="dat"><Alignment ss:Horizontal="Left"/><Font ss:Size="11"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>`
      + `<Style ss:ID="datn"><Alignment ss:Horizontal="Right"/><Font ss:Size="11"/></Style>`
      + `</Styles>`;
    const cols    = PL_SAMPLE_FIELDS.map((_, i) => `<Column ss:Index="${i + 1}" ss:AutoFitWidth="1" ss:Width="120"/>`).join('');
    const hdrRow  = PL_SAMPLE_FIELDS.map((f, i) =>
      `<Cell ss:Index="${i + 1}" ss:StyleID="hdr"><Data ss:Type="String">${safe(f.field)}</Data></Cell>`
    ).join('');
    const datRow  = PL_SAMPLE_FIELDS.map((f, i) => {
      const isNum = f.type === 'Number';
      return `<Cell ss:Index="${i + 1}" ss:StyleID="${isNum ? 'datn' : 'dat'}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${safe(f.sample)}</Data></Cell>`;
    }).join('');
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>`
      + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">`
      + styleXML
      + `<Worksheet ss:Name="Pipeline Data"><Table>${cols}<Row ss:Height="22">${hdrRow}</Row><Row>${datRow}</Row></Table></Worksheet>`
      + `</Workbook>`;
    triggerBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'pipeline_template.xls');
  };

  const downloadCSV = () => {
    const header = PL_SAMPLE_FIELDS.map(f => f.field).join(',');
    const data   = PL_SAMPLE_FIELDS.map(f => `"${f.sample}"`).join(',');
    triggerBlob(new Blob([`${header}\n${data}\n`], { type: 'text/csv;charset=utf-8;' }), 'pipeline_template.csv');
  };

  return (
    <>
      {showModeModal && (
        <PipelineUploadModeModal
          importing={importing}
          onClose={() => setShowModeModal(false)}
          onProceed={mode => {
            setShowModeModal(false);
            onProceed(file, mode);
          }}
        />
      )}

      <div className="bim-backdrop" onClick={e => { if (e.target === e.currentTarget && !importing) onClose(); }}>
        <div className="bim-card">
          <div className="bim-header">
            <div className="bim-header-left">
              <div className="bim-header-icon">📥</div>
              <div>
                <div className="bim-title">Import Pipeline Excel</div>
                <div className="bim-subtitle">Prepare your file using the instructions below, then upload</div>
              </div>
            </div>
            <button className="bim-close" onClick={onClose} disabled={importing}>✕</button>
          </div>

          <div className="bim-body">
            {/* Step 1 — Instructions */}
            <div className="bim-step">
              <div className="bim-step-badge">1</div>
              <div className="bim-step-body">
                <div className="bim-step-title">File Preparation Instructions</div>
                <ul className="bim-instructions">
                  <li>Upload a <strong>single-sheet Excel (.xlsx)</strong> file only. The sheet must be named <code>Pipeline Data</code> and contain the exact column headers — use the sample template in Step 2 for the correct layout.</li>
                  <li><strong>Replace mode</strong> deletes all existing pipeline deals and weeks, then imports this file fresh. Use this when uploading a full weekly snapshot.</li>
                  <li><strong>Insert mode</strong> appends rows from this file into the most recent pipeline import. Existing deals are preserved and the week list is automatically merged — use this to add a new week's snapshot without losing history.</li>
                  <li><strong>Column headers must be exact.</strong> Required columns: <em>Week, Record ID, Deal Name, Company, Stage, Forecast Category, Owner, Team, Amount, Weighted, Term, Order Type, Source, Close Quarter, Region, Sector.</em> Extra columns are ignored.</li>
                  <li>The <strong>Week</strong> column must follow <code>YYYY-WXX</code> format (e.g. <code>2024-W01</code>). <strong>Numeric fields</strong> (Amount, Weighted) must be plain numbers — no currency symbols or commas.</li>
                </ul>
              </div>
            </div>

            {/* Step 2 — Download Template */}
            <div className="bim-step">
              <div className="bim-step-badge bim-step-badge-green">2</div>
              <div className="bim-step-body">
                <div className="bim-step-title">Download Sample Template</div>
                <div className="bim-step-desc">
                  The template contains all required column headers with one example row.
                </div>
                <div className="bim-sample-row">
                  <button className="bim-sample-btn bim-sample-xls" onClick={downloadXLS}>
                    ↓ &nbsp;Pipeline Template (.xls)
                  </button>
                  <button className="bim-sample-btn bim-sample-csv" onClick={downloadCSV}>
                    ↓ &nbsp;Pipeline Template (.csv)
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3 — File Chooser */}
            <div className="bim-step">
              <div className="bim-step-badge bim-step-badge-purple">3</div>
              <div className="bim-step-body">
                <div className="bim-step-title">Select & Upload Your File</div>
                <div className="bim-step-desc">Accepts <code>.xlsx</code> format only.</div>
                <div className="bim-file-row">
                  <label className="bim-choose-btn" onClick={() => fileRef.current?.click()}>Choose File</label>
                  <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files?.[0] || null)} />
                  <span className={`bim-file-name ${file ? 'bim-file-selected' : ''}`}>
                    {file ? `📄 ${file.name}` : 'No file selected'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bim-footer">
            <button className="bim-cancel-btn" onClick={onClose} disabled={importing}>Cancel</button>
            <button className="bim-upload-btn" onClick={() => setShowModeModal(true)} disabled={!file || importing}>
              {importing ? <><span className="bim-spinner" />Uploading…</> : <>↑ &nbsp;Upload Now</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── PipelineMaster ────────────────────────────────────────────────────────────

function PipelineMaster({ data, handleImport, importing, canManageData = false }) {
  const [search, setSearch]               = useState('');
  const [sortField, setSortField]         = useState('amount');
  const [sortDir, setSortDir]             = useState(-1);
  const [page, setPage]                   = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);

  const records = useMemo(() => data.deals || [], [data.deals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const f = q
      ? records.filter(r => PM_COLS.filter(c => !c.num).some(c => String(r[c.key] || '').toLowerCase().includes(q)))
      : records;
    const col = PM_COLS.find(c => c.key === sortField);
    return [...f].sort((a, b) => {
      if (col?.num) return sortDir * (Number(a[sortField] ?? 0) - Number(b[sortField] ?? 0));
      return sortDir * String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''));
    });
  }, [records, search, sortField, sortDir]);

  useEffect(() => { setPage(1); }, [search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PM_PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PM_PAGE_SIZE, page * PM_PAGE_SIZE);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir(d => -d);
    else { setSortField(f); setSortDir(-1); }
  };

  const Th = ({ col }) => (
    <th className={`bm-th${col.num ? ' bm-th-r' : ''}`} onClick={() => toggleSort(col.key)}>
      {col.label}
      <span className="bm-sort-icon">{sortField === col.key ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  const triggerDownload = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!canManageData) return;
    const rows = [PM_COLS.map(c => c.label), ...filtered.map(r => PM_COLS.map(c => r[c.key] ?? ''))];
    const csv  = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'pipeline_master.csv');
  };

  const exportExcel = () => {
    if (!canManageData) return;
    const allRows = [PM_COLS.map(c => c.label), ...filtered.map(r => PM_COLS.map(c => r[c.key] ?? ''))];
    const xmlRows = allRows.map((row, ri) =>
      `<Row>${row.map((v, ci) => {
        const type = ri > 0 && PM_COLS[ci].num ? 'Number' : 'String';
        const safe = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<Cell><Data ss:Type="${type}">${safe}</Data></Cell>`;
      }).join('')}</Row>`
    ).join('');
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Pipeline Master"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    triggerDownload(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'pipeline_master.xls');
  };

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  if (!canManageData) return null;

  return (
    <>
      {showImportModal && (
        <PipelineImportModal
          importing={importing}
          onClose={() => { if (!importing) setShowImportModal(false); }}
          onProceed={(file, mode) => {
            setShowImportModal(false);
            handleImport(file, mode);
          }}
        />
      )}

      <div className="bm-wrap">
        <div className="bm-toolbar">
          <div className="bm-toolbar-left">
            <span className="bm-title">Pipeline Master</span>
            <span className="bm-badge">{filtered.length} deals</span>
          </div>
          <div className="bm-toolbar-right">
            <input className="bm-search" placeholder="Search deals…" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="bm-export-btn" onClick={exportCSV}>↓ CSV</button>
            <button className="bm-export-btn" onClick={exportExcel}>↓ Excel</button>
            <button
              className={`bm-import-btn${importing ? ' bm-import-loading' : ''}`}
              disabled={importing}
              onClick={() => setShowImportModal(true)}
            >
              {importing ? 'Importing…' : '↑ Import Pipeline Excel'}
            </button>
          </div>
        </div>

        <div className="bm-table-wrap">
          <table className="bm-table">
            <thead>
              <tr>
                <th className="bm-th bm-th-num">#</th>
                {PM_COLS.map(col => <Th key={col.key} col={col} />)}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={`pm-${r.record_id || i}`} className="bm-row">
                  <td className="bm-td-num">{(page - 1) * PM_PAGE_SIZE + i + 1}</td>
                  <td className="bm-td-code">{r.record_id || '—'}</td>
                  <td className="bm-td-primary" title={r.deal_name}>{r.deal_name || '—'}</td>
                  <td className="bm-td-muted" title={r.company}>{r.company || '—'}</td>
                  <td><StageBadge stage={r.stage} /></td>
                  <td><FcBadge fc={r.forecast_category} /></td>
                  <td className="bm-td-muted">{r.owner || '—'}</td>
                  <td className="bm-td-muted">{r.team || '—'}</td>
                  <td className="bm-td-money bm-td-r">{fmt(r.amount)}</td>
                  <td className="bm-td-r" style={{ color: '#7c3aed', fontWeight: 600 }}>{fmt(r.weighted)}</td>
                  <td className="bm-td-muted">{r.term || '—'}</td>
                  <td className="bm-td-muted">{r.order_type || '—'}</td>
                  <td className="bm-td-muted">{r.source || '—'}</td>
                  <td><span className="bm-chip">{r.close_quarter || '—'}</span></td>
                  <td className="bm-td-muted">{r.region || '—'}</td>
                  <td className="bm-td-muted">{r.sector || '—'}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={PM_COLS.length + 1} className="bm-empty-row">No matching deals.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bm-pagination">
          <span className="bm-pg-info">
            {filtered.length === 0 ? '0' : `${(page - 1) * PM_PAGE_SIZE + 1}–${Math.min(page * PM_PAGE_SIZE, filtered.length)}`} of {filtered.length}
          </span>
          <div className="bm-pg-controls">
            <button className="bm-pg-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="bm-pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
            {pageNums.map((p, i) =>
              p === '…'
                ? <span key={`el-${i}`} className="bm-pg-ellipsis">…</span>
                : <button key={p} className={`bm-pg-btn${p === page ? ' bm-pg-active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            )}
            <button className="bm-pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
            <button className="bm-pg-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        </div>
      </div>
    </>
  );
}

export { PipelineMaster };
export default PipelineMaster;
