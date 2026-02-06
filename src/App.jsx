import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee, Search
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE - BEHOUDEN (Environment Variables)
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
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [] });
  const [csvInput, setCsvInput] = useState('');

  // Firebase Init & Sync (Logica onveranderd)
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
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), s => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !selectedCompetitionId) { setParticipants({}); return; }
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants'), s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady]);

  // Zoekfilter logica
  const filteredParticipants = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return Object.values(participants).filter(p => 
      p.naam?.toLowerCase().includes(term) || 
      p.club?.toLowerCase().includes(term)
    ).sort((a, b) => a.naam.localeCompare(b.naam));
  }, [participants, searchTerm]);

  // CSV Import Logica (Behouden van vorige prompt)
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
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', color: '#1e293b' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    primaryBtn: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' },
    secondaryBtn: { padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' },
    badge: { padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.3rem' },
    searchBar: { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 0.75rem', width: '300px' }
  };

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.5px' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setView('management')} style={{ ...styles.secondaryBtn, border: view === 'management' ? '2px solid #2563eb' : '1px solid #cbd5e1' }}>Beheer</button>
          <button onClick={() => setView('live')} style={styles.secondaryBtn}>Live</button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', maxWidth: '1700px', margin: '0 auto' }}>
          
          {/* Sidebar */}
          <aside>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <Plus size={16} /> Nieuwe Wedstrijd
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {competitions.map(c => (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{ 
                  ...styles.card, cursor: 'pointer', padding: '0.75rem', 
                  borderColor: selectedCompetitionId === c.id ? '#2563eb' : '#e2e8f0',
                  backgroundColor: selectedCompetitionId === c.id ? '#f0f7ff' : '#fff'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{c.date}</div>
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedComp ? (
              <>
                {/* Header & Onderdelen Selectie (Compacter) */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>{selectedComp.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.9rem' }}>| {selectedComp.location}</span></h1>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                      style={{ ...styles.primaryBtn, backgroundColor: settings.activeCompetitionId === selectedComp.id ? '#10b981' : '#2563eb' }}>
                      {settings.activeCompetitionId === selectedComp.id ? 'Actief' : 'Activeer'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>ONDERDELEN:</span>
                    {POSSIBLE_ONDERDELEN.map(ond => {
                      const isActive = selectedComp.events?.includes(ond);
                      return (
                        <button key={ond} onClick={() => {
                          const newEvents = isActive ? selectedComp.events.filter(e => e !== ond) : [...(selectedComp.events || []), ond];
                          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                        }} style={{ ...styles.secondaryBtn, fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: isActive ? '#eff6ff' : '#fff', borderColor: isActive ? '#2563eb' : '#cbd5e1', color: isActive ? '#2563eb' : '#475569' }}>
                          {isActive ? '✓' : '+'} {ond}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid van Actieve Onderdelen (Kleiner) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {selectedComp.events?.map(ond => {
                    const count = Object.values(participants).filter(p => p.events?.includes(ond) && !p.isPause).length;
                    return (
                      <div key={ond} style={{ ...styles.card, padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{ond}</span>
                          <button onClick={() => setShowUploadModal(ond)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb' }} title="Import CSV"><Upload size={14}/></button>
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 900 }}>{count} <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>SKIPIERS</span></div>
                      </div>
                    );
                  })}
                </div>

                {/* Deelnemers Tabel (Meer ruimte) */}
                <div style={{ ...styles.card, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1rem' }}>Deelnemers & Planning</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                       <div style={styles.searchBar}>
                          <Search size={16} color="#94a3b8" />
                          <input 
                            style={{ border: 'none', padding: '0.5rem', outline: 'none', fontSize: '0.85rem', width: '100%' }} 
                            placeholder="Zoek op naam of club..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                       </div>
                       <div style={{ ...styles.badge, background: '#f8fafc' }}><Users size={14}/> {filteredParticipants.length}</div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', fontSize: '0.7rem', color: '#64748b', borderBottom: '2px solid #f1f5f9', textTransform: 'uppercase' }}>
                          <th style={{ padding: '0.75rem' }}>Naam</th>
                          <th style={{ padding: '0.75rem' }}>Club</th>
                          <th style={{ padding: '0.75rem' }}>Planning per onderdeel</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc', backgroundColor: p.isPause ? '#fffbeb' : 'transparent' }}>
                            <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
                              {p.isPause ? <span style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Coffee size={14}/> PAUZE</span> : p.naam}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontSize: '0.85rem' }}>{p.club}</td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                {p.events?.map(ev => {
                                  const k = ev.replace(/\s/g, '');
                                  return (
                                    <span key={ev} style={{ ...styles.badge, fontSize: '0.65rem' }}>
                                      <span style={{ color: '#2563eb' }}>{ev}:</span> R{p[`reeks_${k}`]} {p[`veld_${k}`] ? `V${p[`veld_${k}`]}` : ''}
                                      <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id), { events: arrayRemove(ev) })} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={10}/></button>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                              <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center', padding: '10rem 2rem', color: '#94a3b8' }}>Selecteer een wedstrijd.</div>
            )}
          </section>
        </div>
      </main>

      {/* Modal: CSV Upload (Gecentreerd) */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Import: {showUploadModal}</h2>
            <textarea 
              style={{ width: '100%', height: '300px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }} 
              placeholder="Plak CSV data hier..."
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={handleCsvUpload}>Start Import</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => { setShowUploadModal(null); setCsvInput(''); }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nieuwe Wedstrijd */}
      {showAddCompModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '400px' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Nieuwe Wedstrijd</h2>
            <input style={{ width: '100%', padding: '0.6rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} placeholder="Naam" onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <input type="date" style={{ width: '100%', padding: '0.6rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={{ width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} placeholder="Locatie" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '1rem' }}>
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
