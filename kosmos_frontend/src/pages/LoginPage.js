import oneKosmosIcon from '../assets/images/1kosmos-icon.png';
import './LoginPage.css';

function LoginIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

export function LoginLoading() {
  return (
    <div className="auth-screen auth-loading-screen">
      <div className="auth-loading-card">
        <img src={oneKosmosIcon} alt="1Kosmos" className="auth-loading-icon" />
        <div className="auth-loader" aria-label="Loading">
          <span /><span /><span /><span />
          <span /><span /><span /><span />
        </div>
        <div className="auth-loading-title">Opening 1Kosmos</div>
        <div className="auth-loading-copy">Checking your secure session...</div>
      </div>
    </div>
  );
}

export default function LoginPage({
  error,
  localLogin,
  onLocalLoginChange,
  onLocalLoginSubmit,
  onSsoLogin,
}) {
  return (
    <div className="auth-screen">
      <section className="auth-brand-side" aria-label="1Kosmos">
        <img src={oneKosmosIcon} alt="" className="auth-brand-icon" />
        <div className="auth-brand-text">
          <span>1Kosmos</span>
        </div>
      </section>

      <section className="auth-panel">
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to access your dashboard.</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-local-form" onSubmit={onLocalLoginSubmit}>
          <label>
            <span>Username</span>
            <input
              type="text"
              value={localLogin.username}
              onChange={(e) => onLocalLoginChange({ username: e.target.value })}
              placeholder="Username"
              autoComplete="username"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={localLogin.password}
              onChange={(e) => onLocalLoginChange({ password: e.target.value })}
              placeholder="Password"
              autoComplete="current-password"
            />
          </label>
          <button className="auth-admin-btn" type="submit" disabled={localLogin.loading}>
            {localLogin.loading && (
              <span className="auth-mini-loader" aria-hidden="true">
                <span /><span /><span />
              </span>
            )}
            {localLogin.loading ? 'Signing in...' : 'Sign-In As Administrator'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <button className="auth-sso-btn" type="button" onClick={onSsoLogin}>
          <span className="auth-login-icon" aria-hidden="true">
            <LoginIcon />
          </span>
          Login with SSO
        </button>
      </section>
    </div>
  );
}
