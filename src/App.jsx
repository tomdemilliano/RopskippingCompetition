import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, Upload, AlertCircle, CheckCircle2
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
  const [status, setStatus] = useState({ type: null, msg: null });

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

    const unsubS = onSnapshot(sRef, async (d) => {
      if (d.exists()) {
        setSettings(d.data());
      } else {
        // Document bestaat niet, maak het aan
        await setDoc(sRef, settings);
      }
    }, (err) => console.error("Settings error:", err));

    const unsubSk = onSnapshot(skRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    }, (err) => console.error("Skippers error:", err));

    const unsubH = onSnapshot(hRef, s => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    }, (err) => console.error("Heats error:", err));

    return () => { unsubS(); unsubSk(); unsubH(); };
  }, [isAuthReady, user]);

  const updateHeat = async (delta) => {
    if (!db || !user) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    
    try {
      const docSnap = await getDoc(ref);
      if (!docSnap.exists()) {
        await setDoc(ref, { ...settings, [key]: Math.max(1, (settings[key] || 1) + delta) });
      } else {
        await updateDoc(ref, { [key]: Math.max(1, (settings[key] || 1) + delta) });
      }
    } catch (e) {
      console.error("Update failed.", e);
      setStatus({ type: 'error', msg: "Update mislukt. Controleer je Database Rules." });
    }
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !db || !user) {
        setStatus({ type: 'error', msg: "Geen data of niet ingelogd." });
        return;
    }
    setIsProcessing(true);
    setStatus({ type: 'info', msg: "Bezig met verwerken..." });

    try {
      const lines = csvInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

      const batch = writeBatch(db);
      let count = 0;

      for (const row of rows) {
        if (importType === 'speed') {
            // Logica voor SP_deelnemers.csv: Reeks is kolom 0, daarna Velden (3,4), (5,6), etc.
            const reeksNum = parseInt(row[0]);
            if (isNaN(reeksNum)) continue;

            const heatId = `speed_${reeksNum}`;
            const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId);
            const slots = [];

            // We lopen door de kolommen voor veld 1 t/m 10
            for (let v = 1; v <= 10; v++) {
                const clubCol = 3 + (v - 1) * 2;
                const nameCol = 4 + (v - 1) * 2;
                
                const club = row[clubCol];
                const naam = row[nameCol];

                if (naam && naam.trim() !== "" && club) {
                    const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
                    const skipperRef = doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid);
                    batch.set(skipperRef, { id: sid, naam, club });
                    slots.push({ veld: `Veld ${v}`, skipperId: sid });
                }
            }

            if (slots.length > 0) {
                batch.set(heatRef, { 
                    type: 'speed', 
                    reeks: reeksNum, 
                    onderdeel: row[1] || 'Speed', 
                    slots: slots 
                });
                count++;
            }
        } else {
            // Logica voor FS_deelnemers.csv: reeks, uur, veld, club, skipper
            const reeksIdx = headers.indexOf('reeks');
            const clubIdx = headers.indexOf('club');
            const nameIdx = headers.indexOf('skipper');
            const veldIdx = headers.indexOf('veld');

            const reeksNum = parseInt(row[reeksIdx]);
            if (isNaN(reeksNum)) continue;

            const club = row[clubIdx];
            const naam = row[nameIdx];
            const veld = row[veldIdx] || "Veld A";

            if (naam && club) {
                const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
                const skipperRef = doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid);
                batch.set(skipperRef, { id: sid, naam, club });

                const heatId = `fs_${reeksNum}`;
                const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId);
                batch.set(heatRef, { 
                    type: 'freestyle', 
                    reeks: reeksNum, 
                    onderdeel: 'Freestyle', 
                    slots: [{ veld, skipperId: sid }] 
                });
                count++;
            }
        }
      }

      await batch.commit();
      setStatus({ type: 'success', msg: `Import geslaagd! ${count} reeksen verwerkt.` });
      setCsvInput('');
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: `Fout: ${e.message}. Controleer je Database Rules!` });
    }
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
        <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900, background: '#f0fdf4', padding: '0.5rem 1rem', borderRadius: '1rem' }}>SYNC OK</div>
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
              <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0' }}>{currentHeat?.onderdeel || (activeTab === 'speed' ? "Speed" : "Freestyle")}</h2>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem' }}>
                <button onClick={() => updateHeat(-1)} style={{ border: 'none', background: '#f0f0f0', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer' }}><ChevronLeft/></button>
                <div style={styles.hugeText}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                <button onClick={() => updateHeat(1)} style={{ border: 'none', background: '#f0f0f0', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight/></button>
              </div>

              <div style={styles.grid}>
                {currentHeat?.slots?.map((s, i) => (
                  <div key={i} style={styles.slot}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#aaa' }}>{String(s.veld).toUpperCase()}</div>
                    <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{skippers[s.skipperId]?.naam || "---"}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{skippers[s.skipperId]?.club || "---"}</div>
                  </div>
                ))}
              </div>
              {(!currentHeat || !currentHeat.slots) && <div style={{marginTop: '2rem', color: '#666'}}>Geen deelnemers gevonden voor deze reeks.</div>}
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '2rem' }}>Data Import</h2>
            
            <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '1rem', borderRadius: '1rem', marginBottom: '2rem', fontSize: '0.9rem' }}>
                <strong>Tip:</strong><br/>
                - <strong>Speed:</strong> Kopieer de rijen uit <code>SP_deelnemers.csv</code> (vanaf reeks 1).<br/>
                - <strong>Freestyle:</strong> Gebruik headers: <code>reeks, uur, veld, club, skipper</code>.
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button onClick={() => setImportType('speed')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: importType === 'speed' ? '#2563eb' : '#eee', color: importType === 'speed' ? '#fff' : '#000' }}>Speed</button>
              <button onClick={() => setImportType('freestyle')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: importType === 'freestyle' ? '#7c3aed' : '#eee', color: importType === 'freestyle' ? '#fff' : '#000' }}>Freestyle</button>
            </div>

            <textarea 
              value={csvInput} 
              onChange={e => setCsvInput(e.target.value)} 
              placeholder={importType === 'speed' ? "Plak hier je Speed CSV rijen..." : "reeks,veld,club,skipper\n1,Veld A,ANTWERP ROPES,Jona Dieltiens"} 
              style={{ width: '100%', height: '300px', borderRadius: '1rem', border: '1px solid #ddd', padding: '1rem', fontFamily: 'monospace' }}
            />

            <button onClick={handleImport} disabled={isProcessing} style={{ ...styles.btnPrimary('#000'), marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {isProcessing ? <Activity style={{ animation: 'spin 1s linear infinite' }} size={20} /> : <Upload size={20} />}
              {isProcessing ? "Verwerken..." : "IMPORTEER GEGEVENS"}
            </button>

            {status.msg && (
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1rem', 
                borderRadius: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                backgroundColor: status.type === 'error' ? '#fef2f2' : (status.type === 'success' ? '#f0fdf4' : '#eff6ff'),
                color: status.type === 'error' ? '#991b1b' : (status.type === 'success' ? '#166534' : '#1e40af'),
                border: `1px solid ${status.type === 'error' ? '#fecaca' : (status.type === 'success' ? '#bbf7d0' : '#bfdbfe')}`
              }}>
                {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                {status.msg}
              </div>
            )}
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
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
              {currentHeat?.slots?.map((s, i) => (
                <div key={i} style={{ border: '3px solid #f0f0f0', borderRadius: '3rem', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{s.veld}</div>
                  <div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.1 }}>{skippers[s.skipperId]?.naam || "---"}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#aaa', marginTop: '0.5rem' }}>{skippers[s.skipperId]?.club || "---"}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: '#eee', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}>X</button>
          </div>
        )}
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default App;
