/**
 * App.jsx — RopeScore Pro
 *
 * Dunne shell. Verantwoordelijk voor:
 *   - Auth-wachtstatus en inlogscherm tonen
 *   - Routing tussen de schermen (beheer / aanwezigheid / speaker / scherm / scherm/podium),
 *     elk bewaakt door hasPermission() uit AppContext
 *   - Klok + uitlogknop in de header
 *
 * Elk scherm heeft een eigen URL (hash-routing — geen server-rewrites nodig op Vercel),
 * zodat elke fysieke werkplek (inkomtafel, speakertafel, groot scherm) er los naartoe
 * kan navigeren zonder eerst door Beheer te moeten — mits die gebruiker het recht heeft.
 *
 * Alle data en acties komen uit AppContext.
 * Alle Firebase-toegang verloopt via dbSchema.js.
 */

import React, { useState, useEffect } from 'react';
import { Ghost, LogOut, ShieldOff } from 'lucide-react';
import {
  HashRouter, Routes, Route, Navigate,
  Outlet, useLocation, useNavigate,
} from 'react-router-dom';

import { AppProvider, useAppContext } from './AppContext';
import LoginView from './components/LoginView';
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
    backgroundColor: '#f1f5f9',
    fontFamily: 'sans-serif',
  },
  header: {
    height: '60px',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  logo: {
    fontWeight: 900,
    fontSize: '1rem',
  },
  navBtn: (active) => ({
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    fontSize: '0.85rem',
  }),
  displayBtn: (active) => ({
    background: active ? '#38bdf8' : '#fff',
    color: active ? '#0f172a' : '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    fontSize: '0.85rem',
  }),
  clock: {
    fontWeight: 700,
    fontSize: '0.9rem',
    background: '#f8fafc',
    padding: '0.5rem 0.8rem',
    borderRadius: '6px',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    minWidth: '65px',
    textAlign: 'center',
  },
  userChip: {
    fontSize: '0.8rem',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0.45rem',
    cursor: 'pointer',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    gap: '1rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATIE — schermen binnen de normale layout (met header), per rechten-key
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/beheer',       label: 'Beheer',        perm: null },            // enkel beheerder
  { path: '/aanwezigheid', label: 'Aanwezigheid',  perm: 'aanwezigheid' },
  { path: '/speaker',      label: 'Speaker',       perm: 'speaker' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHELL LAYOUT — header + klok + nav, rendert het actieve scherm via <Outlet/>
// ─────────────────────────────────────────────────────────────────────────────

function ShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, hasPermission, logout } = useAppContext();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const isAdmin = userProfile?.role === 'beheerder';
  const visibleNavItems = NAV_ITEMS.filter(item =>
    item.perm === null ? isAdmin : hasPermission(item.perm)
  );

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div style={styles.logo}>
          ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {visibleNavItems.map(item => (
            <button
              key={item.path}
              style={styles.navBtn(location.pathname === item.path)}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
          {hasPermission('backstage') && (
            <button
              style={styles.displayBtn(false)}
              onClick={() => navigate('/scherm')}
            >
              Display
            </button>
          )}
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
      <ShieldOff size={56} color="#cbd5e1" strokeWidth={1.5} />
      <div>
        <div style={{ fontWeight: 800, color: '#475569', fontSize: '1.05rem', marginBottom: '0.4rem' }}>
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
// FULLSCHERM-ROUTES — geen header, eigen "terug naar beheer"-knop
// ─────────────────────────────────────────────────────────────────────────────

function DisplayRoute() {
  const navigate = useNavigate();
  return (
    <RequirePermission perm="backstage">
      <DisplayView onClose={() => navigate('/beheer')} />
    </RequirePermission>
  );
}

function PodiumRoute() {
  const navigate = useNavigate();
  return (
    <RequirePermission perm="podium">
      <PodiumView onClose={() => navigate('/beheer')} />
    </RequirePermission>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — auth-status, inloggen, dan de routes
// ─────────────────────────────────────────────────────────────────────────────

/** Eerste scherm waar deze gebruiker effectief recht op heeft. */
function useDefaultPath() {
  const { userProfile, hasPermission } = useAppContext();
  if (userProfile?.role === 'beheerder') return '/beheer';
  if (hasPermission('speaker'))          return '/speaker';
  if (hasPermission('backstage'))        return '/scherm';
  if (hasPermission('aanwezigheid'))     return '/aanwezigheid';
  if (hasPermission('podium'))           return '/scherm/podium';
  return '/beheer'; // toont NoAccess — duidelijker dan een lege pagina
}

function AppRoutes() {
  const { authReady, authError, currentUser } = useAppContext();

  // ── Foutscherm ──────────────────────────────────────────────────────────
  if (authError) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.centered}>
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
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

  return <LoggedInRoutes />;
}

function LoggedInRoutes() {
  const defaultPath = useDefaultPath();

  return (
    <Routes>
      <Route element={<ShellLayout />}>
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

      <Route path="*" element={<Navigate to={defaultPath} replace />} />
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
