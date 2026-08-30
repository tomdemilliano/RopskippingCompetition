/**
 * UserManagement.jsx — SkipFlow
 *
 * Gebruikersbeheer — enkel bereikbaar voor de beheerder-rol (zie ManagementView).
 * Maakt gebruikers aan (username/wachtwoord) en kent per gebruiker rechten toe
 * op de vier werkplek-schermen. Een beheerder heeft altijd alle rechten.
 */

import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { color, radius, shadow } from '../../theme';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem 1.75rem',
    background: color.bg,
  },
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    maxWidth: '760px',
  },
  cardTitle: {
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.6rem',
    color: color.faint,
    fontSize: '0.65rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: `1px solid ${color.border}`,
  },
  td: {
    padding: '0.55rem 0.6rem',
    borderBottom: `1px solid ${color.borderSoft}`,
    color: color.body,
  },
  checkbox: {
    width: '17px',
    height: '17px',
    cursor: 'pointer',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: color.muted,
    marginBottom: '0.3rem',
    display: 'block',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${color.border}`,
    borderRadius: '6px',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    color: color.ink,
  },
  permsRow: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '1.2rem',
    flexWrap: 'wrap',
  },
  permLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: color.body,
  },
  submitWrap: {
    gridColumn: '1 / -1',
  },
  error: {
    gridColumn: '1 / -1',
    background: color.dangerSoft,
    border: `1px solid ${color.dangerBorder}`,
    color: '#991b1b',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
  },
  actionBtn: {
    border: 'none',
    background: 'none',
    color: color.danger,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  },
};

const PERMISSION_KEYS = [
  { key: 'speaker',      label: 'Speaker' },
  { key: 'backstage',    label: 'Backstage' },
  { key: 'podium',       label: 'Podium' },
  { key: 'aanwezigheid', label: 'Aanwezigheid' },
];

const EMPTY_PERMISSIONS = { speaker: false, backstage: false, podium: false, aanwezigheid: false };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const {
    users, loadUsers, createUser, updateUser, deleteUser, currentUser,
  } = useAppContext();

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [role, setRole]               = useState('medewerker');
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState('');

  const togglePermission = (key) => {
    setPermissions(p => ({ ...p, [key]: !p[key] }));
  };

  const handleCreate = async () => {
    if (!username.trim() || password.length < 6) {
      setError('Gebruikersnaam en een wachtwoord van minstens 6 tekens zijn verplicht.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createUser({ username, password, role, permissions });
      setUsername('');
      setPassword('');
      setRole('medewerker');
      setPermissions(EMPTY_PERMISSIONS);
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use'
        ? 'Deze gebruikersnaam bestaat al.'
        : (err.message ?? 'Aanmaken mislukt.'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleUserPermission = (user, key) => {
    updateUser(user.id, {
      permissions: { ...user.permissions, [key]: !user.permissions[key] },
    });
  };

  const handleDelete = (user) => {
    if (user.id === currentUser?.uid) {
      alert('Je kan je eigen account niet verwijderen.');
      return;
    }
    if (!window.confirm(`"${user.username}" verwijderen? Dit account verliest meteen alle toegang.`)) return;
    deleteUser(user.id);
  };

  return (
    <div style={s.wrapper}>
      {/* ── Lijst ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>Gebruikers</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Gebruiker</th>
              {PERMISSION_KEYS.map(p => <th key={p.key} style={s.th}>{p.label}</th>)}
              <th style={{ ...s.th, textAlign: 'right' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isAdmin = user.role === 'beheerder';
              return (
                <tr key={user.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 700, color: color.inkSoft, marginBottom: '2px' }}>{user.username}</div>
                    <Badge tone={isAdmin ? 'primary' : 'neutral'} icon={isAdmin ? <Shield size={10} /> : null}>
                      {isAdmin ? 'Beheerder' : 'Medewerker'}
                    </Badge>
                  </td>
                  {PERMISSION_KEYS.map(p => (
                    <td key={p.key} style={s.td}>
                      {isAdmin ? (
                        <span style={{ color: color.faintest, fontSize: '0.75rem' }}>—</span>
                      ) : (
                        <input
                          style={s.checkbox}
                          type="checkbox"
                          checked={!!user.permissions[p.key]}
                          onChange={() => handleToggleUserPermission(user, p.key)}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <button style={s.actionBtn} title="Verwijderen" onClick={() => handleDelete(user)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td style={s.td} colSpan={PERMISSION_KEYS.length + 2}>Nog geen gebruikers.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Nieuwe gebruiker ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>Nieuwe gebruiker</div>
        <div style={s.form}>
          {error && <div style={s.error}>{error}</div>}

          <div>
            <label style={s.label}>Gebruikersnaam</label>
            <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Wachtwoord</label>
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <div>
            <label style={s.label}>Rol</label>
            <select style={s.input} value={role} onChange={e => setRole(e.target.value)}>
              <option value="medewerker">Medewerker</option>
              <option value="beheerder">Beheerder (alle rechten)</option>
            </select>
          </div>

          {role === 'medewerker' && (
            <div style={s.permsRow}>
              {PERMISSION_KEYS.map(p => (
                <label key={p.key} style={s.permLabel}>
                  <input
                    style={s.checkbox}
                    type="checkbox"
                    checked={permissions[p.key]}
                    onChange={() => togglePermission(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          )}

          <div style={s.submitWrap}>
            <Button variant="primary" icon={<UserPlus size={15} />} onClick={handleCreate} disabled={busy}>
              {busy ? 'Bezig…' : 'Gebruiker aanmaken'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
