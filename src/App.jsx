import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Trash2, Plus, Upload, Download
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

// --- MOGELIJKE ONDERDELEN ---
const POSSIBLE_ONDERDELEN = [
  'Speed', 'Endurance', 'Freestyle', 'Double under', 'Triple under', 'DDC', 'DD4'
];

export default function App() {
  const [view, setView] = useState('live'); 
  const [user, setUser] = useState(null);
  
  // State conform origineel, uitgebreid met lijst onderdelen
  const [status, setStatus] = useState({
    activeOnderdeel: 'Speed',
    activeOnderdeelId: 'default',
    onderdelen: [{ id: 'default', naam: 'Speed' }],
    fields: [
      { id: 'f1', veld: 'Veld 1', skipperId: '', empty: true },
      { id: 'f2', veld: 'Veld 2', skipperId: '', empty: true },
      { id: 'f3', veld: 'Veld 3', skipperId: '', empty: true },
      { id: 'f4', veld: 'Veld 4', skipperId: '', empty: true },
    ]
  });

  const [participants, setParticipants] = useState({}); // { onderdeelId: { skipperId: {naam, club} } }

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

    // FIX: Gebruik een pad met 4 segmenten (Collectie/Doc/Collectie/Doc)
    // artifacts (1) / {appId} (2) / public (3) / status (4)
    const statusRef = doc(db, 'artifacts', appId, 'public', 'status');
    const unsubStatus = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        setStatus(prev => ({ ...prev, ...docSnap.data() }));
      } else {
        setDoc(statusRef, status);
      }
    }, (err) => console.error("Status Sync Error:", err));

    // artifacts (1) / {appId} (2) / public (3) / participants (4)
    const partRef = doc(db, 'artifacts', appId, 'public', 'participants');
    const unsubPart = onSnapshot(partRef, (docSnap) => {
      if (docSnap.exists()) {
        setParticipants(docSnap.data());
      } else {
        setDoc(partRef, {});
      }
    }, (err) => console.error("Participants Sync Error:", err));

    return () => {
      unsubStatus();
      unsubPart();
    };
  }, [user]);

  // --- ACTIONS ---
  const updateStatus = async (newData) => {
    if (!user) return;
    const statusRef = doc(db, 'artifacts', appId, 'public', 'status');
    await updateDoc(statusRef, newData);
  };

  const addOnderdeel = async (naam) => {
    const id = crypto.randomUUID();
    const newOnderdelen = [...(status.onderdelen || []), { id, naam }];
    await updateStatus({ onderdelen: newOnderdelen });
  };

  const deleteOnderdeel = async (id) => {
    const newOnderdelen = status.onderdelen.filter(o => o.id !== id);
    // Indien het actieve onderdeel verwijderd wordt, reset naar de eerste in de lijst of leeg
    const newActiveId = status.activeOnderdeelId === id ? (newOnderdelen[0]?.id || '') : status.activeOnderdeelId;
    const newActiveNaam = status.activeOnderdeelId === id ? (newOnderdelen[0]?.naam || '') : status.activeOnderdeel;
    
    await updateStatus({ 
      onderdelen: newOnderdelen, 
      activeOnderdeelId: newActiveId,
      activeOnderdeel: newActiveNaam 
    });
  };

  const setField = async (fIndex, skipperId) => {
    const newFields = [...status.fields];
    newFields[fIndex] = { ...newFields[fIndex], skipperId, empty: skipperId === '' };
    await updateStatus({ fields: newFields });
  };

  const handleCsvUpload = (onderdeelId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').map(r => r.split(','));
      const newPartList = {};
      rows.slice(1).forEach((cols, idx) => {
        if (cols[0] && cols[0].trim() !== "") {
          const id = `s_${onderdeelId}_${idx}`;
          newPartList[id] = { naam: cols[0].trim(), club: cols[1]?.trim() || '' };
        }
      });
      
      const partRef = doc(db, 'artifacts', appId, 'public', 'participants');
      await updateDoc(partRef, { [onderdeelId]: newPartList });
    };
    reader.readAsText(file);
  };

  const downloadSample = () => {
    const blob = new Blob(["Naam,Club\nJan Janssen,Skipping Club\nMarie Peeters,Rope Jumpers"], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "voorbeeld_deelnemers.csv";
    a.click();
  };

  // Helpers
  const currentPartList = participants[status.activeOnderdeelId] || {};
  const currentOnderdeelObj = status.onderdelen?.find(o => o.id === status.activeOnderdeelId) || status.onderdelen?.[0];

  // --- UI COMPONENTS ---

  const LiveView = () => (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.05em', color: '#3b82f6' }}>ROPESCORE PRO</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Scoreboard</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{currentOnderdeelObj?.naam || status.activeOnderdeel}</div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>● LIVE SYNC</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        {status.fields.map((f) => {
          const skipper = currentPartList[f.skipperId] || { naam: '', club: '' };
          return (
            <div key={f.id} style={{ 
              backgroundColor: '#1e293b', 
              borderRadius: '2rem', 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              borderLeft: f.empty ? '10px solid #334155' : '10px solid #3b82f6',
              opacity: f.empty ? 0.4 : 1
            }}>
              <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.5rem' }}>{f.veld}</div>
              <div style={{ fontSize: '4rem', fontWeight: 900, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {f.empty ? '---' : skipper.naam}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#94a3b8' }}>
                {f.empty ? '' : skipper.club}
              </div>
            </div>
          );
        })}
      </div>
      <div onClick={() => setView('admin')} style={{ textAlign: 'center', marginTop: '1rem', color: '#334155', cursor: 'pointer', fontWeight: 700 }}>ADMIN</div>
    </div>
  );

  const AdminView = () => {
    const [tempOnderdeel, setTempOnderdeel] = useState(POSSIBLE_ONDERDELEN[0]);

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
        <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="#2563eb" size={24} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase' }}>Contest Manager</h1>
          </div>
          <button onClick={() => setView('live')} style={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>LIVE VIEW</button>
        </header>

        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
          
          {/* Kolom 1: Programma */}
          <section>
            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Onderdeel Toevoegen</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select value={tempOnderdeel} onChange={e => setTempOnderdeel(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontWeight: 700 }}>
                  {POSSIBLE_ONDERDELEN.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <button onClick={() => addOnderdeel(tempOnderdeel)} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}><Plus size={20}/></button>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Wedstrijd Programma</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {status.onderdelen?.map(o => {
                  const isActive = status.activeOnderdeelId === o.id;
                  const count = Object.keys(participants[o.id] || {}).length;
                  return (
                    <div key={o.id} onClick={() => updateStatus({ activeOnderdeelId: o.id, activeOnderdeel: o.naam })} style={{ 
                      padding: '1rem', borderRadius: '0.8rem', cursor: 'pointer', border: isActive ? '2px solid #2563eb' : '1px solid #f1f5f9',
                      backgroundColor: isActive ? '#eff6ff' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{o.naam}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>{count} DEELNEMERS • {Math.ceil(count/4)} REEKSEN</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteOnderdeel(o.id); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={18}/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Kolom 2: Deelnemers & Velden */}
          <section>
            {currentOnderdeelObj ? (
              <>
                <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>LIST: {currentOnderdeelObj.naam}</h2>
                    <button onClick={downloadSample} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', cursor: 'pointer' }}>Voorbeeld CSV</button>
                   </div>
                   <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', border: '2px dashed #e2e8f0', borderRadius: '1rem', cursor: 'pointer', fontWeight: 700, color: '#64748b' }}>
                     <Upload size={18}/> {Object.keys(currentPartList).length > 0 ? 'Update Lijst' : 'Upload CSV'}
                     <input type="file" style={{ display: 'none' }} onChange={e => handleCsvUpload(currentOnderdeelObj.id, e)} />
                   </label>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '1.5rem', color: '#fff' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>Live Veld Toewijzing</h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {status.fields.map((f, i) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#1e293b', padding: '0.8rem', borderRadius: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 900, minWidth: '60px' }}>{f.veld}</span>
                        <select 
                          value={f.skipperId} 
                          onChange={e => setField(i, e.target.value)}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: '#334155', color: '#fff', border: 'none', fontWeight: 700 }}
                        >
                          <option value="">-- LEEG --</option>
                          {Object.entries(currentPartList).map(([id, p]) => (
                            <option key={id} value={id}>{p.naam}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => status.fields.forEach((_,i) => setField(i, ''))} style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', borderRadius: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 800, cursor: 'pointer' }}>CLEAR ALL FIELDS</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>SELECTEER EEN ONDERDEEL OM TE BEGINNEN</div>
            )}
          </section>
        </main>
      </div>
    );
  };

  if (view === 'admin') return <AdminView />;
  return <LiveView />;
}
