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
  Download,
  Info,
  AlertTriangle
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-v4-pro';

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
        await signInAnonymously(auth);
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
    let content = "";
    if (type === 'speed') {
      content = "reeks,onderdeel,uur,club1,skipper1,club2,skipper2,club3,skipper3,club4,skipper4,club5,skipper5,club6,skipper6,club7,skipper7,club8,skipper8,club9,skipper9,club10,skipper10\n1,Speed 30s,14:00,Club A,Naam 1,Club B,Naam 2,Club C,Naam 3,,,,,,,,,,,,,,,";
    } else {
      content = "reeks,uur,veld,club,skipper\n1,15:00,Veld A,Club X,Naam Springer\n2,15:02,Veld B,Club Y,Naam Springer";
    }
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.csv`;
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
            if (naam && naam !== "") {
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
      setStatusMsg({ type: 'success', text: `${count} reeksen toegevoegd.` });
      setCsvInput('');
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Fout bij verwerken.' });
    } finally { setIsProcessing(false); }
  };

  const clearData = async () => {
    if (!confirm("Alle data wissen?")) return;
    const q1 = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'skippers'));
    const q2 = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'heats'));
    const batch = writeBatch(db);
    q1.forEach(d => batch.delete(d.ref));
    q2.forEach(d => batch.delete(d.ref));
    batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), {
      currentSpeedHeat: 1, currentFreestyleHeat: 1, announcement: "Database gereset."
    });
    await batch.commit();
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      
      {/* Header met Navigatie */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Trophy size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight">RopeScore<span className="text-blue-600">Pro</span></h1>
          </div>
          
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'live', label: 'Wedstrijd Jury', icon: Activity },
              { id: 'management', label: 'Beheer & Import', icon: Database },
              { id: 'display', label: 'Groot Scherm', icon: Monitor },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  view === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
            <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Verbonden
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full">
        
        {view === 'live' && (
          <div className="grid grid-cols-12 gap-8 animate-in fade-in duration-300">
            {/* Discipline Selector */}
            <div className="col-span-12 flex justify-center mb-4">
              <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
                <button 
                  onClick={() => setActiveTab('speed')}
                  className={`px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'speed' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  <Zap size={16} /> Speed
                </button>
                <button 
                  onClick={() => setActiveTab('freestyle')}
                  className={`px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'freestyle' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                  <Star size={16} /> Freestyle
                </button>
              </div>
            </div>

            {/* Hoofdscherm Bediening */}
            <div className="col-span-12 lg:col-span-9 space-y-8">
              <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-10">
                   <div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Huidige Reeks</span>
                     <h2 className="text-3xl font-black text-slate-800 uppercase italic">
                       {currentHeat?.onderdeel || "Einde programma"}
                     </h2>
                   </div>
                   <div className="text-right">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Totaal Geladen</span>
                     <p className="font-bold text-slate-800">{heats.filter(h => h.type === activeTab).length} Reeksen</p>
                   </div>
                </div>

                <div className="flex items-center justify-center gap-10 mb-16">
                  <button onClick={() => updateHeat(-1)} className="p-6 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 transition-all border border-slate-200">
                    <ChevronLeft size={40} />
                  </button>
                  <div className="text-[12rem] font-black text-slate-900 leading-none tabular-nums tracking-tighter">
                    {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                  </div>
                  <button onClick={() => updateHeat(1)} className="p-6 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 transition-all border border-slate-200">
                    <ChevronRight size={40} />
                  </button>
                </div>

                {/* Velden Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {currentHeat?.slots?.map((slot, i) => {
                    const s = getSkipper(slot.skipperId);
                    return (
                      <div key={i} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl hover:border-blue-300 transition-all group">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-black text-slate-400 uppercase">Veld {slot.veld}</span>
                           <div className={`w-2 h-2 rounded-full ${activeTab === 'speed' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                        </div>
                        <p className="font-black text-slate-900 uppercase text-sm leading-tight truncate">{s.naam}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate mt-1">{s.club}</p>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => updateHeat(1)}
                  className={`w-full mt-10 py-8 rounded-2xl font-black text-xl uppercase italic tracking-widest transition-all flex items-center justify-center gap-4 text-white shadow-xl ${activeTab === 'speed' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'}`}
                >
                  <CheckCircle2 size={24} /> Volgende Reeks
                </button>
              </div>
            </div>

            {/* Zijbalk: Berichten */}
            <div className="col-span-12 lg:col-span-3">
               <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm sticky top-24">
                  <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Megaphone size={14} /> Mededeling op scherm
                  </h3>
                  <textarea 
                    value={settings.announcement}
                    onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { announcement: e.target.value })}
                    className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Typ hier een bericht voor de springers..."
                  />
                  <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-tight">
                      Tip: Je kunt dit bericht tijdens de wedstrijd live aanpassen.
                    </p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {view === 'management' && (
          <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-10 py-8 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tight">Beheer & Import</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Database configuratie</p>
                </div>
                <button onClick={clearData} className="px-6 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-xs uppercase hover:bg-red-600 hover:text-white transition-all">
                  Database Wissen
                </button>
              </div>

              <div className="p-10 grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-4 space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Selecteer Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setImportType('speed')}
                        className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase transition-all ${importType === 'speed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                      >Speed</button>
                      <button 
                        onClick={() => setImportType('freestyle')}
                        className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase transition-all ${importType === 'freestyle' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
                      >Freestyle</button>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-2">
                      <Download size={14} /> Voorbeeldbestanden
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Gebruik deze sjablonen om je data correct te formatteren voordat je gaat plakken.
                    </p>
                    <button 
                      onClick={() => downloadTemplate(importType)}
                      className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                      Download {importType} CSV
                    </button>
                  </div>
                </div>

                <div className="md:col-span-8 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Plak hier je CSV data</label>
                  <textarea 
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    className="w-full h-80 bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                    placeholder="reeks,onderdeel,uur,club1,skipper1..."
                  />
                  
                  {statusMsg && (
                    <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-3 ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                      {statusMsg.type === 'info' ? <Loader2 size={16} className="animate-spin" /> : <Info size={16} />}
                      {statusMsg.text}
                    </div>
                  )}

                  <button 
                    disabled={isProcessing || !csvInput}
                    onClick={handleImport}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase italic tracking-widest hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 transition-all"
                  >
                    Start Import naar Cloud
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-white z-[100] p-12 flex flex-col animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-16">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 font-sans">Live Wedstrijd</span>
                  </div>
                  <h1 className="text-9xl font-black uppercase italic tracking-tighter text-slate-900 leading-[0.8]">
                    {activeTab === 'speed' ? <span className="text-blue-600">Speed</span> : <span className="text-purple-600">Freestyle</span>}<br/>
                    Arena
                  </h1>
                </div>

                <div className="bg-slate-50 p-12 rounded-[3rem] border border-slate-200 text-center min-w-[300px]">
                   <span className="text-sm font-black text-slate-400 uppercase tracking-[0.4em] block mb-4">Reeks</span>
                   <div className="text-[12rem] font-black leading-none tabular-nums text-slate-900 italic">
                     {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                   </div>
                </div>
             </div>

             <div className="flex-1 grid grid-cols-5 grid-rows-2 gap-6">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipper(slot.skipperId);
                  return (
                    <div key={i} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                       <div className="flex justify-between items-start relative z-10">
                         <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Veld</span>
                         <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white ${activeTab === 'speed' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                           {slot.veld}
                         </div>
                       </div>
                       <div className="relative z-10">
                         <h3 className="text-4xl font-black uppercase italic tracking-tight mb-2 text-slate-900">{s.naam}</h3>
                         <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{s.club}</p>
                       </div>
                       <div className="absolute -right-4 -bottom-4 text-9xl font-black text-slate-50 italic opacity-[0.03] select-none">
                         {slot.veld}
                       </div>
                    </div>
                  );
                })}
                {!currentHeat && (
                  <div className="col-span-full flex items-center justify-center text-4xl font-black text-slate-200 uppercase italic">
                    Geen actieve reeks
                  </div>
                )}
             </div>

             <div className="mt-12 flex items-center gap-10 bg-slate-900 p-8 rounded-[2.5rem] overflow-hidden">
                <Megaphone size={40} className="text-blue-400 shrink-0" />
                <div className="overflow-hidden flex-1">
                  <p className="text-3xl font-black italic uppercase tracking-tight text-white whitespace-nowrap animate-marquee">
                    {settings.announcement} • {settings.announcement}
                  </p>
                </div>
                <button onClick={() => setView('live')} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-white">Sluiten</button>
             </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
      `}} />
    </div>
  );
};

export default App;
