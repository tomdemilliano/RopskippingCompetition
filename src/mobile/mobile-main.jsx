/**
 * mobile-main.jsx — SkipFlow
 *
 * Standalone entry point voor de publieke mobiele live-weergave.
 * Bereikbaar via /mobile.html?id=<competitionId>.
 *
 * Zelfde bootstrap-patroon als seed-main.jsx (eigen Firebase-init, eigen
 * ReactDOM.createRoot, los van App.jsx/react-router), met één bewust
 * verschil: GEEN enkele import uit firebase/auth, geen signInAnonymously —
 * dat is de structurele garantie dat deze pagina nooit een nieuwe Firebase
 * Auth-gebruiker aanmaakt. Firestore-leesrechten verlopen volledig via
 * krap afgebakende publieke `allow read`-regels (zie firestore.rules en
 * ARCHITECTURE.md — Mobiele publieke live-weergave).
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

import { initDb } from '../dbSchema';
import { getFirebaseConfig, APP_ID } from '../constants';
import MobileLiveView from '../components/MobileLiveView';

import '../index.css';

// Wedstrijd-ID uit de link — nooit "de toevallig actieve wedstrijd": een
// link zonder (geldig) id valt expliciet terug op een "ongeldige link"-
// scherm in MobileLiveView, nooit op een actieve wedstrijd raden.
const competitionId = new URLSearchParams(window.location.search).get('id') || null;

const Bootstrap = () => {
  const [status, setStatus] = useState('init'); // init | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      const firebaseConfig = getFirebaseConfig();
      if (!firebaseConfig) {
        throw new Error(
          'Geen Firebase-configuratie gevonden. ' +
          'Controleer VITE_FIREBASE_CONFIG in je .env bestand.'
        );
      }

      const app = !getApps().length
        ? initializeApp(firebaseConfig)
        : getApps()[0];

      const db = getFirestore(app);
      initDb(db, APP_ID);
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err.message ?? String(err));
      setStatus('error');
    }
  }, []);

  if (status === 'init') {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'sans-serif', color: '#94a3b8'
      }}>
        Laden…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'sans-serif'
      }}>
        <div style={{
          maxWidth: '480px', padding: '2rem', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b'
        }}>
          <div style={{ fontWeight: 900, marginBottom: '0.5rem' }}>
            Initialisatie mislukt
          </div>
          <div style={{ fontSize: '0.85rem' }}>{errorMsg}</div>
        </div>
      </div>
    );
  }

  return <MobileLiveView competitionId={competitionId} />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>
);
