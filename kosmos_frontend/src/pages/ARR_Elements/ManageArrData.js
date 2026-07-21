import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { fmtFull } from './arrShared';
import { API_URL } from '../../config/api';

const BM_PAGE_SIZE = 10;

const SAMPLE_FIELDS = [
  { field: 'Key id',           sample: 'K001',            type: 'Text'   },
  { field: 'Entity',           sample: '1KOSMOS',         type: 'Text'   },
  { field: 'Cur.',             sample: 'USD',             type: 'Text'   },
  { field: 'Contract_ID',      sample: 'C-001',           type: 'Text'   },
  { field: 'Contract Name',    sample: 'Sample Contract', type: 'Text'   },
  { field: 'Sales person',     sample: 'John Doe',        type: 'Text'   },
  { field: 'Mode',             sample: 'Customer',        type: 'Text'   },
  { field: 'Size',             sample: 'Enterprise',      type: 'Text'   },
  { field: 'Industry',         sample: 'Technology',      type: 'Text'   },
  { field: 'BU',               sample: 'Federal',         type: 'Text'   },
  { field: 'Bill To',          sample: 'Sample Corp',     type: 'Text'   },
  { field: 'End User',         sample: 'Sample Corp',     type: 'Text'   },
  { field: 'Product Type',     sample: 'BlockID',         type: 'Text'   },
  { field: 'Sub Product Type', sample: 'Workforce',       type: 'Text'   },
  { field: 'Rev Method',       sample: 'ARR',             type: 'Text'   },
  { field: 'TCV LCY',          sample: '100000',          type: 'Number' },
  { field: 'TCV USD',          sample: '100000',          type: 'Number' },
  { field: 'ARR LCY',          sample: '50000',           type: 'Number' },
  { field: 'ARR Model',        sample: '50000',           type: 'Number' },
  { field: 'Ex.Rate',          sample: '1',               type: 'Number' },
  { field: 'Booking in renewal', sample: '0',             type: 'Number' },
  { field: 'Booking',          sample: '50000',           type: 'Number' },
  { field: 'Order Status Booking', sample: 'Active',      type: 'Text'   },
  { field: 'Order Status',     sample: 'Active',          type: 'Text'   },
  { field: 'Rec/Non Rec',      sample: 'Recurring',       type: 'Text'   },
  { field: 'Deal Type',        sample: 'New',             type: 'Text'   },
  { field: 'Term Start',       sample: '2024-01-01',      type: 'Date'   },
  { field: 'Term End',         sample: '2024-12-31',      type: 'Date'   },
  { field: 'Chohot Month',     sample: '2024-01',         type: 'Text'   },
  { field: 'Rolloff Month',    sample: '2024-12',         type: 'Text'   },
  { field: 'Type',             sample: 'Commercial',      type: 'Text'   },
  { field: 'Record id',        sample: 'R001',            type: 'Text'   },
];

// Mirrors the source workbook: ARR values, repeated movement amounts, then deal types.
const SAMPLE_MONTHLY = [
  { field: '2026-04-01', sample: '50000', type: 'Number' },
  { field: '2026-05-01', sample: '50000', type: 'Number' },
  { field: '2026-06-01', sample: '52000', type: 'Number' },
  { field: '2026-04-01', sample: '50000', type: 'Number' },
  { field: '2026-05-01', sample: '0',     type: 'Number' },
  { field: '2026-06-01', sample: '2000',  type: 'Number' },
  { field: 'DealType Apr-26', sample: 'New',    type: 'Text' },
  { field: 'DealType May-26', sample: '',       type: 'Text' },
  { field: 'DealType Jun-26', sample: 'Upsell', type: 'Text' },
];

const BM_COLS = [
  { key: 'key_id',           label: 'Key ID' },
  { key: 'entity',           label: 'Entity' },
  { key: 'currency',         label: 'Currency' },
  { key: 'contract_id',      label: 'Contract ID' },
  { key: 'contract_name',    label: 'Contract Name' },
  { key: 'sales_person',     label: 'Sales Person' },
  { key: 'mode',             label: 'Mode' },
  { key: 'company_size',     label: 'Company Size' },
  { key: 'industry',         label: 'Industry' },
  { key: 'business_unit',    label: 'BU' },
  { key: 'bill_to',          label: 'Bill To' },
  { key: 'end_user',         label: 'End User' },
  { key: 'product_type',     label: 'Product Type' },
  { key: 'sub_product_type', label: 'Sub-Product' },
  { key: 'revenue_method',   label: 'Rev. Method' },
  { key: 'tcv_usd',          label: 'TCV (USD)',    num: true },
  { key: 'arr_usd',          label: 'ARR USD',      num: true },
  { key: 'booking',          label: 'Booking',      num: true },
  { key: 'booking_status',   label: 'Booking Status' },
  { key: 'order_status',     label: 'Order Status' },
  { key: 'revenue_type',     label: 'Rev. Type' },
  { key: 'term_start',       label: 'Term Start' },
  { key: 'term_end',         label: 'Term End' },
  { key: 'line_of_business', label: 'Line of Business' },
  { key: 'current_arr',      label: 'Current ARR',  num: true },
  { key: 'monthly_arr',      label: 'Months',       monthly: true },
];

const BM_EXPORT_BASE = BM_COLS.filter(c => !c.monthly);

function bmAllMonths(records) {
  const s = new Set();
  records.forEach(r => Object.keys(r.monthly_arr || {}).forEach(m => s.add(m)));
  return [...s].sort();
}

function UploadModeModal({ onClose, onProceed, uploading }) {
  const [mode, setMode] = useState('replace');

  return (
    <div className="bim-backdrop" style={{ zIndex: 1100 }} onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="bim-card" style={{ maxWidth: 480 }}>
        <div className="bim-header">
          <div className="bim-header-left">
            <div className="bim-header-icon">⚙️</div>
            <div>
              <div className="bim-title">Choose Upload Mode</div>
              <div className="bim-subtitle">How should the uploaded data be applied?</div>
            </div>
          </div>
          <button className="bim-close" onClick={onClose} disabled={uploading}>✕</button>
        </div>

        <div className="bim-body" style={{ gap: 12 }}>
          <label
            className={`upm-option${mode === 'replace' ? ' upm-option--active' : ''}`}
            onClick={() => setMode('replace')}
          >
            <div className="upm-radio">
              <div className={`upm-radio-dot${mode === 'replace' ? ' upm-radio-dot--on' : ''}`} />
            </div>
            <div className="upm-option-body">
              <div className="upm-option-title">Replace</div>
              <div className="upm-option-desc">Delete all existing data and load the new file from scratch.</div>
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
              <div className="upm-option-desc">Append all rows from the new file to the existing data.</div>
            </div>
          </label>
        </div>

        <div className="bim-footer">
          <button className="bim-cancel-btn" onClick={onClose} disabled={uploading}>Back</button>
          <button className="bim-upload-btn" onClick={() => onProceed(mode)} disabled={uploading}>
            {uploading ? <><span className="bim-spinner" />Uploading…</> : <>↑ &nbsp;Proceed to Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);
  const fileRef = useRef();

  const triggerBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
  };

  const downloadXLS = () => {
    const allFields = [...SAMPLE_FIELDS, ...SAMPLE_MONTHLY];
    const styleXML = `<Styles>`
      + `<Style ss:ID="hdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#7C3AED" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5B21B6"/></Borders></Style>`
      + `<Style ss:ID="mhdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0891b2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0e7490"/></Borders></Style>`
      + `<Style ss:ID="dat"><Alignment ss:Horizontal="Left"/><Font ss:Size="11"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>`
      + `<Style ss:ID="datn"><Alignment ss:Horizontal="Right"/><Font ss:Size="11"/></Style>`
      + `</Styles>`;
    const headerCells = allFields.map((h, i) => {
      const style = i >= SAMPLE_FIELDS.length ? 'mhdr' : 'hdr';
      return `<Cell ss:Index="${i + 1}" ss:StyleID="${style}"><Data ss:Type="String">${h.field}</Data></Cell>`;
    }).join('');
    const dataCells = allFields.map((h, i) => {
      const isNum = h.type === 'Number';
      const style = isNum ? 'datn' : 'dat';
      return `<Cell ss:Index="${i + 1}" ss:StyleID="${style}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${h.sample}</Data></Cell>`;
    }).join('');
    const cols = allFields.map((_, i) =>
      `<Column ss:Index="${i + 1}" ss:AutoFitWidth="1" ss:Width="110"/>`
    ).join('');
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">${styleXML}<Worksheet ss:Name="Booking Template"><Table>${cols}<Row ss:Height="22">${headerCells}</Row><Row>${dataCells}</Row></Table></Worksheet></Workbook>`;
    triggerBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'booking_template.xls');
  };

  const downloadCSV = () => {
    const allFields = [...SAMPLE_FIELDS, ...SAMPLE_MONTHLY];
    const header = allFields.map(h => h.field).join(',');
    const data   = allFields.map(h => `"${h.sample}"`).join(',');
    triggerBlob(new Blob([`${header}\n${data}\n`], { type: 'text/csv;charset=utf-8;' }), 'booking_template.csv');
  };

  const handleUpload = async (mode) => {
    if (!file) return;
    setUploading(true);
    setShowModeModal(false);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    try {
      const res = await fetch(`${API_URL}/api/import/`, { method: 'POST', body: fd, credentials: 'include' });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'Import failed.');
      onClose();
      if (onSuccess) await onSuccess();
      Swal.fire({
        icon: 'success',
        title: 'Import Successful!',
        html: `<div style="font-size:14px;color:#374151;line-height:1.6">${r.message}</div>`,
        confirmButtonColor: '#7c3aed',
        confirmButtonText: '🎉 Great!',
        background: '#fff',
        timer: 7000,
        timerProgressBar: true,
        customClass: { popup: 'bim-swal-popup', title: 'bim-swal-title', confirmButton: 'bim-swal-btn' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Import Failed',
        text: err.message,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Close',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
    {showModeModal && (
      <UploadModeModal
        uploading={uploading}
        onClose={() => setShowModeModal(false)}
        onProceed={handleUpload}
      />
    )}
    <div className="bim-backdrop" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose(); }}>
      <div className="bim-card">
        <div className="bim-header">
          <div className="bim-header-left">
            <div className="bim-header-icon">📥</div>
            <div>
              <div className="bim-title">Import Booking Excel</div>
              <div className="bim-subtitle">Prepare your file using the layout below, then upload</div>
            </div>
          </div>
          <button className="bim-close" onClick={onClose} disabled={uploading}>✕</button>
        </div>

        <div className="bim-body">
          <div className="bim-step">
            <div className="bim-step-badge">1</div>
            <div className="bim-step-body">
              <div className="bim-step-title">File Preparation Instructions</div>
              <ul className="bim-instructions">
                <li>Use <strong>Excel (.xlsx / .xls)</strong> or <strong>CSV (.csv)</strong> format. The importer automatically locates the booking-table header, so the standard workbook summary rows above it are supported.</li>
                <li>The standard format contains fixed columns from <em>Key id</em> through <em>Record id</em>. Header aliases such as <em>Cur.</em>, <em>Contract_ID</em>, <em>Size</em>, <em>ARR Model</em>, <em>Rec/Non Rec</em>, and <em>Deal Type</em> are mapped automatically — the monthly <em>Booking_Database_YYYY-MM</em> export uploads as-is, and its <em>Deal Type</em> column fills the Booking / Order Status fields when those are blank.</li>
                <li><strong>Monthly data uses three blocks:</strong> monthly ARR date columns, the same date columns repeated for movement amounts, then matching <code>DealType Mon-YY</code> columns for New, Upsell, Renewal, Downsell, or Churn.</li>
                <li><strong>Numeric fields</strong> (TCV USD, ARR Model, Booking, monthly ARR, and movement amounts) must be plain numbers without currency symbols or percentage signs.</li>
                <li><strong>Date fields</strong> (Term Start, Term End) should use <code>YYYY-MM-DD</code> format or a standard Excel date cell. Any extra or unrecognised columns in your file are automatically ignored during import.</li>
              </ul>
            </div>
          </div>

          <div className="bim-step">
            <div className="bim-step-badge bim-step-badge-green">2</div>
            <div className="bim-step-body">
              <div className="bim-step-title">Download Sample Template</div>
              <div className="bim-step-desc">Pre-formatted file with the correct headers and one example row — ready to fill in.</div>
              <div className="bim-sample-row">
                <button className="bim-sample-btn bim-sample-xls" onClick={downloadXLS}>↓ &nbsp;Excel (.xls)</button>
                <button className="bim-sample-btn bim-sample-csv" onClick={downloadCSV}>↓ &nbsp;CSV (.csv)</button>
              </div>
            </div>
          </div>

          <div className="bim-step">
            <div className="bim-step-badge bim-step-badge-purple">3</div>
            <div className="bim-step-body">
              <div className="bim-step-title">Select & Upload Your File</div>
              <div className="bim-step-desc">Accepts <code>.xlsx</code>, <code>.xls</code> and <code>.csv</code> formats.</div>
              <div className="bim-file-row">
                <label className="bim-choose-btn" onClick={() => fileRef.current?.click()}>Choose File</label>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
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

function BookingMasterTab({ data, onSuccess, canManageData = false }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('key_id');
  const [sortDir, setSortDir] = useState(1);
  const [page, setPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);

  const records = useMemo(() => data.records || [], [data.records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const f = q
      ? records.filter(r =>
          BM_COLS.filter(c => !c.num && !c.monthly)
            .some(c => String(r[c.key] || '').toLowerCase().includes(q))
        )
      : records;
    const col = BM_COLS.find(c => c.key === sortField);
    return [...f].sort((a, b) => {
      if (col?.num) return sortDir * (Number(a[sortField] ?? 0) - Number(b[sortField] ?? 0));
      if (col?.monthly) return sortDir * (Object.keys(a[sortField] || {}).length - Object.keys(b[sortField] || {}).length);
      return sortDir * String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''));
    });
  }, [records, search, sortField, sortDir]);

  useEffect(() => { setPage(1); }, [search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BM_PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * BM_PAGE_SIZE, page * BM_PAGE_SIZE);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir(d => -d);
    else { setSortField(f); setSortDir(1); }
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
    const months = bmAllMonths(filtered);
    const xesc   = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [...BM_EXPORT_BASE.map(c => c.label), ...months];
    const rows   = filtered.map(r => [
      ...BM_EXPORT_BASE.map(c => r[c.key] ?? ''),
      ...months.map(m => (r.monthly_arr || {})[m] ?? ''),
    ]);
    const csv = [header, ...rows].map(row => row.map(xesc).join(',')).join('\n');
    triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), 'booking_master.csv');
  };

  const exportExcel = () => {
    if (!canManageData) return;
    const months = bmAllMonths(filtered);
    const xe = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const hdrRow = '<Row>' + [
      ...BM_EXPORT_BASE.map(c => `<Cell ss:StyleID="bmh"><Data ss:Type="String">${xe(c.label)}</Data></Cell>`),
      ...months.map(m  => `<Cell ss:StyleID="bmh"><Data ss:Type="String">${xe(m)}</Data></Cell>`),
    ].join('') + '</Row>';
    const dataRows = filtered.map(r => '<Row>' + [
      ...BM_EXPORT_BASE.map(c => {
        const v = r[c.key] ?? '';
        return `<Cell><Data ss:Type="${c.num ? 'Number' : 'String'}">${xe(v)}</Data></Cell>`;
      }),
      ...months.map(m => {
        const v = (r.monthly_arr || {})[m] ?? 0;
        return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
      }),
    ].join('') + '</Row>');
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
      '<Styles><Style ss:ID="bmh"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#7c3aed" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style></Styles>',
      '<Worksheet ss:Name="Arr Data"><Table>',
      hdrRow, ...dataRows,
      '</Table></Worksheet></Workbook>',
    ].join('\n');
    triggerDownload(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' }), 'booking_master.xls');
  };

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  const renderCell = (r, col) => {
    if (col.monthly) {
      const count = Object.keys(r[col.key] || {}).length;
      return <span className="bm-td-muted">{count > 0 ? `${count}mo` : '—'}</span>;
    }
    if (col.num) return <span className="bm-td-money">{fmtFull(r[col.key])}</span>;
    if (col.key === 'order_status' || col.key === 'booking_status') {
      const v = r[col.key] || '';
      return <span className={`bm-status ${v.toLowerCase() === 'active' ? 'bm-active' : 'bm-inactive'}`}>{v || '—'}</span>;
    }
    if (col.key === 'business_unit') return <span className="bm-chip">{r[col.key] || '—'}</span>;
    if (col.key === 'contract_id' || col.key === 'key_id') return <span className="bm-td-code">{r[col.key] || '—'}</span>;
    return r[col.key] || '—';
  };

  if (!canManageData) return null;

  return (
    <>
      {showImportModal && (
        <BookingImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={onSuccess}
        />
      )}
      <div className="bm-wrap">
        <div className="bm-toolbar">
          <div className="bm-toolbar-left">
            <span className="bm-title">Arr Data</span>
            <span className="bm-badge">{filtered.length} records</span>
          </div>
          <div className="bm-toolbar-right">
            <input className="bm-search" placeholder="Search bookings…" value={search}
              onChange={e => setSearch(e.target.value)} />
            <button className="bm-export-btn" onClick={exportCSV}>↓ CSV</button>
            <button className="bm-export-btn" onClick={exportExcel}>↓ Excel</button>
            <button className="bm-import-btn" onClick={() => setShowImportModal(true)}>↑ Import Excel</button>
          </div>
        </div>

        <div className="bm-table-wrap">
          <table className="bm-table">
            <thead>
              <tr>
                <th className="bm-th bm-th-num">#</th>
                {BM_COLS.map(col => <Th key={col.key} col={col} />)}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={`bm-${r.contract_id || i}`} className="bm-row">
                  <td className="bm-td-num">{(page - 1) * BM_PAGE_SIZE + i + 1}</td>
                  {BM_COLS.map(col => (
                    <td key={col.key} className={col.num ? 'bm-td-r' : ''}>{renderCell(r, col)}</td>
                  ))}
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={BM_COLS.length + 1} className="bm-empty-row">No matching records.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bm-pagination">
          <span className="bm-pg-info">
            {filtered.length === 0 ? '0' : `${(page - 1) * BM_PAGE_SIZE + 1}–${Math.min(page * BM_PAGE_SIZE, filtered.length)}`} of {filtered.length}
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

export { BookingMasterTab };
export default BookingMasterTab;
