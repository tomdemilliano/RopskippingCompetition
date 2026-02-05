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
  Activity,
  Zap,
  Star,
  UploadCloud,
  Loader2,
  Database,
  Trash2,
  FileText,
  AlertCircle,
  Settings,
  Users
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
        rows.forEach((row) => {
          if (!row[0] || isNaN(row[0])) return;
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
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', skipperId), { id: skipperId, naam, club });
              slots.push({ veld: i + 1, skipperId });
            }
          }
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
            type: 'speed', reeks: reeksNum, onderdeel, status: 'pending', slots
          });
          count++;
        });
      } else {
        rows.forEach((row) => {
          if (!row[0] || isNaN(row[0])) return;
          const reeksNum = parseInt(row[0]);
          const veld = (row[2] || "").replace("Veld ", "");
          const club = row[3];
          const naam = row[4];
          if (naam) {
            const skipperId = `fs_${naam.replace(/\s+/g, '_')}_${club.replace(/\s+/g, '_')}`;
            const heatId = `fs_${reeksNum}`;
            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'skippers', skipperId), { id: skipperId, naam, club });
            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'heats', heatId), {
              type: 'freestyle', reeks: reeksNum, onderdeel: 'Individual Freestyle', status: 'pending', slots: [{ veld, skipperId }]
            });
            count++;
          }
        });
      }
      await batch.commit();
      setMessage({ type: 'success', text: `${count} reeksen toegevoegd!` });
      setCsvInput('');
      setTimeout(() => { setShowImportModal(false); setMessage(null); }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Import mislukt. Check CSV formaat.' });
    } finally { setIsProcessing(false); }
  };

  const clearDatabase = async () => {
    if (!confirm("Alle data wissen? Dit kan niet ongedaan worden gemaakt.")) return;
    setIsProcessing(true);
    try {
      const qSkippers = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'skippers'));
      const qHeats = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'heats'));
      const batch = writeBatch(db);
      qSkippers.forEach(d => batch.delete(d.ref));
      qHeats.forEach(d => batch.delete(d.ref));
      batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
        currentSpeedHeat: 1, currentFreestyleHeat: 1, announcement: "Database gereset."
      });
      await batch.commit();
    } finally { setIsProcessing(false); }
  };

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
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id), { 
      status: 'finished', endTime: serverTimestamp() 
    });
  };

  const getSkipperInfo = (id) => skippers[id] || { naam: "---", club: "---" };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans text-slate-900">
      
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
              <Trophy size={22} />
            </div>
            <div className="leading-tight">
              <h1 className="font-black text-xl tracking-tighter uppercase italic">RopeScore<span className="text-indigo-600">Pro</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competition Manager</p>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-slate-200 ml-4"></div>
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Overzicht' },
              { id: 'control', icon: Activity, label: 'Wedstrijdleiding' },
              { id: 'display', icon: Eye, label: 'Groot Scherm' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setView(btn.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  view === btn.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <btn.icon size={14} />
                {btn.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end mr-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
             <span className="text-xs font-bold text-green-600 flex items-center gap-1.5">
               <div className="w-2 h-2 bg-green-500 rounded-full"></div> Live Verbinding
             </span>
           </div>
           <button onClick={() => setShowImportModal(true)} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-md">
             <UploadCloud size={20} />
           </button>
           <button onClick={clearDatabase} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100">
             <Trash2 size={20} />
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto p-8">
          
          {view === 'dashboard' && (
            <div className="grid grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Speed Column */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-orange-100 text-orange-600 rounded-3xl"><Zap size={28} /></div>
                      <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tight">Speed Reeksen</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{speedHeats.length} totaal</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nu Bezig</span>
                       <span className="text-4xl font-black text-orange-600 tabular-nums">#{settings.currentSpeedHeat}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {speedHeats.slice(Math.max(0, settings.currentSpeedHeat - 1), settings.currentSpeedHeat + 4).map((h) => (
                      <div key={h.id} className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between ${h.reeks === settings.currentSpeedHeat ? 'border-orange-500 bg-orange-50/20' : 'border-slate-50 bg-slate-50/50 opacity-60'}`}>
                        <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${h.reeks === settings.currentSpeedHeat ? 'bg-orange-500 text-white' : 'bg-white text-slate-400'}`}>
                            {h.reeks}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 uppercase text-lg">{h.onderdeel}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{h.slots.length} springers geladen</p>
                          </div>
                        </div>
                        {h.reeks < settings.currentSpeedHeat && <CheckCircle2 className="text-green-500" size={24} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Freestyle Column */}
              <div className="col-span-12 lg:col-span-6 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-indigo-100 text-indigo-600 rounded-3xl"><Star size={28} /></div>
                      <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tight">Freestyle Reeksen</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{fsHeats.length} totaal</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nu Bezig</span>
                       <span className="text-4xl font-black text-indigo-600 tabular-nums">#{settings.currentFreestyleHeat}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {fsHeats.slice(Math.max(0, settings.currentFreestyleHeat - 1), settings.currentFreestyleHeat + 4).map((h) => (
                      <div key={h.id} className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between ${h.reeks === settings.currentFreestyleHeat ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-50 bg-slate-50/50 opacity-60'}`}>
                        <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${h.reeks === settings.currentFreestyleHeat ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                            {h.reeks}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 uppercase text-lg">{getSkipperInfo(h.slots?.[0]?.skipperId).naam}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{getSkipperInfo(h.slots?.[0]?.skipperId).club} — Veld {h.slots?.[0]?.veld}</p>
                          </div>
                        </div>
                        {h.reeks < settings.currentFreestyleHeat && <CheckCircle2 className="text-green-500" size={24} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'control' && (
            <div className="max-w-6xl mx-auto animate-in zoom-in-95 duration-500">
              <div className="flex gap-4 mb-8 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('speed')}
                  className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[1.6rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'speed' ? 'bg-orange-500 text-white shadow-xl shadow-orange-100' : 'text-slate-400'}`}
                >
                  <Zap size={20} /> Speed Control
                </button>
                <button 
                  onClick={() => setActiveTab('freestyle')}
                  className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[1.6rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'freestyle' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}
                >
                  <Star size={20} /> Freestyle Control
                </button>
              </div>

              <div className="grid grid-cols-12 gap-8">
                {/* Left: Active Heat Management */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-[3rem] p-12 border border-slate-200 shadow-sm">
                  <div className="text-center mb-12">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-4 block">Huidige Reeks</span>
                    <div className="flex items-center justify-center gap-12">
                      <button onClick={() => updateHeatIndex(-1)} className="p-8 bg-slate-50 rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900 shadow-inner">
                        <ChevronLeft size={48} strokeWidth={3} />
                      </button>
                      <div className="text-[14rem] font-black text-slate-900 leading-none tabular-nums tracking-tighter drop-shadow-sm">
                        {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                      </div>
                      <button onClick={() => updateHeatIndex(1)} className="p-8 bg-slate-50 rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-900 shadow-inner">
                        <ChevronRight size={48} strokeWidth={3} />
                      </button>
                    </div>
                    <div className="mt-8 flex justify-center">
                      <div className={`px-10 py-3 rounded-full font-black text-sm uppercase tracking-widest border-2 ${activeTab === 'speed' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {currentHeat?.onderdeel || "Geen reeks gevonden"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
                    {currentHeat?.slots?.map((slot, i) => {
                      const s = getSkipperInfo(slot.skipperId);
                      return (
                        <div key={i} className="bg-slate-50 border border-slate-100 p-6 rounded-3xl text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">Veld {slot.veld}</span>
                          <p className="font-black text-slate-800 uppercase text-sm mb-1 leading-tight">{s.naam}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{s.club}</p>
                        </div>
                      );
                    })}
                  </div>

                  <button 
                    onClick={finishHeat}
                    className={`w-full py-8 rounded-[2rem] font-black text-2xl uppercase italic tracking-widest transition-all flex items-center justify-center gap-4 text-white shadow-2xl ${activeTab === 'speed' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                  >
                    <CheckCircle2 size={32} /> Volgende Reeks
                  </button>
                </div>

                {/* Right: Side Tools */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                  <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="font-black uppercase text-sm tracking-widest mb-6 flex items-center gap-3">
                      <Megaphone size={18} className="text-indigo-600" /> Mededeling
                    </h3>
                    <textarea 
                      value={settings.announcement}
                      onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { announcement: e.target.value })}
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                      placeholder="Typ bericht voor groot scherm..."
                    />
                  </div>

                  <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-xl">
                    <h3 className="font-black uppercase text-sm tracking-widest mb-6 flex items-center gap-3">
                      <Settings size={18} className="text-indigo-400" /> Systeem Info
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between py-3 border-b border-white/10">
                        <span className="text-slate-400 font-bold text-xs uppercase">Totaal Springers</span>
                        <span className="font-black text-indigo-400">{Object.keys(skippers).length}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-white/10">
                        <span className="text-slate-400 font-bold text-xs uppercase">Totaal Heats</span>
                        <span className="font-black text-indigo-400">{heats.length}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-slate-400 font-bold text-xs uppercase">Firebase ID</span>
                        <span className="font-mono text-[10px] text-slate-500">{appId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Import Modal - Professional Fullscreen Overlay */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-12 py-8 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><UploadCloud size={24} /></div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic">Data Management</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kopieer & Plak vanuit Google Sheets of Excel</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">Sluiten</button>
            </div>

            <div className="flex-1 p-12 overflow-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">1. Selecteer Type</label>
                   <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                     <button 
                       onClick={() => setImportType('speed')}
                       className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${importType === 'speed' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}
                     >Speed (10 Velden)</button>
                     <button 
                       onClick={() => setImportType('freestyle')}
                       className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${importType === 'freestyle' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                     >Freestyle (Veld A/B)</button>
                   </div>
                 </div>

                 <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                   <h4 className="flex items-center gap-2 font-black text-xs text-indigo-900 uppercase tracking-wider mb-4">
                     <AlertCircle size={16} /> Instructies
                   </h4>
                   <ul className="space-y-3 text-[11px] text-indigo-700 font-medium leading-relaxed">
                     <li className="flex gap-2"><span>•</span> Kopieer de volledige rijen uit je CSV of Excel bestand.</li>
                     <li className="flex gap-2"><span>•</span> Zorg dat de kolomnamen niet meegekopieerd worden (start bij rij 1).</li>
                     <li className="flex gap-2"><span>•</span> Klik op 'Verwerk' om de reeksen live te zetten in de cloud.</li>
                   </ul>
                 </div>
              </div>

              <div className="lg:col-span-8 flex flex-col h-full">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-2">2. Plak Data</label>
                <textarea 
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Plak hier je data..."
                  className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-8 font-mono text-xs focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="px-12 py-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {message ? (
                <div className={`px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {message.text}
                </div>
              ) : <div></div>}
              
              <button 
                disabled={isProcessing || !csvInput}
                onClick={handleImport}
                className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-3"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Database size={18} />}
                Start Import Process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Large Screen Display (Fullscreen Overlay) */}
      {view === 'display' && (
        <div className="fixed inset-0 bg-slate-950 text-white z-[200] p-16 flex flex-col overflow-hidden animate-in fade-in duration-700">
           {/* Display Header */}
           <div className="flex justify-between items-end mb-24">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.8)]"></div>
                  <span className="text-sm font-black uppercase tracking-[0.6em] text-slate-500">Live Competition Feed</span>
                </div>
                <h1 className="text-[10rem] font-black italic uppercase leading-[0.75] tracking-tighter">
                  {activeTab === 'speed' ? <span className="text-orange-500">Speed</span> : <span className="text-indigo-500">Freestyle</span>}<br/>
                  <span className="text-white">Arena</span>
                </h1>
              </div>
              
              <div className="flex gap-8">
                <div className="bg-white/5 backdrop-blur-3xl p-16 rounded-[4rem] border border-white/10 text-center min-w-[320px] shadow-2xl">
                   <span className="text-sm font-black text-slate-500 uppercase tracking-[0.5em] block mb-4">Reeks</span>
                   <div className="text-[14rem] font-black leading-none tabular-nums italic tracking-tighter">
                     {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                   </div>
                </div>
              </div>
           </div>

           {/* Large Grid for PC Display */}
           <div className="flex-1 grid grid-cols-5 grid-rows-2 gap-8">
              {currentHeat?.slots?.map((slot, i) => {
                const s = getSkipperInfo(slot.skipperId);
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-[3.5rem] p-10 flex flex-col justify-between hover:bg-white/10 transition-all group relative overflow-hidden">
                    {/* Background number glow */}
                    <div className="absolute -right-4 -bottom-8 text-[12rem] font-black text-white/5 italic select-none group-hover:text-white/10 transition-all leading-none">{slot.veld}</div>
                    
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Veld</span>
                      <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-4xl font-black shadow-2xl ${activeTab === 'speed' ? 'bg-orange-500' : 'bg-indigo-600'}`}>{slot.veld}</div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-5xl font-black uppercase tracking-tight italic mb-3 leading-tight group-hover:scale-105 transition-transform origin-left">{s.naam}</h3>
                      <p className="text-lg font-bold text-slate-400 uppercase tracking-[0.2em]">{s.club}</p>
                    </div>
                  </div>
                );
              })}
              {/* Fill empty spots if less than 10 to keep grid stable */}
              {currentHeat?.slots?.length < 10 && activeTab === 'speed' && Array.from({length: 10 - currentHeat.slots.length}).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white/[0.02] border border-white/5 rounded-[3.5rem] p-10 flex flex-col items-center justify-center text-slate-800 italic font-black text-3xl">
                  Leeg
                </div>
              ))}
           </div>

           {/* Announcement Bar */}
           <div className="mt-20 flex items-center gap-12 bg-white/5 p-10 rounded-[3.5rem] border border-white/10">
              <Megaphone size={48} className="text-indigo-500 animate-bounce shrink-0" />
              <div className="overflow-hidden">
                <p className="text-4xl font-black italic uppercase tracking-tight whitespace-nowrap animate-marquee">
                  {settings.announcement} • {settings.announcement}
                </p>
              </div>
              <button onClick={() => setView('control')} className="ml-auto text-xs font-black text-slate-600 uppercase tracking-widest hover:text-white">Exit View</button>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; overflow: hidden; }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
};

export default App;
