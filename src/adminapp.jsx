import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, query, where, arrayRemove
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Users, Settings, Plus, Trash2, Upload, LayoutGrid, FileText, ChevronRight, X, AlertCircle, Info, Calendar, MapPin, Trophy as TrophyIcon
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE
 */
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : (import.meta.env.VITE_FIREBASE_CONFIG ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) : null);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-default';

const app = (getApps().length === 0 && firebaseConfig) ? initializeApp(firebaseConfig) : (getApps()[0] || null);
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newComp, setNewComp] = useState({ name: '', location: '', date: '' });

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    const unsubscribe = onSnapshot(q, (snap) => {
      setCompetitions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Fout bij ophalen wedstrijden:", err);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!db || !user || !selectedCompId) return;
    const partRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'participants');
    const unsubParticipants = onSnapshot(partRef, (snap) => {
      const p = {};
      snap.forEach(d => p[d.id] = d.data());
      setParticipants(p);
    });

    const eventRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events');
    const unsubEvents = onSnapshot(eventRef, (snap) => {
      const e = {};
      snap.forEach(d => e[d.id] = d.data());
      setEvents(e);
    });

    return () => {
      unsubParticipants();
      unsubEvents();
    };
  }, [selectedCompId, user]);

  const handleFileUpload = async (eventId, eventType, csvText) => {
    if (!db || !user || !selectedCompId) return;
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const batch = writeBatch(db);
    const newItems = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const data = {};
      headers.forEach((h, idx) => data[h] = values[idx]);

      const skipperId = data.skipperid || data.id || `s_${Date.now()}_${i}`;
      const item = {
        skipperId,
        naam: data.naam || data.name || 'Onbekend',
        club: data.club || '',
        reeks: parseInt(data.reeks || data.heat || '1'),
        veld: parseInt(data.veld || data.station || '1'),
        timestamp: Date.now()
      };

      if (eventType === 'freestyle') {
        item.status = 'ready';
        item.scores = { difficulty: 0, presentation: 0, required: 0, deduction: 0 };
      } else {
        item.clicks = 0;
        item.falseStarts = 0;
        item.isFinished = false;
      }

      newItems.push(item);
      
      const partDoc = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'participants', skipperId);
      batch.set(partDoc, { naam: item.naam, club: item.club, lastUpdated: Date.now() }, { merge: true });
    }

    const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events', eventId);
    const updatedItems = [...(events[eventId].items || []), ...newItems];
    batch.update(eventRef, { items: updatedItems });
    await batch.commit();
    alert("CSV succesvol geïmporteerd!");
  };

  const removeParticipantFromEvent = async (eventId, skipperId) => {
    if (!window.confirm("Verwijderen uit dit onderdeel?")) return;
    const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events', eventId);
    const updatedItems = events[eventId].items.filter(item => item.skipperId !== skipperId);
    await updateDoc(eventRef, { items: updatedItems });
  };

  const deleteFullParticipant = async (skipperId) => {
    if (!window.confirm("Deelnemer volledig schrappen?")) return;
    const batch = writeBatch(db);
    Object.keys(events).forEach(eventId => {
      const filtered = events[eventId].items?.filter(i => i.skipperId !== skipperId);
      if (filtered) batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events', eventId), { items: filtered });
    });
    batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'participants', skipperId));
    await batch.commit();
  };

  const createEvent = async (type) => {
    const name = window.prompt(`Naam voor het nieuwe ${type} onderdeel:`, type.toUpperCase());
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events', id), { name, type, items: [] });
  };

  const submitCompetition = async (e) => {
    e.preventDefault();
    if (!newComp.name || !newComp.date) return;
    
    // Format date from yyyy-mm-dd to dd-mm-yyyy
    const parts = newComp.date.split('-');
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

    const compRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    await addDoc(compRef, { 
      name: newComp.name, 
      location: newComp.location, 
      date: formattedDate,
      createdAt: new Date().toISOString() 
    });
    
    setNewComp({ name: '', location: '', date: '' });
    setIsModalOpen(false);
  };

  if (!firebaseConfig) return <div style={{padding: '2rem', textAlign: 'center'}}>Firebase configuratie ontbreekt.</div>;
  if (!user) return <div style={{padding: '2rem', textAlign: 'center'}}>Bezig met inloggen...</div>;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      
      {/* Modal: Nieuwe Wedstrijd */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '1.25rem', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Nieuwe Wedstrijd</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={24}/></button>
            </div>
            <form onSubmit={submitCompetition} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Naam Wedstrijd</label>
                <div style={{ position: 'relative' }}>
                  <TrophyIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input required type="text" placeholder="bijv. BK Ropeskipping 2026" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none', transition: 'border-color 0.2s' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Locatie</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input type="text" placeholder="Stad of sporthal" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Datum</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input required type="date" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', outline: 'none' }} />
                </div>
              </div>
              <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.875rem', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.2s' }}>Wedstrijd Aanmaken</button>
            </form>
          </div>
        </div>
      )}

      <header style={{ backgroundColor: '#fff', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={28} color="#2563eb" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Ropescore Pro <span style={{color: '#64748b', fontWeight: 400}}>| Beheer</span></h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {selectedCompId && <button onClick={() => setSelectedCompId(null)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Overzicht</button>}
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {!selectedCompId ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Wedstrijden</h2>
              <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={18} /> Nieuwe Wedstrijd
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {competitions.map(comp => (
                <div key={comp.id} onClick={() => setSelectedCompId(comp.id)} style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontWeight: 700, fontSize: '1.1rem' }}>{comp.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                      <Calendar size={14} /> {comp.date}
                    </div>
                    {comp.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                        <MapPin size={14} /> {comp.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
            {/* Content for Competition Details (same as before) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Onderdelen</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => createEvent('speed')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #2563eb', color: '#2563eb', background: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Speed</button>
                  <button onClick={() => createEvent('freestyle')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #0891b2', color: '#0891b2', background: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Freestyle</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(events).map(([id, event]) => (
                  <div key={id} style={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfd' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: event.type === 'freestyle' ? '#0891b2' : '#2563eb', backgroundColor: event.type === 'freestyle' ? '#ecfeff' : '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', marginRight: '0.5rem' }}>{event.type.toUpperCase()}</span>
                        <strong>{event.name}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file'; input.accept = '.csv';
                          input.onchange = (e) => {
                            const reader = new FileReader();
                            reader.onload = (re) => handleFileUpload(id, event.type, re.target.result);
                            reader.readAsText(e.target.files[0]);
                          };
                          input.click();
                        }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}><Upload size={16} /></button>
                        <button onClick={async () => { if(window.confirm("Verwijder onderdeel?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompId, 'events', id)); }} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #fee2e2', color: '#dc2626', background: '#fff', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                        <tbody>
                          {event.items?.sort((a,b) => a.reeks - b.reeks || a.veld - b.veld).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '0.4rem 0.5rem', color: '#64748b' }}>{item.reeks}/{item.veld}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}><strong>{item.naam}</strong></td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}><button onClick={() => removeParticipantFromEvent(id, item.skipperId)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.5rem', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} /> Deelnemers ({Object.keys(participants).length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(participants).sort((a,b) => a[1].naam.localeCompare(b[1].naam)).map(([id, p]) => (
                  <div key={id} style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.naam}</div>
                      <button onClick={() => deleteFullParticipant(id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.club}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
