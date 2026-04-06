/**
 * App.jsx — RopeScore Pro
 *
 * Dunne shell. Verantwoordelijk voor:
 *   - Auth-wachtstatus tonen
 *   - Routing tussen de drie views (beheer / live / display)
 *   - Klok in de header
 *
 * Alle data en acties komen uit AppContext.
 * Alle Firebase-toegang verloopt via dbSchema.js.
 */

import React, { useState, useEffect } from 'react';
import { Ghost } from 'lucide-react';

import { AppProvider, useAppContext } from './AppContext';
import ManagementView from './components/ManagementView';
import LiveView from './components/LiveView';
import DisplayView from './components/DisplayView';

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
// INNER APP (heeft toegang tot context)
// ─────────────────────────────────────────────────────────────────────────────

function InnerApp() {
  const { authReady, authError } = useAppContext();
  const [view, setView]         = useState('management');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

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

  // ── Display view (fullscreen, geen header) ───────────────────────────────
  if (view === 'display') {
    return <DisplayView onClose={() => setView('management')} />;
  }

  // ── Normale layout ───────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div style={styles.logo}>
          ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            style={styles.navBtn(view === 'management')}
            onClick={() => setView('management')}
          >
            Beheer
          </button>
          <button
            style={styles.navBtn(view === 'live')}
            onClick={() => setView('live')}
          >
            Live
          </button>
          <button
            style={styles.displayBtn(view === 'display')}
            onClick={() => setView('display')}
          >
            Display
          </button>
          <div style={styles.clock}>{timeStr}</div>
        </div>
      </header>

      {view === 'management' && <ManagementView />}
      {view === 'live'       && <LiveView />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — wikkelt alles in AppProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  );
}
