import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, Download, Info 
} from 'lucide-react';

// --- FIREBASE CONFIGURATIE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
  authDomain: "ropeskippingcontest.firebaseapp.com",
  projectId: "ropeskippingcontest",
  storageBucket: "ropeskippingcontest.firebasestorage.app",
  messagingSenderId: "430066523717",
  appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

// Global vars
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState('live'); 
  const [activeTab, setActiveTab] = useState('speed');
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom bij de wedstrijd!",
  });

  const [importType, setImportType] = useState('speed');
  const [csvInput, setCsvInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            setIsAuthReady(true);
          }
        });
      } catch (e) {
        console.error("Firebase Init Error", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !db) return;

    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsubS = onSnapshot(sRef, d => d.exists() && setSettings(d.data()));
    const unsubSk = onSnapshot(skRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    });
    const unsubH = onSnapshot(hRef, s => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    });

    return () => { unsubS(); unsubSk(); unsubH(); };
  }, [isAuthReady, user]);

  const updateHeat = async (delta) => {
    if (!db) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    await updateDoc(ref, { [key]: Math.max(1, (settings[key] || 1) + delta) });
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !db) return;
    setIsProcessing(true);
    try {
      const rows = csvInput.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      if (rows.length > 0 && isNaN(parseInt(rows[0][0]))) rows.shift();

      const batch = writeBatch(db);
      for (const row of rows) {
        const reeksNum = parseInt(row[0]);
        if (isNaN(reeksNum)) continue;
        
        if (importType === 'speed') {
          const slots = [];
          for (let i = 0; i < 10; i++) {
            const club = row[3 + (i * 2)], naam = row[4 + (i * 2)];
            if (naam) {
              const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam, club });
              slots.push({ veld: i + 1, skipperId: sid });
            }
          }
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', `speed_${reeksNum}`), { type: 'speed', reeks: reeksNum, onderdeel: row[1] || 'Speed', slots });
        } else {
          const sid = `fs_${row[4]}_${row[3]}`.replace(/[^a-zA-Z0-9]/g, '_');
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam: row[4], club: row[3] });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', `fs_${reeksNum}`), { type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', slots: [{ veld: row[2], skipperId: sid }] });
        }
      }
      await batch.commit();
      setStatusMsg("Import geslaagd!");
      setCsvInput('');
    } catch (e) { setStatusMsg("Fout bij import."); }
    setIsProcessing(false);
  };

  const currentHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  if (!isAuthReady) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <Activity style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', zIndex: 10 },
    nav: { display: 'flex', gap: '0.5rem', background: '#f5f5f5', padding: '0.3rem', borderRadius: '0.8rem' },
    navBtn: (active) => ({ padding: '0.5rem 1rem', border: 'none', borderRadius: '0.6rem', cursor: 'pointer', fontWeight: 'bold', backgroundColor: active ? '#fff' : 'transparent', color: active ? '#2563eb' : '#666', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }),
    main: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
    card: { border: '1px solid #eee', borderRadius: '2rem', padding: '3rem', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' },
    hugeText: { fontSize: '10rem', fontWeight: 900, lineHeight: 1, margin: '2rem 0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '2rem' },
    slot: { padding: '1rem', background: '#f9f9f9', borderRadius: '1rem', textAlign: 'left', border: '1px solid #f0f0f0' },
    btnPrimary: (color) => ({ width: '100%', padding: '1.5rem', borderRadius: '1.5rem', border: 'none', backgroundColor: color, color: '#fff', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', marginTop: '2rem' })
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span style={{ fontWeight: 900, fontSize: '1.2rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
          <div style={styles.nav}>
            <button onClick={() => setView('live')} style={styles.navBtn(view === 'live')}>Live</button>
            <button onClick={() => setView('management')} style={styles.navBtn(view === 'management')}>Beheer</button>
            <button onClick={() => setView('display')} style={styles.navBtn(view === 'display')}>Scherm</button>
          </div>
        </div>
        <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900, background: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '1rem' }}>CLOUD SYNC</div>
      </header>

      <main style={styles.main}>
        {view === 'live' && (
          <div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
              <button onClick={() => setActiveTab('speed')} style={{ flex: 1, maxWidth: '200px', padding: '1rem', borderRadius: '1rem', border: 'none', fontWeight: 900, cursor: 'pointer', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#eee', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ flex: 1, maxWidth: '200px', padding: '1rem', borderRadius: '1rem', border: 'none', fontWeight: 900, cursor: 'pointer', backgroundColor: activeTab === 'freestyle' ? '#7c3aed' : '#eee', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={styles.card}>
              <div style={{ color: '#999', fontWeight: 900, fontSize: '0.8rem' }}>HUIDIGE REEKS</div>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0' }}>{currentHeat?.onderdeel || "Geen reeks gevonden"}</h2>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem' }}>
                <button onClick={() => updateHeat(-1)} style={{ border: 'none', background: '#f0f0f0', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer' }}><ChevronLeft/></button>
                <div style={styles.hugeText}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                <button onClick={() => updateHeat(1)} style={{ border: 'none', background: '#f0f0f0', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight/></button>
              </div>

              <div style={styles.grid}>
                {currentHeat?.slots?.map((s, i) => (
                  <div key={i} style={styles.slot}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#aaa' }}>VELD {s.veld}</div>
                    <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{skippers[s.skipperId]?.naam || "---"}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{skippers[s.skipperId]?.club || "---"}</div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => updateHeat(1)} 
                style={styles.btnPrimary(activeTab === 'speed' ? '#2563eb' : '#7c3aed')}
              >
                VOLGENDE REEKS
              </button>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem' }}>Data Import</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button onClick={() => setImportType('speed')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: importType === 'speed' ? '#000' : '#eee', color: importType === 'speed' ? '#fff' : '#000' }}>Speed</button>
              <button onClick={() => setImportType('freestyle')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: importType === 'freestyle' ? '#000' : '#eee', color: importType === 'freestyle' ? '#fff' : '#000' }}>Freestyle</button>
            </div>
            <textarea 
              value={csvInput} 
              onChange={e => setCsvInput(e.target.value)} 
              placeholder="Plak CSV rijen hier..." 
              style={{ width: '100%', height: '300px', borderRadius: '1rem', border: '1px solid #ddd', padding: '1rem', fontFamily: 'monospace' }}
            />
            <button onClick={handleImport} disabled={isProcessing} style={{ ...styles.btnPrimary('#000'), marginTop: '1rem' }}>
              {isProcessing ? "Verwerken..." : "IMPORTEER GEGEVENS"}
            </button>
            {statusMsg && <div style={{ marginTop: '1rem', fontWeight: 'bold', color: '#2563eb' }}>{statusMsg}</div>}
          </div>
        )}

        {view === 'display' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 100, padding: '4rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h1 style={{ fontSize: '8vw', fontWeight: 900, margin: 0, letterSpacing: '-0.3rem' }}>{activeTab.toUpperCase()}</h1>
              <div style={{ backgroundColor: '#f5f5f5', padding: '2rem 4rem', borderRadius: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#bbb' }}>REEKS</div>
                <div style={{ fontSize: '12vw', fontWeight: 900, lineHeight: 1 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem', marginTop: '3rem' }}>
              {currentHeat?.slots?.map((s, i) => (
                <div key={i} style={{ border: '3px solid #f0f0f0', borderRadius: '3rem', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{s.veld}</div>
                  <div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.1 }}>{skippers[s.skipperId]?.naam || "---"}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#aaa', marginTop: '0.5rem' }}>{skippers[s.skipperId]?.club || "---"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '2rem', background: '#000', color: '#fff', padding: '2rem', borderRadius: '3rem', fontSize: '2.5rem', fontWeight: 900, textAlign: 'center' }}>{settings.announcement}</div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: '#eee', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>Sluiten</button>
          </div>
        )}
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default App;
