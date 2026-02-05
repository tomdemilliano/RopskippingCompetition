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

// --- SAFE CONFIG LOADER ---
// We declareren de variabelen maar initialiseren ze pas als we zeker weten dat de omgeving klaar is.
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [configError, setConfigError] = useState(null);
  
  // UI States
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

  // STAP 1: Initialiseer Firebase & Auth
  useEffect(() => {
    const startFirebase = async () => {
      try {
        // Check of de globale variabelen bestaan
        if (typeof __firebase_config === 'undefined') {
          throw new Error("Firebase configuratie niet gevonden in de omgeving.");
        }

        const firebaseConfig = JSON.parse(__firebase_config);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Authenticatie proces
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          setUser(u);
          if (u) setIsAuthReady(true);
        });

      } catch (err) {
        console.error("Boot error:", err);
        setConfigError(err.message);
      }
    };

    startFirebase();
  }, []);

  // STAP 2: Data listeners (Hanteer RULE 1 & 3)
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;

    // Gebruik strikt de vereiste paden: /artifacts/{appId}/public/data/{collection}
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skippersRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const heatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsubSettings = onSnapshot(settingsRef, (d) => {
      if (d.exists()) setSettings(d.data());
    }, (err) => console.error("Settings listener error:", err));

    const unsubSkippers = onSnapshot(skippersRef, (s) => {
      const d = {}; 
      s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    }, (err) => console.error("Skippers listener error:", err));

    const unsubHeats = onSnapshot(heatsRef, (s) => {
      const hList = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setHeats(hList.sort((a,b) => a.reeks - b.reeks));
    }, (err) => console.error("Heats listener error:", err));

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
    if (!csvInput.trim() || !user || !db) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'info', text: 'Data uploaden...' });
    
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
      setStatusMsg({ type: 'error', text: `Fout: ${e.message}` });
    } finally { 
      setIsProcessing(false); 
    }
  };

  const updateHeat = async (delta) => {
    if (!user || !db) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    try {
      await updateDoc(settingsRef, {
        [key]: Math.max(1, (settings[key] || 1) + delta)
      });
    } catch (err) {
      // Als doc niet bestaat, fallback (bij eerste keer gebruik)
      console.log("Settings doc bestaat mogelijk nog niet, even geduld...");
    }
  };

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? heats.filter(h => h.type === 'speed') : heats.filter(h => h.type === 'freestyle');
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  // Error view
  if (configError) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <Info color="#dc2626" size={48} style={{ margin: '0 auto' }} />
          <h2 style={{ color: '#991b1b', marginTop: '20px' }}>Configuratie Fout</h2>
          <p style={{ color: '#b91c1c' }}>{configError}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Opnieuw proberen</button>
        </div>
      </div>
    );
  }

  // Loading view
  if (!isAuthReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <Activity className="animate-spin" size={48} color="#2563eb" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '20px', fontWeight: 600, color: '#2563eb' }}>Initialiseren...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '"Inter", sans-serif', backgroundColor: '#fff', color: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', borderBottom: '2px solid #eee', alignItems: 'center', background: '#fff', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></h2>
          <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', padding: '5px', borderRadius: '12px' }}>
            <button onClick={() => setView('live')} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', background: view === 'live' ? '#fff' : 'transparent', color: view === 'live' ? '#2563eb' : '#666', boxShadow: view === 'live' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Wedstrijd</button>
            <button onClick={() => setView('management')} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', background: view === 'management' ? '#fff' : 'transparent', color: view === 'management' ? '#2563eb' : '#666', boxShadow: view === 'management' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Beheer</button>
            <button onClick={() => setView('display')} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s', background: view === 'display' ? '#fff' : 'transparent', color: view === 'display' ? '#2563eb' : '#666', boxShadow: view === 'display' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Groot Scherm</button>
          </div>
        </div>
        <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '6px 12px', borderRadius: '20px' }}>
          <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
          LIVE SYNC
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px' }}>
        {view === 'live' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px', gap: '10px' }}>
              <button onClick={() => setActiveTab('speed')} style={{ flex: 1, maxWidth: '200px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', background: activeTab === 'speed' ? '#2563eb' : '#fff', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ flex: 1, maxWidth: '200px', padding: '15px', border: '1px solid #ddd', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', transition: '0.2s', background: activeTab === 'freestyle' ? '#7c3aed' : '#fff', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: '30px', padding: '40px', textAlign: 'center', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: 0, color: '#999', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Huidige Reeks</h3>
              <h1 style={{ margin: '10px 0', fontSize: '2.5rem', fontWeight: 900 }}>{currentHeat?.onderdeel || "Einde Programma"}</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '50px', margin: '40px 0' }}>
                <button onClick={() => updateHeat(-1)} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '80px', height: '80px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={40}/></button>
                <div style={{ fontSize: '10rem', fontWeight: 900, lineHeight: 1 }}>{activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}</div>
                <button onClick={() => updateHeat(1)} style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: '80px', height: '80px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={40}/></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {currentHeat?.slots?.map((slot, i) => {
                  const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                  return (
                    <div key={i} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '15px', background: '#fcfcfc', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#bbb', marginBottom: '5px' }}>VELD {slot.veld}</div>
                      <div style={{ fontWeight: 900, color: '#000', fontSize: '0.95rem' }}>{s.naam}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>{s.club}</div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => updateHeat(1)} style={{ width: '100%', marginTop: '40px', padding: '25px', borderRadius: '20px', border: 'none', background: activeTab === 'speed' ? '#2563eb' : '#7c3aed', color: '#fff', fontSize: '1.5rem', fontWeight: 900, cursor: 'pointer', transition: 'transform 0.1s', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>VOLGENDE REEKS</button>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontWeight: 900, fontSize: '2rem' }}>WEDSTRIJDBEHEER</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', marginTop: '30px' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999', marginBottom: '15px' }}>1. DOWNLOAD SJABLOON</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => downloadTemplate('speed')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', cursor: 'pointer', fontWeight: 700 }}><Download size={18}/> Speed (.csv)</button>
                  <button onClick={() => downloadTemplate('freestyle')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '15px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', cursor: 'pointer', fontWeight: 700 }}><Download size={18}/> Freestyle (.csv)</button>
                </div>
                <div style={{ marginTop: '20px', padding: '20px', background: '#eff6ff', borderRadius: '15px', fontSize: '0.85rem', lineHeight: '1.6', color: '#1e40af' }}>
                  <strong>Tip:</strong> Gebruik het sjabloon om je data in de juiste kolommen te zetten. Plak daarna de rijen in het tekstvak hiernaast.
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999', marginBottom: '15px' }}>2. PLAK DATA ({importType.toUpperCase()})</h4>
                <div style={{ marginBottom: '15px', display: 'flex', gap: '20px' }}>
                  <label style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="radio" checked={importType === 'speed'} onChange={() => setImportType('speed')} /> Speed</label>
                  <label style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="radio" checked={importType === 'freestyle'} onChange={() => setImportType('freestyle')} /> Freestyle</label>
                </div>
                <textarea value={csvInput} onChange={(e) => setCsvInput(e.target.value)} placeholder="reeks, onderdeel, uur, club, skipper..." style={{ width: '100%', height: '300px', borderRadius: '15px', border: '1px solid #ddd', padding: '15px', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#2563eb'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
                <button onClick={handleImport} disabled={isProcessing} style={{ width: '100%', marginTop: '10px', padding: '20px', borderRadius: '15px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? "Verwerken..." : "DATA IMPORTEREN"}</button>
                {statusMsg && <div style={{ marginTop: '15px', padding: '15px', borderRadius: '10px', background: statusMsg.type === 'success' ? '#dcfce7' : '#dbeafe', color: statusMsg.type === 'success' ? '#166534' : '#1e40af', fontWeight: 700, textAlign: 'center' }}>{statusMsg.text}</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, padding: '50px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '50px', alignItems: 'flex-start' }}>
               <h1 style={{ fontSize: '9rem', fontWeight: 900, lineHeight: 0.8, margin: 0, letterSpacing: '-5px' }}>{activeTab === 'speed' ? 'SPEED' : 'FREESTYLE'}</h1>
               <div style={{ background: '#f5f5f5', padding: '30px 60px', borderRadius: '40px', textAlign: 'center' }}>
                 <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ccc', letterSpacing: '4px' }}>REEKS</div>
                 <div style={{ fontSize: '12rem', fontWeight: 900, lineHeight: 1 }}>{activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}</div>
               </div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px' }}>
              {currentHeat?.slots?.map((slot, i) => {
                const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                return (
                  <div key={i} style={{ border: '4px solid #f5f5f5', borderRadius: '40px', padding: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '4rem', fontWeight: 900, color: activeTab === 'speed' ? '#2563eb' : '#7c3aed' }}>{slot.veld}</div>
                    <div>
                      <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase', wordBreak: 'break-word' }}>{s.naam}</div>
                      <div style={{ fontSize: '1.2rem', color: '#888', fontWeight: 700, marginTop: '10px' }}>{s.club}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '40px', background: '#000', color: '#fff', padding: '30px', borderRadius: '40px', fontSize: '3rem', fontWeight: 900, textAlign: 'center' }}>{settings.announcement}</div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', background: '#eee', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>WEDSTRIJDMODUS</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
