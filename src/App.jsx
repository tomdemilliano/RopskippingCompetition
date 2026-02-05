import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
// Firestore imports
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp
} from 'firebase/firestore';
// Auth imports (Hier zat de fout: deze moeten uit firebase/auth komen)
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
  Clock
} from 'lucide-react';

// Firebase configuratie
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropeskipping-db-v2';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('speed');
  
  // Data states
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
        // Gebruik de anonieme login voor publieke toegang
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

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'settings', 'competition');
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

  // Filters voor disciplines
  const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed'), [heats]);
  const fsHeats = useMemo(() => heats.filter(h => h.type === 'freestyle'), [heats]);

  const currentHeat = useMemo(() => {
    const list = activeTab === 'speed' ? speedHeats : fsHeats;
    const heatNum = activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat;
    return list.find(h => h.reeks === heatNum) || null;
  }, [activeTab, speedHeats, fsHeats, settings]);

  const finishHeat = async () => {
    if (!currentHeat || !user) return;
    
    // Markeer huidige heat als klaar
    const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
    await updateDoc(heatRef, { 
      status: 'finished',
      endTime: serverTimestamp()
    });

    // Ga naar volgende reeks
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'settings', 'competition');
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    await updateDoc(settingsRef, { [key]: settings[key] + 1 });
  };

  const getSkipperInfo = (id) => skippers[id] || { naam: "Laden...", club: "..." };

  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium">Verbinden met database...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigatie */}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Trophy size={24} />
          </div>
          <span className="font-black text-xl tracking-tight uppercase">RopeScore Live</span>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['dashboard', 'control', 'display'].map((v) => (
            <button 
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${view === v ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pb-20">
        
        {view === 'control' && (
          <div className="space-y-6">
            <div className="flex gap-4">
              <button onClick={() => setActiveTab('speed')} className={`flex-1 p-4 rounded-xl font-bold border-2 transition ${activeTab === 'speed' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'bg-white border-slate-100 text-slate-400'}`}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} className={`flex-1 p-4 rounded-xl font-bold border-2 transition ${activeTab === 'freestyle' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'bg-white border-slate-100 text-slate-400'}`}>FREESTYLE</button>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border p-8 text-center">
              <div className="mb-8">
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Huidige Reeks</span>
                <h2 className="text-7xl font-black text-slate-800 tabular-nums">
                  {activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}
                </h2>
                <p className="text-xl font-medium text-slate-500 mt-2">{currentHeat?.onderdeel || 'Geen onderdeel data'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipperInfo(slot.skipperId);
                  return (
                    <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border text-left">
                      <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                        {slot.veld}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold truncate">{s.naam}</p>
                        <p className="text-[10px] text-slate-400 uppercase truncate">{s.club}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => {
                     const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
                     updateDoc(doc(db, 'artifacts', appId, 'public', 'settings', 'competition'), { [key]: Math.max(1, settings[key] - 1) });
                  }}
                  className="px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <ChevronLeft />
                </button>
                <button 
                  onClick={finishHeat}
                  className="flex-1 max-w-sm bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-200 flex items-center justify-center gap-2 text-xl transition active:scale-95"
                >
                  <CheckCircle2 /> REEKS KLAAR
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'display' && (
          <div className="fixed inset-0 bg-slate-950 text-white z-50 p-12 flex flex-col overflow-hidden">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-blue-500 font-black tracking-widest text-xl mb-2">LIVE COMPETITION</p>
                <h1 className="text-7xl font-black italic uppercase tracking-tighter">
                  {activeTab === 'speed' ? 'Speed' : 'Freestyle'}
                </h1>
              </div>
              <div className="bg-white/5 p-8 rounded-3xl border border-white/10 text-center min-w-[200px]">
                <p className="text-sm font-bold opacity-50 uppercase mb-1">Reeks</p>
                <p className="text-8xl font-black leading-none italic">{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentHeat?.slots?.map((slot, i) => {
                  const s = getSkipperInfo(slot.skipperId);
                  return (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-6">
                      <div className="text-5xl font-black text-blue-500 opacity-50">{slot.veld}</div>
                      <div>
                        <p className="text-3xl font-bold tracking-tight mb-1">{s.naam}</p>
                        <p className="text-lg font-medium text-white/40 uppercase">{s.club}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-8 border-t border-white/10 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-4 text-2xl italic font-medium text-blue-400">
                <Megaphone /> {settings.announcement}
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('speed')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'speed' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>SPEED</button>
                <button onClick={() => setActiveTab('freestyle')} className={`px-6 py-2 rounded-full font-bold transition ${activeTab === 'freestyle' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>FREESTYLE</button>
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border">
               <div className="flex items-center gap-2 mb-4 text-orange-600">
                 <Timer /> <h2 className="font-black text-xl uppercase">Speed Status</h2>
               </div>
               <div className="space-y-4">
                 {speedHeats.slice(Math.max(0, settings.currentSpeedHeat - 1), settings.currentSpeedHeat + 2).map((h, i) => (
                   <div key={h.id} className={`p-4 rounded-2xl border transition ${h.reeks === settings.currentSpeedHeat ? 'bg-orange-50 border-orange-100' : 'opacity-40'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Reeks {h.reeks}</span>
                        {h.status === 'finished' ? <CheckCircle2 size={16} className="text-green-500"/> : <Clock size={16}/>}
                      </div>
                      <p className="text-sm text-slate-500">{h.onderdeel}</p>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border">
               <div className="flex items-center gap-2 mb-4 text-purple-600">
                 <Users /> <h2 className="font-black text-xl uppercase">Freestyle Status</h2>
               </div>
               <div className="space-y-4">
                 {fsHeats.slice(Math.max(0, settings.currentFreestyleHeat - 1), settings.currentFreestyleHeat + 2).map((h, i) => (
                   <div key={h.id} className={`p-4 rounded-2xl border transition ${h.reeks === settings.currentFreestyleHeat ? 'bg-purple-50 border-purple-100' : 'opacity-40'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Reeks {h.reeks}</span>
                        {h.status === 'finished' ? <CheckCircle2 size={16} className="text-green-500"/> : <Clock size={16}/>}
                      </div>
                      <p className="text-sm text-slate-500">{h.veld} - {getSkipperInfo(h.slots?.[0]?.skipperId).naam}</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t px-6 py-2 text-[10px] text-gray-400 flex justify-between uppercase tracking-widest font-bold z-30">
        <span>RopeScore v2.1</span>
        <span>Connected as: {user?.uid || 'anonymous'}</span>
      </footer>
    </div>
  );
};

export default App;
