import { useEffect, useState } from 'react';
import { useDevMode } from '../../context/DevModeContext';
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

// ── Component ────────────────────────────────────────────────────────────────

export function CodePanel() {
  const { inspected, setInspected } = useDevMode();
  const [tab,     setTab]     = useState('frontend');
  const [fileIdx, setFileIdx] = useState(0);
  const [copied,  setCopied]  = useState(false);

  const close = () => setInspected(null);

  useEffect(() => { setTab('frontend'); setFileIdx(0); setCopied(false); }, [inspected?.name]);
  useEffect(() => { setFileIdx(0); setCopied(false); }, [tab]);
  useEffect(() => { setCopied(false); }, [fileIdx]);

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
  } else {
    const lang = getLang(file.file);
    const code = highlight(file.code || '', lang);
    body = <pre className="cp-code" dangerouslySetInnerHTML={{ __html: code }} />;
  }

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
      </div>
    </>
  );
}
