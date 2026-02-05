import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, updateDoc, 
  writeBatch, getDocs, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Trophy, ChevronRight, ChevronLeft, CheckCircle2, 
  Megaphone, Activity, Zap, Star, Database, Monitor, Download, Info 
} from 'lucide-react';

// Firebase configuratie
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
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

  // STAP 1: Authenticatie (Verplicht voor Firestore)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // STAP 2: Data listeners (Alleen starten NA auth succes)
  useEffect(() => {
    if (!isAuthReady || !user) return;

    // RULE 1: Gebruik altijd dit specifieke pad-formaat
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skippersRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const heatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsubSettings = onSnapshot(settingsRef, (d) => {
      if (d.exists()) setSettings(d.data());
    }, (err) => console.error("Settings error:", err));

    const unsubSkippers = onSnapshot(skippersRef, (s) => {
      const d = {}; 
      s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    }, (err) => console.error("Skippers error:", err));

    const unsubHeats = onSnapshot(heatsRef, (s) => {
      const hList = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setHeats(hList.sort((a,b) => a.reeks - b.reeks));
    }, (err) => console.error("Heats error:", err));

    return () => {
      unsubSettings();
      unsubSkippers();
      unsubHeats();
    };
  }, [isAuthReady, user]);

  const downloadTemplate = (type) => {
    const content = type === 'speed' 
      ? "reeks,onderdeel,uur,club1,skipper1,club2,skipper2,club3,skipper3,club4,skipper4,club5,skipper5,club6,skipper6,club7,skipper7,club8,skipper8,club9,skipper9,club10,skipper10\n1,Speed 30s,14:05,JOLLY JUMPERS,BOLLUE Estelline,SKIPPIES,GOVAERS Nona,ANTWERP ROPES,STUER Vincent,SKIPOUDENBURG,VERMEERSCH Zita,ROPE SKIPPING OOSTENDE,STAPPERS Lies,ROM SKIPPERS MECHELEN,WIJCKMANS Anton,ROM SKIPPERS MECHELEN,NAHIMANA Eva,ZERO SKIP,VANDENBOSCH Aurelia,SKIP UP,OTTO Fenn,JUMP UP,PEETERS Lorytz"
      : "reeks,uur,veld,club,skipper\n1,15:40,Veld A,ROM SKIPPERS MECHELEN,DONS Oona\n2,15:42,Veld B,GYM WESTERLO,JANSSENS Lies";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ropescore_sjabloon_${type}.csv`;
    a.click();
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !user) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'info', text: 'Data uploaden naar beveiligde cloud...' });
    
    try {
      const rows = csvInput.split('\n')
        .filter(r => r.trim())
        .map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      
      if (rows.length > 0 && isNaN(parseInt(rows[0][0]))) {
        rows.shift();
      }

      const batch = writeBatch(db);
      let count = 0;

      for (const row of rows) {
        if (!row[0] || isNaN(parseInt(row[0]))) continue;
        
        const reeksNum = parseInt(row[0]);
        
        if (importType === 'speed') {
          const heatId = `speed_${reeksNum}`;
          const slots = [];
          for (let i = 0; i < 10; i++) {
            const club = row[3 + (i * 2)], naam = row[4 + (i * 2)];
            if (naam && naam !== "") {
              const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam, club });
              slots.push({ veld: i + 1, skipperId: sid });
            }
          }
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'speed', reeks: reeksNum, onderdeel: row[1] || 'Speed', slots
          });
        } else {
          // Freestyle: 0:reeks, 1:uur, 2:veld, 3:club, 4:skipper
          const sid = `fs_${row[4]}_${row[3]}`.replace(/[^a-zA-Z0-9]/g, '_');
          const heatId = `fs_${reeksNum}`;
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam: row[4], club: row[3] });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', slots: [{ veld: row[2], skipperId: sid }]
          });
        }
        count++;
      }
      
      await batch.commit();
      setStatusMsg({ type: 'success', text: `${count} reeksen succesvol verwerkt.` });
      setCsvInput('');
    } catch (e) {
      console.error("Import error:", e);
      setStatusMsg({ type: 'error', text: `Upload mislukt: ${e.message}` });
    } finally { 
      setIsProcessing(false); 
    }
  };

  const updateHeat = async (delta) => {
    if (!user) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    await updateDoc(settingsRef, {
      [key]: Math.max(1, (settings[key] || 1) + delta)
    });
  };

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? heats.filter(h => h.type === 'speed') : heats.filter(h => h.type === 'freestyle');
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  if (!isAuthReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <Activity className="animate-spin" size={48} color="#2563eb" />
          <p style={{ marginTop: '20px', fontWeight: 600 }}>Verbinden met wedstrijd-server...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#fff', color: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* NAV BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', borderBottom: '2px solid #eee', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></h2>
          <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', padding: '5px', borderRadius: '10px' }}>
            <button onClick={() => setView('live')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'live' ? '#fff' : 'transparent', color: view === 'live' ? '#2563eb' : '#666' }}>Wedstrijd</button>
            <button onClick={() => setView('management')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'management' ? '#fff' : 'transparent', color: view === 'management' ? '#2563eb' : '#666' }}>Beheer</button>
            <button onClick={() => setView('display')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'display' ? '#fff' : 'transparent', color: view === 'display' ? '#2563eb' : '#666' }}>Groot Scherm</button>
          </div>
        </div>
        <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Database size={14} /> LIVE SYNC ACTIEF
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px' }}>
        {view === 'live' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
              <button onClick={() => setActiveTab('speed')} style={{ width: '200px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px 0 0 15px', fontWeight: 900, cursor: 'pointer', background: activeTab === 'speed' ? '#2563eb' : '#fff', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ width: '200px', padding: '15px', border: '1px solid #ddd', borderRadius: '0 15px 15px 0', fontWeight: 900, cursor: 'pointer', background: activeTab === 'freestyle' ? '#7c3aed' : '#fff', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={{ border: '2px solid #eee', borderRadius: '30px', padding: '40px', textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: '#666', fontSize: '1rem', textTransform: 'uppercase' }}>Huidige Reeks</h3>
              <h1 style={{ margin: '10px 0', fontSize: '2.5rem', fontWeight: 900 }}>{currentHeat?.onderdeel || "Einde Programma"}</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '50px', margin: '40px 0' }}>
                <button onClick={() => updateHeat(-1)} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '80px', height: '80px', cursor: 'pointer' }}><ChevronLeft size={40}/></button>
                <div style={{ fontSize: '12rem', fontWeight: 900 }}>{activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}</div>
                <button onClick={() => updateHeat(1)} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '80px', height: '80px', cursor: 'pointer' }}><ChevronRight size={40}/></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
                {currentHeat?.slots?.map((slot, i) => {
                  const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                  return (
                    <div key={i} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '15px', background: '#fafafa', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#bbb', marginBottom: '5px' }}>VELD {slot.veld}</div>
                      <div style={{ fontWeight: 900, color: '#000', fontSize: '0.9rem' }}>{s.naam}</div>
                      <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700 }}>{s.club}</div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => updateHeat(1)} style={{ width: '100%', marginTop: '40px', padding: '25px', borderRadius: '20px', border: 'none', background: activeTab === 'speed' ? '#2563eb' : '#7c3aed', color: '#fff', fontSize: '1.5rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>VOLGENDE REEKS</button>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontWeight: 900, fontSize: '2rem' }}>WEDSTRIJDBEHEER</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', marginTop: '30px' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999' }}>1. DOWNLOAD SJABLOON</h4>
                <button onClick={() => downloadTemplate('speed')} style={{ width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontWeight: 700, marginBottom: '10px' }}>Speed Sjabloon (.csv)</button>
                <button onClick={() => downloadTemplate('freestyle')} style={{ width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Freestyle Sjabloon (.csv)</button>
                <div style={{ marginTop: '20px', padding: '15px', background: '#eef2ff', borderRadius: '15px', fontSize: '0.8rem', lineHeight: '1.5', color: '#3730a3' }}>
                  <strong>Instructie:</strong> Kopieer je rijen uit Excel/CSV en plak ze hiernaast. Klik op upload om de data live te zetten.
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999' }}>2. PLAK DATA ({importType.toUpperCase()})</h4>
                <div style={{ marginBottom: '10px' }}>
                  <label><input type="radio" checked={importType === 'speed'} onChange={() => setImportType('speed')} /> Speed</label>
                  <label style={{ marginLeft: '20px' }}><input type="radio" checked={importType === 'freestyle'} onChange={() => setImportType('freestyle')} /> Freestyle</label>
                </div>
                <textarea value={csvInput} onChange={(e) => setCsvInput(e.target.value)} placeholder="reeks, uur, veld, club, skipper..." style={{ width: '100%', height: '300px', borderRadius: '15px', border: '1px solid #ddd', padding: '15px', fontFamily: 'monospace', fontSize: '0.8rem' }} />
                <button onClick={handleImport} disabled={isProcessing} style={{ width: '100%', marginTop: '10px', padding: '20px', borderRadius: '15px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>{isProcessing ? "Laden..." : "UPLOAD NAAR CLOUD"}</button>
                {statusMsg && <div style={{ marginTop: '15px', padding: '15px', borderRadius: '10px', background: statusMsg.type === 'success' ? '#dcfce7' : '#dbeafe', color: statusMsg.type === 'success' ? '#166534' : '#1e40af', fontWeight: 700, textAlign: 'center' }}>{statusMsg.text}</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, padding: '50px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '50px' }}>
               <h1 style={{ fontSize: '10rem', fontWeight: 900, lineHeight: 0.8, margin: 0 }}>{activeTab === 'speed' ? 'SPEED' : 'FREESTYLE'}</h1>
               <div style={{ background: '#f5f5f5', padding: '30px 60px', borderRadius: '30px', textAlign: 'center' }}>
                 <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ccc' }}>REEKS</div>
                 <div style={{ fontSize: '12rem', fontWeight: 900 }}>{activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}</div>
               </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px' }}>
              {currentHeat?.slots?.map((slot, i) => {
                const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                return (
                  <div key={i} style={{ border: '4px solid #f5f5f5', borderRadius: '30px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '4rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{slot.veld}</div>
                    <div>
                      <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, textTransform: 'uppercase' }}>{s.naam}</div>
                      <div style={{ fontSize: '1.2rem', color: '#888', fontWeight: 700 }}>{s.club}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '40px', background: '#000', color: '#fff', padding: '30px', borderRadius: '30px', fontSize: '3rem', fontWeight: 900, textAlign: 'center' }}>{settings.announcement}</div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: 'none', fontSize: '1rem', color: '#ccc', cursor: 'pointer' }}>Sluiten</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
