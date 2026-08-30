/**
 * LoginView.jsx — SkipFlow
 *
 * Inlogscherm. Wordt getoond zodra Firebase klaar is maar er nog niemand
 * ingelogd is — vóór elk ander scherm.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow, font } from '../theme';

const s = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color.stage,
    fontFamily: font.body,
  },
  card: {
    width: '340px',
    background: color.stageAlt,
    border: `1px solid ${color.stageBorder}`,
    borderRadius: radius.xl,
    padding: '2.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    boxShadow: shadow.lg,
  },
  logoWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '0.6rem',
  },
  logoIcon: {
    width: '44px',
    height: '44px',
    borderRadius: radius.md,
    background: color.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    textAlign: 'center',
    fontWeight: 900,
    fontSize: '1.15rem',
    letterSpacing: '-0.01em',
    color: color.stageInk,
  },
  label: {
    fontSize: '0.7rem',
    color: color.stageMuted,
    fontWeight: 700,
    marginBottom: '0.2rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: color.stage,
    border: `1px solid ${color.slate}`,
    borderRadius: '8px',
    padding: '0.6rem 0.75rem',
    color: color.border,
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
    background: color.primary,
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
  if (code.includes('invalid-email')) {
    return 'Ongeldige gebruikersnaam.';
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
        <div style={s.logoWrap}>
          <div style={s.logoIcon}><LogIn size={20} /></div>
          <div style={s.logo}>
            SKIP<span style={{ color: color.primary }}>FLOW</span>
          </div>
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
