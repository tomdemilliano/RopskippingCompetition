import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Activity, Coffee
} from 'lucide-react';

/**
 * CONFIGURATIE & INITIALISATIE - BEHOUDEN (Environment Variables)
 */
const getFirebaseConfig = () => {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try { return JSON.parse(rawConfig); } catch (e) { console.error("Fout bij parsen", e); }
    } else { return rawConfig; }
  }
  if (typeof __firebase_config !== 'undefined') { return JSON.parse(__firebase_config); }
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
  
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', events: [] });
  const [csvInput, setCsvInput] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
        onAuthStateChanged(auth, (u) => { if (u) { setUser(u); setIsAuthReady(true); } });
      } catch (e) { console.error("Firebase Init Error", e); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db) return;
    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
    onSnapshot(sRef, (d) => d.exists() && setSettings(d.data()));
    onSnapshot(cRef, s => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !selectedCompetitionId) { setParticipants({}); return; }
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants');
    return onSnapshot(pRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    });
  }, [selectedCompetitionId, isAuthReady]);

  const toggleEventInComp = async (eventName) => {
    const comp = competitions.find(c => c.id === selectedCompetitionId);
    const newEvents = comp.events?.includes(eventName) 
      ? comp.events.filter(e => e !== eventName)
      : [...(comp.events || []), eventName];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId), { events: newEvents });
  };

  const handleCsvUpload = async () => {
    if (!csvInput || !selectedCompetitionId || !showUploadModal) return;
    const batch = writeBatch(db);
    const rows = csvInput.split('\n').filter(r => r.trim());
    const event = showUploadModal;
    const eventKey = event.replace(/\s/g, '');

    rows.forEach((row, index) => {
      if (index === 0 && row.toLowerCase().includes('reeks')) return; // skip header

      const columns = row.split(',').map(s => s.trim());
      
      if (event === 'Freestyle') {
        // Structuur: reeks, uur, veld, club, skipper
        const [reeks, uur, veld, club, skipper] = columns;
        if (!reeks) return;

        const isPause = (club?.toLowerCase() === 'pauze' || !skipper);
        const pid = isPause ? `pause_${reeks}` : `p_${(skipper + club).replace(/\s/g, '_').toLowerCase()}`;
        
        const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid);
        
        batch.set(pRef, {
          id: pid,
          naam: isPause ? 'PAUZE' : skipper,
          club: isPause ? '' : club,
          isPause: isPause,
          events: arrayUnion(event),
          [`reeks_${eventKey}`]: reeks,
          [`uur_${eventKey}`]: uur,
          [`veld_${eventKey}`]: veld
        }, { merge: true });

      } else {
        // Speed/Endurance/DU/TU logica: reeks, onderdeel, uur, veld1_club, veld1_skipper, ...
        const reeks = columns[0];
        const uur = columns[2];
        
        for (let i = 3; i < columns.length; i += 2) {
          const club = columns[i];
          const naam = columns[i+1];
          const veldNummer = Math.floor((i - 3) / 2) + 1;

          if (naam && naam !== "") {
            const pid = `p_${(naam + club).replace(/\s/g, '_').toLowerCase()}`;
            const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pid);
            
            batch.set(pRef, {
              id: pid, naam, club, isPause: false,
              events: arrayUnion(event),
              [`reeks_${eventKey}`]: reeks,
              [`veld_${eventKey}`]: veldNummer,
              [`uur_${eventKey}`]: uur
            }, { merge: true });
          }
        }
      }
    });

    await batch.commit();
    setCsvInput('');
    setShowUploadModal(null);
  };

  const removeParticipant = async (pId, eventName = null) => {
    const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants', pId);
    if (eventName) {
      await updateDoc(pRef, { events: arrayRemove(eventName) });
    } else if (window.confirm("Dit record (deelnemer of pauze) volledig schrappen?")) {
      await deleteDoc(pRef);
    }
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f4f7f9', color: '#334155' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
    card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
    primaryBtn: { padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' },
    secondaryBtn: { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
    input: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' },
    badge: { padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }
  };

  const selectedComp = competitions.find(c => c.id === selectedCompetitionId);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setView('management')} style={{ ...styles.secondaryBtn, borderColor: view === 'management' ? '#2563eb' : '#cbd5e1' }}>Beheer</button>
          <button onClick={() => setView('live')} style={styles.secondaryBtn}>Live Display</button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
          
          <aside>
            <button onClick={() => setShowAddCompModal(true)} style={{ ...styles.primaryBtn, width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <Plus size={20} /> Nieuwe Wedstrijd
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {competitions.map(c => (
                <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{ 
                  ...styles.card, cursor: 'pointer', padding: '1rem', 
                  borderColor: selectedCompetitionId === c.id ? '#2563eb' : '#e2e8f0',
                  backgroundColor: selectedCompetitionId === c.id ? '#f0f7ff' : '#fff'
                }}>
                  <div style={{ fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}><Calendar size={12}/> {c.date}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}><MapPin size={12}/> {c.location}</div>
                </div>
              ))}
            </div>
          </aside>

          <section>
            {selectedComp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>{selectedComp.name}</h1>
                    <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: selectedComp.id })} 
                      style={{ ...styles.primaryBtn, backgroundColor: settings.activeCompetitionId === selectedComp.id ? '#10b981' : '#2563eb' }}>
                      {settings.activeCompetitionId === selectedComp.id ? 'Huidige Actieve Wedstrijd' : 'Stel in als Actief'}
                    </button>
                  </div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Beschikbare Onderdelen</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {POSSIBLE_ONDERDELEN.map(ond => {
                      const isActive = selectedComp.events?.includes(ond);
                      return (
                        <button key={ond} onClick={() => toggleEventInComp(ond)}
                          style={{ ...styles.secondaryBtn, backgroundColor: isActive ? '#2563eb' : '#fff', color: isActive ? '#fff' : '#475569' }}>
                          {isActive ? '✓ ' : '+ '} {ond}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {selectedComp.events?.map(ond => {
                    const ondParts = Object.values(participants).filter(p => p.events?.includes(ond) && !p.isPause);
                    const ondPauses = Object.values(participants).filter(p => p.events?.includes(ond) && p.isPause);
                    const eventKey = ond.replace(/\s/g, '');
                    const reeksen = new Set(Object.values(participants).filter(p => p.events?.includes(ond)).map(p => p[`reeks_${eventKey}`])).size;
                    
                    return (
                      <div key={ond} style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{ond}</div>
                          <button onClick={() => setShowUploadModal(ond)} style={{ ...styles.primaryBtn, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                            <Upload size={14}/> CSV Import
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>DEELNEMERS</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{ondParts.length}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>TOTAAL REEKSEN</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{reeksen}</div>
                          </div>
                        </div>
                        {ondPauses.length > 0 && <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Bevat {ondPauses.length} pauzes</div>}
                      </div>
                    );
                  })}
                </div>

                <div style={styles.card}>
                  <h3 style={{ margin: '0 0 1.5rem 0', fontWeight: 900 }}>Overzicht Deelnemers & Planning</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '1rem' }}>NAAM / TYPE</th>
                        <th style={{ padding: '1rem' }}>CLUB</th>
                        <th style={{ padding: '1rem' }}>ONDERDELEN & REEKSEN</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>ACTIES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(participants).sort((a,b) => a.naam.localeCompare(b.naam)).map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc', backgroundColor: p.isPause ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '1rem', fontWeight: 700 }}>
                            {p.isPause ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}><Coffee size={14}/> PAUZE</span> : p.naam}
                          </td>
                          <td style={{ padding: '1rem', color: '#64748b' }}>{p.club}</td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {p.events?.map(ev => {
                                const key = ev.replace(/\s/g, '');
                                return (
                                  <span key={ev} style={{ ...styles.badge, color: p.isPause ? '#b45309' : '#1e293b' }}>
                                    {ev}: R{p[`reeks_${key}`]} {p[`veld_${key}`] ? `| ${p[`veld_${key}`]}` : ''}
                                    <button onClick={() => removeParticipant(p.id, ev)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={12}/></button>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            <button onClick={() => removeParticipant(p.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center', padding: '8rem 2rem', color: '#94a3b8' }}>
                <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }}/>
                <div>Selecteer een wedstrijd om te beheren.</div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* MODAL: NIEUWE WEDSTRIJD */}
      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Nieuwe Wedstrijd</h2>
            <input style={styles.input} placeholder="Naam Wedstrijd" onChange={e => setNewComp({...newComp, name: e.target.value})} />
            <input type="date" style={styles.input} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            <input style={styles.input} placeholder="Locatie" onChange={e => setNewComp({...newComp, location: e.target.value})} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={async () => {
                if(!newComp.name) return;
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), { ...newComp, createdAt: new Date().toISOString() });
                setShowAddCompModal(false);
              }}>Opslaan</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CSV UPLOAD */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '90%', maxWidth: '900px' }}>
            <h2 style={{ marginTop: 0, fontWeight: 900 }}>Import: {showUploadModal}</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              {showUploadModal === 'Freestyle' 
                ? "Formaat: reeks, uur, veld, club, skipper (Pauze: vul 'Pauze' in bij club of laat skipper leeg)" 
                : "Formaat: reeks, onderdeel, uur, veld1_club, veld1_skipper, ..."}
            </p>
            <textarea 
              style={{ ...styles.input, height: '350px', fontFamily: 'monospace', fontSize: '0.75rem' }} 
              placeholder="Plak CSV data hier..."
              value={csvInput}
              onChange={e => setCsvInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.primaryBtn, flex: 1, justifyContent: 'center' }} onClick={handleCsvUpload}>Start Import</button>
              <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => { setShowUploadModal(null); setCsvInput(''); }}>Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
