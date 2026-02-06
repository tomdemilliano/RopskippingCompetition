import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Users, Hash, Trash2, Upload, Plus
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE - ONGEWIJZIGD (Environment Variables behouden)
 */
const getFirebaseConfig = () => {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try { return JSON.parse(rawConfig); } catch (e) { console.error("Fout bij parsen", e); }
    } else { return rawConfig; }
  }
  if (typeof __firebase_config !== 'undefined') { return JSON.parse(__firebase_config); }
  return null;
};

const firebaseConfig = getFirebaseConfig();
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

const POSSIBLE_ONDERDELEN = ['Speed', 'Endurance', 'Double under', 'Triple under', 'Freestyle'];

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState('management'); 
  const [activeTab, setActiveTab] = useState('speed');
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState({ activeCompetitionId: null });
  
  // Modals & Forms
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null); // Bevat de naam van het onderdeel
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [] });
  const [csvInput, setCsvInput] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
        onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setIsAuthReady(true); } });
      } catch (e) { console.error("Firebase Init Error", e); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !db) return;
    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    onSnapshot(sRef, (d) => d.exists() && setSettings(d.data()));
    onSnapshot(cRef, s => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user || !db || !selectedCompetitionId) { setParticipants({}); return; }
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants');
    return onSnapshot(pRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady, user]);

  const toggleEventInComp = async (eventName) => {
    const comp = competitions.find(c => c.id === selectedCompetitionId);
    const newEvents = comp.events?.includes(eventName) 
      ? comp.events.filter(e => e !== eventName)
      : [...(comp.events || []), eventName];
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId), {
      events: newEvents
    });
  };

  const handleCsvUpload = async () => {
    if (!csvInput || !showUploadModal) return;
    const batch = writeBatch(db);
    const lines = csvInput.split('\n').filter(l => l.trim());
    const event = showUploadModal;
    const capacity = event === 'Freestyle' ? 1 : 10;

    lines.forEach((line, index) => {
      const [naam, club] = line.split(',').map(s => s.trim());
      const pid = `p_${(naam + club).replace(/\s/g, '_').toLowerCase()}`;
      const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid);
      
      batch.set(pRef, {
        id: pid, naam, club,
        events: arrayUnion(event),
        [`reeks_${event.replace(/\s/g, '')}`]: Math.floor(index / capacity) + 1,
        [`veld_${event.replace(/\s/g, '')}`]: (index % capacity) + 1
      }, { merge: true });
    });

    await batch.commit();
    setCsvInput('');
    setShowUploadModal(null);
  };

  const removeParticipantCompletely = async (pId) => {
    if(window.confirm("Deze deelnemer volledig verwijderen uit de wedstrijd?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pId));
    }
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'system-ui, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    sidebarItem: (active) => ({ padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', border: '1px solid', borderColor: active ? '#2563eb' : '#e2e8f0', backgroundColor: active ? '#eff6ff' : '#fff', transition: 'all 0.2s' }),
    primaryBtn: { padding: '0.6rem 1.2rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' },
    secondaryBtn: { padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
    input: { width: '100%', padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', marginBottom: '0.75rem' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    badge: { padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }
  };

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={{ fontWeight: 900, letterSpacing: '-0.025em' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          {['live', 'management'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ ...styles.secondaryBtn, backgroundColor: view === v ? '#f1f5f9' : 'transparent', border: view === v ? '1px solid #cbd5e1' : 'none' }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
          
          {/* Linker Kantlijn: Wedstrijden */}
          <aside>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem' }}>
              <Plus size={18} /> Nieuwe Wedstrijd
            </button>
            {competitions.map(c => (
              <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={styles.sidebarItem(selectedCompetitionId === c.id)}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{c.date} • {c.location}</div>
              </div>
            ))}
          </aside>

          {/* Rechter deel: Details & Deelnemers */}
          <section>
            {selectedComp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Header Wedstrijd */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{selectedComp.name}</h1>
                      <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>{selectedComp.location} | {selectedComp.date}</p>
                    </div>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                      style={{ ...styles.primaryBtn, backgroundColor: settings.activeCompetitionId === selectedComp.id ? '#10b981' : '#2563eb' }}>
                      {settings.activeCompetitionId === selectedComp.id ? 'Actieve Wedstrijd' : 'Activeer Wedstrijd'}
                    </button>
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.75rem' }}>Onderdelen Selecteren</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {POSSIBLE_ONDERDELEN.map(ond => {
                        const isActive = selectedComp.events?.includes(ond);
                        return (
                          <button key={ond} onClick={() => toggleEventInComp(ond)}
                            style={{ ...styles.secondaryBtn, backgroundColor: isActive ? '#eff6ff' : '#fff', borderColor: isActive ? '#2563eb' : '#e2e8f0', color: isActive ? '#2563eb' : '#64748b' }}>
                            {isActive ? '✓ ' : '+ '} {ond}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Grid per onderdeel */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {selectedComp.events?.map(ond => {
                    const ondParticipants = Object.values(participants).filter(p => p.events?.includes(ond));
                    const reeksen = new Set(ondParticipants.map(p => p[`reeks_${ond.replace(/\s/g, '')}`])).size;
                    return (
                      <div key={ond} style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800 }}>{ond}</span>
                          <button onClick={() => setShowUploadModal(ond)} style={{ ...styles.secondaryBtn, padding: '0.3rem 0.6rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <Upload size={14}/> CSV
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <div style={{ flex: 1, background: '#f8fafc', padding: '0.5rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>DEELNEMERS</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{ondParticipants.length}</div>
                          </div>
                          <div style={{ flex: 1, background: '#f8fafc', padding: '0.5rem', borderRadius: '0.4rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>REEKSEN</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{reeksen}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Deelnemerslijst */}
                <div style={styles.card}>
                  <h3 style={{ margin: '0 0 1rem 0', fontWeight: 900 }}>Overzicht Deelnemers</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem' }}>NAAM</th>
                        <th style={{ padding: '0.75rem' }}>CLUB</th>
                        <th style={{ padding: '0.75rem' }}>ONDERDELEN</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>ACTIE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(participants).map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 700 }}>{p.naam}</td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{p.club}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {p.events?.map(ev => (
                                <span key={ev} style={styles.badge}>
                                  {ev}
                                  <button onClick={async () => {
                                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id), {
                                      events: arrayRemove(ev)
                                    });
                                  }} style={{ marginLeft: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>×</button>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button onClick={() => removeParticipantCompletely(p.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>
                Selecteer een wedstrijd aan de linkerkant om te beheren
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal: Nieuwe Wedstrijd */}
      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '400px' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Nieuwe Wedstrijd</h2>
            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Naam wedstrijd</label>
            <input style={styles.input} placeholder="bijv. Provinciaal Kampioenschap" onChange={e => setNewComp({...newComp, name: e.target.value})} />
            
            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Datum</label>
            <input type="date" style={styles.input} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            
            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Locatie</label>
            <input style={styles.input} placeholder="bijv. Sporthal De Pinte" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={async () => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), { ...newComp, createdAt: new Date().toISOString() });
                setShowAddCompModal(false);
              }}>Opslaan</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV Upload per onderdeel */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '500px' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Deelnemers Import: {showUploadModal}</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Plak hier de CSV gegevens (Formaat: Naam, Club). Elke deelnemer op een nieuwe regel.
            </p>
            <textarea 
              style={{ ...styles.input, height: '200px', fontFamily: 'monospace', fontSize: '0.8rem' }} 
              placeholder="Jan Janssen, Club De Pinte&#10;Piet Peters, Recreatie Gent"
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={handleCsvUpload}>Start Import</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
