import { useState, useMemo } from 'react';
import { fmt, StageBadge, FcBadge } from './plShared';
import { DrillModal, DealModal, useDrill } from './DrillModal';

const SORT_OPTIONS = [
  { value: 'amount-desc',  label: 'Highest Amount'  },
  { value: 'amount-asc',   label: 'Lowest Amount'   },
  { value: 'days-desc',    label: 'Oldest First'     },
  { value: 'days-asc',     label: 'Newest First'     },
  { value: 'name-asc',     label: 'Name A→Z'         },
  { value: 'rep-asc',      label: 'Rep A→Z'          },
];

function ageBadge(days) {
  if (days == null) return <span className="b bx">—</span>;
  if (days <= 30)   return <span className="b bg">{days}d</span>;
  if (days <= 90)   return <span className="b ba">{days}d</span>;
  if (days <= 180)  return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠{days}d</span>;
}

function staleBadge(days) {
  if (days == null) return <span className="b bx">—</span>;
  if (days <= 14)   return <span className="b bg">{days}d</span>;
  if (days <= 30)   return <span className="b ba">{days}d</span>;
  if (days <= 90)   return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠{days}d</span>;
}

function DealExplorer({ data }) {
  const { deals = [] } = data;
  const { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal } = useDrill();
  const [search, setSearch] = useState('');
  const [sort,   setSort]   = useState('amount-desc');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? deals.filter(d =>
          (d.deal_name || '').toLowerCase().includes(q) ||
          (d.company   || '').toLowerCase().includes(q) ||
          (d.owner     || '').toLowerCase().includes(q)
        )
      : deals;
  }, [deals, search]);

  const sorted = useMemo(() => {
    const d = [...filtered];
    switch (sort) {
      case 'amount-desc': return d.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      case 'amount-asc':  return d.sort((a, b) => (a.amount || 0) - (b.amount || 0));
      case 'days-desc':   return d.sort((a, b) => (b.days_open || 0) - (a.days_open || 0));
      case 'days-asc':    return d.sort((a, b) => (a.days_open || 0) - (b.days_open || 0));
      case 'name-asc':    return d.sort((a, b) => (a.deal_name || '').localeCompare(b.deal_name || ''));
      case 'rep-asc':     return d.sort((a, b) => (a.owner || '').localeCompare(b.owner || ''));
      default:            return d;
    }
  }, [filtered, sort]);

  const totalAmt = sorted.reduce((s, d) => s + (d.amount || 0), 0);

  function handleDrillStage(stage) {
    const sd = deals.filter(d => d.stage === stage);
    openDrill(stage, `${sd.length} deals in this stage`, sd);
  }

  return (
    <>
      <div className="anote">
        📌 <strong>Click any deal row</strong> → full deal detail popup with all fields, timeline, and related metrics.
      </div>

      {/* ── Search + sort bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="pl-search"
          style={{ flex: 1, minWidth: 220 }}
          placeholder="🔍 Search deals, companies, owners..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="pl-filter-bar"
          style={{ height: 34 }}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>{sorted.length} deals</span>
        <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>· {fmt(totalAmt)}</span>
      </div>

      {/* ── Deal table ── */}
      <div className="pl-twrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Deal Name</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Amount</th>
              <th>Weighted</th>
              <th>Owner</th>
              <th>Type</th>
              <th>Forecast</th>
              <th>Region</th>
              <th>Quarter</th>
              <th>Term</th>
              <th>Source</th>
              <th>Days Open</th>
              <th>Days Stale</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={d.record_id || i} className="pl-tr-click" onClick={() => openDeal(d)}>
                <td style={{ color: '#9ca3af', fontSize: 10 }}>{i + 1}</td>
                <td style={{ maxWidth: 170, fontSize: 10, fontWeight: 600 }} title={d.deal_name}>{d.deal_name || '—'}</td>
                <td style={{ fontSize: 10, color: 'var(--sub)', maxWidth: 120 }} title={d.company}>{d.company || '—'}</td>
                <td><StageBadge stage={d.stage} /></td>
                <td style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 11 }}>{fmt(d.amount)}</td>
                <td style={{ fontSize: 10, color: 'var(--sub)' }}>{fmt(d.weighted)}</td>
                <td style={{ fontSize: 10, color: 'var(--blue)', cursor: 'pointer' }}
                  onClick={e => {
                    e.stopPropagation();
                    const rd = deals.filter(x => x.owner === d.owner && x.stage !== 'Business Lost');
                    openDrill(`${d.owner}`, `${rd.length} deals`, rd);
                  }}>
                  {d.owner || '—'} ↗
                </td>
                <td>{d.order_type ? <span className="b bx">{d.order_type}</span> : '—'}</td>
                <td><FcBadge fc={d.forecast_category} /></td>
                <td style={{ fontSize: 10, color: 'var(--sub)' }}>{d.region || '—'}</td>
                <td style={{ fontSize: 10 }}>{d.close_quarter || '—'}</td>
                <td style={{ fontSize: 10, color: 'var(--sub)' }}>{d.term || '—'}</td>
                <td style={{ fontSize: 10, color: 'var(--sub)' }}>{d.source || '—'}</td>
                <td>{ageBadge(d.days_open)}</td>
                <td>{staleBadge(d.days_stale)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', color: 'var(--sub)', padding: '24px 0', fontSize: 12 }}>
                  No deals matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drill && <DrillModal {...drill} onClose={closeDrill} onDealClick={openDeal} />}
      {activeDeal && <DealModal deal={activeDeal} onClose={closeDeal} onDrillStage={handleDrillStage} />}
    </>
  );
}

export { DealExplorer };
export default DealExplorer;
