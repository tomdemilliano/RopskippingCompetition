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
    Activity, Clock, Layers, Star, Zap, Shield
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATIE & INITIALISATIE
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY", 
    authDomain: "ropeskippingcontest.firebaseapp.com",
    projectId: "ropeskippingcontest",
    storageBucket: "ropeskippingcontest.firebasestorage.app",
    messagingSenderId: "430066523717",
    appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-ultimate-wide';

// ==========================================
// 2. THEMA & STYLING CONSTANTEN
// ==========================================

const COLORS = {
  bg: 'bg-[#f0f4f8]',
  card: 'bg-white',
  primary: 'from-indigo-600 to-blue-700',
  secondary: 'from-fuchsia-600 to-purple-700',
  accent: 'from-amber-400 to-orange-500',
  text: 'text-slate-900',
  muted: 'text-slate-500'
};

// ==========================================
// 3. HOOFD COMPONENT
// ==========================================

export default function App() {
    const [view, setView] = useState('management'); 
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('speed');
    
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
    // 4. VIEWS
    // ==========================================

    const ManagementView = () => (
      <div className="w-full px-4 md:px-10 py-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {!activeCompId ? (
          <div className="w-full max-w-[1800px] mx-auto">
            <header className="mb-12 flex justify-between items-end">
              <div>
                <h1 className="text-6xl font-black text-slate-900 tracking-tighter mb-2">Events Dashboard</h1>
                <p className="text-xl text-slate-500 font-medium">Beheer en organiseer je rope skipping wedstrijden.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
              >
                <Plus size={24} strokeWidth={3} /> NIEUW EVENT TOEVOEGEN
              </button>
            </header>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {competitions.map(c => (
                <div key={c.id} 
                  onClick={() => setActiveCompId(c.id)}
                  className="group relative bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer overflow-hidden border-b-8 border-b-indigo-500"
                >
                  <div className="flex justify-between items-start mb-10">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Calendar size={28} />
                    </div>
                    <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 tracking-widest uppercase">
                      {c.date}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 leading-tight mb-4 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-sm mb-8">
                    <MapPin size={16} className="text-indigo-400" /> {c.location}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                    <span className="text-indigo-600 font-black text-sm uppercase tracking-widest">Open Dashboard</span>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ChevronRight size={20} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1900px] mx-auto">
            {/* Dashboard Sub-nav */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-12">
               <div className="flex items-center gap-6">
                 <button onClick={() => setActiveCompId(null)} className="p-4 bg-white rounded-3xl text-slate-400 hover:text-indigo-600 border border-slate-200 shadow-sm transition-all hover:scale-110"><ArrowLeft size={24}/></button>
                 <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">{competitions.find(c => c.id === activeCompId)?.name}</h2>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-indigo-500 font-black text-xs uppercase tracking-widest">WEDSTRIJD BEHEER</span>
                      <div className="h-1 w-1 bg-slate-300 rounded-full"></div>
                      <span className="text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1"><MapPin size={12}/> {competitions.find(c => c.id === activeCompId)?.location}</span>
                    </div>
                 </div>
               </div>

               <div className="flex p-2 bg-white rounded-[32px] border border-slate-200 shadow-sm w-full lg:w-auto">
                  {[
                    { id: 'overview', label: 'Dashboard', icon: Layout },
                    { id: 'skippers', label: 'Skippers', icon: Users },
                    { id: 'heats', label: 'Reeksen', icon: Layers }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setMgmtTab(tab.id)}
                      className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-[24px] text-sm font-black transition-all ${mgmtTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                      <tab.icon size={18} strokeWidth={2.5}/> {tab.label.toUpperCase()}
                    </button>
                  ))}
               </div>
            </div>

            {/* Content Tabs */}
            <div className="w-full">
               {mgmtTab === 'overview' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[50px] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                       <Zap className="absolute top-10 right-10 w-40 h-40 text-indigo-500/10" />
                       <div className="relative z-10 flex flex-col h-full justify-between">
                          <div>
                             <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-500/30 text-indigo-400 text-xs font-black tracking-widest uppercase mb-8">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div> LIVE STATUS
                             </div>
                             <h3 className="text-6xl font-black tracking-tighter mb-4">Klaar voor<br/>de start?</h3>
                             <p className="text-slate-400 text-lg font-medium max-w-md">De wedstrijd is geconfigureerd. Start de live modus om de reeksen te tonen in de zaal.</p>
                          </div>
                          <button onClick={() => setView('live')} className="mt-12 group bg-white text-indigo-900 px-10 py-5 rounded-[24px] font-black text-xl flex items-center gap-4 w-fit hover:scale-105 transition-all shadow-xl">
                             NAAR LIVE MODUS <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                          </button>
                       </div>
                    </div>
                    
                    <div className="bg-white rounded-[50px] border border-slate-200 p-10 flex flex-col justify-between shadow-sm relative group overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] transition-all group-hover:scale-110"></div>
                       <div className="relative">
                          <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center text-indigo-600 shadow-sm mb-8">
                             <Users size={32} />
                          </div>
                          <div className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-2">TOTAAL SKIPPERS</div>
                          <div className="text-7xl font-black text-slate-900 tracking-tighter">{Object.keys(skippers).length}</div>
                       </div>
                       <div className="text-indigo-500 font-bold flex items-center gap-2 cursor-pointer mt-8" onClick={() => setMgmtTab('skippers')}>
                          Beheer deelnemers <ChevronRight size={18}/>
                       </div>
                    </div>

                    <div className="bg-white rounded-[50px] border border-slate-200 p-10 flex flex-col justify-between shadow-sm relative group overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] transition-all group-hover:scale-110"></div>
                       <div className="relative">
                          <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center text-amber-500 shadow-sm mb-8">
                             <Layers size={32} />
                          </div>
                          <div className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-2">REEKSEN GEPLAND</div>
                          <div className="text-7xl font-black text-slate-900 tracking-tighter">{heats.length}</div>
                       </div>
                       <div className="text-amber-500 font-bold flex items-center gap-2 cursor-pointer mt-8" onClick={() => setMgmtTab('heats')}>
                          Beheer schema <ChevronRight size={18}/>
                       </div>
                    </div>
                 </div>
               )}

               {mgmtTab === 'skippers' && (
                 <div className="bg-white rounded-[50px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="p-10 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 bg-slate-50/30">
                       <div>
                          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Deelnemerslijst</h3>
                          <p className="text-slate-500 font-medium">Importeer of voeg skippers handmatig toe.</p>
                       </div>
                       <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                          <div className="relative flex-1 sm:w-80">
                             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                             <input className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[24px] focus:ring-4 focus:ring-indigo-500/10 font-bold shadow-sm" placeholder="Snel zoeken..." />
                          </div>
                          <label className="flex items-center justify-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black cursor-pointer hover:bg-black transition-all shadow-xl shadow-slate-200">
                             <Upload size={20} /> CSV IMPORT
                             <input type="file" hidden accept=".csv" onChange={async (e) => {
                                 const file = e.target.files[0];
                                 if (!file) return;
                                 const text = await file.text();
                                 const lines = text.split('\n').filter(l => l.trim());
                                 const batch = writeBatch(db);
                                 lines.slice(1).forEach(line => {
                                     const parts = line.split(',').map(s => s.trim());
                                     if (parts[0]) {
                                         const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers'));
                                         batch.set(ref, { naam: parts[0], club: parts[1] || 'Geen Club', categorie: parts[2] || 'Open' });
                                     }
                                 });
                                 await batch.commit();
                             }} />
                          </label>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full">
                          <thead>
                             <tr className="bg-slate-50/50">
                                <th className="px-12 py-8 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Skipper</th>
                                <th className="px-12 py-8 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Club / Team</th>
                                <th className="px-12 py-8 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Categorie</th>
                                <th className="px-12 py-8 text-right text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Beheer</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {Object.entries(skippers).map(([id, s]) => (
                               <tr key={id} className="hover:bg-indigo-50/30 transition-colors group">
                                  <td className="px-12 py-8">
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-600 font-black text-xl shadow-sm">
                                           {s.naam[0]}
                                        </div>
                                        <span className="font-black text-xl text-slate-800">{s.naam}</span>
                                     </div>
                                  </td>
                                  <td className="px-12 py-8">
                                     <span className="font-bold text-slate-500 text-lg uppercase tracking-tight">{s.club}</span>
                                  </td>
                                  <td className="px-12 py-8">
                                     <span className="px-5 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-black tracking-widest uppercase">
                                        {s.categorie}
                                     </span>
                                  </td>
                                  <td className="px-12 py-8 text-right">
                                     <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm"><Edit3 size={18}/></button>
                                        <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-red-500 shadow-sm"><Trash2 size={18}/></button>
                                     </div>
                                  </td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    );

    const LiveView = () => (
      <div className="w-full max-w-[1900px] mx-auto animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col xl:flex-row gap-10">
          {/* Main Control Panel */}
          <div className="flex-1 space-y-8">
            <div className="bg-white rounded-[60px] border border-slate-200 p-12 shadow-2xl relative overflow-hidden">
               {/* Gradiënt Decoratie */}
               <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-50/50 to-transparent pointer-events-none"></div>
               
               <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 mb-16 relative z-10">
                  <div className="flex p-2 bg-slate-100 rounded-[30px] border border-slate-200 shadow-inner">
                    <button 
                      onClick={() => setActiveTab('speed')} 
                      className={`flex items-center gap-3 px-12 py-5 rounded-[22px] font-black text-base transition-all ${activeTab === 'speed' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Zap size={22} fill={activeTab === 'speed' ? 'currentColor' : 'none'} /> SPEED
                    </button>
                    <button 
                      onClick={() => setActiveTab('freestyle')} 
                      className={`flex items-center gap-3 px-12 py-5 rounded-[22px] font-black text-base transition-all ${activeTab === 'freestyle' ? 'bg-fuchsia-600 text-white shadow-xl shadow-fuchsia-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Star size={22} fill={activeTab === 'freestyle' ? 'currentColor' : 'none'} /> FREESTYLE
                    </button>
                  </div>

                  <div className="flex items-center gap-4 bg-white border border-slate-200 p-3 rounded-[30px] shadow-sm">
                     <button onClick={() => updateCurrentHeat(activeTab, -1)} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"><SkipBack size={24} strokeWidth={3}/></button>
                     <div className="px-8 text-center">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">REEKS</div>
                        <div className="text-4xl font-black text-slate-900 tabular-nums">{(activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat) || 1}</div>
                     </div>
                     <button onClick={() => updateCurrentHeat(activeTab, 1)} className="p-4 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"><SkipForward size={24} strokeWidth={3}/></button>
                  </div>
               </header>

               <div className="relative z-10 mb-20">
                  <div className="inline-flex px-6 py-2 bg-indigo-50 text-indigo-600 rounded-full font-black text-xs tracking-widest uppercase mb-6 border border-indigo-100">
                     HUIDIG ONDERDEEL
                  </div>
                  <h1 className="text-8xl font-black text-slate-900 tracking-tighter leading-none mb-4">
                    {currentHeatData?.onderdeel || 'Geen reeks geselecteerd'}
                  </h1>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
                  {[1, 2, 3, 4, 5].map(v => {
                    const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                    const sk = skippers[slot?.skipperId];
                    return (
                      <div key={v} className={`group flex flex-col items-center p-8 rounded-[45px] border-2 transition-all duration-300 ${sk ? 'bg-slate-50 border-slate-100 shadow-sm' : 'bg-white border-dashed border-slate-100 opacity-30'}`}>
                         <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">VELD {v}</div>
                         <div className="w-20 h-20 rounded-3xl bg-white border border-slate-100 flex items-center justify-center text-3xl font-black text-indigo-600 shadow-sm mb-6 transition-transform group-hover:scale-110">
                            {sk ? sk.naam[0] : v}
                         </div>
                         <div className="text-center min-h-[60px]">
                            <div className="text-xl font-black text-slate-800 leading-tight">{sk?.naam || 'Leeg'}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">{sk?.club || '-'}</div>
                         </div>
                      </div>
                    );
                  })}
               </div>

               <div className="mt-20 flex justify-center">
                  <button 
                    onClick={async () => {
                       if (!currentHeatData) return;
                       await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats', currentHeatData.id), { status: 'voltooid' });
                       updateCurrentHeat(activeTab, 1);
                    }}
                    className="group bg-slate-900 text-white px-20 py-8 rounded-[35px] font-black text-2xl shadow-2xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-6"
                  >
                    REEKS VOLTOOID <ChevronRight size={32} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
                  </button>
               </div>
            </div>
          </div>

          {/* Sidebar Schedule */}
          <div className="w-full xl:w-[450px]">
             <div className="bg-white rounded-[60px] border border-slate-200 shadow-xl h-[850px] flex flex-col sticky top-10">
                <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                   <h3 className="font-black text-slate-900 text-xl tracking-tight">Wedstrijdschema</h3>
                   <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400"><Clock size={20}/></div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                   {(activeTab === 'speed' ? speedHeats : freestyleHeats).map(h => (
                      <div 
                        key={h.id}
                        onClick={() => updateCurrentHeat(activeTab, h.reeks - (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat))}
                        className={`p-6 rounded-[35px] cursor-pointer transition-all flex items-center gap-6 border-4 ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'bg-indigo-600 border-indigo-200 text-white shadow-xl shadow-indigo-100' : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50'}`}
                      >
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {h.reeks}
                         </div>
                         <div className="flex-1">
                            <div className={`font-black text-lg tracking-tight ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'text-white' : 'text-slate-800'}`}>
                               {h.onderdeel}
                            </div>
                            <div className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ${h.reeks === (activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)) ? 'text-white/60' : 'text-slate-400'}`}>
                               {h.status === 'voltooid' ? 'Afgewerkt' : 'In de wacht'}
                            </div>
                         </div>
                         {h.status === 'voltooid' && <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white"><CheckCircle2 size={16}/></div>}
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );

    const DisplayView = () => (
      <div className="fixed inset-0 bg-[#020617] text-white p-16 flex flex-col z-[200] animate-in zoom-in duration-1000 overflow-hidden">
        {/* Animated Orbs for depth */}
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-600/20 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-fuchsia-600/10 rounded-full blur-[140px] animate-pulse delay-700"></div>

        <div className="relative z-10 flex flex-col h-full">
           <header className="flex justify-between items-end border-b-2 border-white/5 pb-16 mb-20">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping"></div>
                    <div className="px-6 py-2 bg-white/5 rounded-full border border-white/10 text-indigo-400 font-black tracking-[0.4em] uppercase text-xl">
                       {competitions.find(c => c.id === activeCompId)?.name}
                    </div>
                 </div>
                 <h1 className="text-[10rem] font-black tracking-tighter leading-none italic uppercase">
                    {currentHeatData?.onderdeel || 'PAUZE'}
                 </h1>
              </div>
              <div className="text-right">
                 <div className="text-indigo-500 font-black text-6xl tracking-[0.3em] mb-4">REEKS</div>
                 <div className="text-[18rem] font-black leading-none tabular-nums drop-shadow-[0_0_80px_rgba(79,70,229,0.3)]">
                   {currentHeatData?.reeks || '00'}
                 </div>
              </div>
           </header>

           <div className="grid grid-cols-1 gap-4 flex-1 items-center max-w-[1700px] mx-auto w-full">
              {[1, 2, 3, 4, 5].map(v => {
                const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                const sk = skippers[slot?.skipperId];
                return (
                  <div key={v} className={`flex items-center px-16 py-8 rounded-[80px] border-4 transition-all duration-700 ${sk ? 'bg-white/5 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-xl' : 'border-dashed border-white/5 opacity-5'}`}>
                    <div className="w-80 text-7xl font-black text-indigo-600/80 italic tracking-tighter">Veld {v}</div>
                    {sk ? (
                      <div className="flex-1 flex justify-between items-center ml-12">
                        <div className="text-[7rem] font-black tracking-tighter uppercase">{sk.naam}</div>
                        <div className="text-5xl font-bold text-slate-500 uppercase tracking-widest">{sk.club}</div>
                      </div>
                    ) : (
                      <div className="flex-1 text-center text-4xl text-white/5 font-black uppercase tracking-[1.5em]">Gereserveerd</div>
                    )}
                  </div>
                );
              })}
           </div>
           
           <div className="mt-16 text-center text-white/20 font-black tracking-[0.5em] text-xs uppercase">Powered by RopeScore Pro Ultimate</div>
        </div>

        <button onClick={() => setView('live')} className="absolute top-10 right-10 p-6 rounded-3xl bg-white/5 border border-white/10 text-white/20 hover:text-white transition-all hover:bg-white/10">
          <X size={32} />
        </button>
      </div>
    );

    // ==========================================
    // 5. MAIN RENDER
    // ==========================================

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                body { 
                  font-family: 'Plus Jakarta Sans', sans-serif; 
                  -webkit-font-smoothing: antialiased; 
                }
                h1, .font-heading { font-family: 'Space Grotesk', sans-serif; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 4px solid transparent; background-clip: content-box; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
            
            {/* Navigatie Header - Full Width */}
            <nav className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 md:px-12 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 transform -rotate-6">
                        <Zap size={28} strokeWidth={3} fill="currentColor" />
                    </div>
                    <div>
                        <div className="text-3xl font-black tracking-tighter leading-none font-heading">ROPESCORE <span className="text-indigo-600">ULTIMATE</span></div>
                        <div className="text-[11px] font-black text-slate-400 tracking-[0.4em] mt-1 uppercase">Advanced Competition Suite</div>
                    </div>
                </div>

                <div className="hidden lg:flex items-center gap-2 p-2 bg-slate-100 rounded-3xl border border-slate-200/50">
                    {[
                      { id: 'management', label: 'Dashboard', icon: Layout },
                      { id: 'live', label: 'Live Controller', icon: Play, disabled: !activeCompId },
                      { id: 'display', label: 'Zaal Display', icon: Monitor, disabled: !activeCompId }
                    ].map(btn => (
                      <button 
                        key={btn.id}
                        onClick={() => !btn.disabled && setView(btn.id)} 
                        disabled={btn.disabled}
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-sm transition-all ${btn.disabled ? 'opacity-20 cursor-not-allowed' : ''} ${view === btn.id ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'}`}
                      >
                        <btn.icon size={20} strokeWidth={2.5}/> {btn.label.toUpperCase()}
                      </button>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                       <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-widest border border-emerald-100">
                          <Shield size={10} fill="currentColor" /> SYSTEM ONLINE
                       </div>
                       <div className="text-xs font-bold text-slate-400 mt-1">Authenticated Admin</div>
                    </div>
                    <div className="w-14 h-14 rounded-3xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400">
                       <Settings size={24} />
                    </div>
                </div>
            </nav>

            {/* Content Body - Full Width */}
            <main className="w-full min-h-[calc(100vh-6rem)]">
                {view === 'management' && <ManagementView />}
                {view === 'live' && activeCompId && <LiveView />}
                {view === 'display' && activeCompId && <DisplayView />}
            </main>

            {/* Modals */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center z-[1000] p-6 animate-in fade-in duration-500">
                    <div className="bg-white w-full max-w-2xl rounded-[60px] p-16 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-500">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">Event Details</h2>
                                <p className="text-slate-500 text-lg font-medium">Stel de basisgegevens van je wedstrijd in.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-4 bg-slate-100 text-slate-400 rounded-3xl hover:bg-slate-200 transition-colors">
                                <X size={24} />
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
                        }} className="space-y-10">
                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] ml-2">WEDSTRIJD TITEL</label>
                                <input name="name" required className="w-full px-8 py-6 rounded-[30px] bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all font-black text-2xl outline-none" placeholder="Bijv: Provinciaal Kampioenschap" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] ml-2">DATUM</label>
                                    <input name="date" type="date" required className="w-full px-8 py-6 rounded-[30px] bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all font-black text-lg outline-none" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] ml-2">STAD / REGIO</label>
                                    <input name="location" required className="w-full px-8 py-6 rounded-[30px] bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all font-black text-lg outline-none" placeholder="Locatie" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-8 rounded-[35px] font-black text-2xl mt-8 shadow-2xl shadow-indigo-100 hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4">
                                CONFIGURATIE VOLTOOIEN <CheckCircle2 size={28}/>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
