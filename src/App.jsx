import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, deleteDoc, addDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, Plus, Calendar, MapPin
} from 'lucide-react';

// Firebase Config Helper
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
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [settings, setSettings] = useState({ activeCompetitionId: null });
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showEditCompModal, setShowEditCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  
  // Data states
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [], status: 'open' });
  const [editCompData, setEditCompData] = useState({ name: '', date: '', location: '' });
  const [csvInput, setCsvInput] = useState('');

  // Firebase Init
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

  // Sync Competitions & Settings
  useEffect(() => {
    if (!isAuthReady || !db) return;
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), (d) => d.exists() && setSettings(d.data()));
    onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), s => {
      setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [isAuthReady]);

  // Sync Participants
  useEffect(() => {
    if (!isAuthReady || !selectedCompetitionId) { setParticipants({}); return; }
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants'), s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady]);

  const selectedComp = useMemo(() => competitions.find(c => c.id === selectedCompetitionId), [competitions, selectedCompetitionId]);

  // LOGICA: Nieuwe wedstrijd toevoegen
  const handleCreateCompetition = async () => {
    if (!newComp.name) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
        ...newComp,
        events: [],
        status: 'open',
        eventOrder: {}
      });
      setShowAddCompModal(false);
      setNewComp({ name: '', date: '', location: '', events: [], status: 'open' });
    } catch (e) { console.error("Fout bij aanmaken:", e); }
  };

  // LOGICA: Wedstrijd bewerken
  const handleUpdateCompetition = async () => {
    if (!selectedComp) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), {
        name: editCompData.name,
        date: editCompData.date,
        location: editCompData.location
      });
      setShowEditCompModal(false);
    } catch (e) { console.error("Fout bij bijwerken:", e); }
  };

  const styles = {
    mainWrapper: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' },
    header: { height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
    layoutGrid: { flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' },
    sidebar: { background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '1rem' },
    contentArea: { display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem', gap: '1rem' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem' },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' },
    btnSecondary: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    input: { width: '100%', padding: '0.7rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }
  };

  return (
    <div style={styles.mainWrapper}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900 }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
      </header>

      <div style={styles.layoutGrid}>
        <aside style={styles.sidebar}>
          <button style={{ ...styles.btnPrimary, width: '100%', marginBottom: '1rem' }} onClick={() => setShowAddCompModal(true)}>
            <Plus size={18} /> Nieuwe Wedstrijd
          </button>
          
          {competitions.map(c => (
            <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
              padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem',
              border: '2px solid', borderColor: selectedCompetitionId === c.id ? '#2563eb' : 'transparent',
              backgroundColor: selectedCompetitionId === c.id ? '#f0f7ff' : '#fff'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.date} • {c.location}</div>
            </div>
          ))}
        </aside>

        <main style={styles.contentArea}>
          {selectedComp ? (
            <>
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedComp.name}</h2>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <span><Calendar size={14} style={{verticalAlign:'middle'}}/> {selectedComp.date}</span>
                      <span><MapPin size={14} style={{verticalAlign:'middle'}}/> {selectedComp.location}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={styles.btnSecondary} onClick={() => {
                      setEditCompData({ name: selectedComp.name, date: selectedComp.date, location: selectedComp.location });
                      setShowEditCompModal(true);
                    }}>
                      <Edit2 size={16}/> Bewerk
                    </button>
                    <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={async () => {
                      if(confirm("Zeker weten?")) {
                        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id));
                        setSelectedCompetitionId(null);
                      }
                    }}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Onderdelen & Tabel (Zoals in je originele code) */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                 <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Beheer hier de onderdelen en deelnemers voor {selectedComp.name}.</p>
                 {/* De rest van je originele tabel-logica kan hier weer tussen */}
              </div>
            </>
          ) : (
            <div style={{ ...styles.card, textAlign: 'center', padding: '10rem', color: '#64748b' }}>
              Selecteer een wedstrijd in het menu links of maak een nieuwe aan.
            </div>
          )}
        </main>
      </div>

      {/* MODAL: NIEUWE WEDSTRIJD */}
      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '400px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
                <h3 style={{ margin: 0 }}>Nieuwe Wedstrijd</h3>
                <X size={20} style={{cursor:'pointer'}} onClick={() => setShowAddCompModal(false)} />
            </div>
            <input style={styles.input} placeholder="Naam wedstrijd" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <input style={styles.input} placeholder="Datum (bv. 20 Okt 2024)" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={styles.input} placeholder="Locatie" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleCreateCompetition}>Aanmaken</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BEWERKEN */}
      {showEditCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Wedstrijd Aanpassen</h3>
            <input style={styles.input} value={editCompData.name} onChange={e => setEditCompData({...editCompData, name: e.target.value})} />
            <input style={styles.input} value={editCompData.date} onChange={e => setEditCompData({...editCompData, date: e.target.value})} />
            <input style={styles.input} value={editCompData.location} onChange={e => setEditCompData({...editCompData, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1 }} onClick={handleUpdateCompetition}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
