/**
 * seed-main.jsx — RopeScore Pro
 *
 * Standalone entry point voor de seed-pagina.
 * Bereikbaar via /seed.html tijdens ontwikkeling.
 *
 * Initialiseert Firebase en de DB-laag zelfstandig,
 * onafhankelijk van App.jsx.
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import { initDb } from '../dbSchema';
import { getFirebaseConfig } from '../constants';
import SeedPage from './SeedPage';

import '../index.css';

const APP_ID = 'ropescore-pro-v1';

const Bootstrap = () => {
  const [status, setStatus] = useState('init'); // init | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const init = async () => {
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

        const auth = getAuth(app);
        const db   = getFirestore(app);

        // Wacht tot auth klaar is voor DB-toegang
        await new Promise((resolve, reject) => {
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) { unsub(); resolve(); }
          });
          signInAnonymously(auth).catch(reject);
        });

        initDb(db, APP_ID);
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err.message ?? String(err));
        setStatus('error');
      }
    };

    init();
  }, []);

  if (status === 'init') {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'sans-serif', color: '#94a3b8'
      }}>
        Firebase initialiseren…
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

  return <SeedPage />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>
);
