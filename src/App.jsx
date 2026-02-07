import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc, getDocs, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee, Search, CheckCircle2, AlertCircle, Archive, Star, Edit2, ChevronDown
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

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return Object.values(participants).filter(p => 
      p.naam?.toLowerCase().includes(term) || p.club?.toLowerCase().includes(term)
    ).sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  }, [participants, searchTerm]);

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  // LOGICA VOOR VERWIJDEREN
  const handleDeleteComp = async () => {
    if (!selectedComp) return;
    
    const confirmDelete = window.confirm(`Weet je zeker dat je de wedstrijd "${selectedComp.name}" en ALLE bijbehorende deelnemers wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`);
    
    if (confirmDelete) {
      try {
        const batch = writeBatch(db);
        
        // 1. Haal alle deelnemers op van deze wedstrijd
        const participantsRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants');
        const participantsSnap = await getDocs(participantsRef);
        
        // 2. Voeg elke deelnemer toe aan de batch om te verwijderen
        participantsSnap.forEach((participantDoc) => {
          batch.delete(participantDoc.ref);
        });
        
        // 3. Voeg de wedstrijd zelf toe aan de batch
        const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id);
        batch.delete(compRef);
        
        // 4. Voer de batch uit
        await batch.commit();
        
        // 5. Reset selectie
        setSelectedCompetitionId(null);
        alert('Wedstrijd succesvol verwijderd.');
      } catch (e) {
        console.error("Fout bij verwijderen:", e);
        alert('Er is een fout opgetreden bij het verwijderen.');
      }
    }
  };

  const handleEditClick = () => {
    setEditCompData({
      name: selectedComp.name,
      date: selectedComp.date,
      location: selectedComp.location,
      type: selectedComp.type || 'A Masters'
    });
    setShowEditCompModal(true);
  };

  const handleUpdateComp = async () => {
    const updatedData = {
      ...editCompData,
      events: COMPETITION_TYPES[editCompData.type]
    };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), updatedData);
    setShowEditCompModal(false);
  };

  const handleCreateComp = async () => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), newComp);
    setShowAddCompModal(false);
  };

  const updateEventOrder = async (eventName, order) => {
    const newOrderMap = { ...(selectedComp.eventOrder || {}), [eventName]: parseInt(order) || 0 };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { eventOrder: newOrderMap });
  };

  const styles = {
    mainWrapper: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' },
    header: { height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
    layoutGrid: { flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' },
    sidebar: { background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '1rem' },
    contentArea: { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem', gap: '1rem' },
    eventStrip: { display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', flexShrink: 0 },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem' },
    tableWrapper: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
    btnSecondary: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    input: { width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }
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
        <aside style={styles.sidebar}>
          <button style={{ ...styles.btnPrimary, width: '100%', marginBottom: '1rem' }} onClick={() => setShowAddCompModal(true)}>+ Nieuwe Wedstrijd</button>
          {competitions.map(c => {
            const isSelected = selectedCompetitionId === c.id;
            const isActive = settings.activeCompetitionId === c.id;
            return (
              <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
                padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem',
                border: '2px solid', borderColor: isSelected ? '#2563eb' : (isActive ? '#bfdbfe' : 'transparent'),
                backgroundColor: isSelected ? '#f0f7ff' : '#fff'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.type} • {c.date}</div>
              </div>
            );
          })}
        </aside>

        <main style={styles.contentArea}>
          {selectedComp ? (
            <>
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedComp.name} <span style={{ fontSize: '1rem', color: '#2563eb', fontWeight: 'normal' }}>({selectedComp.type})</span></h2>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{selectedComp.date} | {selectedComp.location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...styles.btnSecondary, color: '#2563eb' }} onClick={handleEditClick} title="Bewerken"><Edit2 size={16}/></button>
                    <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={handleDeleteComp} title="Verwijderen"><Trash2 size={16}/></button>
                    <button 
                      style={styles.btnPrimary} 
                      onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })}
                    >
                      {settings.activeCompetitionId === selectedComp.id ? 'Huidige Actieve' : 'Activeer Live'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.eventStrip}>
                {selectedComp.events?.map(ond => {
                  const pCount = Object.values(participants).filter(p => p.events?.includes(ond) && !p.isPause).length;
                  const rCount = new Set(Object.values(participants).filter(p => p.events?.includes(ond)).map(p => p[`reeks_${ond.replace(/\s/g, '')}`])).size;
                  return (
                    <div key={ond} style={{ ...styles.card, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px', borderColor: '#2563eb' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900 }}>{ond}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{pCount} skippers • {rCount} reeksen</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #eee', paddingLeft: '8px' }}>
                        <input type="number" style={{ width: '30px', fontSize: '0.75rem' }} value={selectedComp.eventOrder?.[ond] || ''} onChange={(e) => updateEventOrder(ond, e.target.value)} />
                        <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }} onClick={() => setShowUploadModal(ond)}><Upload size={12}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={styles.tableWrapper}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '6px', width: '300px' }}>
                    <Search size={14} color="#64748b" />
                    <input style={{ border: 'none', background: 'none', marginLeft: '0.5rem', outline: 'none' }} placeholder="Zoek op naam of club..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>{filteredParticipants.length} Deelnemers</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff' }}>
                      <tr style={{ textAlign: 'left', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.75rem' }}>Naam</th>
                        <th style={{ padding: '0.75rem' }}>Club</th>
                        <th style={{ padding: '0.75rem' }}>Planning</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', fontWeight: 'bold' }}>{p.isPause ? '☕ PAUZE' : p.naam}</td>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>{p.club}</td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {p.events?.map(ev => (
                                <span key={ev} style={{ fontSize: '0.6rem', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  {ev.charAt(0)}: R{p[`reeks_${ev.replace(/\s/g, '')}`]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                            <button style={{ color: '#ef4444', border: 'none', background: 'none' }} onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))}><X size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div style={{ ...styles.card, textAlign: 'center', padding: '10rem' }}>Selecteer een wedstrijd.</div>}
        </main>
      </div>

      {/* MODAL: NIEUWE WEDSTRIJD */}
      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3>Nieuwe Wedstrijd</h3>
            <label style={{ fontSize: '0.8rem' }}>Naam</label>
            <input style={styles.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <label style={{ fontSize: '0.8rem' }}>Type Wedstrijd</label>
            <select style={styles.input} value={newComp.type} onChange={e => setNewComp({...newComp, type: e.target.value, events: COMPETITION_TYPES[e.target.value]})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><label style={{ fontSize: '0.8rem' }}>Datum</label><input type="date" style={styles.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} /></div>
              <div><label style={{ fontSize: '0.8rem' }}>Locatie</label><input style={styles.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleCreateComp}>Aanmaken</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BEWERKEN */}
      {showEditCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>Wedstrijd Aanpassen</h3>
            <label style={{ fontSize: '0.8rem' }}>Naam</label>
            <input style={styles.input} value={editCompData.name} onChange={e => setEditCompData({...editCompData, name: e.target.value})} />
            <label style={{ fontSize: '0.8rem' }}>Type Wedstrijd</label>
            <select style={styles.input} value={editCompData.type} onChange={e => setEditCompData({...editCompData, type: e.target.value})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><label style={{ fontSize: '0.8rem' }}>Datum</label><input type="date" style={styles.input} value={editCompData.date} onChange={e => setEditCompData({...editCompData, date: e.target.value})} /></div>
              <div><label style={{ fontSize: '0.8rem' }}>Locatie</label><input style={styles.input} value={editCompData.location} onChange={e => setEditCompData({...editCompData, location: e.target.value})} /></div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUpdateComp}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
