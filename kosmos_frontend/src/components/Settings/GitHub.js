import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../config/api';

const GitHubIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;

const todayInput = () => new Date().toISOString().slice(0, 10);
const daysAgoInput = days => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
};

async function readApiResponse(response) {
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (text && contentType.includes('application/json')) return JSON.parse(text);
    if (text && text.trim().startsWith('{')) {
        try { return JSON.parse(text); } catch (_) { /* handled below */ }
    }
    throw new Error(response.status === 404
        ? 'Git API is unavailable. Restart the Django server from this project folder.'
        : `API returned an unexpected ${contentType || 'HTML'} response (${response.status}).`);
}

export default function GitHub() {
    const [git, setGit] = useState({ loading: true, action: '', data: null, message: '', error: '' });
    const [commitDialog, setCommitDialog] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [activeTab, setActiveTab] = useState('repository');
    const [auditSearch, setAuditSearch] = useState('');
    const [auditFrom, setAuditFrom] = useState(() => daysAgoInput(10));
    const [auditTo, setAuditTo] = useState(todayInput);

    const goBackToSettings = () => {
        window.history.pushState(null, '', '/settings');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const loadGitStatus = useCallback(async (silent = false) => {
        if (!silent) setGit(state => ({ ...state, loading: true }));
        try {
            const response = await fetch(`${API_URL}/api/git/status/`, { credentials: 'include' });
            const data = await readApiResponse(response);
            if (!response.ok) throw new Error(data.error || 'Unable to read repository status.');
            setGit(state => ({ ...state, loading: false, data, error: '' }));
        } catch (error) {
            setGit(state => ({ ...state, loading: false, error: error.message }));
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

    const runGitAction = async (action, message = '') => {
        if (action === 'pull' && !window.confirm(`Merge the latest generated branch into ${git.data?.mainBranch || 'main'}?`)) return;
        if (action === 'restore-previous' && !window.confirm('Restore the previous stable version locally? GitHub will not be changed.')) return;
        if (action === 'revert-previous' && !window.confirm(`Restore the previous stable version on GitHub ${git.data?.mainBranch || 'main'}? This creates a rollback commit.`)) return;
        setGit(state => ({ ...state, action, message: '', error: '' }));
        try {
            const response = await fetch(`${API_URL}/api/git/${action}/`, {
                method: 'POST',
                credentials: 'include',
                headers: action === 'push' ? { 'Content-Type': 'application/json' } : undefined,
                body: action === 'push' ? JSON.stringify({ commitMessage: message }) : undefined,
            });
            const data = await readApiResponse(response);
            if (!response.ok) throw new Error(data.error || `Unable to ${action}.`);
            setGit(state => ({ ...state, action: '', message: data.message }));
            await loadGitStatus();
            return true;
        } catch (error) {
            setGit(state => ({ ...state, action: '', error: error.message }));
            return false;
        }
    };

    const submitPush = async event => {
        event.preventDefault();
        const succeeded = await runGitAction('push', commitMessage);
        if (succeeded) {
            setCommitDialog(false);
            setCommitMessage('');
        }
    };

    const busy = Boolean(git.action);
    const changeLabel = git.error && !git.data
        ? 'API unavailable'
        : git.data?.hasChanges
            ? `${git.data.changedFiles.length} uncommitted ${git.data.changedFiles.length === 1 ? 'change' : 'changes'}`
            : 'Working tree clean';
    const blocked = busy || git.loading;
    const changes = git.data?.changes || (git.data?.changedFiles || []).map(path => ({ path, status: 'Modified', code: 'M' }));
    const filteredHistory = useMemo(() => {
        const query = auditSearch.trim().toLowerCase();
        return (git.data?.history || []).filter(entry => {
            const date = (entry.committedAt || '').slice(0, 10);
            const matchesDate = (!auditFrom || date >= auditFrom) && (!auditTo || date <= auditTo);
            const searchable = `${entry.message} ${entry.author} ${entry.email} ${entry.shortHash} ${entry.refs} ${entry.event}`.toLowerCase();
            return matchesDate && (!query || searchable.includes(query));
        });
    }, [git.data?.history, auditSearch, auditFrom, auditTo]);

    return <><article className="settings-panel github-manager">
        <header className="github-head">
            <div>
                <span className="settings-kicker">Source control</span>
                <h2>GitHub Repository</h2>
                <p className="settings-panel-description">Review repository status, push generated changes, merge stable releases, and recover previous versions.</p>
            </div>
            <div className="access-head-actions github-head-actions">
                <button className="access-primary" type="button" onClick={() => loadGitStatus()} disabled={git.loading || busy}>Refresh</button>
                <button className="access-back-button" type="button" onClick={goBackToSettings}>Back to Settings</button>
            </div>
        </header>

        <div className="github-statusbar">
            <span className={git.data?.hasChanges ? 'pending' : git.error && !git.data ? 'danger' : 'clean'}>{changeLabel}</span>
            <small>{git.data?.branch ? `Branch: ${git.data.branch}` : git.loading ? 'Reading repository status...' : 'Repository status'}</small>
        </div>

        {(git.message || git.error) && <div className={`settings-notice${git.error ? ' settings-notice-error' : ''}`} role="status">
            <span className="settings-notice-icon">{git.error ? '!' : 'ok'}</span>
            <div><strong>{git.error ? 'Action failed' : 'Action completed'}</strong><p>{git.error || git.message}</p></div>
            <button type="button" aria-label="Dismiss" onClick={() => setGit(state => ({ ...state, message: '', error: '' }))}>x</button>
        </div>}

        <nav className="github-tabs" aria-label="GitHub settings views">
            <button type="button" className={activeTab === 'repository' ? 'active' : ''} onClick={() => setActiveTab('repository')}>Repository</button>
            <button type="button" className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')}>Git Audit <span>{git.data?.history?.length || 0}</span></button>
        </nav>

        {activeTab === 'repository' ? <div className="github-workspace">
            <div className="github-summary-grid">
                <section className="github-card settings-repository-panel">
                    <div className="settings-repo-header"><PanelHeading icon="github" kicker="Repository" title="Current status" /></div>
                    {git.loading && !git.data ? <div className="settings-skeleton"><span /><span /><span /></div> : git.data ? <>
                        <a className="settings-repository" href={git.data.repository} target="_blank" rel="noreferrer"><span>{git.data.repository?.replace(/^https?:\/\//, '')}</span><span>Open</span></a>
                        <div className="settings-version-grid"><Version label="Current branch" value={git.data.branch} /><Version label="Stable version" value={git.data.stableVersion} /><Version label="Previous version" value={git.data.previousVersion} /></div>
                        <div className={`settings-worktree${git.data.hasChanges ? ' settings-worktree-pending' : ''}`}><span className="settings-worktree-icon">{git.data.hasChanges ? '!' : 'ok'}</span><div><strong>{changeLabel}</strong><span>{git.data.hasChanges ? `Next release: ${git.data.nextBranch}` : `Ready to sync with ${git.data.mainBranch || 'main'}.`}</span></div></div>
                    </> : <div className="settings-empty"><strong>Repository unavailable</strong><span>Refresh to try reading its status again.</span></div>}
                </section>

                <ActionPanel kicker="Deployment" title="Sync changes" badge="Safe actions" description="Create a versioned branch and promote it when ready.">
                    <ActionButton primary icon="Up" title={git.action === 'push' ? 'Pushing changes...' : 'Commit & push'} detail={`Create ${git.data?.nextBranch || 'next version branch'}`} disabled={blocked || !git.data?.hasChanges} onClick={() => setCommitDialog(true)} />
                    <ActionButton icon="Sync" title={git.action === 'pull' ? 'Merging branch...' : 'Merge to stable'} detail="Promote latest release" disabled={blocked || !git.data?.latestBranch || git.data?.hasChanges} onClick={() => runGitAction('pull')} />
                </ActionPanel>

                <ActionPanel recovery kicker="Version control" title="Recovery" badge="Use with care" description="Recover the previous stable repository version.">
                    <ActionButton danger icon="Back" title={git.action === 'revert-previous' ? 'Publishing rollback...' : 'Rollback GitHub'} detail={git.data?.stableVersion ? `${git.data.stableVersion} to ${git.data.previousVersion || 'previous stable'}` : 'Revert stable branch'} disabled={blocked || !git.data?.canRestorePrevious || git.data?.hasChanges} onClick={() => runGitAction('revert-previous')} />
                </ActionPanel>
            </div>

            <ChangesTable changes={changes} />
        </div> : <GitAudit
            entries={filteredHistory}
            total={git.data?.history?.length || 0}
            search={auditSearch}
            from={auditFrom}
            to={auditTo}
            repository={git.data?.repository}
            onSearch={setAuditSearch}
            onFrom={setAuditFrom}
            onTo={setAuditTo}
            onReset={() => { setAuditSearch(''); setAuditFrom(daysAgoInput(10)); setAuditTo(todayInput()); }}
        />}
    </article>

    {commitDialog && <div className="access-backdrop github-commit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setCommitDialog(false); }}>
        <form className="access-modal github-commit-modal" onSubmit={submitPush}>
            <header><div><span className="settings-kicker">Guided Git workflow</span><h2>Commit and push changes</h2></div><button type="button" aria-label="Close" disabled={busy} onClick={() => setCommitDialog(false)}>×</button></header>
            <p className="settings-panel-description">Review the files, enter a meaningful commit message, and the complete workflow will run in sequence.</p>
            <div className="github-flow">
                <div className="done"><span>1</span><strong>Status</strong><small>{git.data?.changedFiles?.length || 0} changes found</small></div>
                <div><span>2</span><strong>Branch</strong><small>{git.data?.nextBranch || 'v1'}</small></div>
                <div><span>3</span><strong>Commit</strong><small>Your message</small></div>
                <div><span>4</span><strong>Push</strong><small>Publish to GitHub</small></div>
            </div>
            <div className="github-commit-summary"><span>New branch</span><strong>{git.data?.nextBranch || 'v1'}</strong><small>The next number is selected automatically from existing version branches.</small></div>
            <label>Commit message
                <input autoFocus value={commitMessage} maxLength={200} required disabled={busy} placeholder="Example: Improve access control audit workflow" onChange={event => setCommitMessage(event.target.value)} />
                <small className="github-character-count">{commitMessage.length}/200</small>
            </label>
            <div className="github-modal-files"><strong>Files included</strong>{(git.data?.changes || []).map(change => <span key={change.path}><b>{change.code}</b>{change.path}</span>)}</div>
            <footer><button type="button" disabled={busy} onClick={() => setCommitDialog(false)}>Cancel</button><button className="access-primary" type="submit" disabled={busy || !commitMessage.trim()}>{busy ? 'Running status → add → commit → push…' : `Create ${git.data?.nextBranch || 'branch'} and push`}</button></footer>
        </form>
    </div>}
    </>;
}

function ChangesTable({ changes }) {
    return <section className="github-table-card github-changes-card">
        <div className="github-table-title"><div><strong>Working tree changes</strong><span>Files that will be included in the next commit</span></div><b>{changes.length} {changes.length === 1 ? 'file' : 'files'}</b></div>
        <div className="github-table-scroll">
            <div className="github-data-row github-change-header"><span>Status</span><span>File path</span><span>Change type</span></div>
            {changes.length ? changes.map(change => <div className="github-data-row" key={`${change.code}-${change.path}`}>
                <span><i className={`github-change-code change-${change.code?.toLowerCase()}`}>{change.code}</i></span>
                <code title={change.path}>{change.path}</code>
                <span className="github-change-label">{change.status}</span>
            </div>) : <div className="github-table-empty"><strong>Working tree is clean</strong><span>There are no local files waiting to be committed.</span></div>}
        </div>
    </section>;
}

function GitAudit({ entries, total, search, from, to, repository, onSearch, onFrom, onTo, onReset }) {
    return <section className="github-audit-view">
        <div className="github-audit-filters">
            <label><span>Search activity</span><input value={search} placeholder="Message, author, hash or branch" onChange={event => onSearch(event.target.value)} /></label>
            <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={event => onFrom(event.target.value)} /></label>
            <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={event => onTo(event.target.value)} /></label>
            <button type="button" onClick={onReset}>Reset</button>
        </div>
        <div className="github-table-card github-audit-card">
            <div className="github-table-title"><div><strong>Repository audit trail</strong><span>Commits, merges and rollback activity across all branches</span></div><b>{entries.length} of {total} events</b></div>
            <div className="github-table-scroll">
                <div className="github-audit-row github-audit-header"><span>Event</span><span>Description</span><span>Performed by</span><span>Date and time</span><span>Commit</span></div>
                {entries.length ? entries.map(entry => <div className="github-audit-row" key={entry.hash}>
                    <span><i className={`github-event github-event-${entry.event.toLowerCase()}`}>{entry.event}</i></span>
                    <span className="github-audit-description"><strong title={entry.message}>{entry.message}</strong><small title={entry.refs}>{entry.refs || 'No branch reference'}</small></span>
                    <span className="github-audit-author"><strong>{entry.author}</strong><small>{entry.email}</small></span>
                    <time dateTime={entry.committedAt}>{formatAuditDate(entry.committedAt)}</time>
                    {repository ? <a href={`${repository}/commit/${entry.hash}`} target="_blank" rel="noreferrer">{entry.shortHash}</a> : <code>{entry.shortHash}</code>}
                </div>) : <div className="github-table-empty"><strong>No audit events found</strong><span>Adjust the search text or selected date range.</span></div>}
            </div>
        </div>
    </section>;
}

function formatAuditDate(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function PanelHeading({ icon, kicker, title }) {
    return <div className="settings-panel-heading"><div className={`settings-icon settings-icon-${icon}`}>{icon === 'github' ? <GitHubIcon /> : icon}</div><div><span className="settings-kicker">{kicker}</span><h2>{title}</h2></div></div>;
}

const Version = ({ label, value }) => <div><span>{label}</span><strong title={value}>{value || 'Not available'}</strong></div>;

function ActionPanel({ recovery = false, kicker, title, badge, description, children }) {
    return <section className={`github-card settings-actions-panel${recovery ? ' settings-recovery-panel' : ''}`}><div className="settings-section-title"><div><span className="settings-kicker">{kicker}</span><h2>{title}</h2></div><span className={recovery ? 'settings-caution-label' : 'settings-safe-label'}>{badge}</span></div><p className="settings-panel-description">{description}</p><div className="settings-action-grid">{children}</div></section>;
}

function ActionButton({ icon, title, detail, disabled, onClick, primary = false, danger = false }) {
    return <button type="button" className={`settings-action${primary ? ' settings-action-primary' : ''}${danger ? ' settings-action-danger' : ''}`} disabled={disabled} onClick={onClick}><span className="settings-action-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span></button>;
}
