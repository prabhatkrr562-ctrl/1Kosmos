import oneKosmosIcon from '../../assets/images/1kosmos-icon.png';
import './DashboardLoader.css';

export function DashboardLoader({ label = 'Loading dashboard...' }) {
  return (
    <div className="dash-loader-card">
      <img src={oneKosmosIcon} alt="1Kosmos" className="dash-loader-icon" />
      <div className="dash-loader-dots" aria-label={label}>
        <span /><span /><span /><span />
        <span /><span /><span /><span />
      </div>
      <div className="dash-loader-label">{label}</div>
    </div>
  );
}
