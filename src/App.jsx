import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, addDoc, getDocs, query, where
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, FileText
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
  const [allParticipantsCounts, setAllParticipantsCounts] = useState({});
  const [settings, setSettings] = useState({ activeCompetitionId: null });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showEditCompModal, setShowEditCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null); // Bevat de naam van het onderdeel
  
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

  const handleUploadCsv = async () => {
    if (!csvInput || !showUploadModal) return;
    const eventName = showUploadModal;
    const lines = csvInput.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const batch = writeBatch(db);
    
    // Verkrijg huidige deelnemers om duplicaten te voorkomen
    const currentParticipants = Object.values(participants);

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = values[idx]);

      const naam = row.naam || row.name;
      const club = row.club;
      const reeks = row.reeks || row.heat;

      if (!naam) continue;

      const existing = currentParticipants.find(p => p.naam === naam);
      const eventKey = `reeks_${eventName.replace(/\s/g, '')}`;

      if (existing) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', existing.id);
        batch.update(docRef, {
          events: Array.from(new Set([...(existing.events || []), eventName])),
          [eventKey]: reeks || ''
        });
      } else {
        const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
        batch.set(newRef, {
          naam,
          club: club || '',
          events: [eventName],
          [eventKey]: reeks || ''
        });
      }
    }
    await batch.commit();
    setCsvInput('');
    setShowUploadModal(null);
  };

  // ... (handleCreateComp, handleUpdateComp, handleDeleteComp, moveEvent blijven identiek)
  const handleCreateComp = async () => {
    if (!newComp.name) return alert("Naam verplicht");
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
    if (window.confirm(`Verwijder "${selectedComp.name}"?`)) {
      const batch = writeBatch(db);
      const pSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
      pSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id));
      await batch.commit();
      setSelectedCompetitionId(null);
    }
  };

  const moveEvent = async (eventName, direction) => {
    const order = selectedComp.eventOrder || {};
    const events = [...selectedComp.events].sort((a,b) => (order[a]||0) - (order[b]||0));
    const idx = events.indexOf(eventName);
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target >= 0 && target < events.length) {
      const newOrder = {...order};
      const otherEvent = events[target];
      newOrder[eventName] = target;
      newOrder[otherEvent] = idx;
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
    input: { width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1' },
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
        {/* KOLOM 1 & 2 blijven zoals voorheen... */}
        <aside style={styles.column}>
          <button style={{ ...styles.btnPrimary, marginBottom: '0.5rem' }} onClick={() => setShowAddCompModal(true)}>+ Nieuwe</button>
          {competitions.map(c => (
            <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
              padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px',
              border: '2px solid', borderColor: settings.activeCompetitionId === c.id ? '#10b981' : (selectedCompetitionId === c.id ? '#2563eb' : 'transparent'),
              backgroundColor: settings.activeCompetitionId === c.id ? '#f0fdf4' : '#fff'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.name}</div>
            </div>
          ))}
        </aside>

        <aside style={{ ...styles.column, backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>ONDERDELEN</div>
          {selectedComp && [...selectedComp.events].sort((a,b) => (selectedComp.eventOrder?.[a]||0)-(selectedComp.eventOrder?.[b]||0)).map((ond, idx) => (
            <div key={ond} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: '0.8rem' }}>{ond}</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => moveEvent(ond, 'up')} style={{ border: 'none', background: '#f1f5f9' }}><ChevronUp size={14}/></button>
                  <button onClick={() => moveEvent(ond, 'down')} style={{ border: 'none', background: '#f1f5f9' }}><ChevronDown size={14}/></button>
                </div>
              </div>
              <button style={{ ...styles.btnPrimary, width: '100%', marginTop: '8px', fontSize: '0.7rem', padding: '4px' }} onClick={() => setShowUploadModal(ond)}>
                <Upload size={12} style={{ marginRight: '4px' }}/> CSV Laden
              </button>
            </div>
          ))}
        </aside>

        <main style={styles.contentArea}>
          {/* Tabel zoals voorheen... */}
          {selectedComp && (
             <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                    <input style={styles.input} placeholder="Zoek skipper..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div style={{ overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem' }}>
                        <tbody>
                            {Object.values(participants).filter(p => p.naam?.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '0.75rem' }}>{p.naam}</td>
                                    <td style={{ padding: '0.75rem', color: '#64748b' }}>{p.club}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', p.id))}><X size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          )}
        </main>
      </div>

      {/* MODAL: CSV UPLOAD */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '500px' }}>
            <h3 style={{ marginTop: 0 }}>Deelnemers laden voor: {showUploadModal}</h3>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Plak CSV data (Kolommen: naam, club, reeks)</p>
            <textarea 
              style={{ ...styles.input, height: '200px', fontFamily: 'monospace', fontSize: '0.8rem' }}
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
              placeholder="naam,club,reeks&#10;Jan Janssen,Rope Club,1&#10;An Smets,Jumpers,2"
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUploadCsv}>Importeren</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* Overige modals (Add/Edit) zoals in vorige stap... */}
    </div>
  );
};

export default App;
