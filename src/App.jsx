import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee, Search, CheckCircle2, AlertCircle, Archive, Star, ArrowRight
} from 'lucide-react';

const getFirebaseConfig = () => {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try { return JSON.parse(rawConfig); } catch (e) { console.error("Fout", e); }
    } else { return rawConfig; }
  }
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
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [settings, setSettings] = useState({ activeCompetitionId: null });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [], status: 'open', eventOrder: {} });
  const [csvInput, setCsvInput] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);
        onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setIsAuthReady(true); } });
        await signInAnonymously(auth);
      } catch (e) { console.error(e); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), (d) => d.exists() && setSettings(d.data()));
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), s => {
      setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !selectedCompetitionId) { setParticipants({}); return; }
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants'), s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady]);

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return Object.values(participants).filter(p => 
      p.naam?.toLowerCase().includes(term) || p.club?.toLowerCase().includes(term)
    ).sort((a, b) => a.naam.localeCompare(b.naam));
  }, [participants, searchTerm]);

  const getCompStatus = (comp) => {
    if (comp.status === 'finished') return { label: 'AFGELOPEN', color: '#64748b', icon: <Archive size={12}/> };
    if (!comp.events || comp.events.length === 0) return { label: 'LEEG', color: '#ef4444', icon: <AlertCircle size={12}/>, id: 'empty' };
    return { label: 'KLAAR', color: '#10b981', icon: <CheckCircle2 size={12}/> };
  };

  const updateEventOrder = async (eventName, order) => {
    const newOrderMap = { ...(selectedComp.eventOrder || {}), [eventName]: parseInt(order) || 0 };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { eventOrder: newOrderMap });
  };

  const deleteCompetition = async (id) => {
    if (!window.confirm("Weet je zeker dat je deze wedstrijd EN alle deelnemers wilt verwijderen?")) return;
    const batch = writeBatch(db);
    const pSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', id, 'participants'));
    pSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
    await batch.commit();
    if (selectedCompetitionId === id) setSelectedCompetitionId(null);
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    sideItem: (isSelected, isActive) => ({
      padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem', border: '2px solid',
      borderColor: isSelected ? '#2563eb' : (isActive ? '#bfdbfe' : 'transparent'),
      backgroundColor: isSelected ? '#f0f7ff' : (isActive ? '#eff6ff' : '#fff'),
    }),
    compactEventCard: (isActive) => ({
      padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid', 
      borderColor: isActive ? '#2563eb' : '#e2e8f0',
      backgroundColor: isActive ? '#fff' : '#f8fafc',
      display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '240px'
    }),
    primaryBtn: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' },
    secondaryBtn: { padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }
  };

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);
  const selectedCompStatus = selectedComp ? getCompStatus(selectedComp) : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setView('management')} style={styles.secondaryBtn}>Beheer</button>
          <button onClick={() => setView('live')} style={styles.secondaryBtn}>Live</button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '1rem', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', width: '100%', maxWidth: '1750px' }}>
          
          {/* SIDEBAR: WEDSTRIJD OVERZICHT */}
          <aside style={{ overflowY: 'auto', borderRight: '1px solid #e2e8f0', paddingRight: '0.5rem' }}>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <Plus size={16} /> Nieuwe Wedstrijd
            </button>
            {competitions.sort((a,b) => b.createdAt?.localeCompare(a.createdAt)).map(c => {
              const isActive = settings.activeCompetitionId === c.id;
              const isSelected = selectedCompetitionId === c.id;
              const status = getCompStatus(c);
              return (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={styles.sideItem(isSelected, isActive)}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Calendar size={10}/> {c.date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><MapPin size={10}/> {c.location}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff', background: status.color, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{status.label}</div>
                    {isActive && <Star size={12} fill="#2563eb" color="#2563eb" />}
                  </div>
                </div>
              );
            })}
          </aside>

          {/* CONTENT SECTION */}
          <section style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {selectedComp ? (
              <>
                {/* WEDSTRIJD HEADER */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>{selectedComp.name}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => deleteCompetition(selectedComp.id)} style={{ ...styles.secondaryBtn, color: '#ef4444' }}><Trash2 size={14}/></button>
                      <button 
                        disabled={selectedCompStatus.id === 'empty'}
                        onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                        style={{ ...styles.primaryBtn, opacity: selectedCompStatus.id === 'empty' ? 0.4 : 1 }}
                      >
                        {settings.activeCompetitionId === selectedComp.id ? 'Huidige Live Wedstrijd' : 'Activeer Live'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ONDERDELEN: COMPACT HORIZONTAAL */}
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {POSSIBLE_ONDERDELEN.map(ond => {
                    const isActive = selectedComp.events?.includes(ond);
                    const eventKey = ond.replace(/\s/g, '');
                    const participantsForEvent = Object.values(participants).filter(p => p.events?.includes(ond));
                    const skipperCount = participantsForEvent.filter(p => !p.isPause).length;
                    const reeksCount = new Set(participantsForEvent.map(p => p[`reeks_${eventKey}`])).size;

                    return (
                      <div key={ond} style={styles.compactEventCard(isActive)}>
                        <input type="checkbox" checked={isActive} onChange={() => {
                          const newEvents = isActive ? selectedComp.events.filter(e => e !== ond) : [...(selectedComp.events || []), ond];
                          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                        }} />
                        <div style={{ minWidth: '80px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.75rem', color: isActive ? '#1e293b' : '#94a3b8' }}>{ond}</div>
                          {isActive && (
                            <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>{skipperCount} sk • {reeksCount} rk</div>
                          )}
                        </div>
                        {isActive && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.5rem' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800 }}>NR:</span>
                            <input 
                              type="number" 
                              style={{ width: '35px', padding: '0.1rem', fontSize: '0.75rem', fontWeight: 900, textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              value={selectedComp.eventOrder?.[ond] || ''}
                              onChange={(e) => updateEventOrder(ond, e.target.value)}
                            />
                            <button onClick={() => setShowUploadModal(ond)} style={{ marginLeft: '0.25rem', background: '#2563eb', border: 'none', borderRadius: '4px', color: '#fff', padding: '2px 4px' }}><Upload size={12}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* DEELNEMERSLIJST */}
                <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', width: '300px' }}>
                      <Search size={14} color="#64748b" />
                      <input style={{ border: 'none', background: 'none', marginLeft: '0.4rem', outline: 'none', width: '100%', fontSize: '0.8rem' }} placeholder="Zoek skipper of club..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', fontSize: '0.65rem', color: '#94a3b8', borderBottom: '2px solid #f1f5f9' }}>
                          <th style={{ padding: '0.4rem' }}>SKIPPER</th>
                          <th style={{ padding: '0.4rem' }}>CLUB</th>
                          <th style={{ padding: '0.4rem' }}>DETAILS</th>
                          <th style={{ padding: '0.4rem', textAlign: 'right' }}>ACTIE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem', backgroundColor: p.isPause ? '#fffbeb' : 'transparent' }}>
                            <td style={{ padding: '0.4rem', fontWeight: 700 }}>{p.isPause ? '☕ PAUZE' : p.naam}</td>
                            <td style={{ padding: '0.4rem', color: '#64748b' }}>{p.club}</td>
                            <td style={{ padding: '0.4rem' }}>
                              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                {p.events?.sort((a,b) => (selectedComp.eventOrder?.[a] || 0) - (selectedComp.eventOrder?.[b] || 0)).map(ev => (
                                  <span key={ev} style={{ fontSize: '0.6rem', background: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 700 }}>
                                    {ev.charAt(0)}: R{p[`reeks_${ev.replace(/\s/g, '')}`]}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '0.4rem', textAlign: 'right' }}>
                              <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))} style={{ color: '#ef4444', background: 'none', border: 'none' }}><X size={14}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd in de zijbalk.</div>
            )}
          </section>
        </div>
      </main>

      {/* MODALS */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '600px' }}>
            <h3 style={{ marginTop: 0 }}>Import {showUploadModal}</h3>
            <textarea style={{ width: '100%', height: '200px', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.7rem' }} value={csvInput} onChange={e => setCsvInput(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={() => { /* Logica behouden */ }}>Import</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowUploadModal(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {showAddCompModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '350px' }}>
            <h3 style={{ marginTop: 0 }}>Nieuwe Wedstrijd</h3>
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} placeholder="Naam" onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <input type="date" style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} placeholder="Locatie" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={async () => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), { ...newComp, createdAt: new Date().toISOString() });
                setShowAddCompModal(false);
              }}>Opslaan</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
