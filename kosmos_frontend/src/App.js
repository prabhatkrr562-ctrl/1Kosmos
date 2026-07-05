import { useEffect, useState } from 'react';
import './App.css';
import MainLayout from './layouts/MainLayout';
import { DevModeProvider } from './context/DevModeContext';
import { CodePanel } from './components/CodePanel/CodePanel';
import LoginPage, { LoginLoading } from './pages/LoginPage';
import './compact-density.css';
import { API_URL } from './config/api';

function App() {
  const [auth, setAuth] = useState({ loading: true, user: null, error: '' });
  const [localLogin, setLocalLogin] = useState({ username: '', password: '', loading: false });

  useEffect(() => {
    fetch(`${API_URL}/api/auth/me/`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) return { authenticated: false };
        if (!res.ok) throw new Error('Unable to reach the authentication service.');
        return res.json();
      })
      .then((data) => {
        setAuth({ loading: false, user: data.authenticated ? data.user : null, error: '' });
      })
      .catch((err) => {
        setAuth({ loading: false, user: null, error: err.message });
      });
  }, []);

  const startSso = () => {
    window.location.href = `${API_URL}/api/auth/saml/login/`;
  };

  const updateLocalLogin = (patch) => {
    setLocalLogin((state) => ({ ...state, ...patch }));
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout/`, { method: 'POST', credentials: 'include' });
    setAuth({ loading: false, user: null, error: '' });
  };

  const submitLocalLogin = async (event) => {
    event.preventDefault();
    setLocalLogin((state) => ({ ...state, loading: true }));
    setAuth((state) => ({ ...state, error: '' }));
    try {
      const res = await fetch(`${API_URL}/api/auth/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: localLogin.username,
          password: localLogin.password,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || 'Local login failed.');
      setAuth({ loading: false, user: data.user, error: '' });
      setLocalLogin({ username: '', password: '', loading: false });
    } catch (err) {
      setAuth({ loading: false, user: null, error: err.message });
      setLocalLogin((state) => ({ ...state, loading: false }));
    }
  };

  if (auth.loading) {
    return <LoginLoading />;
  }

  if (!auth.user) {
    return (
      <LoginPage
        error={auth.error}
        localLogin={localLogin}
        onLocalLoginChange={updateLocalLogin}
        onLocalLoginSubmit={submitLocalLogin}
        onSsoLogin={startSso}
      />
    );
  }

  return (
    <DevModeProvider>
      <CodePanel />
      <MainLayout user={auth.user} onLogout={logout} />
    </DevModeProvider>
  );
}

export default App;
