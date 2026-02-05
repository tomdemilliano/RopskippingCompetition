import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  setDoc,
  writeBatch,
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

import { 
  Trophy, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Megaphone,
  LayoutDashboard,
  Eye,
  Clock,
  Activity,
  Zap,
  Star,
  UploadCloud,
  Loader2,
  Database,
  Trash2,
  FileText,
  AlertCircle
} from 'lucide-react';

const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  return {
    apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
    authDomain: "ropeskippingcontest.firebaseapp.com",
    projectId: "ropeskippingcontest",
    storageBucket: "ropeskippingcontest.firebasestorage.app",
    messagingSenderId: "430066523717",
    appId: "1:430066523717:web:eea53ced41773af66a4d2c",
  };
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropeskipping-db-v2';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('speed');
  
  // Data state
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom bij de wedstrijd!",
  });

  // UI state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState('speed');
  const [csvInput, setCsvInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skippersRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const heatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) setSettings(doc.data());
    });

    const unsubSkippers = onSnapshot(skippersRef, (snapshot) => {
      const dict = {};
      snapshot.forEach(doc => { dict[doc.id] = doc.data(); });
      setSkippers(dict);
    });

    const unsubHeats = onSnapshot(heatsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHeats(data.sort((a, b) => a.reeks - b.reeks));
    });

    return () => {
      unsubSettings();
      unsubSkippers();
      unsubHeats();
    };
  }, [user]);

  // --- CSV Parsing Logic ---
  const handleImport = async () => {
    if (!csvInput.trim()) return;
    setIsProcessing(true);
    setMessage({ type: 'info', text: 'Data verwerken...' });

    try {
      const rows = csvInput.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);
      let count = 0;

      if (importType === 'speed') {
        // Structuur: Reeks, Onderdeel, Uur, Club1, Skipper1, Club2, Skipper2, ...
        rows.forEach((row) => {
          if (!row[0] || isNaN(row[0])) return; // Skip headers of lege rijen
          
          const reeksNum = parseInt(row[0]);
          const onderdeel = row[1];
          const heatId = `speed_${reeksNum}`;
          const slots = [];

          for (let i = 0; i < 10; i++) {
            const clubIndex = 3 + (i * 2);
            const skipperIndex = 4 + (i * 2);
            const club = row[clubIndex];
            const naam = row[skipperIndex];

            if (naam && naam !== "") {
              const skipperId = `s_${naam.replace(/\s+/g, '_')}_${club.replace(/\s+/g, '_')}`;
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', skipperId), {
                id: skipperId, naam, club
              });
              slots.push({ veld: i + 1, skipperId });
            }
          }

          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'speed',
            reeks: reeksNum,
            onderdeel,
            status: 'pending',
            slots
          });
          count++;
        });
      } else {
        // Freestyle Structuur: reeks, uur, veld, club, skipper
        rows.forEach((row) => {
          if (!row[0] || isNaN(row[0])) return;
          
          const reeksNum = parseInt(row[0]);
          const veldRaw = row[2] || "";
          const veld = veldRaw.replace("Veld ", "");
          const club = row[3];
          const naam = row[4];
          
          if (naam) {
            const skipperId = `fs_${naam.replace(/\s+/g, '_')}_${club.replace(/\s+/g, '_')}`;
            const heatId = `fs_${reeksNum}`;

            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', skipperId), {
              id: skipperId, naam, club
            });

            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
              type: 'freestyle',
              reeks: reeksNum,
              onderdeel: 'Individual Freestyle',
              status: 'pending',
              slots: [{ veld, skipperId }]
            });
            count++;
          }
        });
      }

      await batch.commit();
      setMessage({ type: 'success', text: `${count} reeksen succesvol geïmporteerd!` });
      setCsvInput('');
      setTimeout(() => { setShowImportModal(false); setMessage(null); }, 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Fout bij importeren. Controleer je CSV formaat.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearDatabase = async () => {
    if (!confirm("LET OP: Dit verwijdert ALLE skippers en reeksen. Weet je het zeker?")) return;
    setIsProcessing(true);
    try {
      const qSkippers = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'skippers'));
      const qHeats = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'heats'));
      
      const batch = writeBatch(db);
      qSkippers.forEach(d => batch.delete(d.ref));
      qHeats.forEach(d => batch.delete(d.ref));
      
      // Reset settings
      batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
        currentSpeedHeat: 1,
        currentFreestyleHeat: 1,
        announcement: "Database is gereset. Klaar voor nieuwe import."
      });

      await batch.commit();
      alert("Database is volledig leeggemaakt.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Main Logic ---
  const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed'), [heats]);
  const fsHeats = useMemo(() => heats.filter(h => h.type === 'freestyle'), [heats]);

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? speedHeats : fsHeats;
    const heatNum = activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat;
    return list.find(h => h.reeks === heatNum) || null;
  }, [activeTab, speedHeats, fsHeats, settings]);

  const updateHeatIndex = async (delta) => {
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const newVal = Math.max(1, (settings[key] || 1) + delta);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { [key]: newVal });
  };

  const finishHeat = async () => {
    if (!currentHeat) return;
    await updateHeatIndex(1);
    const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
    await updateDoc(heatRef, { status: 'finished', endTime: serverTimestamp() });
  };

  const getSkipperInfo = (id) => skippers[id] || { naam: "Laden...", club: "-" };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Trophy size={20} />
          </div>
          <h1 className="font-black text-xl italic uppercase tracking-tighter">RopeScore<span className="text-blue-600">Pro</span></h1>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Live' },
            { id: 'control', icon: Activity, label: 'Control' },
            { id: 'display', icon: Eye, label: 'Display' }
          ].map((v) => (
            <button 
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === v.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
              }`}
            >
              <v.icon size={14} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 pb-32">
        {view === 'control' && (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Database Control Panel */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Data Beheer</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{heats.length} reeksen geladen</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                >
                  <UploadCloud size={14} /> Importeer CSV
                </button>
                <button 
                  onClick={clearDatabase}
                  className="p-3 text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Discipline Tab */}
            <div className="flex p-1.5 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
              <button 
                onClick={() => setActiveTab('speed')} 
                className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-[1.6rem] font-black text-xs tracking-[0.2em] transition-all uppercase ${
                  activeTab === 'speed' ? 'bg-orange-500 text-white shadow-xl shadow-orange-100' : 'text-slate-400'
                }`}
              >
                <Zap size={16} /> Speed
              </button>
              <button 
                onClick={() => setActiveTab('freestyle')} 
                className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-[1.6rem] font-black text-xs tracking-[0.2em] transition-all uppercase ${
                  activeTab === 'freestyle' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'
                }`}
              >
                <Star size={16} /> Freestyle
              </button>
            </div>

            {/* Control Card */}
            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8 md:p-16 text-center">
              <div className="mb-12">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] block mb-6">Huidige Reeks</span>
                <div className="flex items-center justify-center gap-10">
                  <button onClick={() => updateHeatIndex(-1)} className="p-6 bg-slate-50 rounded-3xl text-slate-400 hover:text-slate-900 transition-all"><ChevronLeft size={32}/></button>
                  <div className="text-[10rem] font-black text-slate-900 leading-none tabular-nums tracking-tighter">
                    {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                  </div>
                  <button onClick={() => updateHeatIndex(1)} className="p-6 bg-slate-50 rounded-3xl text-slate-400 hover:text-slate-900 transition-all"><ChevronRight size={32}/></button>
                </div>
                <div className="mt-8">
                  <span className="px-6 py-2 bg-blue-50 text-blue-600 rounded-full font-black text-xs uppercase tracking-widest border border-blue-100">
                    {currentHeat?.onderdeel || "Einde wedstrijd"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipperInfo(slot.skipperId);
                  return (
                    <div key={i} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5 text-left">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm border border-slate-200">
                        {slot.veld}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 uppercase tracking-tight">{s.naam}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.club}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={finishHeat}
                className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-8 rounded-[2.5rem] shadow-2xl transition-all flex items-center justify-center gap-4 text-xl uppercase tracking-[0.2em] italic"
              >
                <CheckCircle2 size={24} /> Volgende Reeks
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-700">
            {/* Speed Summary */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-10">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl"><Zap size={24} /></div>
                <h2 className="font-black text-xl uppercase italic">Speed Status</h2>
              </div>
              <div className="space-y-4">
                {speedHeats.slice(Math.max(0, settings.currentSpeedHeat - 1), settings.currentSpeedHeat + 3).map((h) => (
                  <div key={h.id} className={`p-6 rounded-[2rem] border-2 transition-all ${h.reeks === settings.currentSpeedHeat ? 'border-orange-500 bg-orange-50/30' : 'border-slate-50 bg-slate-50/20 opacity-50'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-slate-800 uppercase">Reeks {h.reeks}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h.onderdeel}</span>
                    </div>
                    <div className="flex -space-x-2 overflow-hidden mt-3">
                      {h.slots.slice(0, 5).map((_, i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                          {i + 1}
                        </div>
                      ))}
                      {h.slots.length > 5 && <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black">+{h.slots.length - 5}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Freestyle Summary */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-10">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Star size={24} /></div>
                <h2 className="font-black text-xl uppercase italic">Freestyle Status</h2>
              </div>
              <div className="space-y-4">
                {fsHeats.slice(Math.max(0, settings.currentFreestyleHeat - 1), settings.currentFreestyleHeat + 3).map((h) => (
                  <div key={h.id} className={`p-6 rounded-[2rem] border-2 transition-all ${h.reeks === settings.currentFreestyleHeat ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-50 bg-slate-50/20 opacity-50'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-800 uppercase">Reeks {h.reeks}</span>
                      <span className="text-xs font-bold text-indigo-600">Veld {h.slots?.[0]?.veld}</span>
                    </div>
                    <p className="text-xs font-black text-slate-500 uppercase mt-2">{getSkipperInfo(h.slots?.[0]?.skipperId).naam}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-slate-950 text-white z-[100] p-12 flex flex-col">
             <div className="flex justify-between items-end mb-24">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
                    <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">Live Competition Feed</span>
                  </div>
                  <h1 className="text-[8rem] font-black italic uppercase leading-[0.8] tracking-tighter">
                    {activeTab === 'speed' ? 'Speed' : 'Freestyle'}<br/>
                    <span className="text-blue-600">Arena</span>
                  </h1>
                </div>
                <div className="bg-white/5 backdrop-blur-3xl p-16 rounded-[4rem] border border-white/10 text-center min-w-[300px]">
                   <span className="text-xs font-black text-blue-500 uppercase tracking-[0.5em] block mb-4">Huidige Reeks</span>
                   <div className="text-[12rem] font-black leading-none tabular-nums italic tracking-tighter">
                     {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                   </div>
                </div>
             </div>

             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipperInfo(slot.skipperId);
                  return (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-[3rem] p-10 flex flex-col justify-between hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Veld</span>
                        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-3xl font-black">{slot.veld}</div>
                      </div>
                      <div>
                        <h3 className="text-4xl font-black uppercase tracking-tight italic mb-2 leading-tight">{s.naam}</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{s.club}</p>
                      </div>
                    </div>
                  );
                })}
             </div>

             <div className="mt-16 flex items-center gap-8 bg-blue-600/10 p-6 rounded-[2rem] border border-blue-500/20">
                <Megaphone size={32} className="text-blue-500 animate-bounce" />
                <p className="text-2xl font-black italic uppercase tracking-tight">{settings.announcement}</p>
             </div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={24} /></div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter italic">Data Importeur</h2>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-900 font-bold">SLUITEN</button>
              </div>

              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
                <button 
                  onClick={() => setImportType('speed')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${importType === 'speed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                >SPEED CSV</button>
                <button 
                  onClick={() => setImportType('freestyle')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${importType === 'freestyle' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                >FREESTYLE CSV</button>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl mb-6 flex items-start gap-3 border border-blue-100">
                <AlertCircle className="text-blue-600 shrink-0" size={18} />
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  Kopieer de rijen uit je Google Sheet (inclusief velden) en plak ze hieronder. 
                  Het script herkent automatisch de namen en clubs.
                </p>
              </div>

              <textarea 
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Plak hier de CSV rijen..."
                className="w-full h-64 bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none mb-6"
              />

              {message && (
                <div className={`p-4 rounded-2xl mb-6 text-center text-xs font-black uppercase tracking-widest ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {message.text}
                </div>
              )}

              <button 
                disabled={isProcessing || !csvInput}
                onClick={handleImport}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Database size={18} />}
                Verwerk & Upload naar Cloud
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}} />
    </div>
  );
};

export default App;
