import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc, getDocs, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee, Search, CheckCircle2, AlertCircle, Archive, Star, ListOrdered
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
    if (comp.id === selectedCompetitionId && Object.keys(participants).length === 0) return { label: 'GEEN DATA', color: '#f59e0b', icon: <Upload size={12}/> };
    return { label: 'KLAAR', color: '#10b981', icon: <CheckCircle2 size={12}/> };
  };

  const deleteCompetition = async (id) => {
    if (!window.confirm("Weet je zeker dat je deze wedstrijd EN alle deelnemers wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    
    const batch = writeBatch(db);
    const pSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', id, 'participants'));
    pSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
    
    await batch.commit();
    if (selectedCompetitionId === id) setSelectedCompetitionId(null);
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
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#1e293b' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    sideItem: (isSelected, isActive) => ({
      padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem', border: '2px solid',
      borderColor: isSelected ? '#2563eb' : (isActive ? '#bfdbfe' : 'transparent'),
      backgroundColor: isSelected ? '#f0f7ff' : (isActive ? '#eff6ff' : '#fff'),
    }),
    primaryBtn: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' },
    secondaryBtn: { padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' },
    badge: { padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }
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

      <main style={{ flex: 1, padding: '1.25rem', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.25rem', width: '100%', maxWidth: '1700px' }}>
          
          <aside style={{ overflowY: 'auto' }}>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <Plus size={16} /> Nieuwe Wedstrijd
            </button>
            {competitions.sort((a,b) => b.createdAt?.localeCompare(a.createdAt)).map(c => {
              const isActive = settings.activeCompetitionId === c.id;
              const isSelected = selectedCompetitionId === c.id;
              const status = getCompStatus(c);
              return (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={styles.sideItem(isSelected, isActive)}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.2rem' }}>{c.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ ...styles.badge, backgroundColor: status.color, display: 'flex', alignItems: 'center', gap: '2px' }}>{status.icon} {status.label}</div>
                    {isActive && <Star size={12} fill="#2563eb" color="#2563eb" />}
                  </div>
                </div>
              );
            })}
          </aside>

          <section style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedComp ? (
              <>
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900 }}>{selectedComp.name}</h1>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedComp.location} • {selectedComp.date}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => deleteCompetition(selectedComp.id)} style={{ ...styles.secondaryBtn, color: '#ef4444', borderColor: '#fecaca' }}><Trash2 size={14}/></button>
                      <button 
                        disabled={selectedCompStatus.id === 'empty'}
                        onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                        style={{ ...styles.primaryBtn, opacity: selectedCompStatus.id === 'empty' ? 0.4 : 1, cursor: selectedCompStatus.id === 'empty' ? 'not-allowed' : 'pointer' }}
                      >
                        {settings.activeCompetitionId === selectedComp.id ? 'Is Actief' : 'Activeer'}
                      </button>
                    </div>
                  </div>
                  {selectedCompStatus.id === 'empty' && <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.5rem' }}>* Selecteer eerst onderdelen voordat je deze wedstrijd activeert.</div>}
                </div>

                {/* Onderdelen compact grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {POSSIBLE_ONDERDELEN.map(ond => {
                    const isActive = selectedComp.events?.includes(ond);
                    const eventKey = ond.replace(/\s/g, '');
                    const participantsForEvent = Object.values(participants).filter(p => p.events?.includes(ond));
                    const skipperCount = participantsForEvent.filter(p => !p.isPause).length;
                    const reeksCount = new Set(participantsForEvent.map(p => p[`reeks_${eventKey}`])).size;

                    return (
                      <div key={ond} style={{ ...styles.card, padding: '0.75rem', border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0', backgroundColor: isActive ? '#fff' : '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: isActive ? '#1e293b' : '#94a3b8' }}>{ond}</span>
                          <input type="checkbox" checked={isActive} onChange={() => {
                            const newEvents = isActive ? selectedComp.events.filter(e => e !== ond) : [...(selectedComp.events || []), ond];
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                          }} />
                        </div>
                        {isActive && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <div style={{ flex: 1, background: '#f1f5f9', padding: '0.4rem', borderRadius: '4px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b' }}>SKIPPERS</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{skipperCount}</div>
                            </div>
                            <div style={{ flex: 1, background: '#f1f5f9', padding: '0.4rem', borderRadius: '4px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b' }}>REEKSEN</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{reeksCount}</div>
                            </div>
                            <button onClick={() => setShowUploadModal(ond)} style={{ padding: '0 0.4rem', background: '#2563eb', border: 'none', borderRadius: '4px', color: '#fff' }}><Upload size={12}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px', width: '300px' }}>
                      <Search size={14} color="#64748b" />
                      <input style={{ border: 'none', background: 'none', marginLeft: '0.4rem', outline: 'none', width: '100%', fontSize: '0.8rem' }} placeholder="Zoek skipper of club..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                        <tr style={{ textAlign: 'left', fontSize: '0.65rem', color: '#94a3b8', borderBottom: '2px solid #f1f5f9' }}>
                          <th style={{ padding: '0.5rem' }}>NAAM</th>
                          <th style={{ padding: '0.5rem' }}>CLUB</th>
                          <th style={{ padding: '0.5rem' }}>PLANNING</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>ACTIE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', backgroundColor: p.isPause ? '#fffbeb' : 'transparent' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 700 }}>{p.isPause ? '☕ PAUZE' : p.naam}</td>
                            <td style={{ padding: '0.5rem', color: '#64748b' }}>{p.club}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                {p.events?.map(ev => <span key={ev} style={{ fontSize: '0.6rem', background: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 700 }}>{ev.charAt(0)}:R{p[`reeks_${ev.replace(/\s/g, '')}`]}</span>)}
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
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
              <div style={{ ...styles.card, textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd.</div>
            )}
          </section>
        </div>
      </main>

      {/* MODALS (Niet gewijzigd in logica, wel gestyled) */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '700px' }}>
            <h3 style={{ marginTop: 0 }}>Importeer data voor {showUploadModal}</h3>
            <textarea style={{ width: '100%', height: '250px', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.7rem', border: '1px solid #cbd5e1' }} placeholder="Plak CSV..." value={csvInput} onChange={e => setCsvInput(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={handleCsvUpload}>Import</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showAddCompModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...styles.card, width: '350px' }}>
            <h3 style={{ marginTop: 0 }}>Nieuwe Wedstrijd</h3>
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} placeholder="Naam" onChange={e => setNewComp({...newComp, name: e.target.value, createdAt: new Date().toISOString()})} />
            <input type="date" style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }} placeholder="Locatie" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={async () => {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), newComp);
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
