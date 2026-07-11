import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../config/api';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const defaultAuditFilters = () => ({ dateFrom: daysAgoIso(9), dateTo: todayIso() });
const blankUser = { email: '', firstName: '', lastName: '', isActive: true, startDate: todayIso(), endDate: '', access: [] };

async function request(body, query) {
  const params = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${API_URL}/api/access-control/${params}`, {
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
  const [data, setData] = useState({ users: [], roles: [], logs: [], audit: { summary: {} } });
  const [auditFilters, setAuditFilters] = useState(defaultAuditFilters);
  const [tab, setTab] = useState('users');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = user?.isSuperuser || user?.access?.includes('administrator');
  const roleByKey = useMemo(() => Object.fromEntries(data.roles.map((role) => [role.key, role])), [data.roles]);
  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return data.users;
    return data.users.filter((item) =>
      [item.firstName, item.lastName, item.email, item.username]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [data.users, userSearch]);

  const goBackToSettings = () => {
    window.history.pushState(null, '', '/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const load = useCallback(async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      setData(await request(null, auditFilters));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, [canManage, auditFilters]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setModal({ mode: 'create', values: { ...blankUser } });
  const openProfile = (item) => setModal({ mode: 'profile', values: { ...item, startDate: item.startDate || '', endDate: item.endDate || '' } });
  const openPermissions = (item) => {
    const defaultStart = item.roleAudit?.[item.access[0]]?.startDate || todayIso();
    const defaultEnd = item.roleAudit?.[item.access[0]]?.endDate || '';
    setModal({ mode: 'permissions', values: { ...item, startDate: defaultStart, endDate: defaultEnd } });
  };

  const patchModal = (patch) => setModal((state) => ({ ...state, values: { ...state.values, ...patch } }));

  const toggleAccess = (key) => {
    patchModal({
      access: modal.values.access.includes(key)
        ? modal.values.access.filter((item) => item !== key)
        : [...modal.values.access, key],
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const action = modal.mode === 'permissions' ? 'save_permissions' : modal.mode === 'profile' ? 'save_profile' : 'save_user';
      const payload = modal.mode === 'create'
        ? { ...modal.values, username: modal.values.email, access: [] }
        : modal.values;
      const response = await request({ action, ...payload });
      setMessage(response.message);
      setModal(null);
      await load();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const revoke = async (item) => {
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
          <p className="settings-panel-description">Create SAML users, manage profile details, assign permissions, and inspect audit activity.</p>
        </div>
        <div className="access-head-actions">
          {canManage && <button className="access-primary" type="button" onClick={openCreate}>+ Add user</button>}
          <button className="access-back-button" type="button" onClick={goBackToSettings}>Back to Settings</button>
        </div>
      </header>

      {!canManage ? <p className="access-empty">Administrator access is required to manage access control.</p> : <>
        <div className="access-tabbar">
          <nav className="access-tabs">
            <button className={tab === 'users' ? 'active' : ''} type="button" onClick={() => setTab('users')}>Users</button>
            <button className={tab === 'logs' ? 'active' : ''} type="button" onClick={() => setTab('logs')}>Audit Logs</button>
          </nav>
          <div className="access-filter-row">
            {tab === 'users'
              ? <UserFilterBar search={userSearch} onSearch={setUserSearch} filteredCount={filteredUsers.length} totalCount={data.users.length} />
              : <AuditFilterBar auditFilters={auditFilters} setAuditFilters={setAuditFilters} />}
          </div>
        </div>
        {message && <p className="access-message">{message}</p>}

        {tab === 'users' ? <UserGrid users={filteredUsers} totalCount={data.users.length} roleByKey={roleByKey} currentUser={user} onEdit={openProfile} onPermissions={openPermissions} onRevoke={revoke} /> : <AuditBody data={data} />}
      </>}

      {modal && <AccessModal modal={modal} roles={data.roles} busy={busy} onPatch={patchModal} onToggleAccess={toggleAccess} onClose={() => setModal(null)} onSave={save} />}
    </article>
  );
}

function UserFilterBar({ search, onSearch, filteredCount, totalCount }) {
  return (
    <div className="access-user-toolbar">
      <label>
        <span>Search users</span>
        <input
          value={search}
          placeholder="Search first name, last name, email, or username"
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <small>{filteredCount} of {totalCount} users</small>
    </div>
  );
}

function UserGrid({ users, totalCount, roleByKey, currentUser, onEdit, onPermissions, onRevoke }) {
  if (!totalCount) return <p className="access-empty">No users yet.</p>;
  return (
    <div className="access-card-grid">
    {users.map((item) => {
      const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ');
      const displayName = fullName || item.email || item.username;
      const primaryContact = item.email || item.username;
      const secondaryContact = item.email && item.username && item.email !== item.username ? item.username : '';
      const permissions = item.access || [];
      const isDeveloper = item.isSuperuser || permissions.includes('developer');
      const isAdmin = item.isSuperuser || permissions.includes('administrator');
      const initials = initialsFor(fullName || item.email || item.username);
      return <section className="access-user-card" key={item.id}>
        <header>
          <span className="access-avatar">{initials}</span>
          <div>
            <h3>{displayName}</h3>
            <p title={primaryContact}>{primaryContact}</p>
            {secondaryContact && <small title={secondaryContact}>{secondaryContact}</small>}
          </div>
          <em className={item.isActive ? 'active' : 'inactive'}>{item.isActive ? 'Active' : 'Inactive'}</em>
        </header>
        <div className="access-role-chips">
          {permissions.length ? permissions.map((key) => <span key={key}>{roleByKey[key]?.label || key}</span>) : <span className="muted">No permissions</span>}
        </div>
        <div className="access-card-stats">
          <span><b>{permissions.length}</b><small>Permissions</small></span>
          <span><b>{isDeveloper ? 'Yes' : 'No'}</b><small>Developer</small></span>
          <span><b>{isAdmin ? 'Yes' : 'No'}</b><small>Admin</small></span>
        </div>
        <footer>
          <button type="button" onClick={() => onEdit(item)}>Edit profile</button>
          <button type="button" onClick={() => onPermissions(item)}>Permissions</button>
          <button type="button" className="danger" disabled={item.username === currentUser.username} onClick={() => onRevoke(item)}>Revoke</button>
        </footer>
        <p className="access-last-login">Last login: {formatDateTime(item.lastLogin)}</p>
      </section>;
    })}
    {!users.length && <p className="access-empty access-empty-wide">No users match your search.</p>}
    </div>
  );
}

function AccessModal({ modal, roles, busy, onPatch, onToggleAccess, onClose, onSave }) {
  const { mode, values } = modal;
  const isCreate = mode === 'create';
  const isProfile = mode === 'profile';
  const isPermissions = mode === 'permissions';
  const title = isCreate ? 'Create user access' : isProfile ? 'Edit profile' : 'Manage permissions';

  return <div className="access-backdrop">
    <form className="access-modal" onSubmit={onSave}>
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose}>x</button>
      </header>

      {(isCreate || isProfile) && <>
        <label>Email<input required type="email" value={values.email || ''} onChange={(event) => onPatch({ email: event.target.value, username: event.target.value })} /></label>
        <div className="access-two">
          <label>First name<input required={isCreate} value={values.firstName || ''} onChange={(event) => onPatch({ firstName: event.target.value })} /></label>
          <label>Last name<input value={values.lastName || ''} onChange={(event) => onPatch({ lastName: event.target.value })} /></label>
        </div>
        <div className="access-two">
          <label>Start date<input type="date" value={values.startDate || ''} onChange={(event) => onPatch({ startDate: event.target.value })} /></label>
          <label>End date<input type="date" value={values.endDate || ''} onChange={(event) => onPatch({ endDate: event.target.value })} /></label>
        </div>
        {isProfile && <label className="check"><input type="checkbox" checked={values.isActive} onChange={(event) => onPatch({ isActive: event.target.checked })} />Active</label>}
      </>}

      {isPermissions && <>
        <div className="access-permission-person">
          <strong>{[values.firstName, values.lastName].filter(Boolean).join(' ') || values.email}</strong>
          <span>{values.email || values.username}</span>
        </div>
        <div className="access-two">
          <label>Start date<input type="date" value={values.startDate || ''} onChange={(event) => onPatch({ startDate: event.target.value })} /></label>
          <label>End date<input type="date" value={values.endDate || ''} onChange={(event) => onPatch({ endDate: event.target.value })} /></label>
        </div>
        <fieldset>
          <legend>Application access</legend>
          <div className="access-role-grid">
            {roles.map((role) => (
              <label className="access-role" key={role.key}>
                <input type="checkbox" checked={values.access.includes(role.key)} onChange={() => onToggleAccess(role.key)} />
                <span><strong>{role.label}</strong><small>{role.description}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
      </>}

      <footer>
        <button type="button" onClick={onClose}>Cancel</button>
        <button className="access-primary" disabled={busy}>{isPermissions ? 'Save permissions' : 'Save user'}</button>
      </footer>
    </form>
  </div>;
}

function AuditFilterBar({ auditFilters, setAuditFilters }) {
  return (
    <div className="access-audit-toolbar">
      <label>From<input type="date" value={auditFilters.dateFrom} onChange={(event) => setAuditFilters((value) => ({ ...value, dateFrom: event.target.value }))} /></label>
      <label>To<input type="date" value={auditFilters.dateTo} onChange={(event) => setAuditFilters((value) => ({ ...value, dateTo: event.target.value }))} /></label>
      <button type="button" onClick={() => setAuditFilters(defaultAuditFilters())}>Last 10 days</button>
    </div>
  );
}

function AuditBody({ data }) {
  return <>
    <div className="access-audit-summary">
      <AuditStat label="Total events" value={data.audit?.summary?.total || 0} />
      <AuditStat label="Granted" value={data.audit?.summary?.grants || 0} />
      <AuditStat label="Revoked" value={data.audit?.summary?.revokes || 0} />
      <AuditStat label="Access changes" value={data.audit?.summary?.accessChanges || 0} />
      <AuditStat label="User changes" value={data.audit?.summary?.userChanges || 0} />
      <AuditStat label="Actors" value={data.audit?.summary?.actors || 0} />
    </div>
    <div className="access-log-list">
      <div className="access-log-head"><span>User</span><span>Event</span><span>Description</span><span>Changed by</span></div>
      {(data.logs || []).map((item) => (
        <div className="access-log-row" key={item.id}>
          <span><b>{item.email || item.username}</b><small>{item.username}</small></span>
          <em className={eventTone(item.action)}>{item.status}</em>
          <span className="access-log-description">{item.description}</span>
          <span><b>{item.createdBy || '-'}</b><small>{formatDateTime(item.createdDate)}</small></span>
        </div>
      ))}
      {!(data.logs || []).length && <p className="access-empty">No access logs for the selected dates.</p>}
    </div>
  </>;
}

const AuditStat = ({ label, value }) => <div className="access-audit-stat"><span>{label}</span><strong>{value}</strong></div>;

function initialsFor(value) {
  return (value || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join('') || 'U';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function eventTone(action) {
  if (action === 'role_granted' || action === 'user_created' || action === 'user_activated') return 'active';
  if (action === 'role_revoked' || action === 'user_deactivated' || action === 'user_revoked') return 'revoked';
  if (action === 'access_changed') return 'changed';
  return 'updated';
}
