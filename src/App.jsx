import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, addDoc, query 
} from 'firebase/firestore';
import { 
    getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
    Layout, Users, Play, Monitor, Plus, Calendar, MapPin, ChevronLeft, ChevronRight, 
    Upload, Trash2, Edit3, X, Search, Trophy, Settings, ArrowLeft, UserMinus, 
    SkipForward, SkipBack, RefreshCw, Volume2, CheckCircle2, Circle, Save, MoreVertical,
    Activity, Clock, Layers
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATIE & INITIALISATIE
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBdlKc-a_4Xt9MY_2Tjcf" + "KXT7bqJsDr8yY", 
    authDomain: "ropeskippingcontest.firebaseapp.com",
    projectId: "ropeskippingcontest",
    storageBucket: "ropeskippingcontest.firebasestorage.app",
    messagingSenderId: "430066523717",
    appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-ultimate';

// ==========================================
// 2. STYLES & UI UTILS
// ==========================================

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
};

// ==========================================
// 3. HOOFD COMPONENT
// ==========================================

export default function App() {
    const [view, setView] = useState('management'); 
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('freestyle');
    
    const [user, setUser] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [activeCompId, setActiveCompId] = useState(null);
    const [skippers, setSkippers] = useState({});
    const [heats, setHeats] = useState([]);
    const [compSettings, setCompSettings] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);

    // --- AUTH & DATA SYNC ---
    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'));
        return onSnapshot(q, (s) => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [user]);

    useEffect(() => {
        if (!activeCompId || !user) return;
        const base = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
        const unsubS = onSnapshot(base, d => d.exists() && setCompSettings(d.data()));
        const unsubSk = onSnapshot(collection(base, 'skippers'), s => {
            const d = {}; s.forEach(doc => d[doc.id] = doc.data());
            setSkippers(d);
        });
        const unsubH = onSnapshot(collection(base, 'heats'), s => setHeats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubS(); unsubSk(); unsubH(); };
    }, [activeCompId, user]);

    // --- DERIVED DATA ---
    const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed').sort((a,b) => a.reeks - b.reeks), [heats]);
    const freestyleHeats = useMemo(() => heats.filter(h => h.type === 'freestyle').sort((a,b) => a.reeks - b.reeks), [heats]);
    const currentHeatData = useMemo(() => {
        const heatList = activeTab === 'speed' ? speedHeats : freestyleHeats;
        const currentNr = activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1);
        return heatList.find(h => h.reeks === currentNr);
    }, [speedHeats, freestyleHeats, activeTab, compSettings]);

    // --- ACTIONS ---
    const handleCreateCompetition = async (formData) => {
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
            ...formData,
            currentSpeedHeat: 1,
            currentFreestyleHeat: 1,
            createdAt: new Date().toISOString()
        });
        setActiveCompId(docRef.id);
        setShowCreateModal(false);
    };

    const updateCurrentHeat = async (type, delta) => {
        const field = type === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
        const newVal = Math.max(1, (compSettings[field] || 1) + delta);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { [field]: newVal });
    };

    // ==========================================
    // 4. MODULAIRE RENDERERS
    // ==========================================

    const ManagementView = () => (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!activeCompId ? (
          <div className="max-w-5xl mx-auto py-16 px-4">
            <div className="mb-12">
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-4">Mijn Wedstrijden</h1>
              <p className="text-lg text-slate-500 font-medium">Beheer al je evenementen vanuit één centraal dashboard.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="group relative h-48 rounded-3xl border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-4 overflow-hidden"
              >
                <div className="p-4 bg-indigo-600 rounded-2xl text-white group-hover:scale-110 transition-transform shadow-lg shadow-indigo-200">
                  <Plus size={24} strokeWidth={3} />
                </div>
                <span className="font-bold text-slate-600 group-hover:text-indigo-600">Nieuw Event</span>
              </button>

              {competitions.map(c => (
                <div key={c.id} 
                  onClick={() => setActiveCompId(c.id)}
                  className="group relative h-48 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Trophy size={80} className="text-indigo-600" />
                  </div>
                  <div className="relative h-full flex flex-col justify-between">
                    <div>
                      <div className="inline-flex px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider mb-3">
                        {c.date}
                      </div>
                      <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                      <div className="flex items-center gap-1.5 text-slate-400 text-sm font-medium">
                        <MapPin size={14} /> {c.location}
                      </div>
                    </div>
                    <div className="flex items-center text-indigo-500 font-bold text-sm">
                      Beheren <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveCompId(null)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                    {competitions.find(c => c.id === activeCompId)?.name}
                  </h1>
                  <p className="text-slate-400 font-medium">Event Management Dashboard</p>
                </div>
              </div>
              
              <div className="flex p-1 bg-slate-200/50 rounded-2xl backdrop-blur-sm">
                {[
                  { id: 'overview', label: 'Overzicht', icon: Layout },
                  { id: 'skippers', label: 'Skippers', icon: Users },
                  { id: 'heats', label: 'Reeksen', icon: Layers }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setMgmtTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${mgmtTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    <tab.icon size={16} /> {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content per tab */}
            {mgmtTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                  <Activity className="absolute bottom-[-20px] right-[-20px] w-48 h-48 opacity-10" />
                  <h2 className="text-lg font-bold opacity-80 mb-8 uppercase tracking-widest">Status</h2>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-5xl font-black mb-2">Live</div>
                      <p className="font-medium opacity-70 italic">Wedstrijd is momenteel aan de gang</p>
                    </div>
                    <button onClick={() => setView('live')} className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-lg hover:scale-105 transition-transform">
                      NAAR LIVE MODUS
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                    <Users size={24} />
                  </div>
                  <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Deelnemers</div>
                  <div className="text-4xl font-black text-slate-800">{Object.keys(skippers).length}</div>
                </div>
                <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                    <Clock size={24} />
                  </div>
                  <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">Reeksen</div>
                  <div className="text-4xl font-black text-slate-800">{heats.length}</div>
                </div>
              </div>
            )}

            {mgmtTab === 'skippers' && (
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="Zoek op naam of club..." />
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold cursor-pointer hover:bg-slate-200 transition-all">
                      <Upload size={18} /> Import
                      <input type="file" hidden accept=".csv" onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const text = await file.text();
                          const lines = text.split('\n').filter(l => l.trim());
                          const batch = writeBatch(db);
                          lines.slice(1).forEach(line => {
                              const [naam, club, categorie] = line.split(',').map(s => s.trim());
                              if (naam) {
                                  const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers'));
                                  batch.set(ref, { naam, club, categorie });
                              }
                          });
                          await batch.commit();
                      }} />
                    </label>
                    <button 
                      onClick={async () => {
                        const list = Object.entries(skippers).map(([id, d]) => ({id, ...d}));
                        const batch = writeBatch(db);
                        for(let i=0; i<list.length; i+=5) {
                            const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats'));
                            batch.set(ref, {
                                reeks: Math.floor(i/5)+1,
                                type: 'freestyle',
                                onderdeel: 'Individual Freestyle',
                                status: 'wachtend',
                                slots: list.slice(i, i+5).map((s, idx) => ({ veld: idx+1, skipperId: s.id }))
                            });
                        }
                        await batch.commit();
                        setMgmtTab('heats');
                      }}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                      <RefreshCw size={18} /> Genereer Reeksen
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Naam</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Club</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categorie</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Object.entries(skippers).map(([id, s]) => (
                        <tr key={id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 font-bold text-slate-800">{s.naam}</td>
                          <td className="px-8 py-5 text-slate-500 font-medium">{s.club}</td>
                          <td className="px-8 py-5">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-black uppercase">
                              {s.categorie}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Object.keys(skippers).length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <Users size={40} />
                      </div>
                      <p className="text-slate-400 font-medium">Nog geen skippers toegevoegd.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );

    const LiveView = () => (
      <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <div className="flex gap-1 p-1.5 bg-slate-200/60 rounded-[24px] backdrop-blur-md">
            <button 
              onClick={() => setActiveTab('speed')} 
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm transition-all ${activeTab === 'speed' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}
            >
              <Activity size={18} /> SPEED
            </button>
            <button 
              onClick={() => setActiveTab('freestyle')} 
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-sm transition-all ${activeTab === 'freestyle' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}
            >
              <Trophy size={18} /> FREESTYLE
            </button>
          </div>

          <div className="flex items-center gap-8 bg-white px-8 py-4 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
               <div className="text-right">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Huidige Reeks</div>
                 <div className="text-3xl font-black text-slate-900 leading-none">
                    {currentHeatData?.reeks || '0'} 
                    <span className="text-slate-200 font-medium mx-1">/</span>
                    <span className="text-slate-300 font-medium">{activeTab === 'speed' ? speedHeats.length : freestyleHeats.length}</span>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button onClick={() => updateCurrentHeat(activeTab, -1)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><SkipBack size={20}/></button>
                 <button onClick={() => updateCurrentHeat(activeTab, 1)} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><SkipForward size={20}/></button>
               </div>
            </div>
            <div className="h-10 w-px bg-slate-100"></div>
            <button onClick={() => setView('display')} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-indigo-600 transition-all shadow-lg shadow-slate-100">
               <Monitor size={16} /> DISPLAY MODUS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-4">
             <div className="bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm min-h-[600px] flex flex-col">
                <div className="flex justify-between items-start mb-12">
                   <div>
                      <div className="inline-flex px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-4">
                         {activeTab.toUpperCase()} ROUND
                      </div>
                      <h2 className="text-5xl font-black text-slate-900 tracking-tight">{currentHeatData?.onderdeel || 'Selecteer een reeks'}</h2>
                   </div>
                   {currentHeatData?.status === 'voltooid' && (
                     <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs">
                        <CheckCircle2 size={16} /> VOLTOOID
                     </div>
                   )}
                </div>

                <div className="space-y-4 flex-1">
                   {[1, 2, 3, 4, 5].map(v => {
                      const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                      const sk = skippers[slot?.skipperId];
                      return (
                        <div key={v} className={`group relative flex items-center p-8 rounded-[32px] border-2 transition-all duration-300 ${sk ? 'bg-slate-50/50 border-slate-100 hover:border-indigo-200' : 'bg-transparent border-dashed border-slate-100 opacity-40'}`}>
                           <div className="w-24 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] transform -rotate-90 origin-center">Veld {v}</div>
                           {sk ? (
                             <div className="flex-1 flex justify-between items-center ml-4">
                                <div>
                                   <div className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">{sk.naam}</div>
                                   <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{sk.club}</div>
                                </div>
                                <div className="flex gap-2">
                                  <button className="p-4 bg-white rounded-2xl text-slate-400 hover:text-indigo-500 transition-all shadow-sm border border-slate-100">
                                    <Volume2 size={20} />
                                  </button>
                                  <button className="p-4 bg-white rounded-2xl text-slate-400 hover:text-emerald-500 transition-all shadow-sm border border-slate-100">
                                    <CheckCircle2 size={20} />
                                  </button>
                                </div>
                             </div>
                           ) : (
                             <div className="flex-1 ml-4 text-slate-300 font-bold uppercase tracking-widest text-sm italic">Geen toewijzing</div>
                           )}
                        </div>
                      );
                   })}
                </div>

                <div className="mt-12 flex justify-center">
                   <button 
                     onClick={async () => {
                        if (!currentHeatData) return;
                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats', currentHeatData.id), { status: 'voltooid' });
                        updateCurrentHeat(activeTab, 1);
                     }}
                     disabled={!currentHeatData}
                     className="group px-12 py-6 bg-indigo-600 text-white rounded-[28px] font-black text-xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
                   >
                     VOLGENDE REEKS <ChevronRight size={24} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                   </button>
                </div>
             </div>
          </div>

          <div className="lg:col-span-4 h-full">
             <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden h-[800px] flex flex-col sticky top-24">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Reeks Overzicht</h3>
                   <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-400 uppercase">
                     {activeTab === 'speed' ? speedHeats.length : freestyleHeats.length} TOTAL
                   </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                   {(activeTab === 'speed' ? speedHeats : freestyleHeats).map(h => (
                      <div 
                        key={h.id}
                        onClick={() => updateCurrentHeat(activeTab, h.reeks - (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat))}
                        className={`p-6 rounded-[24px] cursor-pointer transition-all flex items-center justify-between border-2 ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                      >
                         <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                               {h.reeks}
                            </div>
                            <div>
                               <div className={`font-black text-sm ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'text-indigo-900' : 'text-slate-700'}`}>
                                 {h.onderdeel}
                               </div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                 {h.status === 'voltooid' ? 'Afgewerkt' : 'Wachtend'}
                               </div>
                            </div>
                         </div>
                         {h.status === 'voltooid' && <CheckCircle2 size={16} className="text-emerald-500" />}
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );

    const DisplayView = () => (
      <div className="fixed inset-0 bg-[#050b18] text-white p-12 flex flex-col z-[100] animate-in zoom-in duration-700 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]"></div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-end border-b border-white/10 pb-12 mb-16">
            <div>
              <div className="inline-flex px-6 py-2 rounded-full bg-indigo-600 text-indigo-100 font-black tracking-[0.3em] mb-8 text-lg border border-indigo-400/30">
                {competitions.find(c => c.id === activeCompId)?.name.toUpperCase()}
              </div>
              <h1 className="text-9xl font-black tracking-tighter leading-none text-white drop-shadow-2xl">
                {currentHeatData?.onderdeel || 'PAUZE'}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-black text-4xl mb-4 tracking-[0.2em]">REEKS</div>
              <div className="text-[15rem] font-black leading-none text-white tabular-nums drop-shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
                {currentHeatData?.reeks || '00'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 flex-1 items-center max-w-[1600px] mx-auto w-full">
            {[1, 2, 3, 4, 5].map(v => {
              const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
              const sk = skippers[slot?.skipperId];
              return (
                <div key={v} className={`flex items-center p-10 rounded-[60px] border-4 transition-all duration-500 h-full max-h-[140px] ${sk ? 'bg-white/5 border-white/20 shadow-2xl backdrop-blur-md' : 'bg-transparent border-dashed border-white/5 opacity-10'}`}>
                  <div className="w-64 text-5xl font-black text-indigo-500/80 italic tracking-tighter">Veld {v}</div>
                  {sk ? (
                    <div className="flex-1 flex justify-between items-center ml-12">
                      <div className="text-8xl font-black tracking-tight text-white uppercase">{sk.naam}</div>
                      <div className="text-5xl font-bold text-slate-500 tracking-wide uppercase italic">{sk.club}</div>
                    </div>
                  ) : (
                    <div className="flex-1 text-center text-4xl text-white/5 font-black uppercase tracking-[1em]">VRIJ</div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => setView('live')} className="absolute top-8 right-8 p-4 rounded-2xl bg-white/5 border border-white/10 text-white/20 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>
      </div>
    );

    // ==========================================
    // 5. MAIN PAGE RENDER
    // ==========================================

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                body { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-font-smoothing: antialiased; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
            
            {/* Navigatie Header */}
            <nav className="h-[88px] bg-white border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 transform rotate-3">
                        <Trophy size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tighter leading-none">ROPESCORE <span className="text-indigo-600">PRO</span></div>
                        <div className="text-[10px] font-bold text-slate-400 tracking-[0.3em] mt-1">ULTIMATE EDITION</div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
                    <button 
                      onClick={() => setView('management')} 
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${view === 'management' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <Layout size={18}/> BEHEER
                    </button>
                    <button 
                      onClick={() => activeCompId && setView('live')} 
                      disabled={!activeCompId}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${!activeCompId ? 'opacity-30' : ''} ${view === 'live' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <Play size={18}/> LIVE
                    </button>
                    <button 
                      onClick={() => activeCompId && setView('display')} 
                      disabled={!activeCompId}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${!activeCompId ? 'opacity-30' : ''} ${view === 'display' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      <Monitor size={18}/> DISPLAY
                    </button>
                </div>

                <div className="flex items-center gap-3 pl-8 border-l border-slate-100">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs font-black text-slate-900 leading-none mb-1">Organisator</div>
                        <div className="text-[10px] font-bold text-slate-400">Admin Panel v4.2</div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                       <Users size={20} className="text-slate-400" />
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="p-4 md:p-10">
                {view === 'management' && <ManagementView />}
                {view === 'live' && activeCompId && <LiveView />}
                {view === 'display' && activeCompId && <DisplayView />}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[1000] p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nieuw Event</h2>
                                <p className="text-slate-400 font-medium">Configureer je nieuwe wedstrijd.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const data = new FormData(e.target);
                            handleCreateCompetition({
                                name: data.get('name'),
                                date: data.get('date'),
                                location: data.get('location')
                            });
                        }} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Wedstrijdnaam</label>
                                <input name="name" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg" placeholder="Bijv. BK Masters 2024" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Datum</label>
                                    <input name="date" type="date" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Stad / Locatie</label>
                                    <input name="location" required className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Locatie" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[24px] font-black text-xl mt-6 shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all">
                                EVENT OPSLAAN
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
