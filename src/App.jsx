import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, deleteDoc, addDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Settings, Monitor, Play
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE
 * Haalt configuratie op uit Environment Variables (Vercel/Vite/Next.js)
 */
const getFirebaseConfig = () => {
  // Check voor verschillende mogelijke env namen afhankelijk van je framework
  const envConfig = 
    process.env.NEXT_PUBLIC_FIREBASE_CONFIG || 
    process.env.VITE_FIREBASE_CONFIG || 
    process.env.FIREBASE_CONFIG;

  if (envConfig) {
    try {
      return JSON.parse(envConfig);
    } catch (e) {
      console.error("Fout bij parsen van FIREBASE_CONFIG env var:", e);
    }
  }

  // Fallback voor de lokale preview omgeving
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }

  return {};
};

const firebaseConfig = getFirebaseConfig();

// Initialiseer app enkel als er nog geen app is (voorkomt dubbele initialisatie bij hot reloads)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-v2';

const POSSIBLE_ONDERDELEN = [
  'Speed', 'Endurance', 'Freestyle', 'Double under', 'Triple under', 'DD Speed'
];

/**
 * HOOFDCOMPONENT: Navigatie tussen de 3 delen
 */
export default function App() {
  const [view, setView] = useState('selection'); // selection, live, beheer, display
  const [user, setUser] = useState(null);
  const [compData, setCompData] = useState(null);
  const [participants, setParticipants] = useState({});

  // 1. Auth Initialisatie
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user) return;

    const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competition');
    const partRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');

    const unsubComp = onSnapshot(compRef, (doc) => {
      if (doc.exists()) setCompData(doc.data());
    }, (err) => console.error("Competition sync error:", err));

    const unsubPart = onSnapshot(partRef, (snap) => {
      const p = {};
      snap.forEach(d => p[d.id] = { id: d.id, ...d.data() });
      setParticipants(p);
    }, (err) => console.error("Participants sync error:", err));

    return () => { unsubComp(); unsubPart(); };
  }, [user]);

  if (!user) return <div className="flex h-screen items-center justify-center font-bold text-slate-400">Verbinden met server...</div>;

  // Render view gebaseerd op state
  switch (view) {
    case 'live':
      return <LiveView compData={compData} participants={participants} onBack={() => setView('selection')} />;
    case 'beheer':
      return <BeheerView compData={compData} participants={participants} onBack={() => setView('selection')} />;
    case 'display':
      return <DisplayView compData={compData} participants={participants} onBack={() => setView('selection')} />;
    default:
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-8 text-slate-800">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight mb-2">ROPESCORE PRO</h1>
            <p className="text-slate-500 uppercase tracking-widest text-sm font-bold">Wedstrijd Management Systeem</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <MenuCard 
              icon={<Play size={32} />} 
              title="Live Overzicht" 
              desc="Bekijk de huidige status van de wedstrijd in real-time."
              onClick={() => setView('live')}
              color="bg-blue-600"
            />
            <MenuCard 
              icon={<Settings size={32} />} 
              title="Beheer" 
              desc="Configureer onderdelen, deelnemers en veld-indelingen."
              onClick={() => setView('beheer')}
              color="bg-slate-800"
            />
            <MenuCard 
              icon={<Monitor size={32} />} 
              title="Display" 
              desc="Groot scherm weergave voor publiek en atleten."
              onClick={() => setView('display')}
              color="bg-emerald-600"
            />
          </div>
        </div>
      );
  }
}

function MenuCard({ icon, title, desc, onClick, color }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all group"
    >
      <div className={`${color} text-white p-4 rounded-xl mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      <p className="text-slate-500 text-sm mt-2 text-center">{desc}</p>
    </button>
  );
}

/**
 * DEEL 1: LIVE OVERZICHT
 */
function LiveView({ compData, participants, onBack }) {
  if (!compData) return <div className="p-10 text-center">Initialiseren...</div>;

  return (
    <div className="min-h-screen bg-white">
      <header className="p-4 bg-blue-600 text-white flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <button onClick={onBack} className="flex items-center gap-2 font-bold hover:bg-blue-700 px-3 py-1 rounded-lg transition-colors"><ChevronLeft /> Terug</button>
        <div className="text-center">
          <div className="text-xs opacity-80 uppercase font-black tracking-widest">Nu bezig: {compData.currentOnderdeel}</div>
          <div className="text-xl font-black italic">REEKS {compData.currentHeat}</div>
        </div>
        <div className="w-20"></div>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto mt-4">
        {compData.slots?.map((s, idx) => {
          const p = participants[s.skipperId];
          return (
            <div key={idx} className={`p-4 rounded-xl border-2 flex items-center justify-between ${s.empty ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-blue-100 shadow-sm'}`}>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black text-blue-600 w-12 text-center">{s.veld}</span>
                <div>
                  <div className="font-bold text-lg leading-tight text-slate-800">{p?.naam || (s.empty ? 'VRIJ' : 'Laden...')}</div>
                  <div className="text-sm text-slate-500 font-bold">{p?.club || '-'}</div>
                </div>
              </div>
              {!s.empty && <Activity className="text-blue-500 animate-pulse" size={24} />}
            </div>
          );
        })}
        {(!compData.slots || compData.slots.length === 0) && (
          <div className="text-center p-12 text-slate-400 italic">Geen velden geconfigureerd voor deze reeks.</div>
        )}
      </div>
    </div>
  );
}

/**
 * DEEL 2: BEHEER DEEL
 */
function BeheerView({ compData, participants, onBack }) {
  const [newSkipper, setNewSkipper] = useState({ naam: '', club: '' });

  const updateComp = async (updates) => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'competition');
    await updateDoc(ref, updates);
  };

  const addParticipant = async () => {
    if (!newSkipper.naam) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    await addDoc(ref, newSkipper);
    setNewSkipper({ naam: '', club: '' });
  };

  const nextHeat = () => {
    updateComp({ currentHeat: (compData.currentHeat || 1) + 1 });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 pb-24 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <button onClick={onBack} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50"><ChevronLeft /></button>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic">Instellingen & Beheer</h2>
          <div className="w-10"></div>
        </div>

        {/* Wedstrijd Status */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy size={16}/> Wedstrijd Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">ONDERDEEL</label>
              <select 
                value={compData?.currentOnderdeel || ''} 
                onChange={(e) => updateComp({ currentOnderdeel: e.target.value })}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Kies onderdeel...</option>
                {POSSIBLE_ONDERDELEN.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">HUIDIGE REEKS</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={compData?.currentHeat || 0} 
                  onChange={(e) => updateComp({ currentHeat: parseInt(e.target.value) || 0 })}
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={nextHeat} className="bg-blue-600 text-white px-4 rounded-xl font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors">VOLGENDE</button>
              </div>
            </div>
          </div>
        </section>

        {/* Deelnemers Beheer */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Info size={16}/> Deelnemers Toevoegen</h3>
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <input 
              placeholder="Naam skipper..." 
              value={newSkipper.naam}
              onChange={(e) => setNewSkipper({...newSkipper, naam: e.target.value})}
              className="flex-1 p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-slate-400 outline-none"
            />
            <input 
              placeholder="Club..." 
              value={newSkipper.club}
              onChange={(e) => setNewSkipper({...newSkipper, club: e.target.value})}
              className="sm:w-40 p-3 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-slate-400 outline-none"
            />
            <button onClick={addParticipant} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">VOEG TOE</button>
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {Object.values(participants).length > 0 ? (
              Object.values(participants).map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg group">
                  <span className="font-bold text-slate-700">{p.naam} <span className="text-slate-400 font-normal ml-2">({p.club})</span></span>
                  <button 
                    onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', p.id))} 
                    className="text-slate-300 hover:text-red-500 p-1 font-bold transition-colors"
                  >
                    Verwijder
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 italic">Nog geen deelnemers in de lijst.</div>
            )}
          </div>
        </section>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm">
          <strong>Tip:</strong> Alle wijzigingen die je hier maakt zijn onmiddellijk zichtbaar op de <strong>Live</strong> en <strong>Display</strong> schermen voor alle gebruikers.
        </div>
      </div>
    </div>
  );
}

/**
 * DEEL 3: DISPLAY DEEL
 */
function DisplayView({ compData, participants, onBack }) {
  if (!compData) return <div className="h-screen bg-black text-white flex items-center justify-center font-black text-4xl italic animate-pulse">Laden...</div>;

  return (
    <div className="h-screen bg-slate-950 text-white overflow-hidden flex flex-col p-8">
      {/* Header */}
      <div className="flex justify-between items-end border-b-8 border-blue-600 pb-8 mb-10">
        <div>
          <h2 className="text-3xl font-black text-blue-500 uppercase italic tracking-tighter mb-2">ROPESCORE PRO DISPLAY</h2>
          <h1 className="text-8xl font-black tracking-tight leading-none uppercase">{compData.currentOnderdeel || 'Wachten...'}</h1>
        </div>
        <div className="text-right">
          <div className="text-5xl font-black text-slate-500 uppercase italic mb-1">REEKS</div>
          <div className="text-[12rem] font-black leading-[0.8]">{compData.currentHeat || '-'}</div>
        </div>
      </div>

      {/* Grid voor velden */}
      <div className="flex-1 grid grid-cols-2 gap-10">
        {compData.slots?.map((s, idx) => {
          const p = participants[s.skipperId];
          return (
            <div key={idx} className={`p-10 rounded-[2.5rem] flex items-center gap-14 transition-all ${s.empty ? 'bg-slate-900/40 border-4 border-dashed border-slate-800 opacity-40' : 'bg-slate-900 border-b-[12px] border-blue-700 shadow-2xl shadow-blue-900/20'}`}>
              <div className="text-9xl font-black text-blue-600 opacity-90 min-w-[160px] text-center">{s.veld}</div>
              <div className="overflow-hidden">
                <div className="text-6xl font-black whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-tight mb-3">
                  {p?.naam || (s.empty ? '' : '...')}
                </div>
                <div className="text-4xl font-bold text-slate-500 uppercase tracking-wide">
                  {p?.club || ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigatie knopje (vrijwel onzichtbaar voor publiek) */}
      <button 
        onClick={onBack} 
        className="fixed bottom-4 right-4 text-slate-800 hover:text-slate-600 transition-colors p-2"
      >
        <Settings size={24} />
      </button>
    </div>
  );
}
