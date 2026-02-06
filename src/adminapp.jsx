import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, query, where, arrayRemove
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Users, Settings, Plus, Trash2, Upload, LayoutGrid, FileText, ChevronRight, X, AlertCircle
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE
 * Behoudt exact dezelfde logica als de originele file.
 */
const getFirebaseConfig = () => {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try {
        return JSON.parse(rawConfig);
      } catch (e) {
        console.error("Fout bij het parsen van Firebase config", e);
      }
    } else {
      return rawConfig;
    }
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const app = (getApps().length === 0 && firebaseConfig) ? initializeApp(firebaseConfig) : (getApps()[0] || null);
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [view, setView] = useState('overview'); // overview, manage_comp
  const [participants, setParticipants] = useState({});
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  // Auth Effect
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      if (token) {
        await signInWithCustomToken(auth, token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Fetch Competitions
  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(collection(db, 'competitions'), (snap) => {
      setCompetitions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  // Fetch Data for Selected Competition
  useEffect(() => {
    if (!db || !selectedCompId) return;
    
    const unsubParticipants = onSnapshot(collection(db, `competitions/${selectedCompId}/participants`), (snap) => {
      const p = {};
      snap.forEach(d => p[d.id] = d.data());
      setParticipants(p);
    });

    const unsubEvents = onSnapshot(collection(db, `competitions/${selectedCompId}/events`), (snap) => {
      const e = {};
      snap.forEach(d => e[d.id] = d.data());
      setEvents(e);
    });

    return () => {
      unsubParticipants();
      unsubEvents();
    };
  }, [selectedCompId]);

  const handleFileUpload = async (eventId, eventType, csvText) => {
    if (!db || !selectedCompId) return;
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const batch = writeBatch(db);
    const newItems = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const data = {};
      headers.forEach((h, idx) => data[h] = values[idx]);

      // Basis structuur voor deelnemer koppeling
      const item = {
        skipperId: data.skipperid || data.id || `s_${Date.now()}_${i}`,
        naam: data.naam || data.name || 'Onbekend',
        club: data.club || '',
        reeks: parseInt(data.reeks || data.heat || '1'),
        veld: parseInt(data.veld || data.station || '1'),
        timestamp: Date.now()
      };

      if (eventType === 'freestyle') {
        // Freestyle specifieke velden
        item.status = 'ready';
        item.scores = { difficulty: 0, presentation: 0, required: 0, deduction: 0 };
      } else {
        // Speed specifieke velden
        item.clicks = 0;
        item.falseStarts = 0;
        item.isFinished = false;
      }

      newItems.push(item);
      
      // Update ook de centrale deelnemerslijst van de wedstrijd
      const partDoc = doc(db, `competitions/${selectedCompId}/participants`, item.skipperId);
      batch.set(partDoc, { 
        naam: item.naam, 
        club: item.club, 
        lastUpdated: Date.now() 
      }, { merge: true });
    }

    // Update de event data (voeg items toe aan de bestaande lijst)
    const eventRef = doc(db, `competitions/${selectedCompId}/events`, eventId);
    const currentEvent = events[eventId];
    const updatedItems = [...(currentEvent.items || []), ...newItems];
    
    batch.update(eventRef, { items: updatedItems });
    await batch.commit();
    alert(`${newItems.length} deelnemers succesvol toegevoegd aan ${eventId}`);
  };

  const removeParticipantFromEvent = async (eventId, skipperId) => {
    if (!window.confirm("Weet je zeker dat je deze deelnemer wilt verwijderen uit dit onderdeel?")) return;
    const eventRef = doc(db, `competitions/${selectedCompId}/events`, eventId);
    const updatedItems = events[eventId].items.filter(item => item.skipperId !== skipperId);
    await updateDoc(eventRef, { items: updatedItems });
  };

  const deleteFullParticipant = async (skipperId) => {
    if (!window.confirm("Dit verwijdert de deelnemer VOLLEDIG uit de wedstrijd en alle onderdelen. Doorgaan?")) return;
    const batch = writeBatch(db);
    
    // Verwijder uit elk event
    Object.keys(events).forEach(eventId => {
      const event = events[eventId];
      if (event.items && event.items.find(i => i.skipperId === skipperId)) {
        const filtered = event.items.filter(i => i.skipperId !== skipperId);
        batch.update(doc(db, `competitions/${selectedCompId}/events`, eventId), { items: filtered });
      }
    });

    // Verwijder uit deelnemerslijst
    batch.delete(doc(db, `competitions/${selectedCompId}/participants`, skipperId));
    await batch.commit();
  };

  const createEvent = async (type) => {
    const name = window.prompt(`Naam voor het nieuwe ${type} onderdeel:`, type.toUpperCase());
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await setDoc(doc(db, `competitions/${selectedCompId}/events`, id), {
      name,
      type,
      items: []
    });
  };

  if (!firebaseConfig) return <div style={{padding: '2rem', textAlign: 'center'}}>Firebase configuratie ontbreekt in environment variabelen.</div>;

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh', 
      color: '#1e293b' 
    }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#fff', 
        padding: '1rem 2rem', 
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={28} color="#2563eb" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Ropescore Pro <span style={{color: '#64748b', fontWeight: 400}}>| Beheer</span></h1>
        </div>
        {selectedCompId && (
          <button 
            onClick={() => setSelectedCompId(null)}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
          >
            Terug naar overzicht
          </button>
        )}
      </header>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
        
        {/* Overview: Lijst van wedstrijden */}
        {!selectedCompId && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Wedstrijden</h2>
              <button 
                onClick={async () => {
                  const n = window.prompt("Naam van nieuwe wedstrijd:");
                  if(n) await addDoc(collection(db, 'competitions'), { name: n, date: new Date().toISOString() });
                }}
                style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={18} /> Nieuwe Wedstrijd
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {competitions.map(comp => (
                <div key={comp.id} onClick={() => setSelectedCompId(comp.id)} style={{ 
                  backgroundColor: '#fff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', cursor: 'pointer',
                  transition: 'transform 0.1s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>{comp.name}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{new Date(comp.date).toLocaleDateString('nl-BE')}</p>
                  <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.8rem' }}><strong>ID:</strong> {comp.id}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competition Management */}
        {selectedCompId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
            
            {/* Left: Events */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Onderdelen</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => createEvent('speed')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #2563eb', color: '#2563eb', background: 'none', cursor: 'pointer' }}>+ Speed</button>
                  <button onClick={() => createEvent('freestyle')} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #0891b2', color: '#0891b2', background: 'none', cursor: 'pointer' }}>+ Freestyle</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(events).map(([id, event]) => {
                  const reeksen = [...new Set((event.items || []).map(i => i.reeks))].length;
                  const deelnemers = (event.items || []).length;
                  
                  return (
                    <div key={id} style={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfd' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: event.type === 'freestyle' ? '#0891b2' : '#2563eb', backgroundColor: event.type === 'freestyle' ? '#ecfeff' : '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', marginRight: '0.5rem' }}>
                            {event.type}
                          </span>
                          <strong style={{ fontSize: '1.1rem' }}>{event.name}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 600 }}>{reeksen} reeksen</div>
                            <div style={{ color: '#64748b' }}>{deelnemers} deelnemers</div>
                          </div>
                          <button 
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.csv';
                              input.onchange = (e) => {
                                const file = e.target.files[0];
                                const reader = new FileReader();
                                reader.onload = (re) => handleFileUpload(id, event.type, re.target.result);
                                reader.readAsText(file);
                              };
                              input.click();
                            }}
                            title="Upload CSV"
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'pointer', background: '#fff' }}
                          >
                            <Upload size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if(window.confirm("Verwijder dit onderdeel?")) await deleteDoc(doc(db, `competitions/${selectedCompId}/events`, id));
                            }}
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #fee2e2', color: '#dc2626', cursor: 'pointer', background: '#fff' }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Lijst van deelnemers in dit onderdeel */}
                      <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 }}>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                              <th style={{ padding: '0.5rem' }}>R/V</th>
                              <th style={{ padding: '0.5rem' }}>Naam</th>
                              <th style={{ padding: '0.5rem' }}>Actie</th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.items?.sort((a,b) => a.reeks - b.reeks || a.veld - b.veld).map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <td style={{ padding: '0.4rem 0.5rem', color: '#64748b' }}>{item.reeks}/{item.veld}</td>
                                <td style={{ padding: '0.4rem 0.5rem' }}><strong>{item.naam}</strong> <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>{item.club}</span></td>
                                <td style={{ padding: '0.4rem 0.5rem' }}>
                                  <button 
                                    onClick={() => removeParticipantFromEvent(id, item.skipperId)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Master Participant List */}
            <div style={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.5rem', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} /> Alle Deelnemers ({Object.keys(participants).length})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(participants).sort((a,b) => a[1].naam.localeCompare(b[1].naam)).map(([id, p]) => {
                  const subEvents = Object.values(events).filter(e => e.items?.some(i => i.skipperId === id));
                  
                  return (
                    <div key={id} style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.naam}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.club || 'Geen club'}</div>
                        </div>
                        <button 
                          onClick={() => deleteFullParticipant(id)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {subEvents.map(se => (
                          <span key={se.name} style={{ fontSize: '0.65rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                            {se.name}
                          </span>
                        ))}
                        {subEvents.length === 0 && <span style={{ fontSize: '0.65rem', fontStyle: 'italic', color: '#94a3b8' }}>Geen onderdelen</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Inline styles helper for CSV expectations */}
      {selectedCompId && (
        <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', maxWidth: '300px', backgroundColor: '#1e293b', color: '#fff', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.75rem', opacity: 0.9 }}>
          <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Info size={14} /> CSV Formaat</h4>
          <code style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '0.25rem' }}>
            skipperid,naam,club,reeks,veld
          </code>
          <p style={{ marginTop: '0.5rem' }}>Gebruik komma's als scheidingsteken.</p>
        </div>
      )}
    </div>
  );
}
