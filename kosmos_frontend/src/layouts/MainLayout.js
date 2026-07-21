import Navbar from '../components/Navbar/Navbar';
import { useEffect, useState } from 'react';
import ARRMain from '../pages/ARR_Main';
import ARMain from '../pages/ARMain';
import PipelineMain from '../pages/PipelineMain';
import { DevOverlay } from '../components/DevOverlay/DevOverlay';
import Settings from '../components/Settings/Settings';
import AccessControl from '../components/Settings/AccessControl';
import GitHub from '../components/Settings/GitHub';

function MainLayout({ user, onLogout }) {
    const [path, setPath] = useState(window.location.pathname);
    const access = user?.isSuperuser ? ['administrator', 'developer', 'pipeline', 'ar', 'arr'] : (user?.access || []);
    const canOpen = (key) => user?.isSuperuser || access.includes(key);

    useEffect(() => {
        const syncPath = () => setPath(window.location.pathname);
        window.addEventListener('popstate', syncPath);
        return () => window.removeEventListener('popstate', syncPath);
    }, []);

    let currentPath = path;
    if (currentPath === '/') {
        const firstPath = canOpen('ar') ? '/ar' : canOpen('arr') ? '/arr' : canOpen('pipeline') ? '/pipeline' : '/settings';
        window.history.replaceState(null, '', firstPath);
        currentPath = firstPath;
    }

    const isPipeline = currentPath.startsWith('/pipeline');
    const isSettings = currentPath === '/settings' || currentPath.startsWith('/settings/');
    const isAccessControl = currentPath === '/settings/access-control';
    const isGitHub = currentPath === '/settings/github';
    const isAR = !isPipeline && (currentPath === '/ar' || currentPath.startsWith('/ar/'));
    const isARR = !isSettings && !isPipeline && !isAR;
    const active = isSettings ? '' : isPipeline ? 'pipeline' : isAR ? 'ar' : 'arr';
    const blocked =
        (isAccessControl && !canOpen('administrator')) ||
        (isGitHub && !canOpen('developer')) ||
        (isSettings && !isAccessControl && !isGitHub && !canOpen('administrator') && !canOpen('developer')) ||
        (isPipeline && !canOpen('pipeline')) ||
        (isAR && !canOpen('ar')) ||
        (isARR && !canOpen('arr'));

    return (
        <>
            <DevOverlay name="Navbar">
                <Navbar active={active} user={user} onLogout={onLogout} />
            </DevOverlay>
            <main>
                {blocked ? <AccessDenied /> : isAccessControl ? <SettingsShell title="Access Control" backLabel="Settings" hideHeader><AccessControl user={user} /></SettingsShell> : isGitHub ? <SettingsShell title="GitHub" backLabel="Settings" hideHeader><GitHub /></SettingsShell> : isSettings ? <Settings user={user} /> : isPipeline ? <PipelineMain user={user} /> : isAR ? <ARMain user={user} /> : <ARRMain user={user} />}
            </main>
        </>
    );
}

function SettingsShell({ title, backLabel, children, hideHeader = false }) {
    const goBack = () => {
        window.history.pushState(null, '', '/settings');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return <section className="settings-page">
        {!hideHeader && <header className="settings-subpage-head">
            <button type="button" onClick={goBack}>Back to {backLabel}</button>
            <div>
                <span className="settings-eyebrow">Workspace control center</span>
                <h1>{title}</h1>
            </div>
        </header>}
        <div className="settings-layout">{children}</div>
    </section>;
}

function AccessDenied() {
    return <section className="settings-page"><article className="settings-panel"><span className="settings-kicker">Access Control</span><h2>Access required</h2><p className="settings-panel-description">You do not have any role assigned in the application. Please contact the Application Administrator.</p></article></section>;
}

export default MainLayout;
