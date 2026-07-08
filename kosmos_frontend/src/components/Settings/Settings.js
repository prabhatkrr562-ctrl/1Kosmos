import { useCallback, useEffect, useState } from 'react';
import { useDevMode } from '../../context/DevModeContext';
import { API_URL } from '../../config/api';
import './Settings.css';

function Settings() {
    const { isDevMode, toggleDevMode } = useDevMode();
    const [git, setGit] = useState({ loading: true, action: '', data: null, message: '', error: '' });

    const loadGitStatus = useCallback(async (silent = false) => {
        if (!silent) setGit((state) => ({ ...state, loading: true }));
        try {
            const response = await fetch(`${API_URL}/api/git/status/`, { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to read repository status.');
            setGit((state) => ({ ...state, loading: false, data }));
        } catch (error) {
            setGit((state) => ({ ...state, loading: false, error: error.message }));
        }
    }, []);

    useEffect(() => {
        if (git.action) return undefined;
        loadGitStatus();
        const refresh = () => loadGitStatus(true);
        const interval = window.setInterval(refresh, git.data?.refreshIntervalMs || 1000);
        window.addEventListener('focus', refresh);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', refresh);
        };
    }, [loadGitStatus, git.data?.refreshIntervalMs, git.action]);

    const runGitAction = async (action) => {
        if (action === 'pull' && !window.confirm(`Merge the latest generated branch into ${git.data?.mainBranch || 'main'}?`)) return;
        setGit((state) => ({ ...state, action, message: '', error: '' }));
        try {
            const response = await fetch(`${API_URL}/api/git/${action}/`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to ${action}.`);
            setGit((state) => ({ ...state, action: '', message: data.message }));
            await loadGitStatus();
        } catch (error) {
            setGit((state) => ({ ...state, action: '', error: error.message }));
        }
    };

    return (
        <section className="settings-page" aria-labelledby="settings-title">
            <div className="settings-heading">
                <span className="settings-eyebrow">Profile</span>
                <h1 id="settings-title">Settings</h1>
                <p>Manage your developer tools and connected services.</p>
            </div>

            <div className="settings-card">
                <div className="settings-row">
                    <div className="settings-icon settings-icon-code" aria-hidden="true">&lt;/&gt;</div>
                    <div className="settings-copy">
                        <h2>Developer Mode</h2>
                        <p>Inspect dashboard components and view their implementation details.</p>
                    </div>
                    <button type="button" role="switch" aria-checked={isDevMode} aria-label="Developer Mode"
                        className={`settings-toggle${isDevMode ? ' settings-toggle-on' : ''}`} onClick={toggleDevMode}>
                        <span className="settings-toggle-knob" />
                    </button>
                </div>

                <div className="settings-divider" />

                <div className="settings-row settings-github-row">
                    <div className="settings-icon settings-icon-github" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
                    </div>
                    <div className="settings-copy">
                        <h2>GitHub Repository</h2>
                        {git.loading && !git.data ? <p>Reading repository information...</p> : git.data ? (
                            <>
                                <a className="settings-repository" href={git.data.repository} target="_blank" rel="noreferrer">{git.data.repository}</a>
                                <p>Current: <strong>{git.data.branch}</strong>{git.data.latestBranch && <> · Latest: <strong>{git.data.latestBranch}</strong></>}</p>
                                <p className={git.data.hasChanges ? 'settings-change-count settings-change-count-active' : 'settings-change-count'}
                                    title={git.data.changedFiles?.join('\n') || 'Working tree is clean'}>
                                    {git.data.hasChanges
                                        ? `${git.data.changedFiles.length} local file${git.data.changedFiles.length === 1 ? '' : 's'} changed`
                                        : 'No local changes'}
                                </p>
                            </>
                        ) : <p>Repository information is unavailable.</p>}
                    </div>
                    <div className="settings-git-actions">
                        <button type="button" className="settings-action settings-action-primary"
                            disabled={Boolean(git.action) || git.loading || !git.data?.hasChanges}
                            onClick={() => runGitAction('push')}
                            title={!git.data?.hasChanges ? 'There are no local changes to push' : 'Create and push a new branch'}>
                            {git.action === 'push' ? 'Pushing...' : 'Push'}
                        </button>
                        <button type="button" className="settings-action"
                            disabled={Boolean(git.action) || git.loading || !git.data?.latestBranch || git.data?.hasChanges}
                            onClick={() => runGitAction('pull')}
                            title={git.data?.hasChanges ? 'Push or clear local changes first' : 'Merge the latest branch into main'}>
                            {git.action === 'pull' ? 'Merging...' : 'Pull'}
                        </button>
                    </div>
                </div>
                {(git.message || git.error) && (
                    <div className={`settings-git-notice${git.error ? ' settings-git-notice-error' : ''}`} role="status">{git.error || git.message}</div>
                )}
            </div>
        </section>
    );
}

export default Settings;
