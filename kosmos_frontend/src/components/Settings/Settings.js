import { useDevMode } from '../../context/DevModeContext';
import './Settings.css';

function Settings() {
    const { isDevMode, toggleDevMode } = useDevMode();
    const go = (href) => {
        window.history.pushState(null, '', href);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return <section className="settings-page" aria-labelledby="settings-title">
        <header className="settings-hero">
            <div>
                <span className="settings-eyebrow">Workspace control center</span>
                <h1 id="settings-title">Settings</h1>
                <p>Keep this page calm: toggle developer inspection here, then open focused admin workspaces when needed.</p>
            </div>
        </header>

        <div className="settings-hub-layout">
            <article className="settings-panel settings-developer-panel">
                <PanelHeading kicker="Developer tools" title="Developer Mode" />
                <p className="settings-panel-description">Inspect dashboard components and open their implementation details directly from the interface.</p>
                <div className="settings-mode-control">
                    <div>
                        <strong>{isDevMode ? 'Inspection enabled' : 'Inspection disabled'}</strong>
                        <span>{isDevMode ? 'Component overlays are visible.' : 'Dashboard is in standard viewing mode.'}</span>
                    </div>
                    <button type="button" role="switch" aria-checked={isDevMode} aria-label="Developer Mode" className={`settings-toggle${isDevMode ? ' settings-toggle-on' : ''}`} onClick={toggleDevMode}>
                        <span className="settings-toggle-knob" />
                    </button>
                </div>
            </article>

            <section className="settings-hub-actions" aria-label="Settings destinations">
                <button type="button" className="settings-hub-card settings-hub-card-access" onClick={() => go('/settings/access-control')}>
                    <span className="settings-hub-icon">AC</span>
                    <span>
                        <small>Administration</small>
                        <strong>Access Control</strong>
                        <em>Manage users, dashboard access, dates, and audit logs.</em>
                    </span>
                    <b>Open</b>
                </button>

                <button type="button" className="settings-hub-card settings-hub-card-github" onClick={() => go('/settings/github')}>
                    <span className="settings-hub-icon">GH</span>
                    <span>
                        <small>Source control</small>
                        <strong>GitHub</strong>
                        <em>Review repository status, sync changes, and recover versions.</em>
                    </span>
                    <b>Open</b>
                </button>
            </section>
        </div>
    </section>;
}

function PanelHeading({ kicker, title }) {
    return <div className="settings-panel-heading"><div className="settings-icon settings-icon-code">{'</>'}</div><div><span className="settings-kicker">{kicker}</span><h2>{title}</h2></div></div>;
}

export default Settings;
