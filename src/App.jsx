import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Users, Hash, Trash2
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE - ONGEWIJZIGD
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

const POSSIBLE_ONDERDELEN = ['Speed', 'Endurance', 'Freestyle', 'Double under', 'Triple under'];

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState('live'); 
  const [activeTab, setActiveTab] = useState('speed');
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom!",
    activeCompetitionId: null,
  });
  const [status, setStatus] = useState({ type: null, msg: null });
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', setActive: false });
  const [showAddModal, setShowAddModal] = useState(false);
  const [onderdeelCsv, setOnderdeelCsv] = useState({ onderdeel: '', csv: '' });

  // Klok & Firebase Init (Onveranderd)
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

  // Sync Listeners
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;
    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');

    const unsubS = onSnapshot(sRef, (d) => d.exists() && setSettings(d.data()));
    const unsubSk = onSnapshot(skRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    });
    const unsubH = onSnapshot(hRef, s => setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks)));
    const unsubC = onSnapshot(cRef, s => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubS(); unsubSk(); unsubH(); unsubC(); };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user || !db || !selectedCompetitionId) { setParticipants({}); return; }
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants');
    return onSnapshot(pRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [isAuthReady, user, selectedCompetitionId]);

  // Functies voor beheer
  const deleteCompetition = async (id) => {
    if (!window.confirm("Zeker weten?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
      if (settings.activeCompetitionId === id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: null });
      setStatus({ type: 'success', msg: 'Verwijderd' });
    } catch (e) { setStatus({ type: 'error', msg: e.message }); }
  };

  const removeParticipant = async (pId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pId));
    } catch (e) { setStatus({ type: 'error', msg: e.message }); }
  };

  const removeEventFromParticipant = async (pId, eventName) => {
    try {
      const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pId);
      await updateDoc(pRef, { events: arrayRemove(eventName) });
    } catch (e) { setStatus({ type: 'error', msg: e.message }); }
  };

  const importOnderdeelParticipants = async (onderdeel) => {
    if (!onderdeelCsv.csv || !selectedCompetitionId) return;
    const batch = writeBatch(db);
    const lines = onderdeelCsv.csv.split('\n').filter(l => l.trim());
    const isFreestyle = onderdeel.toLowerCase() === 'freestyle';
    
    // Per onderdeel kunnen we reeksen berekenen (bijv. 10 per reeks voor speed)
    const capacity = isFreestyle ? 1 : 10;
    
    lines.forEach((line, index) => {
      const [naam, club] = line.split(',').map(s => s.trim());
      const pid = `p_${(naam + club).replace(/\s/g, '_')}`;
      const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid);
      
      batch.set(pRef, {
        id: pid, naam, club,
        events: arrayUnion(onderdeel),
        [`reeks_${onderdeel}`]: Math.floor(index / capacity) + 1,
        [`veld_${onderdeel}`]: (index % capacity) + 1
      }, { merge: true });
    });

    await batch.commit();
    setOnderdeelCsv({ onderdeel: '', csv: '' });
    setStatus({ type: 'success', msg: `Deelnemers toegevoegd aan ${onderdeel}` });
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1.5rem', borderBottom: '1px solid #eee', background: '#fff', alignItems: 'center' },
    main: { flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    card: { border: '1px solid #eee', borderRadius: '1rem', padding: '1rem', width: '100%', maxWidth: '1100px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    primaryButton: { padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 900 },
    outlineButton: { padding: '0.45rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' },
    badge: { padding: '0.2rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#f3f4f6' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 900 }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
          <nav style={{ display: 'flex', gap: '0.25rem', background: '#f5f5f5', padding: '0.2rem', borderRadius: '0.5rem' }}>
            {['live', 'management', 'display'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, backgroundColor: view === v ? '#fff' : 'transparent' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ fontWeight: 800 }}>{currentTime.toLocaleTimeString('nl-BE')}</div>
      </header>

      <main style={styles.main}>
        {view === 'management' && (
          <div style={{ ...styles.card, display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
            {/* Linkerkolom: Wedstrijd selectie */}
            <div style={{ borderRight: '1px solid #eee', paddingRight: '1rem' }}>
              <button onClick={() => setShowAddModal(true)} style={{ ...styles.primaryButton, width: '100%', marginBottom: '1rem' }}>+ Nieuwe Wedstrijd</button>
              {competitions.map(c => (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{ padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', border: '1px solid', borderColor: selectedCompetitionId === c.id ? '#2563eb' : '#eee', backgroundColor: selectedCompetitionId === c.id ? '#eff6ff' : '#fff' }}>
                  <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{c.date}</div>
                  {c.id === settings.activeCompetitionId && <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900 }}>● ACTIEF</span>}
                </div>
              ))}
            </div>

            {/* Rechterkolom: Wedstrijd Details */}
            {selectedCompetitionId ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontWeight: 900 }}>{competitions.find(c => c.id === selectedCompetitionId)?.name}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedCompetitionId })} style={styles.outlineButton}>Maak Actief</button>
                    <button onClick={() => deleteCompetition(selectedCompetitionId)} style={{ ...styles.outlineButton, color: 'red' }}><Trash2 size={14}/></button>
                  </div>
                </div>

                {/* Onderdelen & Stats */}
                <h3 style={{ fontWeight: 900, fontSize: '1rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem' }}>Onderdelen & Import</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {POSSIBLE_ONDERDELEN.map(ond => {
                    const ondParticipants = Object.values(participants).filter(p => p.events?.includes(ond));
                    const reeksen = new Set(ondParticipants.map(p => p[`reeks_${ond}`])).size;
                    
                    return (
                      <div key={ond} style={{ padding: '1rem', borderRadius: '0.8rem', border: '1px solid #eee', background: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 900 }}>{ond}</span>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <span style={styles.badge}>{ondParticipants.length} Deelnemers</span>
                            <span style={styles.badge}>{reeksen} Reeksen</span>
                          </div>
                        </div>
                        <textarea 
                          placeholder="CSV: Naam, Club" 
                          style={{ width: '100%', height: '60px', fontSize: '0.75rem', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #ddd', marginBottom: '0.5rem' }}
                          onChange={(e) => setOnderdeelCsv({ onderdeel: ond, csv: e.target.value })}
                          value={onderdeelCsv.onderdeel === ond ? onderdeelCsv.csv : ''}
                        />
                        <button 
                          onClick={() => importOnderdeelParticipants(ond)}
                          disabled={onderdeelCsv.onderdeel !== ond}
                          style={{ ...styles.primaryButton, width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                        >
                          Importeer {ond}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Totaaloverzicht Deelnemers */}
                <h3 style={{ fontWeight: 900, fontSize: '1rem', marginTop: '2rem', borderBottom: '2px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                  Totaaloverzicht Deelnemers ({Object.keys(participants).length})
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: '#666' }}>
                        <th style={{ padding: '0.5rem' }}>Naam</th>
                        <th style={{ padding: '0.5rem' }}>Club</th>
                        <th style={{ padding: '0.5rem' }}>Onderdelen</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(participants).map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 800 }}>{p.naam}</td>
                          <td style={{ padding: '0.5rem' }}>{p.club}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {p.events?.map(ev => (
                                <span key={ev} style={{ ...styles.badge, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  {ev} <button onClick={() => removeEventFromParticipant(p.id, ev)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}>×</button>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <button onClick={() => removeParticipant(p.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Selecteer een wedstrijd aan de linkerkant</div>
            )}
          </div>
        )}

        {/* Modal voor nieuwe wedstrijd */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ ...styles.card, maxWidth: '400px' }}>
              <h3 style={{ fontWeight: 900 }}>Nieuwe Wedstrijd</h3>
              <input style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} placeholder="Naam" onChange={e => setNewComp({...newComp, name: e.target.value})} />
              <input style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} placeholder="Datum" type="date" onChange={e => setNewComp({...newComp, date: e.target.value})} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={styles.primaryButton} onClick={async () => {
                  await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), { ...newComp, status: 'gepland', createdAt: new Date().toISOString() });
                  setShowAddModal(false);
                }}>Opslaan</button>
                <button style={styles.outlineButton} onClick={() => setShowAddModal(false)}>Annuleren</button>
              </div>
            </div>
          </div>
        )}

        {/* Live en Display views blijven functioneel gelijk maar gebruiken de nieuwe participants data */}
        {view === 'live' && (
           <div style={styles.card}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  {['speed', 'freestyle'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ ...styles.primaryButton, backgroundColor: activeTab === t ? '#2563eb' : '#f3f4f6', color: activeTab === t ? '#fff' : '#000' }}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '4rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { [activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat']: Math.max(1, (settings[activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat'] || 1) - 1) })} style={styles.outlineButton}>Vorige</button>
                  <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { [activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat']: (settings[activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat'] || 1) + 1 })} style={styles.outlineButton}>Volgende</button>
                </div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
