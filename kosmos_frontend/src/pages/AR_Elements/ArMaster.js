import { useEffect, useMemo, useRef, useState } from 'react';

const AR_PAGE_SIZE = 10;
const AR_COLS = [
    { key: 'customer',        label: 'End User' },
    { key: 'legal_customer',  label: 'Legal Customer' },
    { key: 'region',          label: 'Region' },
    { key: 'sales_rep',       label: 'Sales Rep' },
    { key: 'document_number', label: 'Document #' },
    { key: 'document_date',   label: 'Doc Date' },
    { key: 'due_date',        label: 'Due Date' },
    { key: 'days_overdue',    label: 'Days Overdue', num: true },
    { key: 'open_balance',    label: 'Open Balance', num: true },
];

const AR_TABLES = [
    {
        key:   'aging',
        label: 'AR Aging',
        sheet: 'AR Aging',
        desc:  'Append open-balance aging records (invoices, due dates, balances)',
    },
    {
        key:   'payments',
        label: 'Payment History',
        sheet: 'Payment History',
        desc:  'Append payment / collection transaction records',
    },
    {
        key:   'renewals',
        label: 'Renewal Pending',
        sheet: 'Renewal Pending',
        desc:  'Append pending renewal / invoice records',
    },
];

// Sample rows for the downloadable template
const AR_AGING_FIELDS = [
    { field: 'Customer',         sample: 'Sample Corp',   type: 'Text'   },
    { field: 'End User',         sample: 'Sample Corp',   type: 'Text'   },
    { field: 'Region',           sample: 'North America', type: 'Text'   },
    { field: 'Sales Rep',        sample: 'John Doe',      type: 'Text'   },
    { field: 'Type',             sample: 'Invoice',       type: 'Text'   },
    { field: 'Date',             sample: '2024-01-15',    type: 'Date'   },
    { field: 'Document Number',  sample: 'INV-001',       type: 'Text'   },
    { field: 'Due Date',         sample: '2024-02-15',    type: 'Date'   },
    { field: 'Open Balance',     sample: '25000',         type: 'Number' },
];

const AR_PAYMENT_FIELDS = [
    { field: 'InvoiceNo.',       sample: 'INV-001',       type: 'Text'   },
    { field: 'Customer Name',    sample: 'Sample Corp',   type: 'Text'   },
    { field: 'End User',         sample: 'Sample Corp',   type: 'Text'   },
    { field: 'Sales Rep',        sample: 'John Doe',      type: 'Text'   },
    { field: 'Region',           sample: 'North America', type: 'Text'   },
    { field: 'Payment Type',     sample: 'Invoice',       type: 'Text'   },
    { field: 'Date',             sample: '2024-01-15',    type: 'Date'   },
    { field: 'Due Date',         sample: '2024-02-15',    type: 'Date'   },
    { field: 'Amount',           sample: '25000',         type: 'Number' },
];

const AR_RENEWAL_FIELDS = [
    { field: 'End User',         sample: 'Sample Corp',   type: 'Text'   },
    { field: 'Renewal Status',   sample: '12 Months',     type: 'Text'   },
    { field: 'Status',           sample: 'Signed',        type: 'Text'   },
    { field: 'Amount',           sample: '50000',         type: 'Number' },
    { field: 'Sales Rep',        sample: 'John Doe',      type: 'Text'   },
    { field: 'Region',           sample: 'North America', type: 'Text'   },
    { field: 'Remarks',          sample: 'Renewal in Q2', type: 'Text'   },
];

// ── ArUploadModeModal ─────────────────────────────────────────────────────────

function ArUploadModeModal({ onClose, onProceed, uploading }) {
    const [mode, setMode]   = useState('replace');
    const [table, setTable] = useState('aging');

    return (
        <div
            className="bim-backdrop"
            style={{ zIndex: 1200 }}
            onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}
        >
            <div className="bim-card" style={{ maxWidth: 520 }}>
                <div className="bim-header">
                    <div className="bim-header-left">
                        <div className="bim-header-icon">⚙️</div>
                        <div>
                            <div className="bim-title">Choose Import Mode</div>
                            <div className="bim-subtitle">How should the uploaded data be applied?</div>
                        </div>
                    </div>
                    <button className="bim-close" disabled={uploading} onClick={onClose}>✕</button>
                </div>

                <div className="bim-body" style={{ gap: 12 }}>
                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                        Choose how this file's data should be applied to the AR database.
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
                            <div className="upm-option-desc">Delete all existing AR data and re-import all 3 sheets fresh from this file.</div>
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
                            <div className="upm-option-desc">Append new rows into the most recent AR import without deleting existing data.</div>
                        </div>
                    </label>

                    {mode === 'insert' && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Which table are you updating?
                            </div>
                            {AR_TABLES.map(t => (
                                <label
                                    key={t.key}
                                    className={`upm-option${table === t.key ? ' upm-option--active' : ''}`}
                                    style={{ marginBottom: 8, padding: '10px 14px' }}
                                    onClick={() => setTable(t.key)}
                                >
                                    <span className="upm-radio">
                                        {table === t.key && <span className="upm-radio-dot upm-radio-dot--on" />}
                                    </span>
                                    <span className="upm-option-body">
                                        <span className="upm-option-title">{t.label}</span>
                                        <span className="upm-option-desc">{t.desc}</span>
                                        <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'block' }}>
                                            Sheet name in Excel: <em>{t.sheet}</em>
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bim-footer">
                    <button className="bim-cancel-btn" disabled={uploading} onClick={onClose}>Back</button>
                    <button
                        className="bim-upload-btn"
                        disabled={uploading}
                        onClick={() => onProceed(mode, mode === 'insert' ? table : null)}
                    >
                        {uploading ? <><span className="bim-spinner" />Uploading…</> : <>↑ &nbsp;Proceed to Submit</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── ArImportModal ─────────────────────────────────────────────────────────────

function ArImportModal({ onClose, onProceed, uploading }) {
    const [file, setFile]               = useState(null);
    const [showModeModal, setShowModeModal] = useState(false);
    const fileRef = useRef();

    const triggerBlob = (blob, name) => {
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href: url, download: name }).click();
        URL.revokeObjectURL(url);
    };

    const makeSheet = (name, fields, color) => {
        const safe = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const hdrCells = fields.map((f, i) =>
            `<Cell ss:Index="${i + 1}" ss:StyleID="hdr_${color}"><Data ss:Type="String">${safe(f.field)}</Data></Cell>`
        ).join('');
        const datCells = fields.map((f, i) => {
            const isNum = f.type === 'Number';
            return `<Cell ss:Index="${i + 1}" ss:StyleID="${isNum ? 'datn' : 'dat'}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${safe(f.sample)}</Data></Cell>`;
        }).join('');
        const cols = fields.map((_, i) =>
            `<Column ss:Index="${i + 1}" ss:AutoFitWidth="1" ss:Width="120"/>`
        ).join('');
        return `<Worksheet ss:Name="${safe(name)}"><Table>${cols}<Row ss:Height="22">${hdrCells}</Row><Row>${datCells}</Row></Table></Worksheet>`;
    };

    const downloadXLS = () => {
        const styleXML = `<Styles>`
            + `<Style ss:ID="hdr_purple"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#7C3AED" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5B21B6"/></Borders></Style>`
            + `<Style ss:ID="hdr_cyan"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0891b2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0e7490"/></Borders></Style>`
            + `<Style ss:ID="hdr_green"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#059669" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#047857"/></Borders></Style>`
            + `<Style ss:ID="dat"><Alignment ss:Horizontal="Left"/><Font ss:Size="11"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>`
            + `<Style ss:ID="datn"><Alignment ss:Horizontal="Right"/><Font ss:Size="11"/></Style>`
            + `</Styles>`;
        const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>`
            + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">`
            + styleXML
            + makeSheet('AR Aging',        AR_AGING_FIELDS,   'purple')
            + makeSheet('Payment History', AR_PAYMENT_FIELDS, 'cyan')
            + makeSheet('Renewal Pending', AR_RENEWAL_FIELDS, 'green')
            + `</Workbook>`;
        triggerBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'ar_dashboard_template.xls');
    };

    const downloadCSV = (fields, sheetName, fileName) => {
        const header = fields.map(f => f.field).join(',');
        const data   = fields.map(f => `"${f.sample}"`).join(',');
        triggerBlob(new Blob([`${header}\n${data}\n`], { type: 'text/csv;charset=utf-8;' }), fileName);
    };

    return (
        <>
            {showModeModal && (
                <ArUploadModeModal
                    uploading={uploading}
                    onClose={() => setShowModeModal(false)}
                    onProceed={(mode, table) => {
                        setShowModeModal(false);
                        onProceed(file, mode, table);
                    }}
                />
            )}

            <div className="bim-backdrop" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
                <div className="bim-card">
                    <div className="bim-header">
                        <div className="bim-header-left">
                            <div className="bim-header-icon">📥</div>
                            <div>
                                <div className="bim-title">Import AR Dashboard Excel</div>
                                <div className="bim-subtitle">Prepare your file using the instructions below, then upload</div>
                            </div>
                        </div>
                        <button className="bim-close" onClick={onClose} disabled={uploading}>✕</button>
                    </div>

                    <div className="bim-body">
                        {/* Step 1 — Instructions */}
                        <div className="bim-step">
                            <div className="bim-step-badge">1</div>
                            <div className="bim-step-body">
                                <div className="bim-step-title">File Preparation Instructions</div>
                                <ul className="bim-instructions">
                                    <li>Upload an <strong>Excel (.xlsx)</strong> file only. The file must contain the required sheets with exact column headers — use the sample template in Step 2 to get the correct layout.</li>
                                    <li><strong>Replace mode</strong> requires all 3 sheets in the same workbook: <em>AR Aging</em>, <em>Payment History</em>, and <em>Renewal Pending</em>. The system will delete all existing AR data and reload everything fresh.</li>
                                    <li><strong>Insert mode</strong> accepts a single-sheet file. You choose which table to append to (AR Aging, Payment History, or Renewal Pending). Existing records are never deleted — only new rows are added.</li>
                                    <li><strong>Column headers must be exact.</strong> AR Aging needs 9 columns (Customer → Open Balance). Payment History needs 9 columns (InvoiceNo. → Amount). Renewal Pending needs 7 columns (End User → Remarks). Extra columns in your file are ignored.</li>
                                    <li><strong>Date fields</strong> should use <code>YYYY-MM-DD</code> format or standard Excel date cells. <strong>Numeric fields</strong> (Open Balance, Amount) must be plain numbers — no currency symbols or commas.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Step 2 — Download Template */}
                        <div className="bim-step">
                            <div className="bim-step-badge bim-step-badge-green">2</div>
                            <div className="bim-step-body">
                                <div className="bim-step-title">Download Sample Template</div>
                                <div className="bim-step-desc">
                                    The Excel template contains all 3 sheets with correct headers and one example row each.
                                    Individual CSV files are useful for Insert-mode single-sheet uploads.
                                </div>
                                <div className="bim-sample-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                                    <button className="bim-sample-btn bim-sample-xls" onClick={downloadXLS}>
                                        ↓ &nbsp;Full Template (.xls)
                                    </button>
                                    <button className="bim-sample-btn bim-sample-csv"
                                        onClick={() => downloadCSV(AR_AGING_FIELDS,   'AR Aging',        'ar_aging_template.csv')}>
                                        ↓ &nbsp;AR Aging (.csv)
                                    </button>
                                    <button className="bim-sample-btn bim-sample-csv"
                                        style={{ background: '#0891b2' }}
                                        onClick={() => downloadCSV(AR_PAYMENT_FIELDS, 'Payment History', 'payment_history_template.csv')}>
                                        ↓ &nbsp;Payment History (.csv)
                                    </button>
                                    <button className="bim-sample-btn bim-sample-csv"
                                        style={{ background: '#059669' }}
                                        onClick={() => downloadCSV(AR_RENEWAL_FIELDS, 'Renewal Pending', 'renewal_pending_template.csv')}>
                                        ↓ &nbsp;Renewal Pending (.csv)
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
                        <button className="bim-cancel-btn" onClick={onClose} disabled={uploading}>Cancel</button>
                        <button className="bim-upload-btn" onClick={() => setShowModeModal(true)} disabled={!file || uploading}>
                            {uploading ? <><span className="bim-spinner" />Uploading…</> : <>↑ &nbsp;Upload Now</>}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── ArMaster ──────────────────────────────────────────────────────────────────

function ArMaster({ data, upload, uploading }) {
    const [search, setSearch]             = useState('');
    const [sortField, setSortField]       = useState('open_balance');
    const [sortDir, setSortDir]           = useState(-1);
    const [page, setPage]                 = useState(1);
    const [showImportModal, setShowImportModal] = useState(false);

    const records = data.records || [];

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        const f = q
            ? records.filter(r =>
                AR_COLS.filter(c => !c.num)
                    .some(c => String(r[c.key] || '').toLowerCase().includes(q))
              )
            : records;
        const col = AR_COLS.find(c => c.key === sortField);
        return [...f].sort((a, b) => {
            if (col?.num) return sortDir * (Number(a[sortField] ?? 0) - Number(b[sortField] ?? 0));
            return sortDir * String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''));
        });
    }, [records, search, sortField, sortDir]);

    useEffect(() => { setPage(1); }, [search, sortField, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / AR_PAGE_SIZE));
    const paginated  = filtered.slice((page - 1) * AR_PAGE_SIZE, page * AR_PAGE_SIZE);

    const toggleSort = f => {
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
        const rows = [AR_COLS.map(c => c.label), ...filtered.map(r => AR_COLS.map(c => r[c.key] ?? ''))];
        const csv  = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'ar_master.csv');
    };

    const exportExcel = () => {
        const allRows = [AR_COLS.map(c => c.label), ...filtered.map(r => AR_COLS.map(c => r[c.key] ?? ''))];
        const xmlRows = allRows.map((row, ri) =>
            `<Row>${row.map((v, ci) => {
                const type = ri > 0 && AR_COLS[ci].num ? 'Number' : 'String';
                const safe = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<Cell><Data ss:Type="${type}">${safe}</Data></Cell>`;
            }).join('')}</Row>`
        ).join('');
        const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="AR Master"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
        triggerDownload(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'ar_master.xls');
    };

    const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
            acc.push(p);
            return acc;
        }, []);

    return (
        <>
            {showImportModal && (
                <ArImportModal
                    uploading={uploading}
                    onClose={() => { if (!uploading) setShowImportModal(false); }}
                    onProceed={(file, mode, table) => {
                        setShowImportModal(false);
                        upload(file, mode, table);
                    }}
                />
            )}

            <div className="bm-wrap">
                <div className="bm-toolbar">
                    <div className="bm-toolbar-left">
                        <span className="bm-title">AR Master</span>
                        <span className="bm-badge">{filtered.length} records</span>
                    </div>
                    <div className="bm-toolbar-right">
                        <input className="bm-search" placeholder="Search AR records…" value={search}
                            onChange={e => setSearch(e.target.value)} />
                        <button className="bm-export-btn" onClick={exportCSV}>↓ CSV</button>
                        <button className="bm-export-btn" onClick={exportExcel}>↓ Excel</button>
                        <button
                            className={`bm-import-btn${uploading ? ' bm-import-loading' : ''}`}
                            disabled={uploading}
                            onClick={() => setShowImportModal(true)}
                        >
                            {uploading ? 'Importing…' : '↑ Import AR Excel'}
                        </button>
                    </div>
                </div>

                <div className="bm-table-wrap">
                    <table className="bm-table">
                        <thead>
                            <tr>
                                <th className="bm-th bm-th-num">#</th>
                                {AR_COLS.map(col => <Th key={col.key} col={col} />)}
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((r, i) => (
                                <tr key={`arm-${r.document_number || i}`} className="bm-row">
                                    <td className="bm-td-num">{(page - 1) * AR_PAGE_SIZE + i + 1}</td>
                                    <td className="bm-td-primary">{r.customer || '—'}</td>
                                    <td className="bm-td-muted">{r.legal_customer || '—'}</td>
                                    <td><span className="bm-chip">{r.region || '—'}</span></td>
                                    <td className="bm-td-muted">{r.sales_rep || '—'}</td>
                                    <td className="bm-td-code">{r.document_number || '—'}</td>
                                    <td className="bm-td-muted">{r.document_date || '—'}</td>
                                    <td className="bm-td-muted">{r.due_date || '—'}</td>
                                    <td className="bm-td-r">
                                        <span className={`bm-status ${Number(r.days_overdue) > 0 ? 'bm-inactive' : 'bm-active'}`}>
                                            {r.days_overdue}d
                                        </span>
                                    </td>
                                    <td className="bm-td-money">{r.open_balance}</td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr><td colSpan={AR_COLS.length + 1} className="bm-empty-row">No matching records.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bm-pagination">
                    <span className="bm-pg-info">
                        {filtered.length === 0 ? '0' : `${(page - 1) * AR_PAGE_SIZE + 1}–${Math.min(page * AR_PAGE_SIZE, filtered.length)}`} of {filtered.length}
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

export { ArMaster };
export default ArMaster;
