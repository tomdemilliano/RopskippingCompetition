import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Plus, Trash2, Upload
} from 'lucide-react';

// --- FIREBASE CONFIGURATIE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
  authDomain: "ropeskippingcontest.firebaseapp.com",
  projectId: "ropeskippingcontest",
  storageBucket: "ropeskippingcontest.firebasestorage.app",
  messagingSenderId: "430066523717",
  appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

export default function App() {
  const [view, setView] = useState('live'); // 'live', 'admin', 'display'
  const [user, setUser] = useState(null);
  const [newOnderdeelNaam, setNewOnderdeelNaam] = useState('');
  
  const [status, setStatus] = useState({
    activeOnderdeel: 'Speed',
    status: 'In afwachting',
    onderdelenLijst: ['Speed', 'Endurance', 'Freestyle'],
    fields: [
      { id: 'f1', veld: 'Veld 1', skipperId: '', empty: true },
      { id: 'f2', veld: 'Veld 2', skipperId: '', empty: true },
      { id: 'f3', veld: 'Veld 3', skipperId: '', empty: true },
      { id: 'f4', veld: 'Veld 4', skipperId: '', empty: true },
    ]
  });

  const [onderdeelData, setOnderdeelData] = useState({}); // Stores skippers per onderdeel

  // --- INITIALISATIE ---
  useEffect(() => {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);

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

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubAuth();
  }, []);

  // --- SYNC DATA ---
  useEffect(() => {
    if (!user) return;

    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'status');
    const unsubStatus = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        setStatus(docSnap.data());
      } else {
        setDoc(statusRef, status);
      }
    });

    const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'onderdeel_skippers');
    const unsubData = onSnapshot(dataRef, (docSnap) => {
      if (docSnap.exists()) {
        setOnderdeelData(docSnap.data());
      } else {
        setDoc(dataRef, {});
      }
    });

    return () => {
      unsubStatus();
      unsubData();
    };
  }, [user]);

  // --- ACTIONS ---
  const updateStatus = async (newData) => {
    if (!user) return;
    const statusRef = doc(db, 'artifacts', appId, 'public', 'data', 'status');
    await updateDoc(statusRef, newData);
  };

  const setField = async (fieldId, skipperId) => {
    const newFields = status.fields.map(f => {
      if (f.id === fieldId) {
        return { ...f, skipperId, empty: skipperId === '' };
      }
      return f;
    });
    await updateStatus({ fields: newFields });
  };

  const clearAllFields = async () => {
    const newFields = status.fields.map(f => ({ ...f, skipperId: '', empty: true }));
    await updateStatus({ fields: newFields, status: 'In afwachting' });
  };

  const setOnderdeel = async (naam) => {
    await updateStatus({ activeOnderdeel: naam });
  };

  const voegOnderdeelToe = async () => {
    if (!newOnderdeelNaam.trim()) return;
    const nieuweLijst = [...(status.onderdelenLijst || []), newOnderdeelNaam.trim()];
    await updateStatus({ onderdelenLijst: nieuweLijst });
    setNewOnderdeelNaam('');
  };

  const verwijderOnderdeel = async (naam) => {
    const nieuweLijst = status.onderdelenLijst.filter(o => o !== naam);
    await updateStatus({ 
      onderdelenLijst: nieuweLijst,
      activeOnderdeel: status.activeOnderdeel === naam ? (nieuweLijst[0] || '') : status.activeOnderdeel
    });
  };

  const handleCsvUpload = (e, onderdeelNaam) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').map(r => r.split(','));
      
      const skippersLijst = [];
      rows.forEach((row, idx) => {
        if (idx === 0) return; // skip header
        if (row[0] && row[0].trim() !== '') {
          skippersLijst.push({
            id: `s_${onderdeelNaam}_${idx}`,
            naam: row[0].trim(),
            club: row[1]?.trim() || ''
          });
        }
      });

      if (skippersLijst.length > 0) {
        const dataRef = doc(db, 'artifacts', appId, 'public', 'data', 'onderdeel_skippers');
        await updateDoc(dataRef, {
          [onderdeelNaam]: skippersLijst
        });
      }
    };
    reader.readAsText(file);
  };

  // Get skippers for active onderdeel
  const currentSkippers = onderdeelData[status.activeOnderdeel] || [];

  // --- VIEWS ---

  // 1. LIVE BOARD VIEW (EXACT AS SOURCE)
  const LiveView = () => (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif', padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.05em', color: '#3b82f6' }}>ROPESCORE PRO</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Scoreboard Hub</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{status.activeOnderdeel}</div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>● SYNC ACTIEF</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        {status.fields.map((f) => {
          const skipper = currentSkippers.find(s => s.id === f.skipperId) || { naam: '', club: '' };
          return (
            <div key={f.id} style={{ 
              backgroundColor: '#1e293b', 
              borderRadius: '2rem', 
              padding: '2.5rem', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              borderLeft: f.empty ? '12px solid #334155' : '12px solid #3b82f6',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              opacity: f.empty ? 0.4 : 1,
              transition: 'all 0.4s ease'
            }}>
              <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1.2rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{f.veld}</div>
              <div style={{ fontSize: '4.5rem', fontWeight: 900, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                {f.empty ? '---' : skipper.naam}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#94a3b8' }}>
                {f.empty ? 'Leeg veld' : skipper.club}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setView('admin')} style={{ background: '#1e293b', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>BEHEER</button>
      </div>
    </div>
  );

  // 2. DISPLAY VIEW (EXACT AS SOURCE)
  const DisplayView = () => (
    <div style={{ height: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: 'sans-serif', padding: '2rem', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '2rem', left: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ width: '60px', height: '60px', backgroundColor: '#2563eb', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={36} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Official Timing System</div>
        </div>
      </div>

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '1rem' }}>Huidig Onderdeel</div>
          <div style={{ fontSize: '8rem', fontWeight: 900, letterSpacing: '-0.05em', textTransform: 'uppercase', lineHeight: 1 }}>{status.activeOnderdeel}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3rem' }}>
          {status.fields.map((s) => {
             const skipper = currentSkippers.find(sk => sk.id === s.skipperId) || { naam: '', club: '' };
             return (
              <div key={s.id} style={{ 
                backgroundColor: '#0a0a0a', 
                padding: '4.5rem', 
                borderRadius: '5rem', 
                border: s.empty ? '4px solid #111' : '4px solid #2563eb',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxShadow: s.empty ? 'none' : '0 0 80px rgba(37, 99, 235, 0.15)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#2563eb', marginBottom: '1.5rem', textTransform: 'uppercase' }}>{s.veld}</div>
                <div style={{ fontSize: '6rem', fontWeight: 900, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                  {s.empty ? <span style={{ opacity: 0.05 }}>Wachten...</span> : skipper.naam}
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 700, color: '#333' }}>
                  {!s.empty && skipper.club}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div onClick={() => setView('live')} style={{ position: 'absolute', bottom: '2rem', right: '2rem', width: '40px', height: '40px', cursor: 'pointer', opacity: 0.05 }}></div>
    </div>
  );

  // 3. ADMIN / BEHEER VIEW (MODIFIED AS REQUESTED)
  const AdminView = () => (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#0f172a', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity color="#3b82f6" size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Beheer Terminal</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setView('live')} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>LIVE BOARD</button>
          <button onClick={() => setView('display')} style={{ backgroundColor: '#0f172a', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>OPEN DISPLAY</button>
        </div>
      </div>

      <main style={{ padding: '2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Onderdelen Beheer */}
            <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Trophy size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Onderdelen</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <input 
                    type="text" 
                    value={newOnderdeelNaam} 
                    onChange={(e) => setNewOnderdeelNaam(e.target.value)}
                    placeholder="Nieuw onderdeel..."
                    style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
                   />
                   <button onClick={voegOnderdeelToe} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer' }}><Plus size={18}/></button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {(status.onderdelenLijst || []).map(o => (
                  <div key={o} style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setOnderdeel(o)}
                      style={{ 
                        width: '100%',
                        padding: '1rem', 
                        borderRadius: '1rem', 
                        border: status.activeOnderdeel === o ? '2.5px solid #2563eb' : '1px solid #f1f5f9',
                        backgroundColor: status.activeOnderdeel === o ? '#eff6ff' : '#fff',
                        color: status.activeOnderdeel === o ? '#2563eb' : '#64748b',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {o}
                      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.2rem' }}>
                        {onderdeelData[o]?.length || 0} skippers
                      </div>
                    </button>
                    <button 
                      onClick={() => verwijderOnderdeel(o)}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.5 }}
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Veld Toewijzing */}
            <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Clock size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Veld Toewijzing</h3>
                </div>
                <button onClick={clearAllFields} style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>WIS VELDEN</button>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {status.fields.map((f) => (
                  <div key={f.id} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '120px 1fr auto', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    backgroundColor: f.empty ? '#f8fafc' : '#eff6ff', 
                    padding: '1rem', 
                    borderRadius: '1rem',
                    border: f.empty ? '1px solid #f1f5f9' : '1px solid #bfdbfe'
                  }}>
                    <span style={{ fontWeight: 900, color: f.empty ? '#64748b' : '#2563eb' }}>{f.veld}</span>
                    <select 
                      value={f.skipperId} 
                      onChange={(e) => setField(f.id, e.target.value)}
                      style={{ padding: '0.7rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontWeight: 700, outline: 'none' }}
                    >
                      <option value="">-- Geen skipper --</option>
                      {currentSkippers.map((s) => (
                        <option key={s.id} value={s.id}>{s.naam} ({s.club})</option>
                      ))}
                    </select>
                    {!f.empty && (
                      <button onClick={() => setField(f.id, '')} style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#94a3b8', padding: '0.7rem', borderRadius: '0.75rem', cursor: 'pointer' }}>Reset</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Actief Onderdeel Status */}
            <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '2rem', color: '#fff' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Actief Onderdeel</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem' }}>{status.activeOnderdeel}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 800 }}>DEELNEMERS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{currentSkippers.length}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 800 }}>REEKSEN</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{Math.ceil(currentSkippers.length / 4)}</div>
                </div>
              </div>
            </div>

            {/* CSV Import voor Actief Onderdeel */}
            <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Upload size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CSV Import Deelnemers</h3>
              </div>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: '#64748b' }}>Importeer lijst voor <strong>{status.activeOnderdeel}</strong>.</p>
              
              <input 
                type="file" 
                accept=".csv" 
                onChange={(e) => handleCsvUpload(e, status.activeOnderdeel)} 
                id="csv-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-upload" style={{ 
                display: 'block', 
                textAlign: 'center',
                padding: '1.25rem', 
                backgroundColor: '#f8fafc', 
                border: '2px dashed #e2e8f0', 
                borderRadius: '1rem', 
                cursor: 'pointer', 
                fontWeight: 800, 
                color: '#64748b'
              }}>
                CSV BESTAND SELECTEREN
              </label>
            </div>

            {/* Preview Mini */}
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {status.fields.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #f1f5f9', opacity: s.empty ? 0.3 : 1 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#2563eb' }}>{s.veld}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{currentSkippers.find(sk => sk.id === s.skipperId)?.naam || ''}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );

  if (view === 'display') return <DisplayView />;
  if (view === 'admin') return <AdminView />;
  return <LiveView />;
}
