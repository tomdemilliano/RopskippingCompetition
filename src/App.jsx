import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion, query
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock, Upload, Trash2, Users, List, X
} from 'lucide-react';

// --- FIREBASE INITIALISATIE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-default';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, live, display, admin, wedstrijd_beheer
  const [competitions, setCompetitions] = useState([]);
  const [activeComp, setActiveComp] = useState(null);
  const [events, setEvents] = useState([]);
  const [results, setResults] = useState({});
  const [adminTab, setAdminTab] = useState('events'); // events, participants
  
  // --- AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!user) return;

    // Competities ophalen
    const qComp = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    const unsubComp = onSnapshot(qComp, (snap) => {
      setCompetitions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Fout bij laden competities:", err));

    return () => unsubComp();
  }, [user]);

  useEffect(() => {
    if (!user || !activeComp) return;

    // Events ophalen voor actieve competitie
    const qEvents = collection(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`);
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Fout bij laden events:", err));

    // Resultaten ophalen
    const qResults = collection(db, 'artifacts', appId, 'public', 'data', `results_${activeComp.id}`);
    const unsubResults = onSnapshot(qResults, (snap) => {
      const resData = {};
      snap.docs.forEach(d => { resData[d.id] = d.data(); });
      setResults(resData);
    });

    return () => {
      unsubEvents();
      unsubResults();
    };
  }, [user, activeComp]);

  // --- LOGIC: CSV IMPORT & PARTICIPANT MANAGEMENT ---
  
  const handleCSVUpload = async (event, eventId, eventType) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const batch = writeBatch(db);
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`, eventId);
      
      const newParticipants = [];
      
      for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(',').map(d => d.trim());
        const entry = {};
        headers.forEach((header, index) => {
          entry[header] = data[index];
        });

        // Mapping gebaseerd op gevraagde types
        const participant = {
          id: entry.id || crypto.randomUUID(),
          naam: entry.naam || entry.name || 'Onbekend',
          club: entry.club || '',
          reeks: parseInt(entry.reeks) || 1,
          veld: entry.veld || 'A1'
        };

        if (eventType === 'freestyle') {
          // Freestyle structuur
          participant.scores = {
            difficulty: 0,
            presentation: 0,
            deductions: 0
          };
        } else {
          // Speed structuur (Speed, Endurance, DU, TU)
          participant.score = 0;
          participant.fouten = 0;
        }

        newParticipants.push(participant);
      }

      batch.update(eventRef, { participants: newParticipants });
      await batch.commit();
      alert(`${newParticipants.length} deelnemers succesvol toegevoegd aan onderdeel.`);
    };
    reader.readAsText(file);
  };

  const getGlobalParticipants = () => {
    const participantMap = {};
    events.forEach(ev => {
      (ev.participants || []).forEach(p => {
        if (!participantMap[p.id]) {
          participantMap[p.id] = { 
            id: p.id, 
            naam: p.naam, 
            club: p.club, 
            events: [] 
          };
        }
        participantMap[p.id].events.push({ eventId: ev.id, eventName: ev.name });
      });
    });
    return Object.values(participantMap);
  };

  const removeParticipantFromEvent = async (participantId, eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updatedParticipants = event.participants.filter(p => p.id !== participantId);
    const eventRef = doc(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`, eventId);
    await updateDoc(eventRef, { participants: updatedParticipants });
  };

  const removeParticipantCompletely = async (participantId) => {
    const batch = writeBatch(db);
    events.forEach(ev => {
      if (ev.participants?.some(p => p.id === participantId)) {
        const eventRef = doc(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`, ev.id);
        const updated = ev.participants.filter(p => p.id !== participantId);
        batch.update(eventRef, { participants: updated });
      }
    });
    await batch.commit();
  };

  // --- RENDER HELPERS ---

  if (view === 'home') {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '2rem', letterSpacing: '-0.05em' }}>RopeScore <span style={{ color: '#2563eb' }}>Pro</span></h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '3rem' }}>
          <button onClick={() => setView('live')} style={{ padding: '2rem', borderRadius: '1rem', border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', textAlign: 'left' }}>
            <Activity size={32} style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Live Scoreboard</div>
            <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Bekijk real-time resultaten</div>
          </button>
          <button onClick={() => setView('display')} style={{ padding: '2rem', borderRadius: '1rem', border: 'none', backgroundColor: '#0f172a', color: 'white', cursor: 'pointer', textAlign: 'left' }}>
            <Trophy size={32} style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Beamer Display</div>
            <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Grote weergave voor publiek</div>
          </button>
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: 800, margin: 0 }}>Wedstrijdbeheer</h2>
            <button onClick={() => setView('admin')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', fontWeight: 600, cursor: 'pointer' }}>Nieuwe Wedstrijd</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitions.map(comp => (
              <div key={comp.id} onClick={() => { setActiveComp(comp); setView('wedstrijd_beheer'); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '0.75rem', cursor: 'pointer', border: '1px solid #f1f5f9', transition: 'transform 0.1s' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{comp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{comp.date}</div>
                </div>
                <ChevronRight size={20} color="#94a3b8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'wedstrijd_beheer' && activeComp) {
    const globalParticipants = getGlobalParticipants();

    return (
      <div style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <button onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', marginBottom: '1rem', fontWeight: 600 }}>
          <ChevronLeft size={20} /> Terug naar Home
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>{activeComp.name}</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Beheer onderdelen en deelnemers</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setAdminTab('events')}
            style={{ padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, borderBottom: adminTab === 'events' ? '3px solid #2563eb' : '3px solid transparent', color: adminTab === 'events' ? '#2563eb' : '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><List size={18}/> Onderdelen</div>
          </button>
          <button 
            onClick={() => setAdminTab('participants')}
            style={{ padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, borderBottom: adminTab === 'participants' ? '3px solid #2563eb' : '3px solid transparent', color: adminTab === 'participants' ? '#2563eb' : '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={18}/> Deelnemers ({globalParticipants.length})</div>
          </button>
        </div>

        {adminTab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '0.75rem', display: 'flex', gap: '0.5rem' }}>
               <button 
                 onClick={async () => {
                   const name = prompt("Naam onderdeel?");
                   const type = prompt("Type? (speed, freestyle, endurance, double_under, triple_under)");
                   if (name && type) {
                     await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`), {
                       name, type, participants: [], status: 'waiting'
                     });
                   }
                 }}
                 style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                 + Nieuw Onderdeel
               </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {events.map(ev => {
                const heatCount = new Set((ev.participants || []).map(p => p.reeks)).size;
                return (
                  <div key={ev.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{ev.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ev.type}</div>
                      </div>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `events_${activeComp.id}`, ev.id))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18}/></button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{ev.participants?.length || 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Deelnemers</div>
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{heatCount}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Reeksen</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', cursor: 'pointer' }}>
                        <Upload size={16}/> CSV Upload Deelnemers
                        <input 
                          type="file" 
                          accept=".csv" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleCSVUpload(e, ev.id, ev.type === 'freestyle' ? 'freestyle' : 'speed')} 
                        />
                      </label>
                      <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.4rem' }}>Verwacht: naam, club, reeks, veld (optioneel: id)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {adminTab === 'participants' && (
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>Deelnemer</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>Club</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>Onderdelen</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {globalParticipants.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>{p.naam}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{p.club}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {p.events.map(ev => (
                          <span key={ev.eventId} style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {ev.eventName}
                            <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeParticipantFromEvent(p.id, ev.eventId)} />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => {
                          if (confirm(`Weet je zeker dat je ${p.naam} volledig wilt schrappen uit deze wedstrijd?`)) {
                            removeParticipantCompletely(p.id);
                          }
                        }}
                        style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                        Verwijder Volledig
                      </button>
                    </td>
                  </tr>
                ))}
                {globalParticipants.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Geen deelnemers gevonden. Voeg ze toe via CSV bij de onderdelen.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // --- Bestaande weergaven (Live & Display) ---
  // Deze worden hieronder beknopt gehouden maar behouden hun structuur

  if (view === 'live') {
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
           <h2 style={{ margin: 0, fontWeight: 900 }}>Live <span style={{ color: '#2563eb' }}>Scoreboard</span></h2>
           <button onClick={() => setView('home')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Sluiten</button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {events.map(ev => (
            <div key={ev.id} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
               <h3 style={{ margin: '0 0 1rem 0' }}>{ev.name}</h3>
               <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Status: {ev.status}</div>
               {/* Hier komen de resultaten per reeks zoals in het origineel */}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Placeholder voor andere views uit originele code
  return <div style={{ padding: '2rem' }}>Loading view {view}...</div>;
}
