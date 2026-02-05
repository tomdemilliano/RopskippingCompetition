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
  Settings,
  Monitor,
  DatabaseZap,
  Clock,
  Info
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropeskipping-v3-desktop';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('live'); // live, management, display
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
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInAnonymously(auth);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skippersRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const heatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');

    const unsub1 = onSnapshot(settingsRef, (d) => d.exists() && setSettings(d.data()), (e) => console.error(e));
    const unsub2 = onSnapshot(skippersRef, (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    }, (e) => console.error(e));
    const unsub3 = onSnapshot(heatsRef, (s) => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    }, (e) => console.error(e));

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const handleImport = async () => {
    if (!csvInput.trim()) return;
    setIsProcessing(true);
    setStatusMsg({ type: 'loading', text: 'Data wordt geüpload...' });
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
            type: 'speed', reeks: parseInt(row[0]), onderdeel: row[1] || 'Speed', status: 'pending', slots
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
            type: 'freestyle', reeks: parseInt(row[0]), onderdeel: 'Freestyle', status: 'pending', slots: [{ veld: row[2], skipperId: sid }]
          });
          count++;
        });
      }
      await batch.commit();
      setStatusMsg({ type: 'success', text: `${count} reeksen succesvol geladen!` });
      setCsvInput('');
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Fout bij importeren.' });
    } finally { setIsProcessing(false); }
  };

  const clearData = async () => {
    if (!confirm("Weet je zeker dat je alle data wilt wissen?")) return;
    const q1 = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'skippers'));
    const q2 = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'heats'));
    const batch = writeBatch(db);
    q1.forEach(d => batch.delete(d.ref));
    q2.forEach(d => batch.delete(d.ref));
    batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
      currentSpeedHeat: 1, currentFreestyleHeat: 1, announcement: "Database gereset."
    });
    await batch.commit();
    alert("Database gewist.");
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

  const getSkipper = (id) => skippers[id] || { naam: "---", club: "---" };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      
      {/* Sidebar-stijl Header */}
      <header className="bg-[#1E293B]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <Trophy size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter italic uppercase">RopeScore<span className="text-indigo-500">Pro</span></h1>
          </div>
          
          <nav className="flex gap-2">
            {[
              { id: 'live', label: 'Live Jury', icon: Activity },
              { id: 'management', label: 'Data & Import', icon: DatabaseZap },
              { id: 'display', label: 'Display Mode', icon: Monitor },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  view === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden xl:block">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verbonden met Cloud</p>
            <p className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Operationeel
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
        
        {view === 'live' && (
          <div className="animate-in fade-in duration-500 space-y-8">
            {/* Discipline Selector */}
            <div className="flex gap-4 bg-[#1E293B] p-2 rounded-[2rem] border border-white/5 max-w-2xl mx-auto shadow-2xl">
              <button 
                onClick={() => setActiveTab('speed')}
                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[1.6rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'speed' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500 hover:text-white'}`}
              >
                <Zap size={20} /> Speed Control
              </button>
              <button 
                onClick={() => setActiveTab('freestyle')}
                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[1.6rem] font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'freestyle' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
              >
                <Star size={20} /> Freestyle Control
              </button>
            </div>

            <div className="grid grid-cols-12 gap-8">
              {/* Hoofd Bediening */}
              <div className="col-span-12 lg:col-span-9 bg-[#1E293B] rounded-[3rem] p-12 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                  {activeTab === 'speed' ? <Zap size={300} /> : <Star size={300} />}
                </div>

                <div className="relative z-10 text-center mb-16">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-[0.5em] mb-6 block">Huidige Reeks</span>
                  <div className="flex items-center justify-center gap-12">
                    <button onClick={() => updateHeat(-1)} className="p-8 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all shadow-inner">
                      <ChevronLeft size={48} strokeWidth={3} />
                    </button>
                    <div className="text-[18rem] font-black leading-none tabular-nums tracking-tighter italic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                      {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                    </div>
                    <button onClick={() => updateHeat(1)} className="p-8 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all shadow-inner">
                      <ChevronRight size={48} strokeWidth={3} />
                    </button>
                  </div>
                  <div className="mt-10 inline-block px-12 py-4 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                     <p className="font-black text-xl uppercase italic tracking-widest text-indigo-400">
                       {currentHeat?.onderdeel || "Einde van Programma"}
                     </p>
                  </div>
                </div>

                {/* Grid van velden - Horizontaal Desktop Layout */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16 relative z-10">
                  {currentHeat?.slots?.map((slot, i) => {
                    const s = getSkipper(slot.skipperId);
                    return (
                      <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-all group">
                        <div className="flex justify-between items-start mb-6">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Veld</span>
                           <span className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-lg">{slot.veld}</span>
                        </div>
                        <h4 className="font-black text-lg uppercase italic tracking-tight mb-1 group-hover:text-indigo-400 transition-colors truncate">{s.naam}</h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{s.club}</p>
                      </div>
                    );
                  })}
                  {(!currentHeat || currentHeat.slots.length === 0) && (
                    <div className="col-span-full py-12 text-center text-slate-500 font-black uppercase tracking-widest italic opacity-50">
                      Geen springers voor deze reeks
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => updateHeat(1)}
                  className={`w-full py-10 rounded-[2.5rem] font-black text-3xl uppercase italic tracking-[0.2em] transition-all flex items-center justify-center gap-6 shadow-2xl ${activeTab === 'speed' ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'}`}
                >
                  <CheckCircle2 size={40} /> Volgende Reeks
                </button>
              </div>

              {/* Zijbalk: Overzicht en Mededeling */}
              <div className="col-span-12 lg:col-span-3 space-y-8">
                <div className="bg-[#1E293B] rounded-[2.5rem] p-8 border border-white/5 shadow-xl">
                  <h3 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-3 text-indigo-400">
                    <Megaphone size={18} /> Berichten
                  </h3>
                  <textarea 
                    value={settings.announcement}
                    onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { announcement: e.target.value })}
                    className="w-full h-32 bg-black/20 border border-white/5 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-700"
                    placeholder="Dit verschijnt op het grote scherm..."
                  />
                </div>

                <div className="bg-slate-900/50 rounded-[2.5rem] p-8 border border-white/5 shadow-xl">
                  <h3 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-3 text-slate-500">
                    <Clock size={18} /> Programma Verloop
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {heats.filter(h => h.type === activeTab).slice(settings[activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat'] - 1, settings[activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat'] + 5).map((h, idx) => (
                      <div key={idx} className={`p-5 rounded-2xl border transition-all ${idx === 0 ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-white/5 border-transparent opacity-40'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-black text-sm italic uppercase">Reeks {h.reeks}</span>
                          <span className="text-[10px] font-bold uppercase text-slate-500">{h.onderdeel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div className="max-w-6xl mx-auto animate-in zoom-in-95 duration-500">
            <div className="bg-[#1E293B] rounded-[3rem] p-12 border border-white/5 shadow-2xl">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Data Management</h2>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Importeer reeksen en beheer de database</p>
                </div>
                <button 
                  onClick={clearData}
                  className="px-8 py-4 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-3"
                >
                  <Trash2 size={16} /> Volledige Reset
                </button>
              </div>

              <div className="grid grid-cols-12 gap-12">
                <div className="col-span-12 lg:col-span-4 space-y-8">
                  <div className="bg-black/20 p-8 rounded-3xl border border-white/5 space-y-6">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kies Onderdeel</label>
                    <div className="flex bg-white/5 p-1.5 rounded-2xl">
                      <button 
                        onClick={() => setImportType('speed')}
                        className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${importType === 'speed' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                      >Speed</button>
                      <button 
                        onClick={() => setImportType('freestyle')}
                        className={`flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${importType === 'freestyle' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                      >Freestyle</button>
                    </div>
                  </div>

                  <div className="bg-indigo-600/10 p-8 rounded-3xl border border-indigo-500/20">
                     <h4 className="font-black text-xs text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Info size={16} /> Help bij Import
                     </h4>
                     <p className="text-xs leading-relaxed text-indigo-200/70 font-medium">
                       Kopieer de rijen uit je Excel of Google Sheet. <br/><br/>
                       Voor <strong>Speed</strong> verwachten we de kolom-structuur: <br/>
                       <span className="text-white">Reeks, Type, Tijd, Club1, Naam1, Club2, Naam2...</span><br/><br/>
                       Voor <strong>Freestyle</strong>:<br/>
                       <span className="text-white">Reeks, Uur, Veld, Club, Naam</span>
                     </p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8 space-y-6">
                  <textarea 
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder="Plak hier je CSV data..."
                    className="w-full h-80 bg-black/40 border border-white/5 rounded-[2rem] p-8 font-mono text-xs focus:ring-4 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-inner placeholder:text-slate-800"
                  />
                  
                  {statusMsg && (
                    <div className={`p-6 rounded-2xl font-black text-sm uppercase tracking-widest text-center animate-pulse ${
                      statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'
                    }`}>
                      {statusMsg.text}
                    </div>
                  )}

                  <button 
                    disabled={isProcessing || !csvInput}
                    onClick={handleImport}
                    className="w-full py-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-[2rem] font-black text-xl uppercase italic tracking-widest shadow-2xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-4"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
                    Verwerk & Upload naar Cloud
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-slate-950 text-white z-[100] p-16 flex flex-col overflow-hidden animate-in fade-in duration-1000">
             <div className="flex justify-between items-end mb-24">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse shadow-[0_0_30px_rgba(220,38,38,1)]"></div>
                    <span className="text-sm font-black uppercase tracking-[0.8em] text-slate-500">Live Competition Feed</span>
                  </div>
                  <h1 className="text-[12rem] font-black italic uppercase leading-[0.75] tracking-tighter drop-shadow-2xl">
                    {activeTab === 'speed' ? <span className="text-orange-500">Speed</span> : <span className="text-indigo-500">Freestyle</span>}<br/>
                    <span className="text-white">Arena</span>
                  </h1>
                </div>

                <div className="bg-white/5 backdrop-blur-3xl p-20 rounded-[5rem] border border-white/10 text-center min-w-[400px] shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                   <span className="text-lg font-black text-slate-500 uppercase tracking-[0.5em] block mb-6">Reeks</span>
                   <div className="text-[18rem] font-black leading-none tabular-nums italic tracking-tighter text-white">
                     {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                   </div>
                </div>
             </div>

             <div className="flex-1 grid grid-cols-5 grid-rows-2 gap-10">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipper(slot.skipperId);
                  return (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-[4rem] p-12 flex flex-col justify-between hover:bg-white/10 transition-all relative group overflow-hidden">
                       <div className="absolute -right-8 -bottom-12 text-[15rem] font-black text-white/[0.03] italic leading-none group-hover:text-white/[0.07] transition-all">
                         {slot.veld}
                       </div>
                       <div className="flex justify-between items-start relative z-10">
                         <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Veld</span>
                         <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-5xl font-black shadow-2xl ${activeTab === 'speed' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                           {slot.veld}
                         </div>
                       </div>
                       <div className="relative z-10">
                         <h3 className="text-6xl font-black uppercase tracking-tight italic mb-4 leading-tight text-white">{s.naam}</h3>
                         <p className="text-xl font-bold text-slate-400 uppercase tracking-[0.3em]">{s.club}</p>
                       </div>
                    </div>
                  );
                })}
                {(!currentHeat || currentHeat.slots.length === 0) && Array.from({length: 10}).map((_, i) => (
                  <div key={i} className="bg-white/[0.01] border border-white/5 rounded-[4rem] flex items-center justify-center italic text-slate-800 font-black text-4xl uppercase tracking-widest">
                    Pauze
                  </div>
                ))}
             </div>

             <div className="mt-20 flex items-center gap-12 bg-indigo-600/10 p-12 rounded-[4rem] border border-indigo-500/20">
                <Megaphone size={64} className="text-indigo-500 animate-bounce shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-5xl font-black italic uppercase tracking-tight whitespace-nowrap animate-marquee text-white">
                    {settings.announcement} • {settings.announcement}
                  </p>
                </div>
                <button onClick={() => setView('live')} className="ml-auto text-[10px] font-black text-slate-700 uppercase tracking-widest hover:text-white transition-all">Exit View</button>
             </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #0F172A; }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 40s linear infinite;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.5);
        }
      `}} />
    </div>
  );
};

export default App;
