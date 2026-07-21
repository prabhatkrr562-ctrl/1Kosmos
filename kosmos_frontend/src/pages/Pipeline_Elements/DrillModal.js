import { useState } from 'react';
import { fmt, StageBadge, FcBadge } from './plShared';

/* ── Age / stale coloured badges (matching reference ageBadge / staleBadge) ── */
function AgeBadge({ days }) {
  if (days === null || days === undefined) return <span className="b bx">—</span>;
  if (days <= 30)  return <span className="b bg">{days}d</span>;
  if (days <= 90)  return <span className="b ba">{days}d</span>;
  if (days <= 180) return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠ {days}d</span>;
}

function StaleBadge({ days }) {
  if (days === null || days === undefined) return <span className="b bx">—</span>;
  if (days <= 14) return <span className="b bg">{days}d</span>;
  if (days <= 30) return <span className="b ba">{days}d</span>;
  if (days <= 90) return <span className="b bo">{days}d</span>;
  return <span className="b br">⚠ {days}d</span>;
}

function RiskBadge({ daysOpen }) {
  const d = daysOpen || 0;
  if (d > 500) return <span className="b br">🔴 High</span>;
  if (d > 180) return <span className="b ba">⚠ Medium</span>;
  return <span className="b bg">✅ Low</span>;
}

function StallRiskBadge({ score }) {
  if (score >= 70) return <span className="b br">🔴 Critical</span>;
  if (score >= 50) return <span className="b bo">🟠 High</span>;
  if (score >= 30) return <span className="b ba">🟡 Medium</span>;
  return <span className="b bg">🟢 Low</span>;
}

/* ── Scrollable deal table ── */
export function DealTable({ deals, onDealClick }) {
  const total  = deals.reduce((s, d) => s + (d.amount || 0), 0);
  const sorted = [...deals].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#374151' }}>
          {deals.length} deals ·{' '}
          <span style={{ color: '#2563eb', fontWeight: 700 }}>{fmt(total)}</span> total pipeline
        </div>
      </div>
      <div className="pl-twrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Deal Name</th><th>Company</th><th>Stage</th>
              <th>Amount</th><th>Weighted</th><th>Owner</th><th>Forecast</th>
              <th>Region</th><th>Quarter</th><th>Type</th><th>Days Open</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr
                key={d.record_id || i}
                onClick={() => onDealClick(d)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ color: '#9ca3af', fontSize: 10 }}>{i + 1}</td>
                <td style={{ fontSize: 10, maxWidth: 170, fontWeight: 600 }}>{d.deal_name}</td>
                <td className="td2" style={{ fontSize: 10 }}>{d.company}</td>
                <td><StageBadge stage={d.stage} /></td>
                <td style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(d.amount)}</td>
                <td className="td2">{fmt(d.weighted)}</td>
                <td className="td2" style={{ fontSize: 10 }}>{d.owner}</td>
                <td><FcBadge fc={d.forecast_category} /></td>
                <td className="td2" style={{ fontSize: 10 }}>{d.region || '—'}</td>
                <td className="td2" style={{ fontSize: 10 }}>{d.close_quarter || '—'}</td>
                <td style={{ fontSize: 10 }}>
                  {d.order_type ? <span className="b bx">{d.order_type}</span> : '—'}
                </td>
                <td><AgeBadge days={d.days_open} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Individual deal detail overlay ── */
export function DealModal({ deal, onClose, onDrillStage }) {
  if (!deal) return null;

  const dealName = deal.deal_name || deal.name || 'Unnamed deal';
  const company = deal.company || '—';
  const stage = deal.stage || deal.to_stage || '—';
  const forecast = deal.forecast_category || deal.forecast || '—';

  const STAGE_COL = {
    '5% - Prospecting': '#6b7280', '20%-Discovery': '#0891b2',
    '40%-Scoping': '#2563eb',      '60%-Propose':   '#7c3aed',
    '80%-Validate': '#d97706',     '90%-Negotiate & Close': '#dc2626',
    'Business Won': '#059669',     'Business Lost': '#6b7280',
  };

  return (
    <div className="deal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="deal-panel">
        <div className="deal-header">
          <div>
            <div className="deal-title">{dealName}</div>
            <div className="deal-company">{company}</div>
          </div>
          <button className="drill-close" onClick={onClose}>✕</button>
        </div>
        <div className="deal-body">
          <div className="dd-grid">
            <div className="dd-field">
              <div className="dd-label">Deal Value</div>
              <div className="dd-value big" style={{ color: '#2563eb' }}>{fmt(deal.amount)}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Weighted Value</div>
              <div className="dd-value big" style={{ color: '#d97706' }}>{fmt(deal.weighted)}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Deal Stage</div>
              <div className="dd-value" style={{ color: STAGE_COL[stage] || '#374151' }}>
                {stage}
              </div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Forecast Category</div>
              <div className="dd-value">{forecast}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Deal Owner</div>
              <div className="dd-value">{deal.owner}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Team</div>
              <div className="dd-value">{deal.team || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Region</div>
              <div className="dd-value">{deal.region || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Close Quarter</div>
              <div className="dd-value">{deal.close_quarter || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Order Type</div>
              <div className="dd-value">{deal.order_type || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Contract Term</div>
              <div className="dd-value">{deal.term || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Deal Source</div>
              <div className="dd-value">{deal.source || '—'}</div>
            </div>
            <div className="dd-field">
              <div className="dd-label">Days Open</div>
              <div className="dd-value"><AgeBadge days={deal.days_open} /></div>
            </div>
            <div className="dd-field">
              <div className="dd-label">{deal.days_stuck != null ? 'Days Stuck at Current Stage' : 'Days Since Last Activity'}</div>
              <div className="dd-value"><StaleBadge days={deal.days_stuck ?? deal.days_stale} /></div>
            </div>
            <div className="dd-field">
              <div className="dd-label">{deal.days_stuck != null ? 'Stage Stall Risk' : 'Risk Level'}</div>
              <div className="dd-value">{deal.days_stuck != null ? <StallRiskBadge score={deal.urgency_score} /> : <RiskBadge daysOpen={deal.days_open} />}</div>
            </div>
            {deal.days_stuck != null && (
              <div className="dd-field">
                <div className="dd-label">Stuck Since</div>
                <div className="dd-value">{deal.stuck_since || '—'}</div>
              </div>
            )}
          </div>

          {deal.next_step && (
            <div className="dd-field" style={{ marginBottom: 14 }}>
              <div className="dd-label">Next Step</div>
              <div className="dd-value" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.55 }}>
                {deal.next_step}
              </div>
            </div>
          )}

          {deal.recommended_action && (
            <div className="dd-field" style={{ marginBottom: 14 }}>
              <div className="dd-label">Recommended Action</div>
              <div className="dd-value" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55 }}>
                {deal.recommended_action}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              Quick Actions — click to drill further:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="sbtn" onClick={() => onDrillStage(stage)}>
                📊 All {stage} Deals
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Drill overlay panel (deal list) ── */
export function DrillModal({ title, sub, deals, onClose, onDealClick, children }) {
  return (
    <div className="drill-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drill-panel">
        <div className="drill-header">
          <div>
            <div className="drill-title">{title}</div>
            {sub && <div className="drill-sub">{sub}</div>}
          </div>
          <button className="drill-close" onClick={onClose}>✕</button>
        </div>
        <div className="drill-body">
          {children}
          {deals && deals.length > 0 && <DealTable deals={deals} onDealClick={onDealClick} />}
          {deals && deals.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No deals in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Hook: manages drill panel + deal modal state together ── */
export function useDrill() {
  const [drill, setDrill]       = useState(null);
  const [activeDeal, setDeal]   = useState(null);

  const openDrill  = (title, sub, deals, children) => setDrill({ title, sub, deals, children });
  const closeDrill = () => setDrill(null);
  const openDeal   = (d) => setDeal(d);
  const closeDeal  = () => setDeal(null);

  const drillStage = (stage, allDeals) => {
    setDeal(null);
    const filtered = allDeals.filter(d => d.stage === stage);
    setDrill({ title: `${stage} — Deals`, sub: `${filtered.length} deals in this stage · sorted by amount`, deals: filtered });
  };

  return { drill, activeDeal, openDrill, closeDrill, openDeal, closeDeal, drillStage };
}
