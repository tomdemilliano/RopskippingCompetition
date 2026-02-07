import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, addDoc, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, ChevronUp, ChevronDown
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

const COMPETITION_TYPES = {
  'A Masters': ['Speed', 'Endurance', 'Freestyle', 'Triple under'],
  'B/C Masters': ['Speed', 'Endurance', 'Freestyle'],
  'mini Masters': ['Speed', 'Endurance', 'Freestyle'],
  'A Teams': ['SR Speed Relay', 'DD Speed Relay', 'DD Speed Sprint', 'Double under Relay', 'SR2', 'SR4', 'DD3', 'DD4'],
  'B Teams': ['SR Speed Relay', 'DD Speed Relay', 'DD Speed Sprint', 'SR2', 'SR4', 'DD3', 'DD4'],
  'C Teams': ['SR Speed Relay', 'DD Speed Relay', 'SR Team Freestyle', 'DD Team Freestyle'],
  'mini Teams': ['SR Speed Relay', 'DD Speed Relay', 'SR Team Freestyle', 'DD Team Freestyle']
};

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
  const [showEditCompModal, setShowEditCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', type: 'A Masters', events: COMPETITION_TYPES['A Masters'], status: 'open', eventOrder: {} });
  const [editCompData, setEditCompData] = useState({ name: '', date: '', location: '', type: '' });
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

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  // Sortering van onderdelen op basis van eventOrder map
  const sortedEvents = useMemo(() => {
    if (!selectedComp || !selectedComp.events) return [];
    const order = selectedComp.eventOrder || {};
    return [...selectedComp.events].sort((a, b) => (order[a] || 0) - (order[b] || 0));
  }, [selectedComp]);

  const moveEvent = async (eventName, direction) => {
    const newOrder = { ...(selectedComp.eventOrder || {}) };
    // Initialiseer als er nog geen order is
    sortedEvents.forEach((ev, idx) => { if (newOrder[ev] === undefined) newOrder[ev] = idx; });
    
    const currentIndex = sortedEvents.indexOf(eventName);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < sortedEvents.length) {
      const targetEvent = sortedEvents[targetIndex];
      const temp = newOrder[eventName];
      newOrder[eventName] = newOrder[targetEvent];
      newOrder[targetEvent] = temp;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { eventOrder: newOrder });
    }
  };

  const handleDeleteComp = async () => {
    if (!selectedComp) return;
    if (window.confirm(`Verwijder "${selectedComp.name}" en alle data?`)) {
      const batch = writeBatch(db);
      const pSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
      pSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id));
      await batch.commit();
      setSelectedCompetitionId(null);
    }
  };

  const handleUpdateComp = async () => {
    const updatedData = { ...editCompData, events: COMPETITION_TYPES[editCompData.type] };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), updatedData);
    setShowEditCompModal(false);
  };

  const styles = {
    mainWrapper: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' },
    header: { height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0' },
    layoutGrid: { flex: 1, display: 'grid', gridTemplateColumns: '260px 280px 1fr', overflow: 'hidden' },
    column: { background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    contentArea: { padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem' },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
    btnSecondary: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
    input: { width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
  };

  return (
    <div style={styles.mainWrapper}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900 }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={styles.btnSecondary} onClick={() => setView('management')}>Beheer</button>
          <button style={styles.btnSecondary} onClick={() => setView('live')}>Live</button>
        </div>
      </header>

      <div style={styles.layoutGrid}>
        {/* KOLOM 1: WEDSTRIJDEN */}
        <aside style={styles.column}>
          <button style={{ ...styles.btnPrimary, marginBottom: '0.5rem' }} onClick={() => setShowAddCompModal(true)}>+ Nieuwe Wedstrijd</button>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '0.5rem' }}>WEDSTRIJDEN</div>
          {competitions.map(c => (
            <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
              padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
              border: '2px solid', borderColor: selectedCompetitionId === c.id ? '#2563eb' : 'transparent',
              backgroundColor: selectedCompetitionId === c.id ? '#f0f7ff' : '#fff'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.name}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{c.type}</div>
            </div>
          ))}
        </aside>

        {/* KOLOM 2: ONDERDELEN (Nu Verticaal) */}
        <aside style={{ ...styles.column, backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '0.5rem' }}>ONDERDELEN & VOLGORDE</div>
          {selectedComp ? sortedEvents.map((ond, idx) => (
            <div key={ond} style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 900, fontSize: '0.8rem' }}>{ond}</div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => moveEvent(ond, 'up')} style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer' }} disabled={idx === 0}><ChevronUp size={14}/></button>
                  <button onClick={() => moveEvent(ond, 'down')} style={{ border: 'none', background: '#f1f5f9', borderRadius: '4px', cursor: 'pointer' }} disabled={idx === sortedEvents.length - 1}><ChevronDown size={14}/></button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {Object.values(participants).filter(p => p.events?.includes(ond)).length} skippers
                </span>
                <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.65rem', cursor: 'pointer' }} onClick={() => setShowUploadModal(ond)}>
                  <Upload size={12} style={{ marginRight: '4px' }}/> CSV
                </button>
              </div>
            </div>
          )) : <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginTop: '2rem' }}>Geen wedstrijd geselecteerd</div>}
        </aside>

        {/* KOLOM 3: TABEL */}
        <main style={styles.contentArea}>
          {selectedComp ? (
            <>
              <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedComp.name}</h2>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedComp.date} • {selectedComp.location} • <strong>{selectedComp.type}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={styles.btnSecondary} onClick={() => {
                    setEditCompData({ name: selectedComp.name, date: selectedComp.date, location: selectedComp.location, type: selectedComp.type });
                    setShowEditCompModal(true);
                  }}><Edit2 size={16}/></button>
                  <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={handleDeleteComp}><Trash2 size={16}/></button>
                  <button style={styles.btnPrimary} onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })}>
                    {settings.activeCompetitionId === selectedComp.id ? 'Actief' : 'Activeer Live'}
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.5rem', borderRadius: '6px' }}>
                    <Search size={16} color="#64748b" style={{ margin: '0 0.5rem' }} />
                    <input style={{ border: 'none', background: 'none', outline: 'none', width: '100%' }} placeholder="Zoek skipper of club..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #eee' }}>
                      <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                        <th style={{ padding: '0.75rem' }}>Naam</th>
                        <th style={{ padding: '0.75rem' }}>Club</th>
                        <th style={{ padding: '0.75rem' }}>Onderdelen</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(participants).filter(p => p.naam?.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{p.naam}</td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{p.club}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {sortedEvents.filter(ev => p.events?.includes(ev)).map(ev => (
                                <span key={ev} style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{ev.charAt(0)}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))}><X size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div style={{ textAlign: 'center', padding: '5rem', color: '#94a3b8' }}>Selecteer een wedstrijd aan de linkerkant om te beginnen.</div>}
        </main>
      </div>

      {/* MODALS (Add/Edit/Upload) - Beknopte weergave */}
      {showEditCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '400px' }}>
            <h3>Wedstrijd Aanpassen</h3>
            <input style={styles.input} value={editCompData.name} onChange={e => setEditCompData({...editCompData, name: e.target.value})} placeholder="Naam" />
            <select style={styles.input} value={editCompData.type} onChange={e => setEditCompData({...editCompData, type: e.target.value})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" style={styles.input} value={editCompData.date} onChange={e => setEditCompData({...editCompData, date: e.target.value})} />
            <input style={styles.input} value={editCompData.location} onChange={e => setEditCompData({...editCompData, location: e.target.value})} placeholder="Locatie" />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUpdateComp}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
      
      {/* ... overige modals (AddComp, Upload) analoog aan voorgaande code ... */}
    </div>
  );
};

export default App;
