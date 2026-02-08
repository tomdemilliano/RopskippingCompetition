import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, addDoc, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, Info, RotateCcw, Clock, MapPin
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

const isFreestyleType = (eventName) => {
  const specialTypes = ['Freestyle', 'SR2', 'SR4', 'DD3', 'DD4', 'SR Team Freestyle', 'DD Team Freestyle'];
  return specialTypes.includes(eventName);
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState('management'); 
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [allParticipantsCounts, setAllParticipantsCounts] = useState({});
  const [settings, setSettings] = useState({ activeCompetitionId: null });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showEditCompModal, setShowEditCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [showEditParticipantModal, setShowEditParticipantModal] = useState(null);
  
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', type: 'A Masters', events: COMPETITION_TYPES['A Masters'], status: 'open', eventOrder: {} });
  const [editCompData, setEditCompData] = useState({ name: '', date: '', location: '', type: '' });
  const [editParticipantData, setEditParticipantData] = useState(null);
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
      const comps = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompetitions(comps);
      comps.forEach(c => {
        onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', c.id, 'participants'), ps => {
          setAllParticipantsCounts(prev => ({ ...prev, [c.id]: ps.docs.map(pd => pd.data()) }));
        });
      });
    });
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !selectedCompetitionId) { setParticipants({}); return; }
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants'), s => {
      const d = {}; s.forEach(doc => d[doc.id] = { id: doc.id, ...doc.data() });
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady]);

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  const getCompDataStatus = (compId) => {
    const comp = competitions.find(c => c.id === compId);
    const parts = allParticipantsCounts[compId] || [];
    if (!comp || !comp.events) return { isComplete: false, missingCount: 0 };
    const missing = comp.events.filter(event => !parts.some(p => p.events?.includes(event)));
    return { isComplete: missing.length === 0 && parts.length > 0, missingCount: missing.length };
  };

  const sortedEvents = useMemo(() => {
    if (!selectedComp || !selectedComp.events) return [];
    const order = selectedComp.eventOrder || {};
    return [...selectedComp.events].sort((a, b) => (order[a] || 0) - (order[b] || 0));
  }, [selectedComp]);

  const filteredParticipants = useMemo(() => {
    return Object.values(participants).filter(p => 
      p.naam?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.club?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  }, [participants, searchTerm]);

  const handleUploadCsv = async () => {
    if (!csvInput || !showUploadModal) return;
    const eventName = showUploadModal;
    const isFreestyle = isFreestyleType(eventName);
    const lines = csvInput.split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim());
    const batch = writeBatch(db);
    const currentParts = Object.values(participants);

    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);

      const eventKey = `reeks_${eventName.replace(/\s/g, '')}`;
      const detailKey = `detail_${eventName.replace(/\s/g, '')}`;

      if (isFreestyle) {
        const naam = row['skipper'];
        const club = row['club'] || '';
        const reeks = row['reeks'] || '';
        const uur = row['uur'] || '';
        const veld = parseInt(row['veld']) || 1;

        if (naam) {
          const existing = currentParts.find(p => p.naam === naam);
          const eventData = {
            events: Array.from(new Set([...(existing?.events || []), eventName])),
            [eventKey]: reeks,
            [detailKey]: { uur, veld, club }
          };

          if (existing) {
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', existing.id), eventData);
          } else {
            const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
            batch.set(newRef, { naam, club, ...eventData });
          }
        }
      } else {
        const reeks = row['reeks'];
        const uur = row['uur'];
        
        for (let i = 1; i <= 10; i++) {
          const clubKey = `Club_veld${i}`;
          const skipperKey = `Skipper_veld${i}`;
          
          if (row[skipperKey] && row[skipperKey] !== '') {
            const naam = row[skipperKey];
            const club = row[clubKey] || '';
            
            const existing = currentParts.find(p => p.naam === naam);
            const eventData = {
              events: Array.from(new Set([...(existing?.events || []), eventName])),
              [eventKey]: reeks || '',
              [detailKey]: {
                uur: uur || '',
                veld: i,
                club: club
              }
            };

            if (existing) {
              batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', existing.id), eventData);
            } else {
              const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
              batch.set(newRef, { naam, club, ...eventData });
            }
          }
        }
      }
    });

    await batch.commit();
    setCsvInput('');
    setShowUploadModal(null);
  };

  const handleCreateComp = async () => {
    if (!newComp.name) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), newComp);
    setShowAddCompModal(false);
  };

  const handleUpdateComp = async () => {
    const updatedData = { ...editCompData, events: COMPETITION_TYPES[editCompData.type] };
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), updatedData);
    setShowEditCompModal(false);
  };

  const handleDeleteComp = async () => {
    if (!selectedComp) return;
    if (window.confirm(`Weet je zeker dat je "${selectedComp.name}" wilt verwijderen?`)) {
      const batch = writeBatch(db);
      const pSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
      pSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id));
      await batch.commit();
      setSelectedCompetitionId(null);
    }
  };

  const handleUpdateParticipant = async () => {
    if (!editParticipantData) return;
    const { id, ...data } = editParticipantData;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', id), data);
    setShowEditParticipantModal(null);
  };

  const toggleEventStatus = (eventName) => {
    const currentStatus = editParticipantData.eventStatus || {};
    const newStatus = currentStatus[eventName] === 'geschrapt' ? 'actief' : 'geschrapt';
    setEditParticipantData({
      ...editParticipantData,
      eventStatus: { ...currentStatus, [eventName]: newStatus }
    });
  };

  const moveEvent = async (eventName, direction) => {
    const newOrder = { ...(selectedComp.eventOrder || {}) };
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

  const styles = {
    mainWrapper: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' },
    header: { height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
    layoutGrid: { flex: 1, display: 'grid', gridTemplateColumns: '260px 280px 1fr', overflow: 'hidden' },
    column: { background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    contentArea: { padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem' },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
    btnSecondary: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
    btnDanger: { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' },
    btnSuccess: { background: '#f0fdf4', color: '#10b981', border: '1px solid #bbf7d0', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' },
    input: { width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    csvExample: { background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.65rem', color: '#475569', marginBottom: '0.5rem', border: '1px dashed #cbd5e1', overflowX: 'auto', whiteSpace: 'nowrap' }
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
        <aside style={styles.column}>
          <button style={{ ...styles.btnPrimary, marginBottom: '0.5rem' }} onClick={() => setShowAddCompModal(true)}>+ Nieuwe wedstrijd</button>
          {competitions.map(c => {
            const isSelected = selectedCompetitionId === c.id;
            const isActive = settings.activeCompetitionId === c.id;
            const status = getCompDataStatus(c.id);
            return (
              <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
                padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                border: '2px solid', borderColor: isActive ? '#10b981' : (isSelected ? '#2563eb' : 'transparent'),
                backgroundColor: isActive ? '#f0fdf4' : (isSelected ? '#f0f7ff' : '#fff')
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{c.type}</div>
                <div style={{ fontSize: '0.6rem', color: status.isComplete ? '#10b981' : '#f59e0b', marginTop: '4px', fontWeight: 'bold' }}>
                  {status.isComplete ? '✓ Data Compleet' : `! ${status.missingCount} leeg`}
                </div>
              </div>
            );
          })}
        </aside>

        <aside style={{ ...styles.column, backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>ONDERDELEN</div>
          {selectedComp ? sortedEvents.map((ond, idx) => {
            const partsInEvent = Object.values(participants).filter(p => p.events?.includes(ond));
            const count = partsInEvent.length;
            const isSpecial = isFreestyleType(ond);
            
            const reeksen = new Set(partsInEvent.map(p => p[`reeks_${ond.replace(/\s/g, '')}`]).filter(Boolean));
            const maxVeld = partsInEvent.reduce((max, p) => {
                const veld = p[`detail_${ond.replace(/\s/g, '')}`]?.veld || 0;
                return veld > max ? veld : max;
            }, 0);

            return (
              <div key={ond} style={{ ...styles.card, borderLeft: `4px solid ${count > 0 ? '#10b981' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.8rem' }}>{ond}</span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button onClick={() => moveEvent(ond, 'up')} style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer' }} disabled={idx === 0}><ChevronUp size={14}/></button>
                    <button onClick={() => moveEvent(ond, 'down')} style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer' }} disabled={idx === sortedEvents.length - 1}><ChevronDown size={14}/></button>
                  </div>
                </div>
                
                <div style={{ fontSize: '0.65rem', color: '#64748b', margin: '4px 0' }}>
                  {reeksen.size} reeksen {!isSpecial && `| ${maxVeld || '-'} velden`}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{count} skippers</span>
                  <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowUploadModal(ond)}>
                    <Upload size={10} style={{ marginRight: '4px' }}/> CSV
                  </button>
                </div>
              </div>
            );
          }) : <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>Selecteer wedstrijd</div>}
        </aside>

        <main style={styles.contentArea}>
          {selectedComp ? (
            <>
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedComp.name}</h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{selectedComp.type} | {selectedComp.location}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={styles.btnSecondary} onClick={() => {
                      setEditCompData({ name: selectedComp.name, date: selectedComp.date, location: selectedComp.location, type: selectedComp.type });
                      setShowEditCompModal(true);
                    }}><Edit2 size={16}/></button>
                    <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={handleDeleteComp}><Trash2 size={16}/></button>
                    <button style={{ ...styles.btnPrimary, background: settings.activeCompetitionId === selectedComp.id ? '#10b981' : '#2563eb' }} 
                      onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })}>
                      {settings.activeCompetitionId === selectedComp.id ? 'Live Actief' : 'Activeer Live'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.4rem', borderRadius: '6px' }}>
                    <Search size={16} color="#64748b" style={{ margin: '0 0.5rem' }} />
                    <input style={{ border: 'none', background: 'none', outline: 'none', width: '100%' }} placeholder="Zoek skipper..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #eee', zIndex: 10 }}>
                      <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                        <th style={{ padding: '0.75rem' }}>Skipper</th>
                        <th style={{ padding: '0.75rem' }}>Club</th>
                        <th style={{ padding: '0.75rem' }}>Onderdelen</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{p.naam}</td>
                          <td style={{ padding: '0.75rem', color: '#64748b' }}>{p.club}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                              {sortedEvents.filter(ev => p.events?.includes(ev)).map(ev => {
                                const isGeschrapt = p.eventStatus?.[ev] === 'geschrapt';
                                return (
                                  <span key={ev} 
                                    title={`${ev} (Reeks ${p['reeks_'+ev.replace(/\s/g, '')]}) ${isGeschrapt ? '- GESCHRAPT' : ''}`} 
                                    style={{ 
                                      fontSize: '0.6rem', 
                                      background: isGeschrapt ? '#fee2e2' : '#f1f5f9', 
                                      color: isGeschrapt ? '#ef4444' : '#475569',
                                      textDecoration: isGeschrapt ? 'line-through' : 'none',
                                      padding: '2px 4px', 
                                      borderRadius: '4px' 
                                    }}>
                                    {ev.charAt(0)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', marginRight: '8px' }}
                              onClick={() => {
                                setEditParticipantData({ ...p });
                                setShowEditParticipantModal(true);
                              }}>
                              <Edit2 size={16}/>
                            </button>
                            <button style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }} 
                              onClick={() => { if(window.confirm('Deelnemer definitief verwijderen?')) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id)) }}>
                              <X size={16}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div style={{ textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd aan de linkerkant.</div>}
        </main>
      </div>

      {/* --- Modals --- */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '650px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Laden voor: {showUploadModal}</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowUploadModal(null)} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.3rem', display: 'flex', alignItems: 'center' }}>
                <Info size={14} style={{ marginRight: '4px' }} /> Verplichte CSV Structuur:
              </div>
              <div style={styles.csvExample}>
                {isFreestyleType(showUploadModal) 
                  ? "reeks, uur, veld, club, skipper"
                  : "reeks,onderdeel,uur,Club_veld1,Skipper_veld1,Club_veld2,Skipper_veld2,...,Club_veld10,Skipper_veld10"}
              </div>
            </div>

            <textarea 
              style={{ ...styles.input, height: '250px', fontFamily: 'monospace', fontSize: '0.75rem' }} 
              value={csvInput} 
              onChange={e => setCsvInput(e.target.value)} 
              placeholder="Plak hier de CSV inhoud (inclusief headers)..." 
            />
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUploadCsv}>Importeren</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showEditParticipantModal && editParticipantData && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Deelnemer aanpassen</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowEditParticipantModal(null)} />
            </div>

            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
            <input style={styles.input} value={editParticipantData.naam} onChange={e => setEditParticipantData({...editParticipantData, naam: e.target.value})} />
            
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Club</label>
            <input style={styles.input} value={editParticipantData.club} onChange={e => setEditParticipantData({...editParticipantData, club: e.target.value})} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Onderdelen & Deelname</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                {editParticipantData.events?.map(ev => {
                  const isGeschrapt = editParticipantData.eventStatus?.[ev] === 'geschrapt';
                  const details = editParticipantData[`detail_${ev.replace(/\s/g, '')}`] || {};
                  
                  return (
                    <div key={ev} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      background: isGeschrapt ? '#f8fafc' : '#fff',
                      border: '1px solid #f1f5f9'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          textDecoration: isGeschrapt ? 'line-through' : 'none',
                          color: isGeschrapt ? '#94a3b8' : '#1e293b',
                          fontWeight: 'bold'
                        }}>
                          {ev} {isGeschrapt && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontStyle: 'italic', fontWeight: 'normal' }}>(Geschrapt)</span>}
                        </span>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '2px', color: isGeschrapt ? '#cbd5e1' : '#64748b', fontSize: '0.75rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={12}/> {details.uur || '--:--'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={12}/> Veld {details.veld || '?'}
                          </span>
                        </div>
                      </div>
                      {isGeschrapt ? (
                        <button style={styles.btnSuccess} onClick={() => toggleEventStatus(ev)}>
                          <RotateCcw size={12} style={{marginRight: '4px'}}/> Activeer
                        </button>
                      ) : (
                        <button style={styles.btnDanger} onClick={() => toggleEventStatus(ev)}>
                          <Trash2 size={12} style={{marginRight: '4px'}}/> Schrappen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUpdateParticipant}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditParticipantModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>Nieuwe Wedstrijd</h3>
            <label style={{ fontSize: '0.8rem' }}>Naam</label>
            <input style={styles.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <label style={{ fontSize: '0.8rem' }}>Type</label>
            <select style={styles.input} value={newComp.type} onChange={e => setNewComp({...newComp, type: e.target.value, events: COMPETITION_TYPES[e.target.value]})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input type="date" style={styles.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
              <input style={styles.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} placeholder="Locatie" />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleCreateComp}>Aanmaken</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showEditCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>Wedstrijd Aanpassen</h3>
            <label style={{ fontSize: '0.8rem' }}>Naam</label>
            <input style={styles.input} value={editCompData.name} onChange={e => setEditCompData({...editCompData, name: e.target.value})} />
            <label style={{ fontSize: '0.8rem' }}>Type</label>
            <select style={styles.input} value={editCompData.type} onChange={e => setEditCompData({...editCompData, type: e.target.value})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input type="date" style={styles.input} value={editCompData.date} onChange={e => setEditCompData({...editCompData, date: e.target.value})} />
              <input style={styles.input} value={editCompData.location} onChange={e => setEditCompData({...editCompData, location: e.target.value})} />
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
