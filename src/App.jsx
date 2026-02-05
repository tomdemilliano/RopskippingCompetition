import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, updateDoc, 
  writeBatch, getDocs 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trophy, ChevronRight, ChevronLeft, CheckCircle2, 
  Megaphone, Activity, Zap, Star, Database, Monitor, Download, Info 
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-v6-fixed';

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
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
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
    if (!csvInput.trim()) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'info', text: 'Data verwerken...' });
    try {
      const rows = csvInput.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);
      let count = 0;

      if (importType === 'speed') {
        rows.forEach(row => {
          if (!row[0] || isNaN(row[0])) return;
          const heatId = `speed_${row[0]}`;
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
            type: 'speed', reeks: parseInt(row[0]), onderdeel: row[1] || 'Speed', slots
          });
          count++;
        });
      } else {
        rows.forEach(row => {
          if (!row[0] || isNaN(row[0])) return;
          const sid = `fs_${row[4]}_${row[3]}`.replace(/[^a-zA-Z0-9]/g, '_');
          const heatId = `fs_${row[0]}`;
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', sid), { id: sid, naam: row[4], club: row[3] });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'freestyle', reeks: parseInt(row[0]), onderdeel: 'Freestyle', slots: [{ veld: row[2], skipperId: sid }]
          });
          count++;
        });
      }
      await batch.commit();
      setStatusMsg({ type: 'success', text: `${count} reeksen succesvol geladen.` });
      setCsvInput('');
    } catch (e) {
      console.error(e);
      setStatusMsg({ type: 'error', text: 'Fout bij import. Controleer je CSV.' });
    } finally { setIsProcessing(false); }
  };

  const updateHeat = async (delta) => {
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
      [key]: Math.max(1, (settings[key] || 1) + delta)
    });
  };

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? heats.filter(h => h.type === 'speed') : heats.filter(h => h.type === 'freestyle');
    const num = activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat;
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  const mainStyles = {
    fontFamily: '"Inter", system-ui, sans-serif',
    backgroundColor: '#ffffff',
    color: '#000000',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={mainStyles}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', borderBottom: '2px solid #eee', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></h2>
          <div style={{ display: 'flex', gap: '5px', background: '#f0f0f0', padding: '5px', borderRadius: '10px' }}>
            <button onClick={() => setView('live')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'live' ? '#fff' : 'transparent', color: view === 'live' ? '#2563eb' : '#666' }}>Wedstrijd</button>
            <button onClick={() => setView('management')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'management' ? '#fff' : 'transparent', color: view === 'management' ? '#2563eb' : '#666' }}>Beheer</button>
            <button onClick={() => setView('display')} style={{ padding: '8px 20px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700, background: view === 'display' ? '#fff' : 'transparent', color: view === 'display' ? '#2563eb' : '#666' }}>Groot Scherm</button>
          </div>
        </div>
        <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.8rem' }}>LIVE CLOUD SYNC</div>
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
                <div style={{ fontSize: '12rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
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
                  <strong>Instructie:</strong> Open het sjabloon in Excel. Kopieer je data in de juiste kolommen. Sla op of kopieer de rijen en plak ze hiernaast.
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#999' }}>2. PLAK DATA</h4>
                <div style={{ marginBottom: '10px' }}>
                  <label><input type="radio" checked={importType === 'speed'} onChange={() => setImportType('speed')} /> Speed</label>
                  <label style={{ marginLeft: '20px' }}><input type="radio" checked={importType === 'freestyle'} onChange={() => setImportType('freestyle')} /> Freestyle</label>
                </div>
                <textarea value={csvInput} onChange={(e) => setCsvInput(e.target.value)} placeholder="reeks, onderdeel, uur, club, skipper..." style={{ width: '100%', height: '300px', borderRadius: '15px', border: '1px solid #ddd', padding: '15px', fontFamily: 'monospace', fontSize: '0.8rem' }} />
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
                 <div style={{ fontSize: '12rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
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
