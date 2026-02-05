import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
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

// --- FIREBASE CONFIGURATIE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
  authDomain: "ropeskippingcontest.firebaseapp.com",
  projectId: "ropeskippingcontest",
  storageBucket: "ropeskippingcontest.firebasestorage.app",
  messagingSenderId: "430066523717",
  appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

// Global services
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [bootError, setBootError] = useState(null);
  
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
        // Gebruik bestaande app of initialiseer nieuwe met de hardcoded config
        if (!getApps().length) {
          app = initializeApp(firebaseConfig);
        } else {
          app = getApps()[0];
        }
        
        auth = getAuth(app);
        db = getFirestore(app);

        // Authenticatie proces (RULE 3)
        const performAuth = async () => {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            return await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            return await signInAnonymously(auth);
          }
        };

        await performAuth();

        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            setIsAuthReady(true);
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error("Boot error:", err);
        setBootError(err.message);
      }
    };

    startFirebase();
  }, []);

  // STAP 2: Data listeners (RULE 1 & 3)
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;

    // Paden volgens RULE 1: /artifacts/{appId}/public/data/{collection}
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

  const updateHeat = async (delta) => {
    if (!user || !db) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    
    const newVal = Math.max(1, (settings[key] || 1) + delta);
    try {
      await updateDoc(settingsRef, { [key]: newVal });
    } catch (err) {
      console.warn("Update mislukt, doc wordt mogelijk aangemaakt...");
    }
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !user || !db) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'info', text: 'Data uploaden naar cloud...' });
    
    try {
      const rows = csvInput.split('\n')
        .filter(r => r.trim())
        .map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      
      // Skip header indien nodig
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
      setStatusMsg({ type: 'success', text: `${count} reeksen succesvol geïmporteerd.` });
      setCsvInput('');
    } catch (e) {
      console.error("Import error:", e);
      setStatusMsg({ type: 'error', text: `Fout: ${e.message}` });
    } finally { 
      setIsProcessing(false); 
    }
  };

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? heats.filter(h => h.type === 'speed') : heats.filter(h => h.type === 'freestyle');
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  if (bootError) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50 p-6 text-center">
        <div>
          <Info className="mx-auto text-red-600 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-800">Verbindingsfout</h2>
          <p className="text-red-600 mb-4">{bootError}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">Herladen</button>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Activity className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="font-bold text-blue-600">Laden van wedstrijdgegevens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-black font-sans selection:bg-blue-100">
      {/* HEADER */}
      <header className="flex justify-between items-center px-8 py-4 border-b-2 border-gray-100 sticky top-0 bg-white z-50">
        <div className="flex gap-10 items-center">
          <h1 className="text-xl font-black tracking-tighter">ROPESCORE <span className="text-blue-600">PRO</span></h1>
          <nav className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'live', label: 'Wedstrijd' },
              { id: 'management', label: 'Beheer' },
              { id: 'display', label: 'Groot Scherm' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${view === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-xs font-black">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          CLOUD SYNC ACTIEF
        </div>
      </header>

      <main className="flex-1 p-10">
        {view === 'live' && (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-center gap-4 mb-8">
              <button 
                onClick={() => setActiveTab('speed')} 
                className={`flex-1 max-w-[200px] py-4 rounded-2xl font-black border-2 transition-all ${activeTab === 'speed' ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-black hover:border-gray-300'}`}
              >
                SPEED
              </button>
              <button 
                onClick={() => setActiveTab('freestyle')} 
                className={`flex-1 max-w-[200px] py-4 rounded-2xl font-black border-2 transition-all ${activeTab === 'freestyle' ? 'bg-purple-600 border-purple-600 text-white shadow-lg scale-105' : 'bg-white border-gray-100 text-black hover:border-gray-300'}`}
              >
                FREESTYLE
              </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-[40px] p-12 text-center shadow-xl shadow-blue-50/50">
              <span className="text-gray-400 text-xs font-black uppercase tracking-widest">Huidige Reeks</span>
              <h2 className="text-4xl font-black mt-2 mb-8">{currentHeat?.onderdeel || "Einde Programma"}</h2>
              
              <div className="flex items-center justify-center gap-12 mb-12">
                <button onClick={() => updateHeat(-1)} className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronLeft size={40}/></button>
                <div className="text-[12rem] font-black leading-none tracking-tighter tabular-nums">
                  {activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}
                </div>
                <button onClick={() => updateHeat(1)} className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronRight size={40}/></button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                  return (
                    <div key={i} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 text-left">
                      <div className="text-[10px] font-black text-gray-400 mb-1">VELD {slot.veld}</div>
                      <div className="font-black text-sm truncate">{s.naam}</div>
                      <div className="text-[10px] text-gray-500 font-bold truncate">{s.club}</div>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={() => updateHeat(1)} 
                className={`w-full mt-12 py-6 rounded-3xl text-white text-2xl font-black shadow-2xl transition-transform active:scale-95 ${activeTab === 'speed' ? 'bg-blue-600 shadow-blue-200' : 'bg-purple-600 shadow-purple-200'}`}
              >
                VOLGENDE REEKS
              </button>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-black tracking-tight mb-8">Data Beheer</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-4">
                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 text-blue-900">
                  <h4 className="font-black text-sm mb-2 flex items-center gap-2"><Info size={16}/> Hoe werkt het?</h4>
                  <p className="text-xs font-medium leading-relaxed">Download het sjabloon, vul je wedstrijddata in en plak de inhoud in het vak hiernaast.</p>
                </div>
                <button onClick={() => {/* Sjabloon download logic */}} className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl font-bold hover:border-blue-600 transition-colors">
                  <span>Sjabloon Speed</span>
                  <Download size={18} className="text-blue-600"/>
                </button>
                <button onClick={() => {/* Sjabloon download logic */}} className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl font-bold hover:border-purple-600 transition-colors">
                  <span>Sjabloon Freestyle</span>
                  <Download size={18} className="text-purple-600"/>
                </button>
              </div>
              
              <div className="md:col-span-2">
                <div className="flex gap-4 mb-4">
                  <button onClick={() => setImportType('speed')} className={`px-6 py-2 rounded-full font-black text-xs border-2 ${importType === 'speed' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-100'}`}>SPEED</button>
                  <button onClick={() => setImportType('freestyle')} className={`px-6 py-2 rounded-full font-black text-xs border-2 ${importType === 'freestyle' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-100'}`}>FREESTYLE</button>
                </div>
                <textarea 
                  value={csvInput} 
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="reeks, onderdeel, club, skipper..."
                  className="w-full h-80 rounded-3xl border border-gray-200 p-6 font-mono text-sm focus:border-blue-600 outline-none transition-all"
                />
                <button 
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="w-full mt-4 py-5 bg-black text-white rounded-2xl font-black disabled:opacity-50"
                >
                  {isProcessing ? "BEZIG MET VERWERKEN..." : "IMPORTEER DATA NAAR CLOUD"}
                </button>
                {statusMsg && (
                  <div className={`mt-4 p-4 rounded-xl font-bold text-center text-sm ${statusMsg.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {statusMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-white z-[1000] p-12 flex flex-col overflow-hidden">
            <div className="flex justify-between items-start mb-12">
               <h1 className="text-[12vw] font-black leading-[0.8] tracking-tighter m-0">
                 {activeTab === 'speed' ? 'SPEED' : 'FREESTYLE'}
               </h1>
               <div className="bg-gray-100 px-12 py-8 rounded-[50px] text-center min-w-[300px]">
                 <div className="text-2xl font-black text-gray-400 tracking-widest mb-2">REEKS</div>
                 <div className="text-[15vw] font-black leading-none tabular-nums">
                   {activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1)}
                 </div>
               </div>
            </div>
            
            <div className="flex-1 grid grid-cols-5 gap-6">
              {currentHeat?.slots?.map((slot, i) => {
                const s = skippers[slot.skipperId] || { naam: "---", club: "---" };
                return (
                  <div key={i} className="border-4 border-gray-100 rounded-[60px] p-10 flex flex-col justify-between">
                    <div className={`text-8xl font-black ${activeTab === 'speed' ? 'text-blue-600' : 'text-purple-600'}`}>
                      {slot.veld}
                    </div>
                    <div>
                      <div className="text-5xl font-black leading-tight uppercase break-words">{s.naam}</div>
                      <div className="text-2xl text-gray-400 font-bold mt-4 uppercase">{s.club}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-12 bg-black text-white p-10 rounded-[50px] text-5xl font-black text-center">
              {settings.announcement}
            </div>
            
            <button 
              onClick={() => setView('live')} 
              className="absolute top-8 right-8 bg-gray-200 hover:bg-gray-300 p-4 rounded-2xl font-black text-xs transition-colors"
            >
              SLUIT GROOT SCHERM
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
