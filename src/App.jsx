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
      setStatus({ type: 'error', msg: "Update mislukt." });
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
            const reeksNum = parseInt(row[0]);
            if (isNaN(reeksNum)) continue;

            const heatId = `speed_${reeksNum}`;
            const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId);
            const slots = [];

            for (let v = 1; v <= 10; v++) {
                const clubCol = 3 + (v - 1) * 2;
                const nameCol = 4 + (v - 1) * 2;
                const club = row[clubCol];
                const naam = row[nameCol];

                if (naam && naam.trim() !== "" && club) {
                    const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
                    const skipperRef = doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid);
                    batch.set(skipperRef, { id: sid, naam, club });
                    slots.push({ veld: `Veld ${v}`, skipperId: sid, veldNr: v });
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
      setStatus({ type: 'error', msg: `Fout: ${e.message}` });
    }
    setIsProcessing(false);
  };

  const currentHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  // Helper om altijd 10 velden te tonen bij Speed
  const speedSlots = useMemo(() => {
    if (activeTab !== 'speed') return currentHeat?.slots || [];
    const fullList = [];
    for (let i = 1; i <= 10; i++) {
      const found = currentHeat?.slots?.find(s => s.veldNr === i || s.veld === `Veld ${i}`);
      fullList.push(found || { veld: `Veld ${i}`, skipperId: null, empty: true });
    }
    return fullList;
  }, [currentHeat, activeTab]);

  if (!isAuthReady) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <Activity style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 2rem', borderBottom: '1px solid #eee', background: '#fff', flexShrink: 0 },
    nav: { display: 'flex', gap: '0.5rem', background: '#f5f5f5', padding: '0.2rem', borderRadius: '0.5rem' },
    navBtn: (active) => ({ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: active ? '#fff' : 'transparent', color: active ? '#2563eb' : '#666', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }),
    main: { flex: 1, padding: '1rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', overflowY: 'auto' },
    card: { border: '1px solid #eee', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' },
    heatNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' },
    heatNum: { fontSize: '4rem', fontWeight: 900, lineHeight: 1 },
    list: { display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 },
    listItem: { display: 'grid', gridTemplateColumns: '80px 1fr 1fr', alignItems: 'center', padding: '0.6rem 1.2rem', background: '#f9f9f9', borderRadius: '0.75rem', border: '1px solid #f0f0f0' },
    btnPrimary: (color) => ({ width: '100%', padding: '1rem', borderRadius: '1rem', border: 'none', backgroundColor: color, color: '#fff', fontSize: '1rem', fontWeight: 900, cursor: 'pointer' })
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
          <div style={styles.nav}>
            <button onClick={() => setView('live')} style={styles.navBtn(view === 'live')}>Live</button>
            <button onClick={() => setView('management')} style={styles.navBtn(view === 'management')}>Beheer</button>
            <button onClick={() => setView('display')} style={styles.navBtn(view === 'display')}>Scherm</button>
          </div>
        </div>
        <div style={{ color: '#10b981', fontSize: '0.6rem', fontWeight: 900, background: '#f0fdf4', padding: '0.4rem 0.8rem', borderRadius: '1rem', alignSelf: 'center' }}>SYNC OK</div>
      </header>

      <main style={styles.main}>
        {view === 'live' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <button onClick={() => setActiveTab('speed')} style={{ flex: 1, maxWidth: '150px', padding: '0.6rem', borderRadius: '0.75rem', border: 'none', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#eee', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ flex: 1, maxWidth: '150px', padding: '0.6rem', borderRadius: '0.75rem', border: 'none', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', backgroundColor: activeTab === 'freestyle' ? '#7c3aed' : '#eee', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={styles.card}>
              <div style={styles.heatNav}>
                <button onClick={() => updateHeat(-1)} style={{ border: 'none', background: '#f0f0f0', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}><ChevronLeft size={20}/></button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#999', fontWeight: 900, fontSize: '0.7rem' }}>REEKS</div>
                  <div style={styles.heatNum}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                </div>
                <button onClick={() => updateHeat(1)} style={{ border: 'none', background: '#f0f0f0', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight size={20}/></button>
              </div>

              <div style={styles.list}>
                {speedSlots.map((s, i) => (
                  <div key={i} style={{ ...styles.listItem, opacity: s.empty ? 0.4 : 1, backgroundColor: s.empty ? 'transparent' : '#f9f9f9', borderStyle: s.empty ? 'dashed' : 'solid' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#999' }}>{s.veld}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{skippers[s.skipperId]?.naam || (s.empty ? "---" : "Laden...")}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'right' }}>{skippers[s.skipperId]?.club || ""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Data Import</h2>
            <textarea 
              value={csvInput} 
              onChange={e => setCsvInput(e.target.value)} 
              placeholder="Plak CSV data..." 
              style={{ width: '100%', height: '200px', borderRadius: '1rem', border: '1px solid #ddd', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
            <button onClick={handleImport} disabled={isProcessing} style={{ ...styles.btnPrimary('#000'), marginTop: '1rem' }}>
              {isProcessing ? "Verwerken..." : "IMPORTEER GEGEVENS"}
            </button>
            {status.msg && <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: '#f0fdf4', fontSize: '0.85rem' }}>{status.msg}</div>}
          </div>
        )}

        {view === 'display' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 100, padding: '2rem 4rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: 0 }}>{activeTab.toUpperCase()}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f5f5f5', padding: '0.5rem 2rem', borderRadius: '1.5rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#bbb' }}>REEKS</span>
                <span style={{ fontSize: '3rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
              {speedSlots.map((s, i) => (
                <div key={i} style={{ 
                  flex: 1, 
                  display: 'grid', 
                  gridTemplateColumns: '150px 1fr 1fr', 
                  alignItems: 'center', 
                  padding: '0 2rem', 
                  borderRadius: '1rem', 
                  border: '2px solid #f0f0f0',
                  backgroundColor: s.empty ? 'transparent' : '#fff',
                  opacity: s.empty ? 0.3 : 1
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{s.veld}</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>{skippers[s.skipperId]?.naam || ""}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#aaa', textAlign: 'right' }}>{skippers[s.skipperId]?.club || ""}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', bottom: '1rem', right: '1rem', border: 'none', background: '#eee', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', opacity: 0.3 }}>Sluiten</button>
          </div>
        )}
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default App;
