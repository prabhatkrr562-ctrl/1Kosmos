import { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import { useDevMode } from '../../context/DevModeContext';
import oneKosmosIcon from '../../assets/images/1kosmos-icon.png';

const NAV = [
    { id: 'ar',       href: '/ar',      label: 'A/R Dashboard'  },
    { id: 'arr',      href: '/arr',     label: 'ARR Dashboard' },
    { id: 'pipeline', href: '/pipeline',label: 'Pipeline Dashboard' },
];

function Navbar({ active = 'arr', user, onLogout }) {
    const displayName = user?.name || user?.username || 'User';
    const email       = user?.email || '';
    const initial     = displayName.trim().charAt(0).toUpperCase() || 'U';

    const [open, setOpen] = useState(false);
    const dropRef = useRef(null);
    const { isDevMode, toggleDevMode } = useDevMode();

    const go = (event, href) => {
        event.preventDefault();
        if (window.location.pathname === href) return;
        window.history.pushState(null, '', href);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <nav className="navbar">
            <a className="nb-logo" href="/ar">
                <img className="nb-brand-icon" src={oneKosmosIcon} alt="1Kosmos" />
                <div className="nb-logo-text">
                    <span className="nb-name">1Kosmos</span>
                    <span className="nb-sub">Revenue Intelligence</span>
                </div>
            </a>

            <ul className="nb-links">
                {NAV.map(n => (
                    <li key={n.id}>
                        <a href={n.href} onClick={(event) => go(event, n.href)} className={active === n.id ? 'active' : ''}>{n.label}</a>
                    </li>
                ))}
            </ul>

            <div className="nb-right" ref={dropRef}>
                <button
                    className="nb-avatar-btn"
                    onClick={() => setOpen(o => !o)}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    <span className="nb-avatar">{initial}</span>
                </button>

                {open && (
                    <div className="nb-dropdown" role="menu">
                        <div className="nb-dd-profile">
                            <span className="nb-dd-avatar">{initial}</span>
                            <div className="nb-dd-meta">
                                <strong className="nb-dd-name">{displayName}</strong>
                                {email && <span className="nb-dd-email">{email}</span>}
                            </div>
                        </div>

                        <div className="nb-dd-divider" />

                        <div className="nb-dd-section">
                            <p className="nb-dd-section-label">Developer</p>
                            <div className="nb-dd-item nb-dev-row">
                                <span className="nb-dd-icon-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </span>
                                <span className="nb-dev-label">Developer Mode</span>
                                <button
                                    role="switch"
                                    aria-checked={isDevMode}
                                    className={`nb-toggle${isDevMode ? ' nb-toggle-on' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); toggleDevMode(); }}
                                    title={isDevMode ? 'Turn off developer mode' : 'Turn on developer mode'}
                                >
                                    <span className="nb-toggle-knob" />
                                </button>
                            </div>
                        </div>

                        <div className="nb-dd-divider" />

                        <div className="nb-dd-section">
                            <p className="nb-dd-section-label">Account</p>
                            <button className="nb-dd-item" onClick={() => setOpen(false)}>
                                <span className="nb-dd-icon-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                                </span>
                                Your Profile
                            </button>
                            <button className="nb-dd-item" onClick={() => setOpen(false)}>
                                <span className="nb-dd-icon-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>
                                </span>
                                Settings
                            </button>
                        </div>

                        <div className="nb-dd-divider" />

                        <div className="nb-dd-footer">
                            <button
                                className="nb-dd-signout"
                                onClick={() => { setOpen(false); onLogout(); }}
                                role="menuitem"
                            >
                                <span className="nb-dd-icon-wrap nb-dd-icon-red">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                </span>
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
