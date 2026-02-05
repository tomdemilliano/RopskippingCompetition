import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom!",
  });

  const [importType, setImportType] = useState('speed');
  const [csvInput, setCsvInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ type: null, msg: null });

  // Update klok elke seconde
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const currentHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  const nextHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num + 1) || null;
  }, [heats, activeTab, settings]);

  // Berekening van het tijdsverschil in minuten
  const timeDifferenceInfo = useMemo(() => {
    if (!currentHeat?.uur || !currentHeat.uur.includes(':')) return null;

    try {
      const [h, m] = currentHeat.uur.split(':').map(Number);
      const plannedTime = new Date(currentTime);
      plannedTime.setHours(h, m, 0, 0);

      const diffInMs = currentTime.getTime() - plannedTime.getTime();
      const diffInMins = Math.floor(diffInMs / 60000);

      return {
        minutes: diffInMins,
        isBehind: diffInMins > 0,
        isAhead: diffInMins < 0,
        label: diffInMins > 0 ? `+${diffInMins}` : `${diffInMins}`
      };
    } catch (e) {
      return null;
    }
  }, [currentHeat, currentTime]);

  const speedSlots = useMemo(() => {
    if (activeTab !== 'speed') return currentHeat?.slots || [];
    const fullList = [];
    for (let i = 1; i <= 10; i++) {
      const found = currentHeat?.slots?.find(s => s.veldNr === i || s.veld === `Veld ${i}`);
      fullList.push(found || { veld: `Veld ${i}`, skipperId: null, empty: true });
    }
    return fullList;
  }, [currentHeat, activeTab]);

  const updateHeat = async (delta) => {
    if (!db || !user) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    try {
      const currentVal = settings[key] || 1;
      await updateDoc(ref, { [key]: Math.max(1, currentVal + delta) });
    } catch (e) { console.error(e); }
  };

  const finishHeat = async () => {
    if (!currentHeat || !db || !user) return;
    try {
      const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
      await updateDoc(heatRef, { status: 'finished' });
      await updateHeat(1);
    } catch (e) { console.error(e); }
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !db || !user) return;
    setIsProcessing(true);
    try {
      const lines = csvInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);

      for (const row of rows) {
        const reeksNum = parseInt(row[0]);
        if (isNaN(reeksNum)) continue;

        if (importType === 'speed') {
          const heatId = `speed_${reeksNum}`;
          const slots = [];
          for (let v = 1; v <= 10; v++) {
            const club = row[3 + (v - 1) * 2];
            const naam = row[4 + (v - 1) * 2];
            if (naam && naam !== "") {
              const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam, club });
              slots.push({ veld: `Veld ${v}`, skipperId: sid, veldNr: v });
            }
          }
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), { 
            type: 'speed', reeks: reeksNum, onderdeel: row[1], uur: row[2], slots, status: 'pending' 
          });
        } else {
          const sid = `s_${row[2]}_${row[1]}`.replace(/[^a-zA-Z0-9]/g, '_');
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam: row[2], club: row[1] });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', `fs_${reeksNum}`), { 
            type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', uur: '00:00', slots: [{ veld: row[3] || 'Veld A', skipperId: sid }], status: 'pending' 
          });
        }
      }
      await batch.commit();
      setStatus({ type: 'success', msg: "Import succesvol!" });
      setCsvInput('');
    } catch (e) { setStatus({ type: 'error', msg: e.message }); }
    setIsProcessing(false);
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 2rem', borderBottom: '1px solid #eee', background: '#fff', alignItems: 'center' },
    main: { flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    card: { border: '1px solid #eee', borderRadius: '1.5rem', padding: '1.5rem', width: '100%', maxWidth: '800px', backgroundColor: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    displayOverlay: { 
      position: 'fixed', 
      inset: 0, 
      backgroundColor: '#fff', 
      zIndex: 1000, 
      padding: '1.5rem', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      boxSizing: 'border-box'
    },
    diffBadge: (info) => ({
      padding: '0.2rem 0.6rem',
      borderRadius: '0.5rem',
      fontWeight: '900',
      fontSize: '1rem',
      backgroundColor: info.isBehind ? '#fee2e2' : '#dcfce7',
      color: info.isBehind ? '#dc2626' : '#16a34a',
      display: 'inline-flex',
      alignItems: 'center',
      marginLeft: '0.5rem'
    })
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontWeight: 900, fontSize: '1.2rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
          <nav style={{ display: 'flex', gap: '0.5rem', background: '#f5f5f5', padding: '0.25rem', borderRadius: '0.5rem' }}>
            <button onClick={() => setView('live')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 700, backgroundColor: view === 'live' ? '#fff' : 'transparent' }}>Live</button>
            <button onClick={() => setView('management')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 700, backgroundColor: view === 'management' ? '#fff' : 'transparent' }}>Beheer</button>
            <button onClick={() => setView('display')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 700, backgroundColor: view === 'display' ? '#fff' : 'transparent' }}>Scherm</button>
          </nav>
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      </header>

      <main style={styles.main}>
        {view === 'live' && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setActiveTab('speed')} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', fontWeight: 800, cursor: 'pointer', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#f5f5f5', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ padding: '0.75rem 2rem', borderRadius: '0.75rem', border: 'none', fontWeight: 800, cursor: 'pointer', backgroundColor: activeTab === 'freestyle' ? '#7c3aed' : '#f5f5f5', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999' }}>HUIDIGE REEKS</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                <button onClick={() => updateHeat(-1)} style={{ background: '#f5f5f5', border: 'none', padding: '1rem', borderRadius: '50%', cursor: 'pointer' }}><ChevronLeft /></button>
                <span style={{ fontSize: '4rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
                <button onClick={() => updateHeat(1)} style={{ background: '#f5f5f5', border: 'none', padding: '1rem', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight /></button>
              </div>
              {currentHeat?.uur && <div style={{ fontWeight: 800, color: '#666' }}>Gepland: {currentHeat.uur} u.</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {speedSlots.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', padding: '0.75rem 1.5rem', background: s.empty ? 'transparent' : '#f9f9f9', borderRadius: '1rem', border: s.empty ? '1px dashed #eee' : '1px solid #eee' }}>
                  <span style={{ fontWeight: 900, color: '#2563eb', fontSize: '0.8rem' }}>{s.veld}</span>
                  <span style={{ fontWeight: 800 }}>{skippers[s.skipperId]?.naam || (s.empty ? "" : "...")}</span>
                  <span style={{ textAlign: 'right', color: '#999', fontSize: '0.8rem' }}>{skippers[s.skipperId]?.club || ""}</span>
                </div>
              ))}
            </div>

            {currentHeat?.status !== 'finished' && (
              <button onClick={finishHeat} style={{ width: '100%', marginTop: '2rem', padding: '1.25rem', borderRadius: '1rem', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle2 /> REEKS VOLTOOID
              </button>
            )}
          </div>
        )}

        {view === 'management' && (
          <div style={styles.card}>
            <h2 style={{ fontWeight: 900, marginBottom: '1rem' }}>Importeer Data (CSV)</h2>
            <textarea value={csvInput} onChange={e => setCsvInput(e.target.value)} placeholder="Reeks, Onderdeel, Uur, Club1, Skipper1..." style={{ width: '100%', height: '200px', borderRadius: '1rem', border: '1px solid #eee', padding: '1rem', marginBottom: '1rem' }} />
            <button onClick={handleImport} style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: 'none', background: '#000', color: '#fff', fontWeight: 800 }}>START IMPORT</button>
            {status.msg && <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', background: status.type === 'success' ? '#f0fdf4' : '#fef2f2', color: status.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{status.msg}</div>}
          </div>
        )}

        {view === 'display' && (
          <div style={styles.displayOverlay}>
            {/* Header Sectie - Geoptimaliseerd voor ruimte */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{currentHeat?.onderdeel?.toUpperCase() || "SPEED"}</h1>
                <div style={{ color: '#2563eb', fontWeight: 900, fontSize: '1rem' }}>ROPESKIPPING COMPETITION</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                {/* Geplande Tijd Sectie */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px' }}>GEPLAND TIJDSTIP</div>
                  <div style={{ fontWeight: 900, color: '#fff', background: '#000', padding: '0.4rem 1rem', borderRadius: '0.6rem', fontSize: '1.5rem', lineHeight: 1 }}>
                    {currentHeat?.uur || "--:--"} u.
                  </div>
                </div>

                {/* Klok en Vertraging */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                     <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>{currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</div>
                     {timeDifferenceInfo && (
                        <div style={styles.diffBadge(timeDifferenceInfo)}>
                          {timeDifferenceInfo.label}m
                        </div>
                     )}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8' }}>LIVE TIJD</div>
                </div>
              </div>
            </div>

            {/* Reeks Indicator - Iets compacter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f8fafc', padding: '0.5rem 1.5rem', borderRadius: '1rem', marginBottom: '1rem', border: '2px solid #e2e8f0' }}>
               <span style={{ fontSize: '1rem', fontWeight: 900, color: '#64748b' }}>HUIDIGE REEKS</span>
               <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, color: '#0f172a' }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
            </div>

            {/* De Deelnemerslijst - Schaling verbeterd om op scherm te passen */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem', minHeight: 0 }}>
              {speedSlots.map((s, i) => (
                <div key={i} style={{ 
                  flex: 1, 
                  display: 'grid', 
                  gridTemplateColumns: '120px 1fr 1fr', 
                  alignItems: 'center', 
                  padding: '0 1.5rem', 
                  borderRadius: '0.75rem', 
                  border: '1px solid #f1f5f9',
                  backgroundColor: s.empty ? 'transparent' : '#fff',
                  opacity: s.empty ? 0.1 : 1,
                  minHeight: 0,
                  boxShadow: s.empty ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2563eb' }}>{s.veld}</span>
                  <span style={{ fontSize: '1.7rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skippers[s.skipperId]?.naam || ""}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#94a3b8', textAlign: 'right' }}>{skippers[s.skipperId]?.club || ""}</span>
                </div>
              ))}
            </div>

            {currentHeat?.status === 'finished' && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(16, 185, 129, 0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 100, borderRadius: 'inherit' }}>
                <Trophy size={80} />
                <h2 style={{ fontSize: '3rem', fontWeight: 900, margin: 0 }}>REEKS VOLTOOID</h2>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, opacity: 0.8 }}>Even geduld voor de volgende reeks...</p>
              </div>
            )}

            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 700, opacity: 0.3 }}>X</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
