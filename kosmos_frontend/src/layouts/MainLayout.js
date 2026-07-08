import Navbar from '../components/Navbar/Navbar';
import { useEffect, useState } from 'react';
import ARRMain from '../pages/ARR_Main';
import ARMain from '../pages/ARMain';
import PipelineMain from '../pages/PipelineMain';
import { DevOverlay } from '../components/DevOverlay/DevOverlay';
import Settings from '../components/Settings/Settings';

function MainLayout({ user, onLogout }) {
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        const syncPath = () => setPath(window.location.pathname);
        window.addEventListener('popstate', syncPath);
        return () => window.removeEventListener('popstate', syncPath);
    }, []);

    let currentPath = path;
    if (currentPath === '/') {
        window.history.replaceState(null, '', '/ar');
        currentPath = '/ar';
    }

    const isPipeline = currentPath.startsWith('/pipeline');
    const isSettings = currentPath === '/settings';
    const isAR = !isPipeline && (currentPath === '/ar' || currentPath.startsWith('/ar/'));
    const active = isSettings ? '' : isPipeline ? 'pipeline' : isAR ? 'ar' : 'arr';

    return (
        <>
            <DevOverlay name="Navbar">
                <Navbar active={active} user={user} onLogout={onLogout} />
            </DevOverlay>
            <main>
                {isSettings ? <Settings /> : isPipeline ? <PipelineMain /> : isAR ? <ARMain /> : <ARRMain />}
            </main>
        </>
    );
}

export default MainLayout;
