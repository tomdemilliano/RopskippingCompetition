/**
 * App.jsx — SkipFlow
 *
 * Dunne shell. Verantwoordelijk voor:
 *   - Auth-wachtstatus en inlogscherm tonen
 *   - Routing: "/" is de landingspagina (tegels), elk scherm daarna heeft
 *     zijn eigen URL, bewaakt door hasPermission() uit AppContext
 *   - Header: logo (→ terug naar landingspagina), klok, gebruiker + afmelden
 *
 * Navigatie tussen schermen gebeurt uitsluitend via de landingspagina —
 * de header zelf bevat geen kruis-scherm knoppen meer.
 *
 * Elk scherm heeft een eigen URL (hash-routing — geen server-rewrites nodig op
 * Vercel), zodat elke fysieke werkplek (inkomtafel, speakertafel, groot scherm)
 * er los naartoe kan navigeren.
 *
 * Alle data en acties komen uit AppContext.
 * Alle Firebase-toegang verloopt via dbSchema.js.
 */

import React, { useState, useEffect } from 'react';
import { Ghost, LogOut, ShieldOff, Home } from 'lucide-react';
import {
  HashRouter, Routes, Route, Navigate,
  Outlet, useNavigate,
} from 'react-router-dom';

import { AppProvider, useAppContext } from './AppContext';
import { color, font } from './theme';
import LoginView from './components/LoginView';
import HubView from './components/HubView';
import ManagementView from './components/ManagementView';
import LiveView from './components/LiveView';
import DisplayView from './components/DisplayView';
import AttendanceView from './components/AttendanceView';
import PodiumView from './components/PodiumView';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: color.bg,
    fontFamily: font.body,
  },
  header: {
    height: '60px',
    background: color.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  },
  homeLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  homeIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: color.ink,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logo: {
    fontWeight: 900,
    fontSize: '1.02rem',
    color: color.ink,
    letterSpacing: '-0.01em',
  },
  clock: {
    fontFamily: font.mono,
    fontWeight: 600,
    fontSize: '0.85rem',
    background: color.surfaceAlt,
    padding: '0.45rem 0.8rem',
    borderRadius: '6px',
    color: color.body,
    border: `1px solid ${color.border}`,
    minWidth: '62px',
    textAlign: 'center',
  },
  userChip: {
    fontSize: '0.82rem',
    color: color.body,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  logoutBtn: {
    background: 'none',
    border: `1px solid ${color.faintest}`,
    borderRadius: '6px',
    padding: '0.42rem',
    cursor: 'pointer',
    color: color.muted,
    display: 'flex',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: color.faint,
    gap: '1rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHELL LAYOUT — header + klok, rendert het actieve scherm via <Outlet/>
// ─────────────────────────────────────────────────────────────────────────────

function ShellLayout() {
  const navigate = useNavigate();
  const { userProfile, logout } = useAppContext();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <button style={styles.homeLink} onClick={() => navigate('/')} title="Terug naar overzicht">
          <div style={styles.homeIcon}><Home size={16} /></div>
          <div style={styles.logo}>
            SKIP<span style={{ color: color.primary }}>FLOW</span>
          </div>
        </button>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={styles.clock}>{timeStr}</div>
          <div style={styles.userChip}>
            {userProfile?.username ?? '…'}
            <button style={styles.logoutBtn} title="Afmelden" onClick={logout}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOEGANGSBEWAKING — toont "geen toegang" i.p.v. het scherm zonder het recht
// ─────────────────────────────────────────────────────────────────────────────

function NoAccess() {
  return (
    <div style={styles.centered}>
      <ShieldOff size={56} color={color.faintest} strokeWidth={1.5} />
      <div>
        <div style={{ fontWeight: 800, color: color.body, fontSize: '1.05rem', marginBottom: '0.4rem' }}>
          Geen toegang
        </div>
        <div style={{ fontSize: '0.85rem' }}>
          Je account heeft hier geen recht op. Vraag de beheerder om toegang.
        </div>
      </div>
    </div>
  );
}

function RequirePermission({ perm, children }) {
  const { hasPermission } = useAppContext();
  return hasPermission(perm) ? children : <NoAccess />;
}

function RequireAdmin({ children }) {
  const { userProfile } = useAppContext();
  return userProfile?.role === 'beheerder' ? children : <NoAccess />;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULLSCHERM-ROUTES — geen header, eigen "terug naar overzicht"-knop
// ─────────────────────────────────────────────────────────────────────────────

function DisplayRoute() {
  const navigate = useNavigate();
  return (
    <RequirePermission perm="backstage">
      <DisplayView onClose={() => navigate('/')} />
    </RequirePermission>
  );
}

function PodiumRoute() {
  const navigate = useNavigate();
  return (
    <RequirePermission perm="podium">
      <PodiumView onClose={() => navigate('/')} />
    </RequirePermission>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — auth-status, inloggen, dan de routes
// ─────────────────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { authReady, authError, currentUser } = useAppContext();

  // ── Foutscherm ──────────────────────────────────────────────────────────
  if (authError) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centered}>
          <div style={{
            background: color.dangerSoft, border: `1px solid ${color.dangerBorder}`,
            borderRadius: '10px', padding: '2rem', maxWidth: '400px',
            textAlign: 'center', color: '#991b1b',
          }}>
            <div style={{ fontWeight: 900, marginBottom: '0.5rem' }}>
              Firebase-fout
            </div>
            <div style={{ fontSize: '0.85rem' }}>{authError}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Laadscherm ──────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centered}>
          <Ghost size={48} strokeWidth={1.5} />
          <div style={{ fontSize: '0.9rem' }}>Verbinden met Firebase…</div>
        </div>
      </div>
    );
  }

  // ── Niet ingelogd ───────────────────────────────────────────────────────
  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<HubView />} />
        <Route path="/beheer" element={
          <RequireAdmin><ManagementView /></RequireAdmin>
        } />
        <Route path="/aanwezigheid" element={
          <RequirePermission perm="aanwezigheid"><AttendanceView /></RequirePermission>
        } />
        <Route path="/speaker" element={
          <RequirePermission perm="speaker"><LiveView /></RequirePermission>
        } />
      </Route>

      <Route path="/scherm"         element={<DisplayRoute />} />
      <Route path="/scherm/podium"  element={<PodiumRoute />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — wikkelt alles in AppProvider + router
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
}
