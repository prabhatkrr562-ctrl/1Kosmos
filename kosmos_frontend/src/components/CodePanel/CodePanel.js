import { useEffect, useState } from 'react';
import { useDevMode } from '../../context/DevModeContext';
import { API_URL } from '../../config/api';
import './CodePanel.css';

// ── Syntax highlighting ──────────────────────────────────────────────────────

const JS_KW = new Set([
  'import','export','default','from','const','let','var','function','return',
  'if','else','for','while','class','new','this','async','await','try','catch',
  'throw','finally','null','undefined','true','false','of','in','typeof',
  'instanceof','void','delete','switch','case','break','continue','do','static',
  'extends','super','yield','debugger','with',
]);

const PY_KW = new Set([
  'def','class','import','from','return','if','elif','else','for','while',
  'try','except','finally','with','as','in','not','and','or','True','False',
  'None','yield','async','await','lambda','pass','break','continue','raise',
  'assert','del','global','nonlocal','is','self',
]);

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hlLine(raw, kw) {
  let out = '', i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '/' && raw[i + 1] === '/') {
      out += `<span class="cp-comment">${raw.slice(i)}</span>`; break;
    }
    if (ch === '#') {
      out += `<span class="cp-comment">${raw.slice(i)}</span>`; break;
    }
    if (ch === '@' && kw === PY_KW) {
      let e = i + 1;
      while (e < raw.length && /[\w.]/.test(raw[e])) e++;
      out += `<span class="cp-dec">${raw.slice(i, e)}</span>`;
      i = e; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let e = i + 1;
      while (e < raw.length && raw[e] !== ch) { if (raw[e] === '\\') e++; e++; }
      out += `<span class="cp-str">${raw.slice(i, e + 1)}</span>`;
      i = e + 1; continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let e = i + 1;
      while (e < raw.length && /[\w$]/.test(raw[e])) e++;
      const word = raw.slice(i, e);
      if (kw.has(word))        out += `<span class="cp-kw">${word}</span>`;
      else if (raw[e] === '(') out += `<span class="cp-fn">${word}</span>`;
      else                     out += word;
      i = e; continue;
    }
    if (/[0-9]/.test(ch)) {
      let e = i + 1;
      while (e < raw.length && /[0-9._xXa-fA-F]/.test(raw[e])) e++;
      out += `<span class="cp-num">${raw.slice(i, e)}</span>`;
      i = e; continue;
    }
    out += ch; i++;
  }
  return out;
}

function highlight(code, lang) {
  const hl = lang === 'py' ? l => hlLine(l, PY_KW)
           : lang === 'js' ? l => hlLine(l, JS_KW)
           : l => l;
  return escHtml(code)
    .split('\n')
    .map(l => `<span class="cp-ln">${hl(l) || ' '}</span>`)
    .join('');
}

function getLang(path) {
  if (!path) return '';
  if (path.endsWith('.py')) return 'py';
  if (path.endsWith('.js')) return 'js';
  return '';
}

function basename(p) { return p ? p.split('/').pop() : ''; }

// ── Diff ─────────────────────────────────────────────────────────────────────

function diffLines(oldText, newText) {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  if (a.length * b.length > 4_000_000) {
    // Too large for a full LCS diff — fall back to a coarse whole-block diff.
    return [
      ...a.map((text) => ({ type: 'del', text })),
      ...b.map((text) => ({ type: 'add', text })),
    ];
  }
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', text: a[i] }); i++; }
    else { ops.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'del', text: a[i++] }); }
  while (j < m) { ops.push({ type: 'add', text: b[j++] }); }
  return ops;
}

function DiffView({ oldText, newText }) {
  const ops = diffLines(oldText, newText);
  const CONTEXT = 3;
  const visible = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type !== 'same') {
      for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(ops.length - 1, idx + CONTEXT); k++) {
        visible[k] = true;
      }
    }
  });
  const rows = [];
  let i = 0;
  while (i < ops.length) {
    if (visible[i]) { rows.push(ops[i]); i++; continue; }
    let j = i;
    while (j < ops.length && !visible[j]) j++;
    rows.push({ type: 'skip', count: j - i });
    i = j;
  }
  return (
    <pre className="cp-diff-body">
      {rows.map((op, idx) => op.type === 'skip' ? (
        <div key={idx} className="cp-diff-skip">
          {`⋯ ${op.count} unchanged line${op.count === 1 ? '' : 's'} ⋯`}
        </div>
      ) : (
        <div key={idx} className={`cp-diff-line cp-diff-${op.type}`}>
          <span className="cp-diff-marker">{op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}</span>
          <span className="cp-diff-text">{op.text || ' '}</span>
        </div>
      ))}
    </pre>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function CodePanel() {
  const { inspected, setInspected } = useDevMode();
  const [tab,     setTab]     = useState('frontend');
  const [fileIdx, setFileIdx] = useState(0);
  const [copied,  setCopied]  = useState(false);

  const [instruction, setInstruction] = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [proposal,    setProposal]    = useState(null); // { file, original, updated, unchanged }
  const [applying,    setApplying]    = useState(false);

  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');

  const close = () => setInspected(null);

  const resetAiState = () => {
    setInstruction('');
    setAiLoading(false);
    setAiError('');
    setProposal(null);
    setApplying(false);
  };

  const resetEditState = () => {
    setEditing(false);
    setDraft('');
    setSaving(false);
    setSaveError('');
  };

  useEffect(() => { setTab('frontend'); setFileIdx(0); setCopied(false); resetAiState(); resetEditState(); }, [inspected?.name]);
  useEffect(() => { setFileIdx(0); setCopied(false); resetAiState(); resetEditState(); }, [tab]);
  useEffect(() => { setCopied(false); resetAiState(); resetEditState(); }, [fileIdx]);

  useEffect(() => {
    if (!inspected) return;
    const h = (e) => { if (e.key === 'Escape') setInspected(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [inspected, setInspected]);

  if (!inspected) return null;

  const files  = inspected[tab] || [];
  const file   = files[fileIdx] || null;
  const isLoad = inspected.loading;
  const isErr  = !!inspected.error;

  let body;
  if (isLoad) {
    body = (
      <div className="cp-status">
        <svg className="cp-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
        </svg>
        Loading source files…
      </div>
    );
  } else if (isErr) {
    body = (
      <div className="cp-status cp-status-err">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {inspected.error}
      </div>
    );
  } else if (!file) {
    body = <div className="cp-status">No files registered for this component.</div>;
  } else if (file.error) {
    body = <div className="cp-status cp-status-err">{file.error}</div>;
  } else if (editing) {
    body = (
      <textarea
        className="cp-edit-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        disabled={saving}
        autoFocus
      />
    );
  } else if (proposal && proposal.file === file.file && !proposal.unchanged) {
    body = <DiffView oldText={proposal.original} newText={proposal.updated} />;
  } else if (proposal && proposal.file === file.file && proposal.unchanged) {
    body = <div className="cp-status">Claude didn't suggest any changes to this file.</div>;
  } else {
    const lang = getLang(file.file);
    const code = highlight(file.code || '', lang);
    body = <pre className="cp-code" dangerouslySetInnerHTML={{ __html: code }} />;
  }

  const askClaude = async () => {
    if (!file || file.error || !instruction.trim()) return;
    setAiLoading(true);
    setAiError('');
    setProposal(null);
    try {
      const res = await fetch(`${API_URL}/api/dev/ai-edit/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file.file, instruction: instruction.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProposal(data);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    setAiError('');
    try {
      const res = await fetch(`${API_URL}/api/dev/ai-apply/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: proposal.file,
          updated: proposal.updated,
          original: proposal.original,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Patch the already-loaded source so the panel reflects the new code
      // without a round-trip back through the source-code endpoint.
      setInspected((prev) => {
        if (!prev) return prev;
        const nextFiles = (prev[tab] || []).map((f) =>
          f.file === proposal.file ? { ...f, code: proposal.updated } : f
        );
        return { ...prev, [tab]: nextFiles };
      });
      setProposal(null);
      setInstruction('');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const startEdit = () => {
    if (!file || file.error) return;
    setProposal(null);
    setDraft(file.code || '');
    setSaveError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
    setSaveError('');
  };

  const saveEdit = async () => {
    if (!file) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_URL}/api/dev/ai-apply/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: file.file, updated: draft, original: file.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInspected((prev) => {
        if (!prev) return prev;
        const nextFiles = (prev[tab] || []).map((f) =>
          f.file === file.file ? { ...f, code: draft } : f
        );
        return { ...prev, [tab]: nextFiles };
      });
      setEditing(false);
      setDraft('');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (!file || file.error || !file.code) return;
    try {
      await navigator.clipboard.writeText(file.code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = file.code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <div className="cp-backdrop" onClick={close} />
      <div className="cp-panel">

        {/* ── Toolbar ── */}
        <div className="cp-toolbar">
          <div className="cp-tabs">
            {[['frontend', 'Frontend'], ['backend', 'Backend']].map(([id, label]) => (
              <button
                key={id}
                className={`cp-tab${tab === id ? ' cp-tab-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cp-breadcrumb">
            <span className="cp-crumb-dim">{inspected.name}</span>
            {file && !isLoad && !isErr && <>
              <span className="cp-crumb-dim"> › </span>
              <span className="cp-crumb-name">{basename(file.file)}</span>
            </>}
          </div>
          {file && !isLoad && !isErr && !file.error && !editing && (
            <button className="cp-copy" onClick={startEdit} title="Edit file directly">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <span>Edit</span>
            </button>
          )}
          {file && !isLoad && !isErr && !file.error && (
            <button className={`cp-copy${copied ? ' cp-copy-ok' : ''}`} onClick={copyCode} title="Copy code">
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
          <button className="cp-close" onClick={close} title="Close (Esc)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── File pills ── */}
        {!isLoad && !isErr && files.length > 1 && (
          <div className="cp-filepills">
            {files.map((f, idx) => (
              <button
                key={idx}
                className={`cp-filepill${fileIdx === idx ? ' cp-filepill-active' : ''}`}
                onClick={() => setFileIdx(idx)}
                title={f.file}
              >
                {basename(f.file)}
              </button>
            ))}
          </div>
        )}

        {/* ── Code body ── */}
        <div className="cp-body">
          {body}
        </div>

        {/* ── Direct edit save bar ── */}
        {!isLoad && !isErr && file && !file.error && editing && (
          <div className="cp-ai-bar">
            {saveError && <div className="cp-ai-error">{saveError}</div>}
            <div className="cp-ai-proposal-actions">
              <span className="cp-ai-proposal-label">Editing {basename(file.file)} directly</span>
              <button className="cp-ai-discard" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="cp-ai-apply" onClick={saveEdit} disabled={saving || draft === file.code}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ── Ask Claude ── */}
        {!isLoad && !isErr && file && !file.error && !editing && (
          <div className="cp-ai-bar">
            {aiError && <div className="cp-ai-error">{aiError}</div>}
            {proposal && proposal.file === file.file ? (
              <div className="cp-ai-proposal-actions">
                <span className="cp-ai-proposal-label">
                  {proposal.unchanged ? 'No changes suggested' : 'Review the diff above'}
                </span>
                <button className="cp-ai-discard" onClick={() => setProposal(null)}>
                  Discard
                </button>
                {!proposal.unchanged && (
                  <button className="cp-ai-apply" onClick={applyProposal} disabled={applying}>
                    {applying ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
            ) : (
              <div className="cp-ai-input-row">
                <textarea
                  className="cp-ai-input"
                  rows={2}
                  placeholder={`Ask Claude to edit ${basename(file.file)}…`}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      askClaude();
                    }
                  }}
                  disabled={aiLoading}
                />
                <button
                  className="cp-ai-btn"
                  onClick={askClaude}
                  disabled={aiLoading || !instruction.trim()}
                  title="Ctrl/Cmd + Enter"
                >
                  {aiLoading ? 'Thinking…' : 'Ask Claude'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
