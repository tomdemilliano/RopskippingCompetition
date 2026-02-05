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
    announcement: "Welkom bij de wedstrijd!",
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

  const finishHeat = async () => {
    if (!currentHeat || !db || !user) return;
    
    try {
      const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
      await updateDoc(heatRef, { status: 'finished' });
      
      await updateHeat(1);
      setStatus({ type: 'success', msg: `Reeks ${currentHeat.reeks} voltooid!` });
      setTimeout(() => setStatus({ type: null, msg: null }), 3000);
    } catch (e) {
      console.error("Finish heat failed", e);
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
                    uur: row[2] || '00:00',
                    slots: slots,
                    status: 'pending'
                });
                count++;
            }
        } else {
            const reeksNum = parseInt(row[0]);
            if (isNaN(reeksNum)) continue;

            const club = row[1];
            const naam = row[2];
            const veld = row[3] || "Veld A";

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
                    uur: '00:00',
                    slots: [{ veld, skipperId: sid }],
                    status: 'pending'
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

  const nextHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num + 1) || null;
  }, [heats, activeTab, settings]);

  const speedSlots = useMemo(() => {
    if (activeTab !== 'speed') return currentHeat?.slots || [];
    const fullList = [];
    for (let i = 1; i <= 10; i++) {
      const found = currentHeat?.slots?.find(s => s.veldNr === i || s.veld === `Veld ${i}`);
      fullList.push(found || { veld: `Veld ${i}`, skipperId: null, empty: true });
    }
    return fullList;
  }, [currentHeat, activeTab]);

  // Berekening tijdsverschil
  const timeDiff = useMemo(() => {
    if (!currentHeat?.uur) return null;
    const [h, m] = currentHeat.uur.split(':').map(Number);
    const planned = new Date();
    planned.setHours(h, m, 0, 0);
    
    const diffMs = currentTime - planned;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  }, [currentHeat, currentTime]);

  if (!isAuthReady) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <Activity style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', boxSizing: 'border-box' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 2rem', borderBottom: '1px solid #eee', background: '#fff', flexShrink: 0, boxSizing: 'border-box' },
    nav: { display: 'flex', gap: '0.5rem', background: '#f5f5f5', padding: '0.2rem', borderRadius: '0.5rem' },
    navBtn: (active) => ({ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: active ? '#fff' : 'transparent', color: active ? '#2563eb' : '#666', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }),
    main: { flex: 1, padding: '1rem', width: '100%', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    contentWrapper: { maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 },
    card: { border: '1px solid #eee', borderRadius: '1.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' },
    heatNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' },
    heatNum: { fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 },
    list: { display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' },
    listItem: { display: 'grid', gridTemplateColumns: '70px 1fr 120px', alignItems: 'center', padding: '0.6rem 1rem', background: '#f9f9f9', borderRadius: '0.75rem', border: '1px solid #f0f0f0', width: '100%', boxSizing: 'border-box', overflow: 'hidden' },
    textTruncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    btnPrimary: (color) => ({ width: '100%', padding: '1rem', borderRadius: '1rem', border: 'none', backgroundColor: color, color: '#fff', fontSize: '1rem', fontWeight: 900, cursor: 'pointer' }),
    finishBtn: { width: '100%', backgroundColor: '#10b981', color: 'white', padding: '1.2rem', borderRadius: '1rem', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '1.2rem', marginTop: '1rem', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div style={{ fontWeight: 800, color: '#666', fontSize: '0.9rem' }}>{currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</div>
           <div style={{ color: '#10b981', fontSize: '0.6rem', fontWeight: 900, background: '#f0fdf4', padding: '0.4rem 0.8rem', borderRadius: '1rem' }}>SYNC OK</div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.contentWrapper}>
          {view === 'live' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                <button onClick={() => setActiveTab('speed')} style={{ flex: 1, maxWidth: '150px', padding: '0.6rem', borderRadius: '0.75rem', border: 'none', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#eee', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
                <button onClick={() => setActiveTab('freestyle')} style={{ flex: 1, maxWidth: '150px', padding: '0.6rem', borderRadius: '0.75rem', border: 'none', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', backgroundColor: activeTab === 'freestyle' ? '#7c3aed' : '#eee', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
              </div>

              <div style={styles.card}>
                {currentHeat?.status === 'finished' && (
                  <div style={{ backgroundColor: '#f0fdf4', color: '#10b981', padding: '0.5rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 800, marginBottom: '1rem', border: '1px solid #10b981' }}>
                    ✓ DEZE REEKS IS REEDS VOLTOOID
                  </div>
                )}
                
                <div style={styles.heatNav}>
                  <button onClick={() => updateHeat(-1)} style={{ border: 'none', background: '#f0f0f0', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={20}/></button>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999', fontWeight: 900, fontSize: '0.7rem' }}>REEKS</div>
                    <div style={styles.heatNum}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                    {currentHeat?.uur && <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#666' }}>{currentHeat.uur} u.</div>}
                  </div>
                  <button onClick={() => updateHeat(1)} style={{ border: 'none', background: '#f0f0f0', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={20}/></button>
                </div>

                {currentHeat && (
                  <div style={{ textAlign: 'center', marginBottom: '1rem', backgroundColor: activeTab === 'speed' ? '#eff6ff' : '#f5f3ff', padding: '0.5rem', borderRadius: '1rem', color: activeTab === 'speed' ? '#2563eb' : '#7c3aed', fontWeight: 900 }}>
                    {currentHeat.onderdeel.toUpperCase()}
                  </div>
                )}

                <div style={styles.list}>
                  {speedSlots.map((s, i) => (
                    <div key={i} style={{ ...styles.listItem, opacity: s.empty ? 0.4 : 1, backgroundColor: s.empty ? 'transparent' : '#f9f9f9', borderStyle: s.empty ? 'dashed' : 'solid' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#999', ...styles.textTruncate }}>{s.veld}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', ...styles.textTruncate }}>{skippers[s.skipperId]?.naam || (s.empty ? "---" : "Laden...")}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'right', ...styles.textTruncate }}>{skippers[s.skipperId]?.club || ""}</div>
                    </div>
                  ))}
                </div>

                {activeTab === 'speed' && currentHeat?.status !== 'finished' && (
                  <button onClick={finishHeat} style={styles.finishBtn}>
                    <CheckCircle2 size={24} /> REEKS VOLTOOID
                  </button>
                )}
              </div>
            </div>
          )}

          {view === 'management' && (
            <div style={{ width: '100%' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1rem' }}>Data Import</h2>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>Verwacht formaat: Reeks, Onderdeel, <b>Uur (HH:MM)</b>, Club 1, Skipper 1, Club 2, Skipper 2...</p>
              <textarea 
                value={csvInput} 
                onChange={e => setCsvInput(e.target.value)} 
                placeholder="Plak CSV data..." 
                style={{ width: '100%', height: '200px', borderRadius: '1rem', border: '1px solid #ddd', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <select value={importType} onChange={e => setImportType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem' }}>
                      <option value="speed">Speed Import</option>
                      <option value="freestyle">Freestyle Import</option>
                  </select>
                  <button onClick={handleImport} disabled={isProcessing} style={{ ...styles.btnPrimary('#000'), flex: 1 }}>
                  {isProcessing ? "Verwerken..." : "IMPORTEER GEGEVENS"}
                  </button>
              </div>
              {status.msg && <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: status.type === 'error' ? '#fef2f2' : '#f0fdf4', color: status.type === 'error' ? '#ef4444' : '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>{status.msg}</div>}
            </div>
          )}

          {view === 'display' && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 100, padding: '2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{currentHeat?.onderdeel.toUpperCase() || activeTab.toUpperCase()}</h1>
                    <div style={{ color: '#2563eb', fontWeight: 900, fontSize: '1.2rem', marginTop: '0.2rem' }}>{activeTab === 'speed' ? 'SPEED COMPETITION' : 'FREESTYLE'}</div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
                  {/* Tijd & Schema Informatie */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '0.25rem' }}>
                     <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>{currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</div>
                     {currentHeat?.uur && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <span style={{ fontWeight: 800, color: '#999', fontSize: '1rem' }}>SCHEMA: {currentHeat.uur}</span>
                           {timeDiff !== null && (
                              <span style={{ 
                                fontWeight: 900, 
                                padding: '0.2rem 0.6rem', 
                                borderRadius: '0.5rem',
                                fontSize: '1.1rem',
                                backgroundColor: timeDiff > 0 ? '#fef2f2' : '#f0fdf4',
                                color: timeDiff > 0 ? '#ef4444' : '#10b981'
                              }}>
                                {timeDiff > 0 ? `+${timeDiff} min.` : `${timeDiff} min.`}
                              </span>
                           )}
                        </div>
                     )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f5f5f5', padding: '0.5rem 2rem', borderRadius: '1.5rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#bbb' }}>REEKS</span>
                    <span style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
                  </div>
                </div>
              </div>

              {/* Melding volgend onderdeel type */}
              {nextHeat && currentHeat && nextHeat.onderdeel !== currentHeat.onderdeel && (
                <div style={{ backgroundColor: '#fff7ed', border: '2px solid #fb923c', padding: '1rem 2rem', borderRadius: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <div style={{ backgroundColor: '#fb923c', color: '#fff', padding: '0.6rem', borderRadius: '50%' }}><Info size={36} /></div>
                    <div>
                        <div style={{ color: '#c2410c', fontWeight: 900, fontSize: '1.2rem' }}>OPGELET: VOLGENDE REEKS IS EEN ANDER TYPE</div>
                        <div style={{ color: '#ea580c', fontWeight: 700, fontSize: '1rem' }}>Vanaf reeks {nextHeat.reeks} om {nextHeat.uur}u: <span style={{ textDecoration: 'underline' }}>{nextHeat.onderdeel}</span></div>
                    </div>
                </div>
              )}
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                {speedSlots.map((s, i) => (
                  <div key={i} style={{ 
                    flex: 1, 
                    display: 'grid', 
                    gridTemplateColumns: '150px 1fr 1fr', 
                    alignItems: 'center', 
                    padding: '0 2.5rem', 
                    borderRadius: '1.2rem', 
                    border: '2px solid #f0f0f0',
                    backgroundColor: s.empty ? 'transparent' : '#fff',
                    opacity: s.empty ? 0.3 : 1,
                    overflow: 'hidden'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed', ...styles.textTruncate }}>{s.veld}</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, ...styles.textTruncate }}>{skippers[s.skipperId]?.naam || ""}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#aaa', textAlign: 'right', ...styles.textTruncate }}>{skippers[s.skipperId]?.club || ""}</div>
                  </div>
                ))}

                {currentHeat?.status === 'finished' && (
                  <div style={{ 
                      position: 'absolute', 
                      inset: 0, 
                      backgroundColor: 'rgba(16, 185, 129, 0.95)', 
                      borderRadius: '1.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white',
                      zIndex: 10,
                      textAlign: 'center',
                      padding: '2rem'
                  }}>
                    <Trophy size={120} />
                    <div style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, lineHeight: 1.1 }}>REEKS VOLTOOID</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, opacity: 0.9, marginTop: '1rem' }}>Wachten op de volgende reeks...</div>
                  </div>
                )}
              </div>
              <button onClick={() => setView('live')} style={{ position: 'absolute', bottom: '1rem', right: '1rem', border: 'none', background: '#eee', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', opacity: 0.3 }}>Sluiten</button>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default App;
