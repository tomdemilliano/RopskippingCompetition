import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee, Search, CheckCircle2, AlertCircle, Archive, Star
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE
 */
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
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [], status: 'open' });
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
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompetitions(docs);
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

  // Functie om de status van een wedstrijd te bepalen
  const getCompStatus = (comp) => {
    if (comp.status === 'finished') return { label: 'AFGELOPEN', color: '#64748b', icon: <Archive size={12}/> };
    if (!comp.events || comp.events.length === 0) return { label: 'LEEG', color: '#ef4444', icon: <AlertCircle size={12}/> };
    // We kunnen hier niet direct checken op participants zonder ze allemaal in te laden voor elke comp, 
    // maar we kunnen een benadering doen of een vlag 'hasData' in de comp doc bijhouden.
    // Voor nu checken we de geselecteerde comp specifiek:
    if (comp.id === selectedCompetitionId && Object.keys(participants).length === 0) return { label: 'GEEN DATA', color: '#f59e0b', icon: <Upload size={12}/> };
    return { label: 'KLAAR', color: '#10b981', icon: <CheckCircle2 size={12}/> };
  };

  const handleCsvUpload = async () => {
    if (!csvInput || !selectedCompetitionId || !showUploadModal) return;
    const batch = writeBatch(db);
    const rows = csvInput.split('\n').filter(r => r.trim());
    const event = showUploadModal;
    const eventKey = event.replace(/\s/g, '');

    rows.forEach((row, index) => {
      if (index === 0 && row.toLowerCase().includes('reeks')) return;
      const columns = row.split(',').map(s => s.trim());
      
      if (event === 'Freestyle') {
        const [reeks, uur, veld, club, skipper] = columns;
        if (!reeks) return;
        const isPause = (club?.toLowerCase() === 'pauze' || !skipper);
        const pid = isPause ? `pause_${reeks}` : `p_${(skipper + club).replace(/\s/g, '_').toLowerCase()}`;
        batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid), {
          id: pid, naam: isPause ? 'PAUZE' : skipper, club: isPause ? '' : club, isPause,
          events: arrayUnion(event), [`reeks_${eventKey}`]: reeks, [`uur_${eventKey}`]: uur, [`veld_${eventKey}`]: veld
        }, { merge: true });
      } else {
        const [reeks, , uur] = columns;
        for (let i = 3; i < columns.length; i += 2) {
          const club = columns[i], naam = columns[i+1];
          if (naam) {
            const pid = `p_${(naam + club).replace(/\s/g, '_').toLowerCase()}`;
            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid), {
              id: pid, naam, club, isPause: false, events: arrayUnion(event),
              [`reeks_${eventKey}`]: reeks, [`veld_${eventKey}`]: Math.floor((i - 3) / 2) + 1, [`uur_${eventKey}`]: uur
            }, { merge: true });
          }
        }
      }
    });
    await batch.commit();
    setCsvInput(''); setShowUploadModal(null);
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    sideItem: (isSelected, isActive) => ({
      padding: '0.85rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.6rem', border: '2px solid',
      borderColor: isSelected ? '#2563eb' : (isActive ? '#bfdbfe' : 'transparent'),
      backgroundColor: isSelected ? '#f0f7ff' : (isActive ? '#eff6ff' : '#fff'),
      boxShadow: isActive ? '0 0 10px rgba(37, 99, 235, 0.1)' : 'none',
      position: 'relative', transition: 'all 0.2s'
    }),
    statusBadge: (color) => ({ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, color: '#fff', backgroundColor: color, display: 'flex', alignItems: 'center', gap: '0.25rem' }),
    primaryBtn: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' },
    secondaryBtn: { padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }
  };

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setView('management')} style={{ ...styles.secondaryBtn, backgroundColor: view === 'management' ? '#f1f5f9' : '#fff' }}>Beheer</button>
          <button onClick={() => setView('live')} style={styles.secondaryBtn}>Live</button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', width: '100%', maxWidth: '1700px' }}>
          
          {/* SIDEBAR */}
          <aside style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <Plus size={18} /> Nieuwe Wedstrijd
            </button>
            
            {competitions.sort((a,b) => b.createdAt?.localeCompare(a.createdAt)).map(c => {
              const isActive = settings.activeCompetitionId === c.id;
              const isSelected = selectedCompetitionId === c.id;
              const status = getCompStatus(c);
              
              return (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={styles.sideItem(isSelected, isActive)}>
                  {isActive && <div style={{ position: 'absolute', top: -8, right: 10, backgroundColor: '#2563eb', color: '#fff', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 900 }}>ACTIEF</div>}
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.2rem', color: c.status === 'finished' ? '#94a3b8' : '#1e293b' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>{c.date}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={styles.statusBadge(status.color)}>{status.icon} {status.label}</div>
                    {isActive && <Star size={14} fill="#2563eb" color="#2563eb" />}
                  </div>
                </div>
              );
            })}
          </aside>

          {/* MAIN */}
          <section style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedComp ? (
              <>
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{selectedComp.name}</h1>
                      <p style={{ margin: '0.2rem 0', color: '#64748b' }}><MapPin size={14}/> {selectedComp.location} | <Calendar size={14}/> {selectedComp.date}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { status: selectedComp.status === 'finished' ? 'open' : 'finished' })}
                        style={{ ...styles.secondaryBtn, color: selectedComp.status === 'finished' ? '#2563eb' : '#ef4444' }}
                      >
                        {selectedComp.status === 'finished' ? 'Heropenen' : 'Markeer als Afgelopen'}
                      </button>
                      <button 
                        onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                        style={{ ...styles.primaryBtn, backgroundColor: settings.activeCompetitionId === selectedComp.id ? '#10b981' : '#2563eb' }}
                      >
                        {settings.activeCompetitionId === selectedComp.id ? 'Huidige Actieve Wedstrijd' : 'Activeer Wedstrijd'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Onderdelen compact */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {POSSIBLE_ONDERDELEN.map(ond => {
                    const isActive = selectedComp.events?.includes(ond);
                    const count = Object.values(participants).filter(p => p.events?.includes(ond) && !p.isPause).length;
                    return (
                      <div key={ond} style={{ ...styles.card, opacity: isActive ? 1 : 0.5, borderStyle: isActive ? 'solid' : 'dashed' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{ond}</span>
                          <input type="checkbox" checked={isActive} onChange={() => {
                            const newEvents = isActive ? selectedComp.events.filter(e => e !== ond) : [...(selectedComp.events || []), ond];
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                          }} />
                        </div>
                        {isActive && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{count} <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>SKIPIERS</span></div>
                            <button onClick={() => setShowUploadModal(ond)} style={{ ...styles.secondaryBtn, padding: '0.2rem 0.5rem' }}><Upload size={14}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Deelnemerslijst */}
                <div style={{ ...styles.card, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.4rem 0.75rem', borderRadius: '8px', width: '350px' }}>
                      <Search size={16} color="#64748b" />
                      <input style={{ border: 'none', background: 'none', marginLeft: '0.5rem', outline: 'none', width: '100%', fontSize: '0.85rem' }} placeholder="Zoek op naam of club..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{filteredParticipants.length} Deelnemers</div>
                  </div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', fontSize: '0.7rem', color: '#94a3b8', borderBottom: '2px solid #f1f5f9', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.75rem' }}>Deelnemer</th>
                        <th style={{ padding: '0.75rem' }}>Club</th>
                        <th style={{ padding: '0.75rem' }}>Planning</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: p.isPause ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>
                            {p.isPause ? <span style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Coffee size={14}/> PAUZE</span> : p.naam}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>{p.club}</td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                              {p.events?.map(ev => (
                                <span key={ev} style={{ padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                  {ev}: R{p[`reeks_${ev.replace(/\s/g, '')}`]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                            <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd in de lijst.</div>
            )}
          </section>
        </div>
      </main>

      {/* MODALS */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '800px' }}>
            <h2 style={{ marginTop: 0 }}>Importeer data voor {showUploadModal}</h2>
            <textarea style={{ width: '100%', height: '300px', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="Plak CSV hier..." value={csvInput} onChange={e => setCsvInput(e.target.value)} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={handleCsvUpload}>Import starten</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showAddCompModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '400px' }}>
            <h2 style={{ marginTop: 0 }}>Nieuwe Wedstrijd</h2>
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="Naam wedstrijd" onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <input type="date" style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="Locatie" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={async () => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), { ...newComp, createdAt: new Date().toISOString() });
                setShowAddCompModal(false);
              }}>Opslaan</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
