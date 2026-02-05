import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, CheckCircle2, Plus, Trophy, Settings, Calendar, MapPin, List, Play, Archive, Trash2
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
  const [view, setView] = useState('management'); // Start in management voor wedstrijdkeuze
  const [activeTab, setActiveTab] = useState('speed');
  
  // Wedstrijd-gerelateerde state
  const [competitions, setCompetitions] = useState([]);
  const [activeCompId, setActiveCompId] = useState(null);
  
  // Data voor de actieve wedstrijd
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [compSettings, setCompSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
  });

  // UI state
  const [csvInput, setCsvInput] = useState('');
  const [importType, setImportType] = useState('speed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ type: null, msg: null });
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', status: 'gepland' });

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
      } catch (e) { console.error("Firebase Init Error", e); }
    };
    init();
  }, []);

  // Luister naar alle wedstrijden
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;
    const compsRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    return onSnapshot(compsRef, (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompetitions(list);
      // Als er nog geen actieve is geselecteerd, pak de eerste 'actieve'
      if (!activeCompId && list.length > 0) {
        const activeOne = list.find(c => c.status === 'actief') || list[0];
        setActiveCompId(activeOne.id);
      }
    });
  }, [isAuthReady, user]);

  // Luister naar data van de SPECIFIEKE geselecteerde wedstrijd
  useEffect(() => {
    if (!activeCompId || !db || !user) return;

    const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
    const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers');
    const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats');

    const unsubS = onSnapshot(compRef, (d) => {
      if (d.exists()) {
        const data = d.data();
        setCompSettings({
          currentSpeedHeat: data.currentSpeedHeat || 1,
          currentFreestyleHeat: data.currentFreestyleHeat || 1
        });
      }
    });

    const unsubSk = onSnapshot(skRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    });

    const unsubH = onSnapshot(hRef, s => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    });

    return () => { unsubS(); unsubSk(); unsubH(); };
  }, [activeCompId, user]);

  const currentHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat;
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, compSettings]);

  const stats = useMemo(() => {
    return {
      speed: heats.filter(h => h.type === 'speed').length,
      freestyle: heats.filter(h => h.type === 'freestyle').length
    };
  }, [heats]);

  const handleCreateCompetition = async (e) => {
    e.preventDefault();
    if (!newComp.name || !db) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
        ...newComp,
        currentSpeedHeat: 1,
        currentFreestyleHeat: 1,
        createdAt: new Date().toISOString()
      });
      setNewComp({ name: '', date: '', location: '', status: 'gepland' });
    } catch (e) { console.error(e); }
  };

  const updateCompStatus = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id), { status });
  };

  const deleteCompetition = async (id) => {
    if (!window.confirm("Weet je zeker dat je deze wedstrijd en alle bijbehorende data wilt verwijderen?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
    if (activeCompId === id) setActiveCompId(null);
  };

  const handleImport = async () => {
    if (!csvInput.trim() || !activeCompId || !db || !user) return;
    setIsProcessing(true);
    try {
      const lines = csvInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);

      for (const row of rows) {
        const reeksNum = parseInt(row[0]);
        if (isNaN(reeksNum)) continue;

        const baseRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);

        if (importType === 'speed') {
          const slots = [];
          for (let v = 1; v <= 10; v++) {
            const club = row[3 + (v - 1) * 2];
            const naam = row[4 + (v - 1) * 2];
            if (naam && naam !== "") {
              const sid = `s_${naam}_${club}`.replace(/[^a-zA-Z0-9]/g, '_');
              batch.set(doc(baseRef, 'skippers', sid), { id: sid, naam, club });
              slots.push({ veld: `Veld ${v}`, skipperId: sid, veldNr: v });
            }
          }
          batch.set(doc(baseRef, 'heats', `speed_${reeksNum}`), { 
            type: 'speed', reeks: reeksNum, onderdeel: row[1], uur: row[2], slots, status: 'pending' 
          });
        } else {
          const sid = `s_${row[2]}_${row[1]}`.replace(/[^a-zA-Z0-9]/g, '_');
          batch.set(doc(baseRef, 'skippers', sid), { id: sid, naam: row[2], club: row[1] });
          batch.set(doc(baseRef, 'heats', `fs_${reeksNum}`), { 
            type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', uur: row[4] || '00:00', slots: [{ veld: row[3] || 'Veld A', skipperId: sid }], status: 'pending' 
          });
        }
      }
      await batch.commit();
      setStatus({ type: 'success', msg: `Import voltooid! ${rows.length} rijen verwerkt.` });
      setCsvInput('');
    } catch (e) { setStatus({ type: 'error', msg: e.message }); }
    setIsProcessing(false);
  };

  const updateHeatIndex = async (delta) => {
    if (!activeCompId || !db) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const val = Math.max(1, (compSettings[key] || 1) + delta);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { [key]: val });
  };

  // Helper voor status kleuren
  const getStatusColor = (s) => {
    switch(s) {
      case 'actief': return '#16a34a';
      case 'afgesloten': return '#64748b';
      default: return '#2563eb';
    }
  };

  const selectedComp = competitions.find(c => c.id === activeCompId);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <h1 className="font-black text-xl tracking-tight">ROPESCORE <span className="text-blue-600">PRO</span></h1>
          <nav className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setView('live')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${view === 'live' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Live</button>
            <button onClick={() => setView('management')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${view === 'management' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Beheer</button>
            <button onClick={() => setView('display')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${view === 'display' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Scherm</button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {selectedComp && (
             <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase">
               <Activity size={14}/> {selectedComp.name}
             </div>
          )}
          <span className="font-mono font-bold text-slate-600">{currentTime.toLocaleTimeString('nl-BE')}</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        {view === 'management' && (
          <div className="max-w-6xl mx-auto h-full flex gap-6 overflow-hidden">
            {/* Linker kolom: Lijst van wedstrijden */}
            <div className="w-1/3 flex flex-col gap-4 overflow-hidden">
              <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 shrink-0">
                <h2 className="text-lg font-black mb-4 flex items-center gap-2"><Plus size={20} className="text-blue-600"/> NIEUWE WEDSTRIJD</h2>
                <form onSubmit={handleCreateCompetition} className="space-y-3">
                  <input required placeholder="Naam wedstrijd" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 ring-blue-500 outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    <input placeholder="Locatie" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-black text-sm hover:bg-blue-700 transition">WEDSTRIJD AANMAKEN</button>
                </form>
              </section>

              <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                <h2 className="text-lg font-black mb-4 flex items-center gap-2"><Trophy size={20} className="text-amber-500"/> WEDSTRIJDEN</h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {competitions.length === 0 && <p className="text-slate-400 text-sm italic">Nog geen wedstrijden.</p>}
                  {competitions.map(c => (
                    <div key={c.id} 
                      onClick={() => setActiveCompId(c.id)}
                      className={`p-4 rounded-xl border-2 transition cursor-pointer relative group ${activeCompId === c.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-slate-900 leading-tight pr-8">{c.name}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                           <button onClick={(e) => { e.stopPropagation(); deleteCompetition(c.id); }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: getStatusColor(c.status) }}>{c.status.toUpperCase()}</span>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                           <Calendar size={12}/> {c.date || 'TBD'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Rechter kolom: Details & Import */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {activeCompId ? (
                <>
                  <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 shrink-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">{selectedComp?.name}</h2>
                        <div className="flex gap-4 mt-2">
                          <div className="flex items-center gap-1.5 text-slate-500 text-sm font-bold"><MapPin size={16}/> {selectedComp?.location || 'Geen locatie'}</div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-sm font-bold"><Calendar size={16}/> {selectedComp?.date || 'Geen datum'}</div>
                        </div>
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['gepland', 'actief', 'afgesloten'].map(s => (
                          <button key={s} onClick={() => updateCompStatus(activeCompId, s)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition capitalize ${selectedComp?.status === s ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>{s}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <div className="text-blue-600 font-black text-xs uppercase tracking-wider">Speed Reeksen</div>
                        <div className="text-3xl font-black text-blue-900 mt-1">{stats.speed}</div>
                      </div>
                      <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                        <div className="text-purple-600 font-black text-xs uppercase tracking-wider">Freestyle Reeksen</div>
                        <div className="text-3xl font-black text-purple-900 mt-1">{stats.freestyle}</div>
                      </div>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                    <h2 className="text-lg font-black mb-4 flex items-center gap-2"><List size={20} className="text-indigo-500"/> DATA IMPORT</h2>
                    <div className="flex gap-2 mb-4">
                      <button onClick={() => setImportType('speed')} className={`flex-1 py-2 rounded-xl text-sm font-black transition border-2 ${importType === 'speed' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>SPEED CSV</button>
                      <button onClick={() => setImportType('freestyle')} className={`flex-1 py-2 rounded-xl text-sm font-black transition border-2 ${importType === 'freestyle' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>FREESTYLE CSV</button>
                    </div>
                    <textarea 
                      value={csvInput} 
                      onChange={e => setCsvInput(e.target.value)}
                      placeholder={`Plak hier de ${importType} CSV data...`}
                      className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:ring-2 ring-blue-500 outline-none resize-none"
                    />
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-slate-400 font-bold">
                        {importType === 'speed' ? 'Formaat: Reeks, Onderdeel, Uur, Club1, Skipper1, ...' : 'Formaat: Reeks, Club, Skipper, Veld, Uur'}
                      </div>
                      <button 
                        onClick={handleImport}
                        disabled={isProcessing || !csvInput}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-slate-800 transition disabled:opacity-50"
                      >
                        {isProcessing ? 'VERWERKEN...' : 'IMPORT STARTEN'}
                      </button>
                    </div>
                    {status.msg && <div className={`mt-4 p-3 rounded-xl text-sm font-bold ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{status.msg}</div>}
                  </section>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <Trophy size={64} strokeWidth={1}/>
                  <p className="mt-4 font-black text-xl">SELECTEER EEN WEDSTRIJD</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'live' && selectedComp && (
           <div className="max-w-4xl mx-auto h-full flex flex-col gap-4">
              <div className="flex gap-2 justify-center shrink-0">
                <button onClick={() => setActiveTab('speed')} className={`px-8 py-3 rounded-xl font-black transition ${activeTab === 'speed' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>SPEED</button>
                <button onClick={() => setActiveTab('freestyle')} className={`px-8 py-3 rounded-xl font-black transition ${activeTab === 'freestyle' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>FREESTYLE</button>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center shrink-0">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">HUIDIGE REEKS</span>
                <div className="flex items-center justify-center gap-12 mt-2">
                  <button onClick={() => updateHeatIndex(-1)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition"><ChevronLeft size={32}/></button>
                  <span className="text-8xl font-black tabular-nums">{activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat}</span>
                  <button onClick={() => updateHeatIndex(1)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition"><ChevronRight size={32}/></button>
                </div>
                <div className="mt-6 flex flex-col items-center gap-1">
                  <div className="text-xl font-black text-slate-800">{currentHeat?.onderdeel || 'Geen onderdeel'}</div>
                  <div className="px-4 py-1 bg-slate-100 rounded-full text-sm font-black text-slate-500">GEPLAND: {currentHeat?.uur || '--:--'}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                 <div className="grid grid-cols-1 gap-2">
                    {activeTab === 'speed' ? (
                      // Toon alle 10 velden voor speed
                      Array.from({length: 10}, (_, i) => i + 1).map(vNum => {
                        const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                        const skipper = slot ? skippers[slot.skipperId] : null;
                        return (
                          <div key={vNum} className={`flex items-center gap-4 p-4 rounded-2xl border transition ${skipper ? 'bg-white border-slate-200' : 'bg-slate-50/50 border-dashed border-slate-200 opacity-40'}`}>
                            <div className="w-16 font-black text-blue-600 text-sm italic">VELD {vNum}</div>
                            <div className="flex-1 font-black text-lg">{skipper?.naam || '-'}</div>
                            <div className="text-slate-400 font-bold text-sm uppercase">{skipper?.club || ''}</div>
                          </div>
                        );
                      })
                    ) : (
                      // Toon slots voor freestyle (meestal 1 of 2)
                      currentHeat?.slots?.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-6 bg-white border border-slate-200 rounded-2xl">
                           <div className="w-20 font-black text-purple-600">{slot.veld}</div>
                           <div className="flex-1 font-black text-2xl">{skippers[slot.skipperId]?.naam}</div>
                           <div className="text-slate-400 font-bold uppercase">{skippers[slot.skipperId]?.club}</div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
           </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-white z-[100] p-8 flex flex-col overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h1 className="text-5xl font-black leading-none">{currentHeat?.onderdeel?.toUpperCase() || 'GEEN DATA'}</h1>
                   <div className="text-blue-600 font-black text-xl mt-2">ROPESKIPPING LIVE - {selectedComp?.name?.toUpperCase()}</div>
                </div>
                <div className="flex gap-4">
                   <div className="bg-slate-100 px-6 py-3 rounded-2xl text-right">
                      <div className="text-xs font-black text-slate-500 uppercase">Gepland</div>
                      <div className="text-3xl font-black">{currentHeat?.uur || '--:--'}</div>
                   </div>
                   <div className="bg-black text-white px-6 py-3 rounded-2xl text-right">
                      <div className="text-xs font-black opacity-60 uppercase">Live Tijd</div>
                      <div className="text-3xl font-black tabular-nums">{currentTime.toLocaleTimeString('nl-BE', {hour:'2-digit', minute:'2-digit'})}</div>
                   </div>
                </div>
             </div>

             <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 flex items-center gap-6 mb-6">
                <span className="text-2xl font-black text-slate-400">REEKS</span>
                <span className="text-7xl font-black text-blue-600 leading-none">{activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat}</span>
                <div className="ml-auto flex items-center gap-3">
                   <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                   <span className="text-xl font-black">LIVE</span>
                </div>
             </div>

             <div className="flex-1 grid grid-cols-1 gap-2 overflow-hidden">
                {activeTab === 'speed' ? (
                  Array.from({length: 10}, (_, i) => i + 1).map(vNum => {
                    const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                    const skipper = slot ? skippers[slot.skipperId] : null;
                    return (
                      <div key={vNum} className={`flex-1 flex items-center px-8 border rounded-2xl ${skipper ? 'bg-white border-slate-200' : 'bg-slate-50/50 border-transparent opacity-20'}`}>
                         <span className="w-24 text-lg font-black text-blue-600 italic">VELD {vNum}</span>
                         <span className="flex-1 text-3xl font-black truncate">{skipper?.naam || ''}</span>
                         <span className="text-xl font-bold text-slate-400 uppercase">{skipper?.club || ''}</span>
                      </div>
                    );
                  })
                ) : (
                  currentHeat?.slots?.map((slot, idx) => (
                    <div key={idx} className="flex-1 flex items-center px-12 bg-white border border-slate-200 rounded-3xl">
                       <span className="w-32 text-2xl font-black text-purple-600">{slot.veld}</span>
                       <span className="flex-1 text-6xl font-black">{skippers[slot.skipperId]?.naam}</span>
                       <span className="text-3xl font-bold text-slate-400 uppercase">{skippers[slot.skipperId]?.club}</span>
                    </div>
                  ))
                )}
             </div>

             <button onClick={() => setView('live')} className="absolute top-2 left-2 opacity-10 hover:opacity-100 transition px-4 py-2 bg-slate-100 rounded font-black text-[10px]">SLUITEN</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
