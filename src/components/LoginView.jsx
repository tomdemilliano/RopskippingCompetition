/**
 * LoginView.jsx — RopeScore Pro
 *
 * Inlogscherm. Wordt getoond zodra Firebase klaar is maar er nog niemand
 * ingelogd is — vóór elk ander scherm.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAppContext } from '../AppContext';

const s = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    fontFamily: 'sans-serif',
  },
  card: {
    width: '320px',
    background: '#1e293b',
    borderRadius: '16px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  logo: {
    textAlign: 'center',
    fontWeight: 900,
    fontSize: '1.1rem',
    color: '#f1f5f9',
    marginBottom: '0.5rem',
  },
  label: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    fontWeight: 700,
    marginBottom: '0.2rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0.6rem 0.75rem',
    color: '#e2e8f0',
    fontSize: '0.9rem',
    outline: 'none',
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#fca5a5',
    borderRadius: '8px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.8rem',
  },
  submit: (disabled) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.65rem',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    marginTop: '0.4rem',
  }),
};

function friendlyError(err) {
  const code = err?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Gebruikersnaam of wachtwoord klopt niet.';
  }
  if (code.includes('too-many-requests')) {
    return 'Te veel pogingen — probeer het straks opnieuw.';
  }
  return 'Aanmelden mislukt. Probeer het opnieuw.';
}

export default function LoginView() {
  const { login } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>
          ROPESCORE <span style={{ color: '#60a5fa' }}>PRO</span>
        </div>

        {/* Geen <form>-element per CLAUDE.md — onClick i.p.v. submit */}
        <div>
          <div style={s.label}>Gebruikersnaam</div>
          <input
            style={s.input}
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            autoFocus
          />
        </div>

        <div>
          <div style={s.label}>Wachtwoord</div>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
          />
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={s.submit(busy || !username.trim() || !password)}
          disabled={busy || !username.trim() || !password}
          onClick={handleSubmit}
        >
          <LogIn size={16} />
          {busy ? 'Bezig…' : 'Inloggen'}
        </button>
      </div>
    </div>
  );
}
