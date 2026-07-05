import { useState, useMemo, useRef, useEffect } from 'react';
import { fmt } from './plShared';

function getWow(curr, prev, key) {
  if (!prev) return null;
  const c = curr[key] || 0, p = prev[key] || 0;
  if (p === 0) return null;
  return ((c - p) / p * 100).toFixed(1);
}

function WowBadge({ pct }) {
  if (pct === null) return null;
  const n = parseFloat(pct);
  const pos = n >= 0;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      color: pos ? '#059669' : '#dc2626',
      background: pos ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
      border: `1px solid ${pos ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
      borderRadius: 4, padding: '1px 5px', marginLeft: 5,
    }}>
      {pos ? '▲' : '▼'}{Math.abs(n)}%
    </span>
  );
}

function buildBody(week, prev) {
  const active = week.active || 0;
  const won    = week.won    || 0;
  const commit = week.commit || 0;
  const lost   = week.lost   || 0;
  const count  = week.deal_count || 0;
  const pipeWow = getWow(week, prev, 'active');

  const dir = pipeWow === null ? 'is reported at' : parseFloat(pipeWow) >= 0 ? 'grew to' : 'declined to';
  const mag = pipeWow !== null && Math.abs(parseFloat(pipeWow)) > 20 ? 'significantly ' : '';
  const winPct = (active + won) > 0 ? ((won / (active + won)) * 100).toFixed(0) : '0';
  const commitNote = commit > 0 ? ` Commit pipeline: ${fmt(commit)}.` : '';
  const lostNote   = lost > 0   ? ` ${fmt(lost)} moved to lost this week.` : '';

  return `Active pipeline ${mag}${dir} ${fmt(active)} across ${count} deals.`
    + ` Booked revenue: ${fmt(won)} (${winPct}% win rate on closed business).`
    + commitNote + lostNote
    + ` Overall health: ${active > 5000000 ? 'strong' : active > 1000000 ? 'moderate' : 'below target'}.`;
}

function buildTags(week, prev) {
  const tags = [];
  const w = getWow(week, prev, 'active');
  if (w !== null) {
    const n = parseFloat(w);
    tags.push({ label: `Pipeline ${n >= 0 ? '▲' : '▼'}${Math.abs(n)}% WoW`, color: n >= 0 ? '#059669' : '#dc2626' });
  }
  if (week.won    > 0) tags.push({ label: `${fmt(week.won)} Booked`,    color: '#2563eb' });
  if (week.commit > 0) tags.push({ label: `${fmt(week.commit)} Commit`, color: '#4f46e5' });
  if (week.lost   > 0) tags.push({ label: `${fmt(week.lost)} Lost`,     color: '#dc2626' });
  if (week.deal_count) tags.push({ label: `${week.deal_count} deals`,   color: '#6b7280' });
  return tags;
}

function Commentary({ data }) {
  const weeks = useMemo(() => {
    const wt = data.weekly_trend || [];
    return [...wt].reverse();
  }, [data.weekly_trend]);

  const weekLabels = useMemo(() => weeks.map(w => w.week).filter(Boolean), [weeks]);

  const [fromWeek, setFromWeek] = useState('');
  const [toWeek,   setToWeek]   = useState('');
  const [jumpWeek, setJumpWeek] = useState('');
  const blockRefs = useRef({});

  useEffect(() => {
    if (jumpWeek && blockRefs.current[jumpWeek]) {
      blockRefs.current[jumpWeek].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setJumpWeek('');
    }
  }, [jumpWeek]);

  const visible = useMemo(() => {
    let ws = weeks;
    if (fromWeek) ws = ws.filter(w => w.week >= fromWeek);
    if (toWeek)   ws = ws.filter(w => w.week <= toWeek);
    return ws;
  }, [weeks, fromWeek, toWeek]);

  const sel = {
    height: 28, borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: 11, padding: '0 6px',
    background: 'var(--card)', color: 'var(--text)',
  };

  return (
    <>
      {/* ── Filter / jump bar ── */}
      <div className="comm-filter-bar">
        <label style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          From Week&nbsp;
          <select style={sel} value={fromWeek} onChange={e => setFromWeek(e.target.value)}>
            <option value="">All</option>
            {[...weekLabels].reverse().map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          To Week&nbsp;
          <select style={sel} value={toWeek} onChange={e => setToWeek(e.target.value)}>
            <option value="">All</option>
            {[...weekLabels].reverse().map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: 'var(--sub)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Jump to&nbsp;
          <select style={sel} value={jumpWeek} onChange={e => setJumpWeek(e.target.value)}>
            <option value="">Select week…</option>
            {[...weekLabels].reverse().map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sub)' }}>
          {visible.length} weeks · latest first
        </span>
      </div>

      {/* ── Commentary blocks ── */}
      {visible.map((week, i) => {
        const prev = visible[i + 1] || null;
        const pipeWow = getWow(week, prev, 'active');
        const tags    = buildTags(week, prev);
        const body    = buildBody(week, prev);
        const topEntry = Object.entries(week.stages || {}).sort((a, b) => b[1] - a[1])[0];

        return (
          <div key={week.week} className="cc" ref={el => { blockRefs.current[week.week] = el; }}>
            <div className="cw">📅 {week.week}</div>
            <div className="ctitle">
              Week {week.week_num || (weeks.length - i)} Pipeline Summary
              {pipeWow !== null && <WowBadge pct={pipeWow} />}
            </div>
            <div className="cbody">
              {body}
              {topEntry && <> Largest stage: <strong>{topEntry[0]}: {fmt(topEntry[1])}</strong>.</>}
            </div>
            <div className="ctags">
              {tags.map((t, j) => (
                <span key={j} style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600,
                  color: t.color,
                  background: `${t.color}12`,
                  border: `1px solid ${t.color}33`,
                  borderRadius: 4, padding: '2px 8px',
                }}>{t.label}</span>
              ))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="cc" style={{ textAlign: 'center', color: 'var(--sub)', padding: '40px 0' }}>
          No weekly data available for the selected range.
        </div>
      )}
    </>
  );
}

export { Commentary };
export default Commentary;
