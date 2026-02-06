import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Upload, Users, Hash, Trash2
} from 'lucide-react';

// --- FIREBASE CONFIGURATIE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

// --- MOGELIJKE ONDERDELEN ---
const POSSIBLE_ONDERDELEN = [
  'Speed',
  'Endurance',
  'Freestyle',
  'Double under',
  'Triple under',
  'DDC Speed',
  'DDC Freestyle',
  'Wheel',
  'Show'
];

export default function App() {
  const [view, setView] = useState('live');
  const [user, setUser] = useState(null);
  const [contest, setContest] = useState(null);
  const [participants, setParticipants] = useState({});
  const [loading, setLoading] = useState(true);

  // Auth setup
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
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data sync
  useEffect(() => {
    if (!user) return;

    // Corrected path: collection 'artifacts', doc 'appId', collection 'public', doc 'data', collection 'items', doc 'currentContest'
    // Or simplified to even segments: artifacts / {appId} / public / data
    const contestRef = doc(db, 'artifacts', appId, 'public', 'data');
    
    const unsubContest = onSnapshot(contestRef, (docSnap) => {
      if (docSnap.exists()) {
        setContest(docSnap.data());
      } else {
        const initial = {
          naam: 'Nieuwe Wedstrijd',
          onderdelen: [],
          actiefOnderdeel: '',
          huidigeReeks: 1,
          velden: 6,
          status: 'klaar'
        };
        setDoc(contestRef, initial);
      }
      setLoading(false);
    }, (err) => console.error("Contest sync error:", err));

    // Corrected path for collection: artifacts / {appId} / public / data / participants (5 segments)
    // Firestore needs even for doc, odd for collection. 
    // The previous error was using doc() with 5 segments.
    const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    
    const unsubParts = onSnapshot(partsRef, (querySnap) => {
      const p = {};
      querySnap.forEach(doc => {
        p[doc.id] = doc.data();
      });
      setParticipants(p);
    }, (err) => console.error("Participants sync error:", err));

    return () => {
      unsubContest();
      unsubParts();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-blue-600 animate-pulse" />
          <p className="text-slate-500 font-medium">Laden...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'manage': return <ManageView contest={contest} participants={participants} setView={setView} />;
      case 'display': return <DisplayView contest={contest} participants={participants} setView={setView} />;
      default: return <LiveView contest={contest} participants={participants} setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {renderView()}
    </div>
  );
}

// --- VIEW: LIVE (ONGEWIJZIGD) ---
function LiveView({ contest, participants, setView }) {
  const currentSlots = useMemo(() => {
    const slots = [];
    const pArray = Object.values(participants).filter(p => 
      p.onderdeel === contest.actiefOnderdeel && p.reeks === contest.huidigeReeks
    );

    for (let i = 1; i <= contest.velden; i++) {
      const p = pArray.find(x => x.veld === i);
      slots.push({
        veld: i,
        skipperId: p?.id || null,
        empty: !p
      });
    }
    return slots;
  }, [contest, participants]);

  const updateReeks = async (val) => {
    const newReeks = Math.max(1, contest.huidigeReeks + val);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data'), {
      huidigeReeks: newReeks
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Trophy className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{contest.naam}</h1>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{contest.actiefOnderdeel || 'Geen onderdeel'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('manage')} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">Instellingen</button>
          <button onClick={() => setView('display')} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-transform active:scale-95">Display</button>
        </div>
      </div>

      {/* Reeks Selector */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center gap-4">
        <span className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Huidige Reeks</span>
        <div className="flex items-center gap-8">
          <button onClick={() => updateReeks(-1)} className="p-4 rounded-2xl bg-slate-50 text-slate-900 hover:bg-slate-100 transition-all active:scale-90 border border-slate-100">
            <ChevronLeft size={32} />
          </button>
          <span className="text-7xl font-black tabular-nums tracking-tighter text-blue-600">{contest.huidigeReeks}</span>
          <button onClick={() => updateReeks(1)} className="p-4 rounded-2xl bg-slate-50 text-slate-900 hover:bg-slate-100 transition-all active:scale-90 border border-slate-100">
            <ChevronRight size={32} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pb-4">
        {currentSlots.map((s) => (
          <div key={s.veld} className={`relative flex items-center p-4 rounded-2xl border transition-all ${
            s.empty ? 'bg-slate-50 border-slate-100 opacity-40' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-black text-lg mr-4 border border-blue-100">
              {s.veld}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Skipper</p>
              <h3 className="font-bold text-lg truncate leading-tight">
                {s.empty ? 'Leeg' : (participants[s.skipperId]?.naam || 'Laden...')}
              </h3>
              {!s.empty && (
                <p className="text-slate-500 text-sm font-medium truncate mt-0.5">
                  {participants[s.skipperId]?.club}
                </p>
              )}
            </div>
            {!s.empty && <CheckCircle2 className="text-emerald-500 w-5 h-5 absolute top-4 right-4" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- VIEW: DISPLAY (ONGEWIJZIGD) ---
function DisplayView({ contest, participants, setView }) {
  const currentSlots = useMemo(() => {
    const slots = [];
    const pArray = Object.values(participants).filter(p => 
      p.onderdeel === contest.actiefOnderdeel && p.reeks === contest.huidigeReeks
    );
    for (let i = 1; i <= contest.velden; i++) {
      const p = pArray.find(x => x.veld === i);
      slots.push({ veld: i, skipperId: p?.id || null, empty: !p });
    }
    return slots;
  }, [contest, participants]);

  return (
    <div className="fixed inset-0 bg-[#0f172a] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div style={{ padding: '2vh 4vw', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{contest.naam}</div>
          <div style={{ fontSize: '5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{contest.actiefOnderdeel || 'Geen onderdeel'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Huidige Reeks</div>
          <div style={{ fontSize: '7rem', fontWeight: 900, lineHeight: 0.9, color: '#3b82f6' }}>{contest.huidigeReeks}</div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: '3vh 4vw', display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: '1.5rem' }}>
        {currentSlots.map(s => (
          <div key={s.veld} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0 2rem', 
            borderRadius: '1.5rem', 
            backgroundColor: s.empty ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: s.empty ? '2px dashed rgba(255,255,255,0.05)' : 'none',
            opacity: s.empty ? 0.3 : 1
          }}>
            <div style={{ 
              width: '4.5rem', 
              height: '4.5rem', 
              borderRadius: '50%', 
              backgroundColor: '#3b82f6', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '2.5rem', 
              fontWeight: 900,
              marginRight: '2rem',
              boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
            }}>
              {s.veld}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.empty ? '' : (participants[s.skipperId]?.naam || '...')}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {s.empty ? '' : (participants[s.skipperId]?.club || '')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Control overlay hidden during display */}
      <button onClick={() => setView('live')} className="fixed bottom-4 right-4 opacity-0 hover:opacity-100 bg-white/10 p-4 rounded-full">X</button>
    </div>
  );
}

// --- VIEW: MANAGE (GEWIJZIGD) ---
function ManageView({ contest, participants, setView }) {
  const [newOnderdeel, setNewOnderdeel] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [targetOnderdeel, setTargetOnderdeel] = useState(null);

  const saveContest = async (updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data'), updates);
  };

  const addOnderdeel = async () => {
    if (!newOnderdeel) return;
    const list = [...(contest.onderdelen || [])];
    if (!list.includes(newOnderdeel)) {
      list.push(newOnderdeel);
      await saveContest({ onderdelen: list });
    }
    setNewOnderdeel('');
  };

  const removeOnderdeel = async (ond) => {
    const list = (contest.onderdelen || []).filter(o => o !== ond);
    await saveContest({ onderdelen: list });
  };

  // CSV Import Logic
  const handleFileUpload = (e, onderdeel) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setIsUploading(true);
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      
      const batch = writeBatch(db);
      
      lines.forEach((line, index) => {
        const [naam, club, reeks, veld] = line.split(',').map(s => s.trim());
        if (naam && reeks) {
          const id = `p_${onderdeel}_${index}_${Date.now()}`;
          // Correct path: artifacts / {appId} / public / data / participants / {id}
          const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', id);
          batch.set(pRef, {
            id,
            naam,
            club: club || '',
            reeks: parseInt(reeks) || 1,
            veld: parseInt(veld) || (index % contest.velden) + 1,
            onderdeel: onderdeel
          });
        }
      });

      try {
        await batch.commit();
      } catch (err) {
        console.error("Batch error:", err);
      } finally {
        setIsUploading(false);
        e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  // Helper om stats te berekenen per onderdeel
  const getStats = (onderdeel) => {
    const relevant = Object.values(participants).filter(p => p.onderdeel === onderdeel);
    const deelnemers = relevant.length;
    const reeksen = new Set(relevant.map(p => p.reeks)).size;
    return { deelnemers, reeksen };
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('live')} className="flex items-center text-slate-500 font-bold hover:text-slate-900 transition-colors">
          <ChevronLeft className="mr-1" /> Terug naar Live
        </button>
        <h2 className="text-2xl font-black">Beheer</h2>
      </div>

      {/* Algemene Info */}
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest">
          <Info size={16} /> Algemene Informatie
        </h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Naam Wedstrijd</label>
            <input 
              className="w-full bg-slate-50 border-none rounded-xl p-3 font-semibold focus:ring-2 ring-blue-500 transition-all"
              value={contest.naam || ''}
              onChange={(e) => saveContest({ naam: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Aantal Velden</label>
              <input 
                type="number"
                className="w-full bg-slate-50 border-none rounded-xl p-3 font-semibold focus:ring-2 ring-blue-500"
                value={contest.velden || 1}
                onChange={(e) => saveContest({ velden: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Actief Onderdeel</label>
              <select 
                className="w-full bg-slate-50 border-none rounded-xl p-3 font-semibold focus:ring-2 ring-blue-500 appearance-none"
                value={contest.actiefOnderdeel || ''}
                onChange={(e) => saveContest({ actiefOnderdeel: e.target.value })}
              >
                <option value="">Kies onderdeel...</option>
                {contest.onderdelen?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Onderdelen Beheer */}
      <section className="space-y-4">
        <h3 className="font-bold flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest">
          <Activity size={16} /> Onderdelen & Deelnemers
        </h3>
        
        <div className="flex gap-2">
          <select 
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-semibold focus:ring-2 ring-blue-500"
            value={newOnderdeel}
            onChange={(e) => setNewOnderdeel(e.target.value)}
          >
            <option value="">Selecteer onderdeel...</option>
            {POSSIBLE_ONDERDELEN.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <button 
            onClick={addOnderdeel}
            className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Toevoegen
          </button>
        </div>

        <div className="space-y-3">
          {contest.onderdelen?.map(ond => {
            const stats = getStats(ond);
            return (
              <div key={ond} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-lg text-slate-900">{ond}</span>
                  </div>
                  <button onClick={() => removeOnderdeel(ond)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Users size={16} className="text-blue-500" />
                    <span className="text-sm font-bold">{stats.deelnemers} <span className="font-medium text-slate-400">deelnemers</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Hash size={16} className="text-blue-500" />
                    <span className="text-sm font-bold">{stats.reeksen} <span className="font-medium text-slate-400">reeksen</span></span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-50">
                  <label className="flex items-center justify-center gap-2 w-full bg-slate-50 hover:bg-slate-100 py-2 rounded-lg cursor-pointer transition-colors text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <Upload size={14} />
                    {isUploading ? 'Bezig met laden...' : 'CSV Deelnemers Laden'}
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, ond)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CSV Handleiding */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
        <h4 className="text-blue-700 font-bold text-sm mb-1 flex items-center gap-2">
          <Info size={14} /> CSV Formaat handleiding
        </h4>
        <p className="text-blue-600/70 text-xs font-medium">
          Gebruik een CSV met kolommen: <code className="bg-blue-100 px-1 rounded">Naam, Club, Reeks, Veld</code>. 
          Deelnemers worden direct gekoppeld aan het betreffende onderdeel.
        </p>
      </div>
    </div>
  );
}
