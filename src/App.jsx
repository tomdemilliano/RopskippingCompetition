import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Trash2, UserPlus, Play, Square, RotateCcw
} from 'lucide-react';

/**
 * FIREBASE CONFIGURATIE via Environment Variabelen
 * Voeg deze toe in Vercel Dashboard onder 'Environment Variables'
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ""
};

// Initialiseer Firebase (Singleton pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Gebruik een unieke ID voor de app context
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

const POSSIBLE_ONDERDELEN = [
  'Speed',
  'Endurance',
  'Freestyle',
  'Double under',
  'Triple under'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('live'); // 'live', 'admin', 'scores', 'heats'
  const [participants, setParticipants] = useState({});
  const [status, setStatus] = useState({ 
    activeOnderdeel: 'Speed', 
    timerRunning: false, 
    currentHeat: 1, 
    startTime: null,
    totalHeats: 1
  });
  const [heats, setHeats] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Authenticate & Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    // Listen to status
    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'status');
    const unsubStatus = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) setStatus(docSnap.data());
      setLoading(false);
    }, (err) => console.error("Status listener error:", err));

    // Listen to participants
    const partRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubPart = onSnapshot(partRef, (snap) => {
      const p = {};
      snap.forEach(d => p[d.id] = { id: d.id, ...d.data() });
      setParticipants(p);
    });

    // Listen to heats
    const heatRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');
    const unsubHeats = onSnapshot(heatRef, (snap) => {
      const h = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHeats(h.sort((a, b) => a.heatNr - b.heatNr));
    });

    return () => {
      unsubStatus();
      unsubPart();
      unsubHeats();
    };
  }, [user]);

  // --- LOGICA VOOR RANGSCHIKKING ---
  const rankings = useMemo(() => {
    const list = Object.values(participants).filter(p => p.scores && p.scores[status.activeOnderdeel]);
    return list.sort((a, b) => (b.scores[status.activeOnderdeel] || 0) - (a.scores[status.activeOnderdeel] || 0));
  }, [participants, status.activeOnderdeel]);

  // --- ACTIONS ---
  const toggleTimer = async () => {
    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'status');
    await updateDoc(statusRef, { 
      timerRunning: !status.timerRunning,
      startTime: !status.timerRunning ? Date.now() : status.startTime
    });
  };

  const nextHeat = async () => {
    if (status.currentHeat >= status.totalHeats) return;
    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'status');
    await updateDoc(statusRef, { currentHeat: status.currentHeat + 1, timerRunning: false });
  };

  // --- RENDER HELPERS ---
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Nav */}
      <nav className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="text-blue-600 w-6 h-6" />
          <span className="font-bold text-xl tracking-tight">RopeScore <span className="text-blue-600">Pro</span></span>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          {['live', 'scores', 'heats', 'admin'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-6xl mx-auto">
        {view === 'live' && <LiveView status={status} participants={participants} heats={heats} />}
        {view === 'admin' && <AdminDashboard status={status} participants={participants} toggleTimer={toggleTimer} nextHeat={nextHeat} appId={appId} />}
        {view === 'scores' && <Scoreboard rankings={rankings} activeOnderdeel={status.activeOnderdeel} />}
        {view === 'heats' && <HeatOverview heats={heats} participants={participants} currentHeat={status.currentHeat} />}
      </main>
    </div>
  );
}

// --- SUBCOMPONENTS ---

function LiveView({ status, participants, heats }) {
  const currentHeatData = heats.find(h => h.heatNr === status.currentHeat);
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-xl flex justify-between items-center overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-blue-100 font-medium uppercase tracking-widest text-sm mb-1">{status.activeOnderdeel}</p>
          <h1 className="text-6xl font-black mb-2">Heat {status.currentHeat}</h1>
          <div className="flex items-center gap-2 text-blue-100">
            <Clock size={20} />
            <span className="text-xl font-bold">Live Wedstrijd</span>
          </div>
        </div>
        <div className="text-8xl font-mono font-black tabular-nums bg-blue-700/50 px-8 py-4 rounded-2xl border border-blue-400/30">
          {status.timerRunning ? "RUN" : "00"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentHeatData?.assignments?.map((a, idx) => {
          const p = participants[a.skipperId];
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black text-xl">
                {a.veld}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{p?.naam || 'Leeg'}</h3>
                <p className="text-slate-500 text-sm">{p?.club || 'Geen club'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminDashboard({ status, participants, toggleTimer, nextHeat, appId }) {
  const [newSkipper, setNewSkipper] = useState({ naam: '', club: '' });

  const addSkipper = async () => {
    if (!newSkipper.naam) return;
    const id = Date.now().toString();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', id), {
      naam: newSkipper.naam,
      club: newSkipper.club,
      scores: {}
    });
    setNewSkipper({ naam: '', club: '' });
  };

  const deleteSkipper = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', id));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Controls */}
      <div className="md:col-span-1 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Play size={18} /> Wedstrijd Verloop</h2>
          <div className="flex flex-col gap-3">
            <button 
              onClick={toggleTimer}
              className={`w-full py-4 rounded-xl font-bold text-white transition-transform active:scale-95 flex items-center justify-center gap-2 ${status.timerRunning ? 'bg-red-500' : 'bg-green-600'}`}
            >
              {status.timerRunning ? <><Square fill="white" size={20}/> Stop Timer</> : <><Play fill="white" size={20}/> Start Timer</>}
            </button>
            <button 
              onClick={nextHeat}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700"
            >
              Volgende Heat <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={18} /> Deelnemer Toevoegen</h2>
          <div className="space-y-3">
            <input 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Naam springer"
              value={newSkipper.naam}
              onChange={e => setNewSkipper({...newSkipper, naam: e.target.value})}
            />
            <input 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Club"
              value={newSkipper.club}
              onChange={e => setNewSkipper({...newSkipper, club: e.target.value})}
            />
            <button onClick={addSkipper} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">
              Voeg toe
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="md:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold uppercase text-xs tracking-widest text-slate-500">Geregistreerde Deelnemers</h2>
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold">{Object.keys(participants).length}</span>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {Object.values(participants).map(p => (
              <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <div className="font-bold">{p.naam}</div>
                  <div className="text-sm text-slate-500">{p.club}</div>
                </div>
                <button onClick={() => deleteSkipper(p.id)} className="text-slate-400 hover:text-red-500 p-2 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {Object.keys(participants).length === 0 && (
              <div className="p-12 text-center text-slate-400 italic">Geen deelnemers gevonden.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Scoreboard({ rankings, activeOnderdeel }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-800 p-8 text-white flex justify-between items-end">
        <div>
          <h2 className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-2">{activeOnderdeel}</h2>
          <h1 className="text-4xl font-black italic">TOP RANGSCHIKKING</h1>
        </div>
        <Trophy size={48} className="text-yellow-400" />
      </div>
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="text-left text-slate-400 text-xs uppercase tracking-tighter border-b">
              <th className="pb-4 px-4">Pos</th>
              <th className="pb-4">Springer</th>
              <th className="pb-4">Club</th>
              <th className="pb-4 text-right px-4">Score</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((p, idx) => (
              <tr key={p.id} className={`border-b last:border-0 ${idx === 0 ? 'bg-yellow-50' : idx === 1 ? 'bg-slate-50' : idx === 2 ? 'bg-orange-50' : ''}`}>
                <td className="py-5 px-4 font-black text-xl italic text-slate-400">
                  {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}
                </td>
                <td className="py-5 font-bold text-lg">{p.naam}</td>
                <td className="py-5 text-slate-500">{p.club}</td>
                <td className="py-5 text-right px-4 font-black text-2xl text-blue-600">{p.scores[activeOnderdeel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatOverview({ heats, participants, currentHeat }) {
  return (
    <div className="space-y-6">
      {heats.map(h => (
        <div key={h.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${h.heatNr === currentHeat ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 opacity-60'}`}>
          <div className={`p-3 px-6 flex justify-between items-center ${h.heatNr === currentHeat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <span className="font-black text-lg">HEAT {h.heatNr}</span>
            {h.heatNr === currentHeat && <span className="text-xs font-bold bg-white text-blue-600 px-2 py-0.5 rounded-full animate-pulse">NU BEZIG</span>}
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {h.assignments.map((a, i) => (
              <div key={i} className="flex flex-col border rounded-xl p-3 bg-slate-50">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Veld {a.veld}</span>
                <span className="font-bold truncate">{participants[a.skipperId]?.naam || 'Leeg'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
