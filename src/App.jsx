import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Upload, Trash2, Users, List, X
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE
 */
const getFirebaseConfig = () => {
  const rawConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : (import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG);

  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try {
        return JSON.parse(rawConfig);
      } catch (e) {
        console.error("Fout bij het parsen van config.", e);
      }
    } else {
      return rawConfig;
    }
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-default';

// Helper voor CSV parsing
const parseCSV = (text) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce((obj, header, i) => {
      obj[header] = values[i];
      return obj;
    }, {});
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, live, display, admin, manage-competition
  const [competitions, setCompetitions] = useState([]);
  const [activeComp, setActiveComp] = useState(null);
  const [activeOnderdeel, setActiveOnderdeel] = useState(null);
  const [onderdelen, setOnderdelen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('onderdelen'); // onderdelen, deelnemers

  // Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Wedstrijden ophalen
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    return onSnapshot(q, (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => console.error("Fout bij ophalen wedstrijden:", err));
  }, [user]);

  // Onderdelen ophalen als er een actieve wedstrijd is
  useEffect(() => {
    if (!user || !activeComp) {
      setOnderdelen([]);
      return;
    }
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen');
    return onSnapshot(q, (snapshot) => {
      setOnderdelen(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Fout bij ophalen onderdelen:", err));
  }, [user, activeComp]);

  // --- HANDLERS ---
  
  const createCompetition = async (e) => {
    e.preventDefault();
    const name = e.target.compName.value;
    if (!name) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
      name,
      createdAt: new Date().toISOString(),
      status: 'planned'
    });
    e.target.reset();
  };

  const addOnderdeel = async (e) => {
    e.preventDefault();
    const name = e.target.ondName.value;
    const type = e.target.ondType.value; // speed, endurance, double_under, triple_under, freestyle
    if (!name || !activeComp) return;
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen'), {
      name,
      type,
      heats: [] // Bevat de data structure
    });
    e.target.reset();
  };

  const handleCSVUpload = async (onderdeelId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const data = parseCSV(text);
      
      // Data groeperen op reeks/heat
      const heatsMap = {};
      data.forEach(row => {
        const heatNr = row.reeks || row.heat || "1";
        if (!heatsMap[heatNr]) heatsMap[heatNr] = { heat: parseInt(heatNr), skippers: [] };
        
        // Skipper object opbouwen
        const skipper = {
          skipperId: row.id || Math.random().toString(36).substr(2, 9),
          naam: row.naam || row.name || "Onbekend",
          club: row.club || "",
          veld: parseInt(row.veld || row.station || "1"),
          score: 0,
          completed: false
        };
        heatsMap[heatNr].skippers.push(skipper);
      });

      const heatsArray = Object.values(heatsMap).sort((a, b) => a.heat - b.heat);

      const ondRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen', onderdeelId);
      await updateDoc(ondRef, { heats: heatsArray });
    };
    reader.readAsText(file);
  };

  const removeParticipantFromOnderdeel = async (onderdeelId, skipperId) => {
    const ond = onderdelen.find(o => o.id === onderdeelId);
    if (!ond) return;

    const newHeats = ond.heats.map(h => ({
      ...h,
      skippers: h.skippers.filter(s => s.skipperId !== skipperId)
    })).filter(h => h.skippers.length > 0);

    const ondRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen', onderdeelId);
    await updateDoc(ondRef, { heats: newHeats });
  };

  const removeParticipantCompletely = async (skipperId) => {
    if (!window.confirm("Weet je zeker dat je deze deelnemer uit ALLE onderdelen wilt verwijderen?")) return;
    
    const batch = writeBatch(db);
    onderdelen.forEach(ond => {
      const newHeats = ond.heats.map(h => ({
        ...h,
        skippers: h.skippers.filter(s => s.skipperId !== skipperId)
      })).filter(h => h.skippers.length > 0);
      
      const ondRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen', ond.id);
      batch.update(ondRef, { heats: newHeats });
    });
    await batch.commit();
  };

  // --- COMPUTED DATA ---
  
  const participantsList = useMemo(() => {
    const list = {};
    onderdelen.forEach(ond => {
      ond.heats?.forEach(heat => {
        heat.skippers?.forEach(s => {
          if (!list[s.skipperId]) {
            list[s.skipperId] = { 
              id: s.skipperId, 
              naam: s.naam, 
              club: s.club, 
              onderdelen: [] 
            };
          }
          list[s.skipperId].onderdelen.push({ id: ond.id, name: ond.name });
        });
      });
    });
    return Object.values(list).sort((a, b) => a.naam.localeCompare(b.naam));
  }, [onderdelen]);

  // --- UI COMPONENTS ---

  const AdminSection = () => (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <button onClick={() => setView('home')} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
        <ChevronLeft size={20} /> Terug naar Dashboard
      </button>

      <div style={{ backgroundColor: '#fff', borderRadius: '1rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Beheer: {activeComp?.name}</h1>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setAdminTab('onderdelen')}
            style={{ padding: '1rem', fontWeight: 700, border: 'none', background: 'none', borderBottom: adminTab === 'onderdelen' ? '3px solid #2563eb' : '3px solid transparent', color: adminTab === 'onderdelen' ? '#2563eb' : '#64748b', cursor: 'pointer' }}
          >
            Onderdelen & CSV
          </button>
          <button 
            onClick={() => setAdminTab('deelnemers')}
            style={{ padding: '1rem', fontWeight: 700, border: 'none', background: 'none', borderBottom: adminTab === 'deelnemers' ? '3px solid #2563eb' : '3px solid transparent', color: adminTab === 'deelnemers' ? '#2563eb' : '#64748b', cursor: 'pointer' }}
          >
            Deelnemers Overzicht ({participantsList.length})
          </button>
        </div>

        {adminTab === 'onderdelen' ? (
          <div>
            <form onSubmit={addOnderdeel} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
              <input name="ondName" placeholder="Naam onderdeel (bijv. 30s Speed)" required style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }} />
              <select name="ondType" style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <option value="speed">Speed (30s/2min)</option>
                <option value="endurance">Endurance (3min)</option>
                <option value="double_under">Double Under</option>
                <option value="triple_under">Triple Under</option>
                <option value="freestyle">Freestyle</option>
              </select>
              <button type="submit" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Toevoegen</button>
            </form>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {onderdelen.map(ond => (
                <div key={ond.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{ond.name}</h3>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><List size={14} /> {ond.heats?.length || 0} reeksen</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={14} /> {ond.heats?.reduce((acc, h) => acc + (h.skippers?.length || 0), 0)} deelnemers</span>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>{ond.type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Upload size={16} /> CSV Upload
                      <input type="file" accept=".csv" hidden onChange={(e) => handleCSVUpload(ond.id, e.target.files[0])} />
                    </label>
                    <button 
                      onClick={async () => {
                        if(confirm('Onderdeel verwijderen?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen', ond.id));
                      }}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
              Hieronder vind je alle unieke deelnemers in deze wedstrijd.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '1rem' }}>Naam</th>
                    <th style={{ padding: '1rem' }}>Club</th>
                    <th style={{ padding: '1rem' }}>Onderdelen</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {participantsList.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{p.naam}</td>
                      <td style={{ padding: '1rem', color: '#64748b' }}>{p.club}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {p.onderdelen.map(o => (
                            <span key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>
                              {o.name}
                              <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeParticipantFromOnderdeel(o.id, p.id)} />
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => removeParticipantCompletely(p.id)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                          title="Volledig verwijderen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {participantsList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Geen deelnemers gevonden. Upload een CSV bij een onderdeel.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const HomeSection = () => (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.025em' }}>RopeScore <span style={{ color: '#2563eb' }}>Pro</span></h1>
          <p style={{ color: '#64748b', fontWeight: 500 }}>Wedstrijd Management Systeem</p>
        </div>
        <Activity size={40} color="#2563eb" />
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trophy size={20} /> Nieuwe Wedstrijd</h2>
          <form onSubmit={createCompetition} style={{ display: 'flex', gap: '0.5rem' }}>
            <input name="compName" placeholder="Naam van de wedstrijd..." style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }} />
            <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}>Aanmaken</button>
          </form>
        </section>

        <section>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>Actieve Wedstrijden</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {competitions.map(comp => (
              <div key={comp.id} style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{comp.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(comp.createdAt).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setActiveComp(comp); setView('admin'); }} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Beheer</button>
                  <button onClick={() => { setActiveComp(comp); setView('live'); }} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Live Scoring</button>
                  <button onClick={() => { setActiveComp(comp); setView('display'); }} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Display</button>
                </div>
              </div>
            ))}
            {competitions.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Geen wedstrijden gevonden.</p>}
          </div>
        </section>
      </div>
    </div>
  );

  // --- RENDER LOGIC ---

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>Laden...</div>;
  if (!firebaseConfig) return <div style={{ padding: '2rem', color: 'red' }}>Geen Firebase configuratie gevonden. Controleer je environment variabelen.</div>;

  switch (view) {
    case 'admin': return <AdminSection />;
    case 'live': return <LiveScoringView activeComp={activeComp} onderdelen={onderdelen} setView={setView} appId={appId} db={db} />;
    case 'display': return <DisplayView activeComp={activeComp} onderdelen={onderdelen} setView={setView} appId={appId} db={db} />;
    default: return <HomeSection />;
  }
}

/**
 * LIVE SCORING VIEW (Ongewijzigd qua structuur, gefilterd op actieve comp)
 */
function LiveScoringView({ activeComp, onderdelen, setView, appId, db }) {
  const [selectedOnderdeel, setSelectedOnderdeel] = useState(null);
  const [activeHeat, setActiveHeat] = useState(1);
  
  const currentOnderdeel = onderdelen.find(o => o.id === selectedOnderdeel);

  const updateScore = async (skipperId, newScore) => {
    if (!currentOnderdeel) return;
    const newHeats = currentOnderdeel.heats.map(h => {
      if (h.heat === activeHeat) {
        return {
          ...h,
          skippers: h.skippers.map(s => s.skipperId === skipperId ? { ...s, score: newScore } : s)
        };
      }
      return h;
    });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeComp.id, 'onderdelen', selectedOnderdeel), { heats: newHeats });
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Sluiten</button>
          <h2 style={{ fontWeight: 900 }}>{activeComp.name} - LIVE</h2>
       </div>

       <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
         {onderdelen.map(o => (
           <button 
             key={o.id} 
             onClick={() => { setSelectedOnderdeel(o.id); setActiveHeat(1); }}
             style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', whiteSpace: 'nowrap', border: 'none', backgroundColor: selectedOnderdeel === o.id ? '#2563eb' : '#fff', color: selectedOnderdeel === o.id ? '#fff' : '#000', fontWeight: 700, cursor: 'pointer' }}
           >
             {o.name}
           </button>
         ))}
       </div>

       {currentOnderdeel && (
         <div style={{ backgroundColor: '#fff', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setActiveHeat(Math.max(1, activeHeat - 1))} style={{ padding: '0.5rem' }}><ChevronLeft /></button>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>REEKS {activeHeat}</div>
              <button onClick={() => setActiveHeat(activeHeat + 1)} style={{ padding: '0.5rem' }}><ChevronRight /></button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {currentOnderdeel.heats.find(h => h.heat === activeHeat)?.skippers.map(s => (
                <div key={s.skipperId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #f1f5f9', borderRadius: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb' }}>VELD {s.veld}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{s.naam}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => updateScore(s.skipperId, Math.max(0, s.score - 1))} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #e2e8f0', background: 'none', fontWeight: 900, fontSize: '1.2rem' }}>-</button>
                    <div style={{ fontSize: '2rem', fontWeight: 900, minWidth: '60px', textAlign: 'center' }}>{s.score}</div>
                    <button onClick={() => updateScore(s.skipperId, s.score + 1)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #2563eb', background: 'none', color: '#2563eb', fontWeight: 900, fontSize: '1.2rem' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
}

/**
 * DISPLAY VIEW (Ongewijzigd qua structuur)
 */
function DisplayView({ activeComp, onderdelen, setView, appId, db }) {
  const [selectedOnderdeel, setSelectedOnderdeel] = useState(null);
  const [activeHeat, setActiveHeat] = useState(1);

  const currentOnderdeel = onderdelen.find(o => o.id === selectedOnderdeel);
  const currentHeat = currentOnderdeel?.heats.find(h => h.heat === activeHeat);

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f172a', color: '#fff', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{activeComp.name}</h1>
            <h2 style={{ fontSize: '1.5rem', color: '#38bdf8', fontWeight: 700 }}>{currentOnderdeel?.name || 'Selecteer Onderdeel'}</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: '#38bdf8' }}>{activeHeat}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '-0.5rem' }}>REEKS</div>
          </div>
       </div>

       <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
          {[1,2,3,4,5,6].map(veld => {
            const s = currentHeat?.skippers.find(sk => sk.veld === veld);
            return (
              <div key={veld} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.2rem' }}>VELD {veld}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{s?.naam || '-'}</div>
                  <div style={{ color: '#94a3b8', fontWeight: 600 }}>{s?.club || ''}</div>
                </div>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#38bdf8' }}>{s?.score ?? ''}</div>
              </div>
            );
          })}
       </div>

       <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2rem' }}>
          {onderdelen.map(o => (
            <button key={o.id} onClick={() => setSelectedOnderdeel(o.id)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: selectedOnderdeel === o.id ? '#38bdf8' : 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>{o.name}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => setActiveHeat(h => Math.max(1, h - 1))} style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#334155', color: '#fff', border: 'none' }}>Vorige</button>
          <button onClick={() => setActiveHeat(h => h + 1)} style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', background: '#38bdf8', color: '#000', border: 'none', fontWeight: 800 }}>Volgende Reeks</button>
          <button onClick={() => setView('home')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: '#475569' }}>Menu</button>
       </div>
    </div>
  );
}
