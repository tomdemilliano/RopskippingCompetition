import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, setDoc, getDoc, addDoc, deleteDoc, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, Clock, Upload, Download, Trash2, Plus, Users, Layers
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
    onderdelen: [], 
    fields: [
      { id: 'f1', veld: 'Veld 1', skipperId: '', empty: true },
      { id: 'f2', veld: 'Veld 2', skipperId: '', empty: true },
      { id: 'f3', veld: 'Veld 3', skipperId: '', empty: true },
      { id: 'f4', veld: 'Veld 4', skipperId: '', empty: true },
    ]
  });
  const [participants, setParticipants] = useState({}); 

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

    // RULE 1 compliant paths: /artifacts/{appId}/public/data
    // We gebruiken 'data' als de collectie en 'contest'/'participants' als documenten of sub-paden
    const contestDocRef = doc(db, 'artifacts', appId, 'public', 'data'); 
    
    // Omdat we maar 1 document kunnen hebben in dit specifieke pad-formaat, 
    // slaan we de hele status op in één document genaamd 'main_state'
    const mainStateDoc = doc(db, 'artifacts', appId, 'public', 'main_state');

    const unsub = onSnapshot(mainStateDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setContestData(prev => ({ ...prev, ...data.contest }));
        setParticipants(data.participants || {});
      } else {
        setDoc(mainStateDoc, { contest: contestData, participants: {} });
      }
    }, (err) => console.error("Sync error:", err));

    return () => unsub();
  }, [user]);

  // --- ACTIES ---
  const saveState = async (newContest, newParts) => {
    if (!user) return;
    const mainStateDoc = doc(db, 'artifacts', appId, 'public', 'main_state');
    await updateDoc(mainStateDoc, {
      contest: newContest || contestData,
      participants: newParts || participants
    });
  };

  const addOnderdeel = async (naam) => {
    const newOnderdeel = {
      id: crypto.randomUUID(),
      naam,
      order: contestData.onderdelen.length
    };
    const updatedOnderdelen = [...contestData.onderdelen, newOnderdeel];
    const newContest = {
      ...contestData,
      onderdelen: updatedOnderdelen,
      activeOnderdeelId: contestData.activeOnderdeelId || newOnderdeel.id
    };
    await saveState(newContest, null);
  };

  const deleteOnderdeel = async (id) => {
    const updatedOnderdelen = contestData.onderdelen.filter(o => o.id !== id);
    const newParts = { ...participants };
    delete newParts[id];
    const newContest = { ...contestData, onderdelen: updatedOnderdelen };
    await saveState(newContest, newParts);
  };

  const setFieldSkipper = async (fieldIndex, skipperId) => {
    const newFields = [...contestData.fields];
    newFields[fieldIndex] = { 
      ...newFields[fieldIndex], 
      skipperId, 
      empty: skipperId === '' 
    };
    await saveState({ ...contestData, fields: newFields }, null);
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

      const newParts = { ...participants, [onderdeelId]: list };
      await saveState(null, newParts);
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

  // --- VIEWS (LIVE) ---
  const LiveView = () => (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col font-sans">
      <div className="flex justify-between items-center mb-12 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-blue-400">ROPESCORE PRO</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest mt-1">Live Tracking</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black">{currentOnderdeel?.naam || 'Wachten op start...'}</div>
          <div className="flex items-center justify-end gap-2 text-green-400 mt-1">
            <span className="text-xs font-bold uppercase tracking-widest">Verbonden</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        {contestData.fields.map((f) => {
          const skipper = currentParticipants.find(p => p.naam === f.skipperId) || { naam: f.skipperId, club: '' };
          return (
            <div key={f.id} className={`rounded-[2rem] p-10 flex flex-col justify-center transition-all border-l-[16px] ${f.empty ? 'bg-slate-800/30 border-slate-700 opacity-40' : 'bg-slate-800 border-blue-500 shadow-2xl shadow-blue-500/20'}`}>
              <div className="text-blue-400 font-black text-2xl mb-4 uppercase tracking-widest">{f.veld}</div>
              <div className="text-7xl font-black mb-4 truncate leading-tight">
                {f.empty ? <span className="text-slate-700">STBY</span> : (skipper.naam || '...')}
              </div>
              <div className="text-3xl text-slate-400 font-bold uppercase tracking-wide truncate">
                {f.empty ? '' : (skipper.club || 'Individueel')}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-center text-slate-600 font-bold uppercase tracking-widest text-sm cursor-pointer" onClick={() => setView('admin')}>
        Admin Access
      </div>
    </div>
  );

  // --- VIEWS (ADMIN) ---
  const AdminView = () => {
    const [selectedOnderdeelName, setSelectedOnderdeelName] = useState(POSSIBLE_ONDERDELEN[0]);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white"><Activity size={24} /></div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Wedstrijd Beheer</h1>
          </div>
          <button onClick={() => setView('live')} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition">
            Live Scherm <ChevronRight size={18} />
          </button>
        </header>

        <main className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Programma Kolom */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-slate-400">Nieuw Onderdeel</h2>
              <div className="flex gap-2">
                <select 
                  className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold"
                  value={selectedOnderdeelName}
                  onChange={(e) => setSelectedOnderdeelName(e.target.value)}
                >
                  {POSSIBLE_ONDERDELEN.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => addOnderdeel(selectedOnderdeelName)} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">
                  <Plus size={24} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-sm font-black mb-4 uppercase tracking-widest text-slate-400">Wedstrijd Programma</h2>
              <div className="space-y-3">
                {contestData.onderdelen.length === 0 && <p className="text-slate-400 italic text-center py-4">Geen onderdelen.</p>}
                {contestData.onderdelen.map((o) => {
                  const pList = participants[o.id] || [];
                  const reeksCount = Math.ceil(pList.length / 4);
                  const isActive = contestData.activeOnderdeelId === o.id;
                  return (
                    <div 
                      key={o.id} 
                      onClick={() => saveState({ ...contestData, activeOnderdeelId: o.id }, null)}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${isActive ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <div>
                        <div className={`font-black text-xl ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>{o.naam}</div>
                        <div className="flex gap-4 mt-1 text-xs font-bold text-slate-400 uppercase">
                          <span className="flex items-center gap-1"><Users size={12}/> {pList.length}</span>
                          <span className="flex items-center gap-1"><Layers size={12}/> {reeksCount} reeksen</span>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteOnderdeel(o.id); }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Deelnemer Kolom */}
          <div className="lg:col-span-7 space-y-6">
            {!currentOnderdeel ? (
              <div className="bg-slate-100 rounded-[2rem] h-64 flex items-center justify-center border-4 border-dashed border-slate-200">
                <p className="font-bold text-slate-400 uppercase tracking-widest">Selecteer een onderdeel</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black uppercase">Lijst: {currentOnderdeel.naam}</h2>
                    <button onClick={downloadExampleCsv} className="text-blue-600 font-black text-xs uppercase flex items-center gap-1"><Download size={14}/> Voorbeeld CSV</button>
                  </div>
                  <label className="w-full flex items-center justify-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition font-black text-slate-500 uppercase tracking-tight">
                    <Upload size={24} /> {currentParticipants.length > 0 ? 'Lijst Bijwerken' : 'Deelnemers Uploaden'}
                    <input type="file" accept=".csv" onChange={(e) => handleCsvUpload(currentOnderdeel.id, e)} className="hidden" />
                  </label>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl">
                  <h2 className="text-blue-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2"><Clock size={16}/> Nu op de vloer</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contestData.fields.map((f, idx) => (
                      <div key={f.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                        <label className="text-slate-500 font-black text-[10px] uppercase mb-2 block">{f.veld}</label>
                        <select 
                          className="w-full bg-slate-700 border-none text-white p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 text-sm"
                          value={f.skipperId}
                          onChange={(e) => setFieldSkipper(idx, e.target.value)}
                        >
                          <option value="">-- LEEG --</option>
                          {currentParticipants.map((p, pIdx) => (
                            <option key={pIdx} value={p.naam}>{p.naam}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setFieldSkipper(0,'') || setFieldSkipper(1,'') || setFieldSkipper(2,'') || setFieldSkipper(3,'')} className="w-full mt-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-black uppercase text-xs border border-red-500/20 hover:bg-red-500 hover:text-white transition">Alle velden vrijgeven</button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  };

  if (view === 'admin') return <AdminView />;
  return <LiveView />;
}
