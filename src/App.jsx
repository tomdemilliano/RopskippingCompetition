import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

import { 
  Trophy, 
  Timer, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Megaphone,
  LayoutDashboard,
  Eye,
  Clock,
  Settings,
  Activity,
  Zap,
  Star
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
    measurementId: "G-0MG01YNV0F"
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
  
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom bij de wedstrijd!",
  });

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
    }, (err) => console.error("Settings listener error:", err));

    const unsubSkippers = onSnapshot(skippersRef, (snapshot) => {
      const dict = {};
      snapshot.forEach(doc => { dict[doc.id] = doc.data(); });
      setSkippers(dict);
    }, (err) => console.error("Skippers listener error:", err));

    const unsubHeats = onSnapshot(heatsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHeats(data.sort((a, b) => a.reeks - b.reeks));
    }, (err) => console.error("Heats listener error:", err));

    return () => {
      unsubSettings();
      unsubSkippers();
      unsubHeats();
    };
  }, [user]);

  const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed'), [heats]);
  const fsHeats = useMemo(() => heats.filter(h => h.type === 'freestyle'), [heats]);

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? speedHeats : fsHeats;
    const heatNum = activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat;
    return list.find(h => h.reeks === heatNum) || null;
  }, [activeTab, speedHeats, fsHeats, settings]);

  const finishHeat = async () => {
    if (!currentHeat || !user) return;
    
    const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
    await updateDoc(heatRef, { 
      status: 'finished',
      endTime: serverTimestamp()
    });

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    await updateDoc(settingsRef, { [key]: settings[key] + 1 });
  };

  const getSkipperInfo = (id) => skippers[id] || { naam: "Laden...", club: "..." };

  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-semibold text-lg">Wedstrijd inladen...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navbar met Glasmorphism-effect */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
            <Trophy size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-black text-lg leading-tight tracking-tight text-slate-800 uppercase italic">RopeScore<span className="text-blue-600">Live</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Antwerp-VLB-WV</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Live' },
            { id: 'control', icon: Activity, label: 'Jury' },
            { id: 'display', icon: Eye, label: 'Display' }
          ].map((v) => (
            <button 
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 uppercase tracking-wider ${
                view === v.id 
                  ? 'bg-white shadow-md text-blue-600 scale-100' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95'
              }`}
            >
              <v.icon size={16} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
        {view === 'control' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Discipline Selector */}
            <div className="grid grid-cols-2 gap-4 p-1.5 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
              <button 
                onClick={() => setActiveTab('speed')} 
                className={`flex items-center justify-center gap-3 p-5 rounded-[1.6rem] font-black text-sm tracking-widest transition-all ${
                  activeTab === 'speed' 
                  ? 'bg-orange-500 text-white shadow-xl shadow-orange-200' 
                  : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Zap size={18} /> SPEED
              </button>
              <button 
                onClick={() => setActiveTab('freestyle')} 
                className={`flex items-center justify-center gap-3 p-5 rounded-[1.6rem] font-black text-sm tracking-widest transition-all ${
                  activeTab === 'freestyle' 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' 
                  : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Star size={18} /> FREESTYLE
              </button>
            </div>

            {/* Main Control Card */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 p-8 md:p-12 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-slate-900 pointer-events-none">
                 {activeTab === 'speed' ? <Zap size={200} /> : <Star size={200} />}
              </div>
              
              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                  Huidige Reeks
                </div>
                
                <div className="flex items-center justify-center gap-12 mb-8">
                  <button 
                    onClick={() => {
                       const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
                       updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { [key]: Math.max(1, settings[key] - 1) });
                    }}
                    className="w-16 h-16 rounded-3xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 transition-all border border-slate-100"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  
                  <div className="text-center">
                    <h2 className="text-9xl font-black text-slate-800 tracking-tighter tabular-nums drop-shadow-sm leading-none">
                      {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                    </h2>
                  </div>

                  <button 
                    onClick={() => {
                       const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
                       updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { [key]: settings[key] + 1 });
                    }}
                    className="w-16 h-16 rounded-3xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 transition-all border border-slate-100"
                  >
                    <ChevronRight size={32} />
                  </button>
                </div>

                <div className="bg-blue-50/50 inline-block px-8 py-3 rounded-2xl border border-blue-100/50 mb-12">
                   <p className="text-blue-700 font-bold text-lg italic tracking-tight uppercase">
                    {currentHeat?.onderdeel || 'Geen onderdeel geselecteerd'}
                   </p>
                </div>

                {/* Jury/Skipper List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 text-left">
                  {currentHeat?.slots?.map((slot, i) => {
                    const s = getSkipperInfo(slot.skipperId);
                    return (
                      <div key={i} className="group bg-slate-50/80 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 p-5 rounded-2xl border border-slate-100 transition-all duration-300">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 leading-none">VELD</span>
                            <span className="text-xl font-black text-blue-600 leading-none mt-1">{slot.veld}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 truncate leading-tight uppercase tracking-tight">{s.naam}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{s.club}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={finishHeat}
                  className="group relative w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-slate-200 overflow-hidden transition-all duration-500 active:scale-[0.98]"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3 text-xl tracking-widest uppercase italic">
                    <CheckCircle2 size={28} className="text-blue-400 group-hover:text-white transition-colors" />
                    <span>Volgende Reeks</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-[#0F172A] text-white z-50 p-8 md:p-16 flex flex-col overflow-hidden font-display">
            {/* Header met Arena Look */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 relative">
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full w-fit">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                   <span className="text-blue-400 font-black tracking-[0.3em] text-[10px] uppercase">Live Arena Feed</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.9] text-white">
                  {activeTab === 'speed' ? 'Speed' : 'Freestyle'}<br/>
                  <span className="text-blue-500">Sessie</span>
                </h1>
                <p className="text-xl text-slate-400 font-medium tracking-tight uppercase border-l-4 border-blue-600 pl-4 mt-4">
                  {currentHeat?.onderdeel}
                </p>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-4 bg-blue-600 opacity-20 blur-2xl group-hover:opacity-30 transition rounded-full"></div>
                <div className="relative bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 text-center min-w-[240px] shadow-2xl">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-[0.4em] mb-3">Reeks</p>
                  <p className="text-9xl font-black leading-none italic tracking-tighter tabular-nums">
                    {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                  </p>
                </div>
              </div>
            </div>

            {/* Skippers Grid - Display Mode */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipperInfo(slot.skipperId);
                  return (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-[2rem] p-8 flex flex-col justify-between hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-900/20 group">
                      <div className="flex justify-between items-start mb-12">
                        <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Veld</div>
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
                          {slot.veld}
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-black tracking-tight mb-2 leading-tight uppercase group-hover:text-blue-400 transition-colors">{s.naam}</p>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{s.club}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Bar Display */}
            <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6 text-xl italic font-bold text-blue-400 bg-blue-500/5 px-8 py-4 rounded-full border border-blue-500/10">
                <Megaphone size={24} className="animate-bounce" /> 
                <span className="uppercase tracking-tight text-white/90">{settings.announcement}</span>
              </div>
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                <button onClick={() => setActiveTab('speed')} className={`px-8 py-3 rounded-xl font-black text-xs tracking-widest transition-all ${activeTab === 'speed' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>SPEED</button>
                <button onClick={() => setActiveTab('freestyle')} className={`px-8 py-3 rounded-xl font-black text-xs tracking-widest transition-all ${activeTab === 'freestyle' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>FREESTYLE</button>
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Announcement Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 md:p-10 rounded-[2.5rem] text-white shadow-xl shadow-blue-200 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                  <Megaphone size={160} />
               </div>
               <div className="bg-white/20 p-5 rounded-3xl backdrop-blur-sm border border-white/20">
                 <Megaphone size={32} />
               </div>
               <div className="text-center md:text-left relative z-10">
                 <p className="text-blue-200 text-xs font-black uppercase tracking-[0.3em] mb-1">Mededeling</p>
                 <h3 className="text-2xl md:text-3xl font-black tracking-tight">{settings.announcement}</h3>
               </div>
            </div>

            {/* Live Progress Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Speed Card */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                 <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                     <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                       <Zap size={24} strokeWidth={2.5} />
                     </div>
                     <h2 className="font-black text-xl uppercase tracking-tighter italic">Speed Tracker</h2>
                   </div>
                   <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">Live</span>
                 </div>
                 
                 <div className="space-y-4 flex-1">
                   {speedHeats.slice(Math.max(0, settings.currentSpeedHeat - 1), settings.currentSpeedHeat + 3).map((h, i) => (
                     <div key={h.id} className={`p-6 rounded-[1.8rem] border transition-all duration-500 ${h.reeks === settings.currentSpeedHeat ? 'bg-orange-50 border-orange-200 shadow-lg shadow-orange-100 scale-[1.02] z-10 relative' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-slate-800 uppercase tracking-tighter text-lg">Reeks {h.reeks}</span>
                          {h.status === 'finished' ? <CheckCircle2 size={20} className="text-green-500"/> : <Clock size={20} className="text-slate-300"/>}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{h.onderdeel}</p>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Freestyle Card */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                 <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                     <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                       <Star size={24} strokeWidth={2.5} />
                     </div>
                     <h2 className="font-black text-xl uppercase tracking-tighter italic">Freestyle Tracker</h2>
                   </div>
                   <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">Live</span>
                 </div>
                 
                 <div className="space-y-4 flex-1">
                   {fsHeats.slice(Math.max(0, settings.currentFreestyleHeat - 1), settings.currentFreestyleHeat + 3).map((h, i) => (
                     <div key={h.id} className={`p-6 rounded-[1.8rem] border transition-all duration-500 ${h.reeks === settings.currentFreestyleHeat ? 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-100 scale-[1.02] z-10 relative' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-slate-800 uppercase tracking-tighter text-lg">Reeks {h.reeks}</span>
                          {h.status === 'finished' ? <CheckCircle2 size={20} className="text-green-500"/> : <Clock size={20} className="text-slate-300"/>}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {h.veld} — {getSkipperInfo(h.slots?.[0]?.skipperId).naam}
                        </p>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-8 py-4 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Live Database Connected</span>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">RopeScore Professional v2.5</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        
        body { font-family: 'Inter', sans-serif; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .font-display { font-family: 'Inter', sans-serif; }
      `}} />
    </div>
  );
};

export default App;
