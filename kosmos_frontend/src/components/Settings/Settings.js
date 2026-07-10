import { useCallback, useEffect, useState } from 'react';
import { useDevMode } from '../../context/DevModeContext';
import { API_URL } from '../../config/api';
import './Settings.css';

const GitHubIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;

function Settings() {
    const { isDevMode, toggleDevMode } = useDevMode();
    const [git, setGit] = useState({ loading: true, action: '', data: null, message: '', error: '' });

    const loadGitStatus = useCallback(async (silent = false) => {
        if (!silent) setGit(state => ({ ...state, loading: true }));
        try {
            const response = await fetch(`${API_URL}/api/git/status/`, { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to read repository status.');
            setGit(state => ({ ...state, loading: false, data, error: '' }));
        } catch (error) { setGit(state => ({ ...state, loading: false, error: error.message })); }
    }, []);

    useEffect(() => {
        if (git.action) return undefined;
        loadGitStatus();
        const refresh = () => loadGitStatus(true);
        const interval = window.setInterval(refresh, git.data?.refreshIntervalMs || 1000);
        window.addEventListener('focus', refresh);
        return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
    }, [loadGitStatus, git.data?.refreshIntervalMs, git.action]);

    const runGitAction = async action => {
        if (action === 'pull' && !window.confirm(`Merge the latest generated branch into ${git.data?.mainBranch || 'main'}?`)) return;
        if (action === 'restore-previous' && !window.confirm('Restore the previous stable version locally? GitHub will not be changed.')) return;
        if (action === 'revert-previous' && !window.confirm(`Restore the previous stable version on GitHub ${git.data?.mainBranch || 'main'}? This creates a rollback commit.`)) return;
        setGit(state => ({ ...state, action, message: '', error: '' }));
        try {
            const response = await fetch(`${API_URL}/api/git/${action}/`, { method: 'POST', credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to ${action}.`);
            setGit(state => ({ ...state, action: '', message: data.message }));
            await loadGitStatus();
        } catch (error) { setGit(state => ({ ...state, action: '', error: error.message })); }
    };

    const busy = Boolean(git.action);
    const changeLabel = git.data?.hasChanges ? `${git.data.changedFiles.length} uncommitted ${git.data.changedFiles.length === 1 ? 'change' : 'changes'}` : 'Working tree clean';
    const blocked = busy || git.loading;

    return <section className="settings-page" aria-labelledby="settings-title">
        <header className="settings-hero">
            <div><span className="settings-eyebrow">Workspace control center</span><h1 id="settings-title">Settings</h1><p>Manage developer tools, deployments, and version recovery from one place.</p></div>
            <div className={`settings-health${git.data?.hasChanges ? ' settings-health-pending' : ''}`}><span className="settings-health-dot" />{git.loading && !git.data ? 'Checking workspace' : changeLabel}</div>
        </header>

        {(git.message || git.error) && <div className={`settings-notice${git.error ? ' settings-notice-error' : ''}`} role="status">
            <span className="settings-notice-icon">{git.error ? '!' : '✓'}</span><div><strong>{git.error ? 'Action failed' : 'Action completed'}</strong><p>{git.error || git.message}</p></div>
            <button type="button" aria-label="Dismiss" onClick={() => setGit(state => ({ ...state, message: '', error: '' }))}>×</button>
        </div>}

        <div className="settings-layout">
            <article className="settings-panel settings-developer-panel">
                <PanelHeading icon="code" kicker="Developer tools" title="Developer Mode" />
                <p className="settings-panel-description">Inspect dashboard components and open their implementation details directly from the interface.</p>
                <div className="settings-mode-control"><div><strong>{isDevMode ? 'Inspection enabled' : 'Inspection disabled'}</strong><span>{isDevMode ? 'Component overlays are visible.' : 'Dashboard is in standard viewing mode.'}</span></div>
                    <button type="button" role="switch" aria-checked={isDevMode} aria-label="Developer Mode" className={`settings-toggle${isDevMode ? ' settings-toggle-on' : ''}`} onClick={toggleDevMode}><span className="settings-toggle-knob" /></button>
                </div>
            </article>

            <article className="settings-panel settings-repository-panel">
                <div className="settings-repo-header"><PanelHeading icon="github" kicker="Source control" title="GitHub Repository" /><button className="settings-refresh" type="button" onClick={() => loadGitStatus()} disabled={git.loading || busy} title="Refresh status">↻</button></div>
                {git.loading && !git.data ? <div className="settings-skeleton"><span /><span /><span /></div> : git.data ? <>
                    <a className="settings-repository" href={git.data.repository} target="_blank" rel="noreferrer"><span>{git.data.repository?.replace(/^https?:\/\//, '')}</span><span>↗</span></a>
                    <div className="settings-version-grid"><Version label="Current branch" value={git.data.branch} /><Version label="Stable version" value={git.data.stableVersion} /><Version label="Previous version" value={git.data.previousVersion} /></div>
                    <div className={`settings-worktree${git.data.hasChanges ? ' settings-worktree-pending' : ''}`} title={git.data.changedFiles?.join('\n') || 'Working tree is clean'}><span className="settings-worktree-icon">{git.data.hasChanges ? '●' : '✓'}</span><div><strong>{changeLabel}</strong><span>{git.data.hasChanges ? 'Push changes before merging or restoring.' : `Ready to sync with ${git.data.mainBranch || 'main'}.`}</span></div></div>
                </> : <div className="settings-empty"><strong>Repository unavailable</strong><span>Refresh to try reading its status again.</span></div>}
            </article>

            <ActionPanel kicker="Deployment" title="Sync changes" badge="Safe actions" description="Publish local work to a generated branch, then merge the latest branch into the stable version.">
                <ActionButton primary icon="↑" title={git.action === 'push' ? 'Pushing changes…' : 'Push changes'} detail="Create a new remote branch" disabled={blocked || !git.data?.hasChanges} onClick={() => runGitAction('push')} />
                <ActionButton icon="⇄" title={git.action === 'pull' ? 'Merging branch…' : 'Merge to stable'} detail="Promote the latest branch" disabled={blocked || !git.data?.latestBranch || git.data?.hasChanges} onClick={() => runGitAction('pull')} />
            </ActionPanel>

            <ActionPanel recovery kicker="Version control" title="Recovery" badge="Use with care" description="Return to the previous stable version locally, or publish that rollback to GitHub.">
                <ActionButton icon="↶" title={git.action === 'restore-previous' ? 'Restoring locally…' : 'Restore locally'} detail="GitHub remains unchanged" disabled={blocked || !git.data?.canRestorePrevious || git.data?.hasChanges} onClick={() => runGitAction('restore-previous')} />
                <ActionButton danger icon="↶" title={git.action === 'revert-previous' ? 'Publishing rollback…' : 'Rollback GitHub'} detail="Create a revert on main" disabled={blocked || !git.data?.canRestorePrevious || git.data?.hasChanges} onClick={() => runGitAction('revert-previous')} />
            </ActionPanel>
        </div>
    </section>;
}

function PanelHeading({ icon, kicker, title }) {
    return <div className="settings-panel-heading"><div className={`settings-icon settings-icon-${icon}`}>{icon === 'code' ? '</>' : <GitHubIcon />}</div><div><span className="settings-kicker">{kicker}</span><h2>{title}</h2></div></div>;
}

const Version = ({ label, value }) => <div><span>{label}</span><strong title={value}>{value || 'Not available'}</strong></div>;

function ActionPanel({ recovery = false, kicker, title, badge, description, children }) {
    return <article className={`settings-panel settings-actions-panel${recovery ? ' settings-recovery-panel' : ''}`}><div className="settings-section-title"><div><span className="settings-kicker">{kicker}</span><h2>{title}</h2></div><span className={recovery ? 'settings-caution-label' : 'settings-safe-label'}>{badge}</span></div><p className="settings-panel-description">{description}</p><div className="settings-action-grid">{children}</div></article>;
}

function ActionButton({ icon, title, detail, disabled, onClick, primary = false, danger = false }) {
    return <button type="button" className={`settings-action${primary ? ' settings-action-primary' : ''}${danger ? ' settings-action-danger' : ''}`} disabled={disabled} onClick={onClick}><span className="settings-action-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span></button>;
}

export default Settings;
