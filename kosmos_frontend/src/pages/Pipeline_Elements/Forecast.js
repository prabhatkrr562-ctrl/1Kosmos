import { fmt, KpiCard, Card, StageBadge, SortTh, useSort } from './plShared';

function Forecast({ data }) {
  const { deals, kpis } = data;
  const commit  = deals.filter(d => d.forecast_category.trim() === 'Commit' || d.forecast_category.trim() === 'Commit ');
  const upside  = deals.filter(d => d.forecast_category.trim() === 'Upside');

  const { sorted: sortedCommit, sortKey: skC, dir: dC, onSort: osC } = useSort(commit, 'amount');
  const { sorted: sortedUpside, sortKey: skU, dir: dU, onSort: osU } = useSort(upside, 'amount');

  return (
    <>
      <div className="pl-kpi-strip">
        <KpiCard label="Commit"           value={fmt(kpis.commit_pipeline)} sub={`${kpis.commit_deals} deals`} color="k-cyan"   icon="📋" />
        <KpiCard label="Upside"           value={fmt(kpis.upside_pipeline)} sub={`${kpis.upside_deals} deals`} color="k-amber"  icon="⬆" />
        <KpiCard label="Won YTD"          value={fmt(kpis.won_ytd)}         sub={`${kpis.won_deals} deals`}   color="k-green"  icon="✅" />
        <KpiCard label="Best Case"        value={fmt(kpis.commit_pipeline + kpis.upside_pipeline + kpis.won_ytd)} sub="Commit + Upside + Won" color="k-blue" />
        <KpiCard label="AOP Gap"          value={fmt(Math.max(0, kpis.aop - kpis.won_ytd))} sub="Remaining to close" color={kpis.won_ytd >= kpis.aop ? 'k-green' : 'k-red'} />
        <KpiCard label="Commit Coverage"  value={`${kpis.aop ? ((kpis.commit_pipeline + kpis.won_ytd) / kpis.aop * 100).toFixed(1) : 0}%`} sub="of AOP" color="k-purple" />
      </div>

      <div className="pl-2col">
        <Card title="Commit Deals" tag={`${commit.length} · ${fmt(kpis.commit_pipeline)}`}>
          <div className="pl-twrap pl-table-scroll">
            <table>
              <thead>
                <tr>
                  <SortTh col="deal_name" sortKey={skC} dir={dC} onSort={osC}>Deal</SortTh>
                  <SortTh col="owner"     sortKey={skC} dir={dC} onSort={osC}>Owner</SortTh>
                  <SortTh col="amount"    sortKey={skC} dir={dC} onSort={osC}>Amount</SortTh>
                  <SortTh col="stage"     sortKey={skC} dir={dC} onSort={osC}>Stage</SortTh>
                  <th>Quarter</th>
                </tr>
              </thead>
              <tbody>
                {sortedCommit.map((d, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.deal_name}>{d.deal_name}</td>
                    <td>{d.owner}</td>
                    <td className="c-cyan" style={{ fontWeight: 700 }}>{fmt(d.amount)}</td>
                    <td><StageBadge stage={d.stage} /></td>
                    <td>{d.close_quarter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Upside Deals" tag={`${upside.length} · ${fmt(kpis.upside_pipeline)}`}>
          <div className="pl-twrap pl-table-scroll">
            <table>
              <thead>
                <tr>
                  <SortTh col="deal_name" sortKey={skU} dir={dU} onSort={osU}>Deal</SortTh>
                  <SortTh col="owner"     sortKey={skU} dir={dU} onSort={osU}>Owner</SortTh>
                  <SortTh col="amount"    sortKey={skU} dir={dU} onSort={osU}>Amount</SortTh>
                  <SortTh col="stage"     sortKey={skU} dir={dU} onSort={osU}>Stage</SortTh>
                  <th>Quarter</th>
                </tr>
              </thead>
              <tbody>
                {sortedUpside.map((d, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.deal_name}>{d.deal_name}</td>
                    <td>{d.owner}</td>
                    <td className="c-amber" style={{ fontWeight: 700 }}>{fmt(d.amount)}</td>
                    <td><StageBadge stage={d.stage} /></td>
                    <td>{d.close_quarter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

export { Forecast };
export default Forecast;
