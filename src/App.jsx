import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, updateDoc, 
  writeBatch, getDocs, signInAnonymously 
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { 
  Trophy, ChevronRight, ChevronLeft, CheckCircle2, 
  Megaphone, Activity, Zap, Star, UploadCloud, 
  Loader2, Database, Monitor, Download, Info 
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
  authDomain: "ropeskippingcontest.firebaseapp.com",
  projectId: "ropeskippingcontest",
  storageBucket: "ropeskippingcontest.firebasestorage.app",
  messagingSenderId: "430066523717",
  appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-v5-final';

const App = () => {
  const [user, setUser] = useState(null);
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
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skippersRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const heatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsub1 = onSnapshot(settingsRef, (d) => d.exists() && setSettings(d.data()));
    const unsub2 = onSnapshot(skippersRef, (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    });
    const unsub3 = onSnapshot(heatsRef, (s) => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const downloadTemplate = (type) => {
    const content = type === 'speed' 
      ? "reeks,onderdeel,uur,club1,skipper1,club2,skipper2,club3,skipper3,club4,skipper4,club5,skipper5,club6,skipper6,club7,skipper7,club8,skipper8,club9,skipper9,club10,skipper10\n1,Speed 30s,14:00,Club A,Naam 1,Club B,Naam 2,Club C,Naam 3,,,,,,,,,,,,,,,"
      : "reeks,uur,veld,club,skipper\n1,15:00,Veld A,Club X,Naam Springer\n2,15:02,Veld B,Club Y,Naam Springer";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voorbeeld_${type}.csv`;
    a.click();
  };

  const handleImport = async () => {
    if (!csvInput.trim()) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'info', text: 'Data verwerken...' });
    try {
      const rows = csvInput.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);
      let count = 0;

      if (importType === 'speed') {
        rows.forEach(row => {
          if (!row[0] || isNaN(row[0])) return;
          const heatId = `speed_${row[0]}`;
          const slots = [];
          for (let i = 0; i < 10; i++) {
            const club = row[3 + (i * 2)], naam = row[4 + (i * 2)];
            if (naam) {
              const sid = `s_${naam}_${club}`.replace(/\s+/g, '_');
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam, club });
              slots.push({ veld: i + 1, skipperId: sid });
            }
          }
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'speed', reeks: parseInt(row[0]), onderdeel: row[1] || 'Speed', slots
          });
          count++;
        });
      } else {
        rows.forEach(row => {
          if (!row[0] || isNaN(row[0])) return;
          const sid = `fs_${row[4]}_${row[3]}`.replace(/\s+/g, '_');
          const heatId = `fs_${row[0]}`;
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam: row[4], club: row[3] });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'freestyle', reeks: parseInt(row[0]), onderdeel: 'Freestyle', slots: [{ veld: row[2], skipperId: sid }]
          });
          count++;
        });
      }
      await batch.commit();
      setStatusMsg({ type: 'success', text: `${count} reeksen geladen.` });
      setCsvInput('');
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Fout bij import.' });
    } finally { setIsProcessing(false); }
  };

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? heats.filter(h => h.type === 'speed') : heats.filter(h => h.type === 'freestyle');
    const num = activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat;
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  const updateHeat = async (delta) => {
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
      [key]: Math.max(1, (settings[key] || 1) + delta)
    });
  };

  const styles = {
    container: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    nav: { display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.75rem' },
    navButton: (active) => ({
      padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', 
      backgroundColor: active ? '#ffffff' : 'transparent', color: active ? '#2563eb' : '#64748b', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
    }),
    main: { flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' },
    card: { backgroundColor: '#ffffff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginTop: '2rem' },
    slot: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '1rem', textAlign: 'left' },
    heatDisplay: { fontSize: '10rem', fontWeight: '900', lineHeight: '1', margin: '1rem 0' },
    buttonPrimary: (color) => ({
      width: '100%', padding: '1.5rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', backgroundColor: color, color: '#ffffff', fontWeight: '900', fontSize: '1.25rem', textTransform: 'uppercase', marginTop: '2rem', transition: 'opacity 0.2s'
    })
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>RopeScore <span style={{ color: '#2563eb' }}>Pro</span></h1>
          <nav style={styles.nav}>
            <button style={styles.navButton(view === 'live')} onClick={() => setView('live')}>Wedstrijd</button>
            <button style={styles.navButton(view === 'management')} onClick={() => setView('management')}>Wedstrijdbeheer</button>
            <button style={styles.navButton(view === 'display')} onClick={() => setView('display')}>Display</button>
          </nav>
        </div>
        <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>● Verbonden met Cloud</div>
      </header>

      <main style={styles.main}>
        {view === 'live' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '2rem' }}>
              <button 
                onClick={() => setActiveTab('speed')}
                style={{ padding: '1rem 2rem', borderRadius: '1rem 0 0 1rem', border: '1px solid #e2e8f0', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#fff', color: activeTab === 'speed' ? '#fff' : '#64748b', fontWeight: '800' }}>
                SPEED
              </button>
              <button 
                onClick={() => setActiveTab('freestyle')}
                style={{ padding: '1rem 2rem', borderRadius: '0 1rem 1rem 0', border: '1px solid #e2e8f0', backgroundColor: activeTab === 'freestyle' ? '#7c3aed' : '#fff', color: activeTab === 'freestyle' ? '#fff' : '#64748b', fontWeight: '800' }}>
                FREESTYLE
              </button>
            </div>

            <div style={styles.card}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b' }}>{currentHeat?.onderdeel || "GEEN DATA"}</h2>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem' }}>
                <button onClick={() => updateHeat(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}><ChevronLeft size={64} /></button>
                <div style={styles.heatDisplay}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                <button onClick={() => updateHeat(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}><ChevronRight size={64} /></button>
              </div>

              <div style={styles.grid}>
                {currentHeat?.slots?.map((slot, i) => {
                  const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                  return (
                    <div key={i} style={styles.slot}>
                      <div style={{ fontSize: '0.65rem', fontWeight: '900', color: '#94a3b8', marginBottom: '0.5rem' }}>VELD {slot.veld}</div>
                      <div style={{ fontWeight: '900', color: '#000', fontSize: '1rem', textTransform: 'uppercase' }}>{s.naam}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>{s.club}</div>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={() => updateHeat(1)}
                style={styles.buttonPrimary(activeTab === 'speed' ? '#2563eb' : '#7c3aed')}>
                Volgende Reeks
              </button>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={styles.card}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '1.5rem' }}>DATA MANAGEMENT</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '2rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8', marginBottom: '1rem' }}>STAP 1: DOWNLOAD SJABLOON</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button onClick={() => downloadTemplate('speed')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}>
                    <Download size={16} /> Speed Template (.csv)
                  </button>
                  <button onClick={() => downloadTemplate('freestyle')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: '700' }}>
                    <Download size={16} /> Freestyle Template (.csv)
                  </button>
                </div>

                <div style={{ marginTop: '2rem', backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#1e40af', lineHeight: '1.5', fontWeight: '600' }}>
                    Kopieer de rijen uit je Excel en plak ze hiernaast. Gebruik de templates hierboven voor de juiste volgorde van de kolommen.
                  </p>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8', marginBottom: '1rem' }}>STAP 2: PLAK DATA & IMPORT</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ marginRight: '1rem', fontSize: '0.8rem', fontWeight: '800' }}>Type:</span>
                  <label><input type="radio" checked={importType === 'speed'} onChange={() => setImportType('speed')} /> Speed</label>
                  <label style={{ marginLeft: '1rem' }}><input type="radio" checked={importType === 'freestyle'} onChange={() => setImportType('freestyle')} /> Freestyle</label>
                </div>
                <textarea 
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="reeks, onderdeel, uur, club, springer..."
                  style={{ width: '100%', height: '300px', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: '#f8fafc' }}
                />
                <button 
                  onClick={handleImport}
                  disabled={isProcessing}
                  style={{ width: '100%', marginTop: '1rem', padding: '1rem', borderRadius: '1rem', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>
                  {isProcessing ? "Verwerken..." : "Data Uploaden naar Cloud"}
                </button>
                {statusMsg && <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: statusMsg.type === 'success' ? '#dcfce7' : '#dbeafe', color: statusMsg.type === 'success' ? '#166534' : '#1e40af', fontWeight: '700', textAlign: 'center' }}>{statusMsg.text}</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', padding: '3rem', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem' }}>
              <div>
                <h1 style={{ fontSize: '10rem', fontWeight: '900', textTransform: 'uppercase', lineHeight: '0.8', margin: 0 }}>
                  {activeTab === 'speed' ? 'SPEED' : 'FREESTYLE'}
                </h1>
                <p style={{ fontSize: '2rem', fontWeight: '800', color: '#64748b' }}>ARENA OVERZICHT</p>
              </div>
              <div style={{ backgroundColor: '#f1f5f9', padding: '2rem 4rem', borderRadius: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#94a3b8' }}>REEKS</div>
                <div style={{ fontSize: '12rem', fontWeight: '900', color: '#000' }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem' }}>
              {currentHeat?.slots?.map((slot, i) => {
                const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                return (
                  <div key={i} style={{ border: '4px solid #f1f5f9', borderRadius: '2rem', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '900', color: '#cbd5e1' }}>VELD</span>
                      <span style={{ fontSize: '3rem', fontWeight: '900', color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{slot.veld}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '3.5rem', fontWeight: '900', lineHeight: '1', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{s.naam}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#64748b' }}>{s.club}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '3rem', backgroundColor: '#000', color: '#fff', padding: '2rem', borderRadius: '2rem', fontSize: '2.5rem', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' }}>
              {settings.announcement}
            </div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}>Sluiten</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
