import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../config/api';

const blankUser = {
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  isActive: true,
  isStaff: false,
  access: [],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
};

async function request(body) {
  const response = await fetch(`${API_URL}/api/access-control/`, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to manage access control.');
  return data;
}

export default function AccessControl({ user }) {
  const [data, setData] = useState({ users: [], roles: [] });
  const [tab, setTab] = useState('users');
  const [edit, setEdit] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = user?.isSuperuser || user?.access?.includes('administrator');

  const load = useCallback(async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      setData(await request());
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const roleByKey = useMemo(
    () => Object.fromEntries(data.roles.map((role) => [role.key, role])),
    [data.roles]
  );

  const toggleAccess = (key) => {
    setEdit((value) => ({
      ...value,
      access: value.access.includes(key)
        ? value.access.filter((item) => item !== key)
        : [...value.access, key],
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await request({ action: 'save_user', ...edit });
      setMessage(response.message);
      setEdit(null);
      await load();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Revoke all access for ${item.email || item.username}? The user record will be kept for audit history.`)) return;
    try {
      const response = await request({ action: 'revoke_user', id: item.id });
      setMessage(response.message);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <article className="settings-panel access-manager">
      <header className="access-head">
        <div>
          <span className="settings-kicker">Administration</span>
          <h2>Access Control</h2>
          <p className="settings-panel-description">Create SAML-enabled app users by username or email, then grant dashboard access.</p>
        </div>
        {canManage && <button className="access-primary" type="button" onClick={() => setEdit({ ...blankUser })}>+ Add user</button>}
      </header>

      {!canManage ? (
        <p className="access-empty">Administrator access is required to manage access control.</p>
      ) : (
        <>
          <nav className="access-tabs">
            <button className={tab === 'users' ? 'active' : ''} type="button" onClick={() => setTab('users')}>Users</button>
            <button className={tab === 'logs' ? 'active' : ''} type="button" onClick={() => setTab('logs')}>Audit Logs</button>
          </nav>
          {message && <p className="access-message">{message}</p>}
          {tab === 'users' ? <div className="access-list">
            {data.users.map((item) => {
              const defaultStart = item.roleAudit?.[item.access[0]]?.startDate || new Date().toISOString().slice(0, 10);
              const defaultEnd = item.roleAudit?.[item.access[0]]?.endDate || '';
              return (
              <div className="access-row access-user-row" key={item.id}>
                <div>
                  <b>{item.email || item.username}</b>
                  <small>{item.username}{item.firstName || item.lastName ? ` - ${[item.firstName, item.lastName].filter(Boolean).join(' ')}` : ''}</small>
                </div>
                <div className="access-chip-list">
                  {item.access.length ? item.access.map((key) => <span key={key}>{roleByKey[key]?.label || key}</span>) : <span className="muted">No access</span>}
                </div>
                <em>{item.isActive ? 'Active' : 'Inactive'}</em>
                <button type="button" onClick={() => setEdit({ ...item, startDate: defaultStart, endDate: defaultEnd })}>Edit</button>
                <button className="danger" type="button" disabled={item.username === user.username} onClick={() => remove(item)}>Revoke</button>
              </div>
            )})}
            {!busy && !data.users.length && <p className="access-empty">No users yet.</p>}
          </div> : <div className="access-log-list">
            <div className="access-log-head"><span>User</span><span>Role</span><span>Status</span><span>Start</span><span>End</span><span>Updated</span></div>
            {(data.logs || []).map((item) => (
              <div className="access-log-row" key={item.id}>
                <span><b>{item.email || item.username}</b><small>{item.username}</small></span>
                <span>{item.roleLabel}</span>
                <em className={item.status === 'Active' ? 'active' : 'revoked'}>{item.status}</em>
                <span>{item.startDate || '-'}</span>
                <span>{item.endDate || '-'}</span>
                <span><b>{item.lastUpdatedBy || item.createdBy || '-'}</b><small>{formatDateTime(item.lastUpdatedDate || item.createdDate)}</small></span>
              </div>
            ))}
            {!busy && !(data.logs || []).length && <p className="access-empty">No access logs yet.</p>}
          </div>}
        </>
      )}

      {edit && (
        <div className="access-backdrop">
          <form className="access-modal" onSubmit={save}>
            <header>
              <h2>{edit.id ? 'Edit user access' : 'Create user access'}</h2>
              <button type="button" aria-label="Close" onClick={() => setEdit(null)}>x</button>
            </header>
            <div className="access-two">
              <label>Username<input value={edit.username} onChange={(event) => setEdit({ ...edit, username: event.target.value })} /></label>
              <label>Email<input type="email" value={edit.email} onChange={(event) => setEdit({ ...edit, email: event.target.value })} /></label>
            </div>
            <div className="access-two">
              <label>First name<input value={edit.firstName} onChange={(event) => setEdit({ ...edit, firstName: event.target.value })} /></label>
              <label>Last name<input value={edit.lastName} onChange={(event) => setEdit({ ...edit, lastName: event.target.value })} /></label>
            </div>
            <div className="access-two">
              <label>Start date<input type="date" value={edit.startDate || ''} onChange={(event) => setEdit({ ...edit, startDate: event.target.value })} /></label>
              <label>End date<input type="date" value={edit.endDate || ''} onChange={(event) => setEdit({ ...edit, endDate: event.target.value })} /></label>
            </div>
            <fieldset>
              <legend>Application access</legend>
              <div className="access-role-grid">
                {data.roles.map((role) => (
                  <label className="access-role" key={role.key}>
                    <input type="checkbox" checked={edit.access.includes(role.key)} onChange={() => toggleAccess(role.key)} />
                    <span><strong>{role.label}</strong><small>{role.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check"><input type="checkbox" checked={edit.isActive} onChange={(event) => setEdit({ ...edit, isActive: event.target.checked })} />Active</label>
            <footer>
              <button type="button" onClick={() => setEdit(null)}>Cancel</button>
              <button className="access-primary" disabled={busy}>Save access</button>
            </footer>
          </form>
        </div>
      )}
    </article>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
