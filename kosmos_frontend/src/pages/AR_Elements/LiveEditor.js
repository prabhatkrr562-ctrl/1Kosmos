import { useCallback, useEffect, useState } from 'react';
import { API_URL } from './arShared';

const AGING_COLS  = ['customer','end_user','region','sales_rep','type','date','doc','due','bal'];
const AGING_HEADS = ['Customer','End User','Region','Sales Rep','Type','Date','Document','Due Date','Balance'];
const PAY_COLS    = ['invoice_number','customer','end_user','sales_rep','region','payment_type','date','due_date','amount'];
const PAY_HEADS   = ['Invoice #','Customer','End User','Sales Rep','Region','Type','Date','Due Date','Amount'];
const REN_COLS    = ['end_user','renewal_status','status','amount','sales_rep','region','remarks'];
const REN_HEADS   = ['End User','Renewal Status','Status','Amount','Sales Rep','Region','Remarks'];

function LiveEditor({ onApply, canManageData = false }) {
    const [sheet, setSheet] = useState('aging');
    const [rows, setRows] = useState({ aging: [], payments: [], renewals: [] });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [editBackup, setEditBackup] = useState(null);

    const loadData = useCallback(() => {
        if (!canManageData) return;
        setLoading(true);
        setEditingRow(null);
        fetch(`${API_URL}/api/ar/raw/`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                setRows({ aging: d.aging || [], payments: d.payments || [], renewals: d.renewals || [] });
            })
            .catch(() => setStatus('Could not load raw data.'))
            .finally(() => setLoading(false));
    }, [canManageData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    function updateCell(sheetKey, rowIndex, col, value) {
        setRows((prev) => ({
            ...prev,
            [sheetKey]: prev[sheetKey].map((r, i) => i === rowIndex ? { ...r, [col]: value } : r),
        }));
    }

    function addRow(sheetKey) {
        const newRow = {};
        const cols = sheetKey === 'aging' ? AGING_COLS : sheetKey === 'payments' ? PAY_COLS : REN_COLS;
        cols.forEach(col => newRow[col] = '');
        setRows((prev) => ({
            ...prev,
            [sheetKey]: [...prev[sheetKey], newRow],
        }));
        const newIndex = rows[sheetKey].length;
        setEditingRow(`${sheetKey}-${newIndex}`);
    }

    function deleteRow(sheetKey, rowIndex) {
        const row = rows[sheetKey][rowIndex];
        if (!row) return;

        if (!window.confirm('Delete this row?')) return;

        if (!row.id) {
            setRows((prev) => ({
                ...prev,
                [sheetKey]: prev[sheetKey].filter((_, i) => i !== rowIndex),
            }));
            setEditingRow(null);
            setEditBackup(null);
            setStatus('Row removed.');
            return;
        }

        setSaving(true);
        setStatus('Deleting row...');

        fetch(`${API_URL}/api/ar/save/`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                aging: [],
                payments: [],
                renewals: [],
                delete: {
                    aging: sheetKey === 'aging' ? [row.id] : [],
                    payments: sheetKey === 'payments' ? [row.id] : [],
                    renewals: sheetKey === 'renewals' ? [row.id] : [],
                },
            }),
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setRows((prev) => ({
                        ...prev,
                        [sheetKey]: prev[sheetKey].filter((_, i) => i !== rowIndex),
                    }));
                    setEditingRow(null);
                    setEditBackup(null);
                    setStatus('Row deleted successfully');
                    onApply();
                    loadData();
                } else {
                    setStatus(`Error: ${d.error}`);
                }
            })
            .catch((err) => setStatus(`Delete failed: ${err.message}`))
            .finally(() => setSaving(false));
    }

    function startEdit(sheetKey, rowIndex) {
        setEditingRow(`${sheetKey}-${rowIndex}`);
        setEditBackup(JSON.parse(JSON.stringify(rows[sheetKey][rowIndex])));
    }

    function cancelEdit(sheetKey, rowIndex) {
        if (editBackup) {
            setRows((prev) => ({
                ...prev,
                [sheetKey]: prev[sheetKey].map((r, i) => i === rowIndex ? editBackup : r),
            }));
        }
        setEditingRow(null);
        setEditBackup(null);
    }

    function saveRow(sheetKey, rowIndex) {
        setSaving(true);
        setStatus('Saving row…');

        const row = rows[sheetKey][rowIndex];
        const payload = {
            aging: sheetKey === 'aging' ? [row] : [],
            payments: sheetKey === 'payments' ? [row] : [],
            renewals: sheetKey === 'renewals' ? [row] : [],
        };

        fetch(`${API_URL}/api/ar/save/`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success) {
                    setStatus('✓ Row saved successfully');
                    setEditingRow(null);
                    setEditBackup(null);
                    onApply();
                    loadData();
                } else {
                    setStatus(`Error: ${d.error}`);
                }
            })
            .catch((err) => setStatus(`Save failed: ${err.message}`))
            .finally(() => setSaving(false));
    }

    function handleSaveCSV() {
        if (!canManageData) return;
        const cols  = sheet === 'aging' ? AGING_COLS  : sheet === 'payments' ? PAY_COLS  : REN_COLS;
        const heads = sheet === 'aging' ? AGING_HEADS : sheet === 'payments' ? PAY_HEADS : REN_HEADS;
        const data = rows[sheet];
        const csv = [heads.join(','), ...data.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${sheet}.csv`; a.click();
        URL.revokeObjectURL(url);
        setStatus('CSV downloaded.');
    }

    const currentRows = rows[sheet] || [];
    const cols  = sheet === 'aging' ? AGING_COLS  : sheet === 'payments' ? PAY_COLS  : REN_COLS;
    const heads = sheet === 'aging' ? AGING_HEADS : sheet === 'payments' ? PAY_HEADS : REN_HEADS;

    if (!canManageData) return null;

    return (
        <div className="ar-editor-wrap">
            <div className="ar-editor-toolbar">
                <span className="ar-editor-title">📝 Live Data Editor — click Edit to modify rows</span>
                <div className="ar-sheet-tabs">
                    {[['aging','AR Aging'],['payments','Payment History'],['renewals','Renewal Pending']].map(([k,l]) => (
                        <button key={k} className={`ar-sheet-tab ${sheet === k ? 'active' : ''}`} onClick={() => setSheet(k)} disabled={saving}>{l}</button>
                    ))}
                </div>
                <button className="ar-editor-btn-add" onClick={() => addRow(sheet)} disabled={saving || editingRow !== null}>+ Add Row</button>
                <button className="ar-editor-btn-save" onClick={handleSaveCSV} disabled={saving}>📥 Export CSV</button>
            </div>
            {loading
                ? <div style={{ padding: 24, color: '#718096', fontSize: 13 }}>Loading data…</div>
                : (
                    <div className="ar-editor-grid-wrap">
                        <table className="ar-egrid">
                            <thead>
                                <tr>
                                    <th className="rh">#</th>
                                    {heads.map((h) => <th key={h}>{h}</th>)}
                                    <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentRows.map((row, ri) => {
                                    const isEditing = editingRow === `${sheet}-${ri}`;
                                    return (
                                        <tr key={ri} style={{ background: isEditing ? '#f0f6ff' : 'transparent' }}>
                                            <td className="rn">{ri + 1}</td>
                                            {cols.map((c) => (
                                                <td key={c}>
                                                    {isEditing ? (
                                                        <input
                                                            value={row[c] ?? ''}
                                                            onChange={(e) => updateCell(sheet, ri, c, e.target.value)}
                                                            disabled={saving}
                                                        />
                                                    ) : (
                                                        <span style={{ color: '#4a5568', fontSize: '12px' }}>
                                                            {row[c] ?? ''}
                                                        </span>
                                                    )}
                                                </td>
                                            ))}
                                            <td style={{ textAlign: 'center', padding: '4px' }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button
                                                            onClick={() => saveRow(sheet, ri)}
                                                            disabled={saving}
                                                            style={{
                                                                background: '#22863a',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '4px 10px',
                                                                cursor: 'pointer',
                                                                borderRadius: '3px',
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => cancelEdit(sheet, ri)}
                                                            disabled={saving}
                                                            style={{
                                                                background: '#6c757d',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '4px 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '3px',
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            ✕
                                                        </button>
                                                        <button
                                                            onClick={() => deleteRow(sheet, ri)}
                                                            disabled={saving}
                                                            style={{
                                                                background: '#cb2431',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '4px 8px',
                                                                cursor: 'pointer',
                                                                borderRadius: '3px',
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            🗑
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(sheet, ri)}
                                                        disabled={saving || editingRow !== null}
                                                        style={{
                                                            background: '#1877f2',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 12px',
                                                            cursor: 'pointer',
                                                            borderRadius: '3px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }
            <div className="ar-editor-status">
                <span>{sheet === 'aging' ? 'AR Aging' : sheet === 'payments' ? 'Payment History' : 'Renewal Pending'} · {currentRows.length} rows · {cols.length} columns</span>
                <span style={{ color: status.includes('✓') ? '#22863a' : status.includes('Error') || status.includes('failed') ? '#cb2431' : '#666' }}>{status}</span>
            </div>
        </div>
    );
}

export { LiveEditor };
export default LiveEditor;
