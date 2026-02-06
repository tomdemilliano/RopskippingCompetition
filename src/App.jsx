import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Upload, Download, Trash2, Plus, GripVertical, Users, Layers
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

const POSSIBLE_ONDERDELEN = [
  'Speed (30s)',
  'Endurance (180s)',
  'Freestyle',
  'Double under',
  'Triple under',
  'Double Dutch (DDC)'
];

export default function App() {
  const [view, setView] = useState('live'); // 'live', 'admin', 'speaker'
  const [user, setUser] = useState(null);
  const [contestData, setContestData] = useState({
    activeOnderdeelId: '',
    onderdelen: [], // Array van {id, naam, order}
    fields: [
      { id: 'f1', veld: 'Veld 1', skipperId: '', empty: true },
      { id: 'f2', veld: 'Veld 2', skipperId: '', empty: true },
      { id: 'f3', veld: 'Veld 3', skipperId: '', empty: true },
      { id: 'f4', veld: 'Veld 4', skipperId: '', empty: true },
    ]
  });
  const [participants, setParticipants] = useState({}); // {onderdeelId: [ {naam, club} ]}

  // --- AUTH ---
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

  // --- FIRESTORE SYNC ---
  useEffect(() => {
    if (!user) return;

    const contestDoc = doc(db, 'artifacts', appId, 'public', 'data', 'contest');
    const unsubContest = onSnapshot(contestDoc, (docSnap) => {
      if (docSnap.exists()) {
        setContestData(prev => ({ ...prev, ...docSnap.data() }));
      } else {
        setDoc(contestDoc, contestData);
      }
    }, (err) => console.error("Contest sync error:", err));

    const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubParticipants = onSnapshot(participantsCol, (snap) => {
      const pData = {};
      snap.forEach(doc => {
        pData[doc.id] = doc.data().list || [];
      });
      setParticipants(pData);
    }, (err) => console.error("Participants sync error:", err));

    return () => {
      unsubContest();
      unsubParticipants();
    };
  }, [user]);

  // --- ACTIES ---
  const addOnderdeel = async (naam) => {
    const newOnderdeel = {
      id: crypto.randomUUID(),
      naam,
      order: contestData.onderdelen.length
    };
    const updatedOnderdelen = [...contestData.onderdelen, newOnderdeel];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contest'), {
      onderdelen: updatedOnderdelen,
      activeOnderdeelId: contestData.activeOnderdeelId || newOnderdeel.id
    });
  };

  const deleteOnderdeel = async (id) => {
    const updatedOnderdelen = contestData.onderdelen.filter(o => o.id !== id);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contest'), {
      onderdelen: updatedOnderdelen
    });
    // Optioneel: verwijder ook deelnemers document in Firestore
  };

  const setFieldSkipper = async (fieldIndex, skipperId) => {
    const newFields = [...contestData.fields];
    newFields[fieldIndex] = { 
      ...newFields[fieldIndex], 
      skipperId, 
      empty: skipperId === '' 
    };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contest'), {
      fields: newFields
    });
  };

  const handleCsvUpload = async (onderdeelId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const list = lines.slice(1).map(line => {
        const [naam, club] = line.split(',').map(s => s.trim());
        return { naam, club };
      }).filter(p => p.naam);

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', onderdeelId), {
        list: list
      });
    };
    reader.readAsText(file);
  };

  const downloadExampleCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8,Naam,Club\nJan Janssen,Skipping Stars\nMarie Peeters,Rope Jumpers";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "voorbeeld_deelnemers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- HELPERS ---
  const currentOnderdeel = contestData.onderdelen.find(o => o.id === contestData.activeOnderdeelId);
  const currentParticipants = participants[contestData.activeOnderdeelId] || [];

  // --- VIEWS ---

  const LiveView = () => (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-400">ROPESCORE PRO</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Live Scoreboard</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black">{currentOnderdeel?.naam || 'Geen Actief Onderdeel'}</div>
          <div className="flex items-center justify-end gap-2 text-green-400">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest">Live Sync</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {contestData.fields.map((f) => {
          const skipper = currentParticipants.find(p => p.naam === f.skipperId) || { naam: f.skipperId, club: '' };
          return (
            <div key={f.id} className={`rounded-3xl p-8 flex flex-col justify-center transition-all border-l-[12px] ${f.empty ? 'bg-slate-800/50 border-slate-700 opacity-50' : 'bg-slate-800 border-blue-500 shadow-2xl shadow-blue-500/10'}`}>
              <div className="text-blue-400 font-black text-xl mb-2 uppercase tracking-widest">{f.veld}</div>
              <div className="text-6xl font-black mb-4 truncate">
                {f.empty ? <span className="text-slate-700">LEEG</span> : skipper.naam || '...'}
              </div>
              <div className="text-2xl text-slate-400 font-bold uppercase tracking-wide truncate">
                {f.empty ? '' : (skipper.club || 'Individueel')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center text-slate-500 font-medium cursor-pointer hover:text-slate-400 transition" onClick={() => setView('admin')}>
        Opgestart via Admin Paneel v2.1
      </div>
    </div>
  );

  const AdminView = () => {
    const [selectedOnderdeelName, setSelectedOnderdeelName] = useState(POSSIBLE_ONDERDELEN[0]);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Activity size={24} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Beheer Paneel</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('live')} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-lg shadow-slate-200">
              Live View <ChevronRight size={18} />
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Linker Kolom: Onderdelen & Statistieken */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-slate-600">
                <Plus size={20} className="text-blue-500" /> Onderdeel Toevoegen
              </h2>
              <div className="flex gap-2">
                <select 
                  className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-slate-700"
                  value={selectedOnderdeelName}
                  onChange={(e) => setSelectedOnderdeelName(e.target.value)}
                >
                  {POSSIBLE_ONDERDELEN.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button 
                  onClick={() => addOnderdeel(selectedOnderdeelName)}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition shadow-md shadow-blue-100"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 overflow-hidden">
              <h2 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-wide text-slate-600">
                <Layers size={20} className="text-blue-500" /> Programma
              </h2>
              <div className="space-y-2">
                {contestData.onderdelen.length === 0 && <p className="text-slate-400 italic">Geen onderdelen toegevoegd.</p>}
                {contestData.onderdelen.sort((a,b) => a.order - b.order).map((o) => {
                  const partCount = (participants[o.id] || []).length;
                  const reeksCount = Math.ceil(partCount / contestData.fields.length);
                  const isActive = contestData.activeOnderdeelId === o.id;

                  return (
                    <div 
                      key={o.id} 
                      onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contest'), { activeOnderdeelId: o.id })}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${isActive ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                    >
                      <div className="flex flex-col">
                        <span className={`font-black text-lg ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>{o.naam}</span>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase">
                            <Users size={12} /> {partCount} deelnemers
                          </span>
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase">
                            <Clock size={12} /> {reeksCount} reeksen
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteOnderdeel(o.id); }}
                        className="text-slate-300 hover:text-red-500 transition p-2"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rechter Kolom: Deelnemer Beheer & Veld Toewijzing */}
          <div className="lg:col-span-7 space-y-6">
            {!currentOnderdeel ? (
              <div className="bg-slate-200 rounded-2xl h-64 flex items-center justify-center border-4 border-dashed border-slate-300">
                <p className="font-bold text-slate-500">Selecteer een onderdeel om deelnemers te beheren.</p>
              </div>
            ) : (
              <>
                {/* CSV Sectie */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      Lijst: <span className="text-blue-600">{currentOnderdeel.naam}</span>
                    </h2>
                    <button 
                      onClick={downloadExampleCsv}
                      className="text-xs font-black text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition uppercase"
                    >
                      <Download size={14} /> Voorbeeld
                    </button>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <label className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition font-bold text-slate-600 shadow-sm">
                      <Upload size={20} /> {currentParticipants.length > 0 ? 'Lijst vervangen' : 'Upload CSV Deelnemers'}
                      <input type="file" accept=".csv" onChange={(e) => handleCsvUpload(currentOnderdeel.id, e)} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Veld Toewijzing */}
                <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl">
                  <h2 className="text-white font-black text-lg mb-4 flex items-center gap-2 uppercase tracking-widest text-blue-400">
                    <Activity size={20} /> Live Veld Toewijzing
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contestData.fields.map((f, idx) => (
                      <div key={f.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <label className="text-slate-500 font-black text-xs uppercase mb-2 block">{f.veld}</label>
                        <select 
                          className="w-full bg-slate-700 border-none text-white p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500"
                          value={f.skipperId}
                          onChange={(e) => setFieldSkipper(idx, e.target.value)}
                        >
                          <option value="">-- Geen --</option>
                          {currentParticipants.map((p, pIdx) => (
                            <option key={pIdx} value={p.naam}>{p.naam} ({p.club})</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const newFields = contestData.fields.map(f => ({ ...f, skipperId: '', empty: true }));
                      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'contest'), { fields: newFields });
                    }}
                    className="w-full mt-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-black hover:bg-red-500 hover:text-white transition uppercase text-sm border border-red-500/20"
                  >
                    Alle velden leegmaken
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  };

  const SpeakerView = () => (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-black text-slate-900 uppercase">Speaker Dashboard</h1>
        <button onClick={() => setView('admin')} className="p-2 bg-white rounded-lg shadow"><ChevronLeft /></button>
      </div>
      
      <div className="bg-white rounded-3xl p-8 shadow-xl mb-8">
        <h2 className="text-blue-600 font-black uppercase text-sm mb-4">Nu aan de slag</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {contestData.fields.map(f => {
            const skipper = currentParticipants.find(p => p.naam === f.skipperId);
            return (
              <div key={f.id} className="border-b-4 border-slate-100 pb-4">
                <span className="text-slate-400 font-black text-sm uppercase">{f.veld}</span>
                <div className="text-3xl font-black text-slate-800">{f.empty ? '---' : f.skipperId}</div>
                <div className="text-lg text-slate-400 font-bold uppercase">{f.empty ? '' : (skipper?.club || 'Club onbekend')}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-3xl p-8 text-white overflow-hidden flex flex-col">
        <h2 className="text-slate-400 font-black uppercase text-sm mb-4">Volledige Lijst ({currentOnderdeel?.naam})</h2>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {currentParticipants.map((p, i) => {
            const isActive = contestData.fields.some(f => f.skipperId === p.naam);
            return (
              <div key={i} className={`flex justify-between items-center p-3 rounded-xl ${isActive ? 'bg-blue-600 font-bold' : 'bg-slate-700/50'}`}>
                <span>{p.naam}</span>
                <span className="text-xs opacity-60 uppercase">{p.club}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (view === 'admin') return <AdminView />;
  if (view === 'speaker') return <SpeakerView />;
  return <LiveView />;
}
