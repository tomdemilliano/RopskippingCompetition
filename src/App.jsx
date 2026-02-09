import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, addDoc, getDocs, setDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, Info, RotateCcw, Clock, MapPin, UserPlus, UserMinus, Play, Square, Check, ChevronRight, ChevronLeft, Mic2, FastForward, Flag, Users, UserCheck, UserX, Ghost
} from 'lucide-react';

// Importeer de nieuwe bestanden
import { APP_ID, COMPETITION_TYPES, isFreestyleType, getFirebaseConfig } from './constants';
import { styles } from './styles';
import LiveView from './components/LiveView';
import Modals from './components/Modals';

const firebaseConfig = getFirebaseConfig();
let app, auth, db;
const appId = APP_ID; // Gebruikt nu de constante uit constants.js

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
  const [filterStatus, setFilterStatus] = useState('alle');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Live State
  const [activeEvent, setActiveEvent] = useState(null);
  const [activeReeks, setActiveReeks] = useState(1);
  const [finishedReeksen, setFinishedReeksen] = useState({});
  const [finishedEvents, setFinishedEvents] = useState([]);

  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showEditCompModal, setShowEditCompModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(null);
  const [showEditParticipantModal, setShowEditParticipantModal] = useState(null);
  
  const [newComp, setNewComp] = useState({ 
    name: '', date: '', location: '', type: 'A Masters', 
    events: COMPETITION_TYPES['A Masters'], status: 'open', eventOrder: {} 
  });
  const [editCompData, setEditCompData] = useState({ name: '', date: '', location: '', type: '' });
  const [editParticipantData, setEditParticipantData] = useState(null);
  const [csvInput, setCsvInput] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!firebaseConfig) return; // Veiligheidshalve checken
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
    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), (d) => {
        if(d.exists()) {
            const s = d.data();
            setSettings(s);
            if (s.activeCompetitionId && !selectedCompetitionId) {
                setSelectedCompetitionId(s.activeCompetitionId);
            }
        }
    });

    onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'progress'), (d) => {
        if(d.exists()) {
            const data = d.data();
            setFinishedReeksen(data.finishedReeksen || {});
            setFinishedEvents(data.finishedEvents || []);
        }
    });

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
  const activeCompExists = competitions.some(c => c.status === 'bezig');

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

  useEffect(() => {
    if (sortedEvents.length > 0 && !activeEvent) {
        setActiveEvent(sortedEvents[0]);
    }
  }, [sortedEvents]);

  const filteredParticipants = useMemo(() => {
    return Object.values(participants).filter(p => {
      const matchesSearch = p.naam?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.club?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      const hasGeschraptOnderdeel = p.eventStatus && Object.values(p.eventStatus).includes('geschrapt');
      const isGeschrapt = p.status === 'geschrapt' || hasGeschraptOnderdeel;

      if (filterStatus === 'niet-aangemeld') {
        matchesFilter = !p.aanwezig && !isGeschrapt;
      } else if (filterStatus === 'aangemeld') {
        matchesFilter = p.aanwezig && !isGeschrapt;
      } else if (filterStatus === 'geschrapt') {
        matchesFilter = isGeschrapt;
      }

      return matchesSearch && matchesFilter;
    }).sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  }, [participants, searchTerm, filterStatus]);

  const liveParticipants = useMemo(() => {
    if (!activeEvent) return [];
    const eventKey = `reeks_${activeEvent.replace(/\s/g, '')}`;
    return Object.values(participants)
      .filter(p => p.events?.includes(activeEvent) && p.status !== 'geschrapt' && p.eventStatus?.[activeEvent] !== 'geschrapt')
      .sort((a, b) => {
        const ra = parseInt(a[eventKey]) || 0;
        const rb = parseInt(b[eventKey]) || 0;
        if (ra !== rb) return ra - rb;
        return (a[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || 0) - (b[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || 0);
      });
  }, [participants, activeEvent]);

  const reeksenInEvent = useMemo(() => {
    const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
    const r = [...new Set(liveParticipants.map(p => parseInt(p[eventKey])).filter(Boolean))];
    return r.sort((a, b) => a - b);
  }, [liveParticipants, activeEvent]);

  const currentReeksData = useMemo(() => {
    const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
    return liveParticipants.filter(p => parseInt(p[eventKey]) === activeReeks);
  }, [liveParticipants, activeReeks, activeEvent]);

  const plannedTime = useMemo(() => {
    if (currentReeksData.length === 0) return null;
    return currentReeksData[0][`detail_${activeEvent?.replace(/\s/g, '')}`]?.uur;
  }, [currentReeksData, activeEvent]);

  const timeDiff = useMemo(() => {
    if (!plannedTime) return null;
    const [pHours, pMinutes] = plannedTime.split(':').map(Number);
    const pDate = new Date();
    pDate.setHours(pHours, pMinutes, 0, 0);
    
    const diffMs = currentTime - pDate;
    return Math.floor(diffMs / 60000);
  }, [plannedTime, currentTime]);

  const handleFinishReeks = async () => {
    const isLaatsteReeks = activeReeks === reeksenInEvent[reeksenInEvent.length - 1];
    
    const newFinishedReeksen = {
        ...finishedReeksen,
        [activeEvent]: [...(finishedReeksen[activeEvent] || []), activeReeks]
    };
    
    let newFinishedEvents = [...finishedEvents];
    if (isLaatsteReeks && !newFinishedEvents.includes(activeEvent)) {
        newFinishedEvents.push(activeEvent);
    }

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'progress'), {
        finishedReeksen: newFinishedReeksen,
        finishedEvents: newFinishedEvents
    });

    const nextIdx = reeksenInEvent.indexOf(activeReeks) + 1;
    if (nextIdx < reeksenInEvent.length) {
        setActiveReeks(reeksenInEvent[nextIdx]);
    } else {
        const eventIdx = sortedEvents.indexOf(activeEvent) + 1;
        if (eventIdx < sortedEvents.length) {
            setActiveEvent(sortedEvents[eventIdx]);
            setActiveReeks(1);
        }
    }
  };

  const handleStartCompetition = async (compId) => {
    if (activeCompExists) {
        alert("Er is al een wedstrijd bezig. Beëindig deze eerst.");
        return;
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', compId), { status: 'bezig' });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: compId });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'progress'), { finishedReeksen: {}, finishedEvents: [] });
  };

  const handleEndCompetition = async (compId) => {
    if (window.confirm("Weet je zeker dat je deze wedstrijd wilt beëindigen?")) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', compId), { status: 'beëindigd' });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: null });
    }
  };

  const handleToggleAttendance = async (pId, current) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', pId), {
      aanwezig: !current
    });
  };

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
            batch.set(newRef, { naam, club, ...eventData, status: 'actief', aanwezig: false });
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
              batch.set(newRef, { naam, club, ...eventData, status: 'actief', aanwezig: false });
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
    setNewComp({ name: '', date: '', location: '', type: 'A Masters', events: COMPETITION_TYPES['A Masters'], status: 'open', eventOrder: {} });
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

  const toggleParticipantGlobalStatus = async (participantId, currentStatus) => {
    const newStatus = currentStatus === 'geschrapt' ? 'actief' : 'geschrapt';
    const p = participants[participantId];
    if (!p) return;

    const newEventStatus = {};
    if (p.events) {
      p.events.forEach(ev => {
        newEventStatus[ev] = newStatus;
      });
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', participantId), {
      status: newStatus,
      eventStatus: newEventStatus
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

  const renderManagement = () => (
    <div style={styles.layoutGrid}>
        <aside style={styles.column}>
          <button style={{ ...styles.btnPrimary, marginBottom: '0.5rem', justifyContent: 'center' }} onClick={() => setShowAddCompModal(true)}>+ Nieuwe wedstrijd</button>
          {competitions.map(c => {
            const isSelected = selectedCompetitionId === c.id;
            const isBezig = c.status === 'bezig';
            const isDone = c.status === 'beëindigd';
            const statusData = getCompDataStatus(c.id);
            
            return (
              <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
                padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', position: 'relative',
                border: '2px solid', 
                borderColor: isBezig ? '#ef4444' : (isSelected ? '#2563eb' : 'transparent'),
                backgroundColor: isDone ? '#f8fafc' : (isSelected ? '#f0f7ff' : '#fff'),
                opacity: isDone ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.name}</div>
                    {isBezig && <span style={styles.badgeLive}>LIVE</span>}
                    {isDone && <span style={styles.badgeDone}>BEËINDIGD</span>}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{c.type}</div>
                <div style={{ fontSize: '0.6rem', color: statusData.isComplete ? '#10b981' : '#f59e0b', marginTop: '4px', fontWeight: 'bold' }}>
                  {statusData.isComplete ? '✓ Data Compleet' : `! ${statusData.missingCount} leeg`}
                </div>
              </div>
            );
          })}
        </aside>

        <aside style={{ ...styles.column, backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>ONDERDELEN</div>
          {selectedComp ? sortedEvents.map((ond, idx) => {
            const activePartsInEvent = Object.values(participants).filter(p => 
                p.events?.includes(ond) && 
                p.status !== 'geschrapt' && 
                p.eventStatus?.[ond] !== 'geschrapt'
            );
            const count = activePartsInEvent.length;
            const isSpecial = isFreestyleType(ond);
            const reeksen = new Set(activePartsInEvent.map(p => p[`reeks_${ond.replace(/\s/g, '')}`]).filter(Boolean));
            const maxVeld = activePartsInEvent.reduce((max, p) => {
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
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{count} actieve skippers</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ margin: 0 }}>{selectedComp.name}</h2>
                        {selectedComp.status === 'bezig' && <span style={styles.badgeLive}>LIVE</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{selectedComp.type} | {selectedComp.location} | {selectedComp.date}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={styles.btnSecondary} onClick={() => {
                      setEditCompData({ name: selectedComp.name, date: selectedComp.date, location: selectedComp.location, type: selectedComp.type });
                      setShowEditCompModal(true);
                    }}><Edit2 size={16}/></button>
                    <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={handleDeleteComp}><Trash2 size={16}/></button>
                    
                    {selectedComp.status === 'bezig' ? (
                        <button style={{ ...styles.btnPrimary, background: '#ef4444' }} onClick={() => handleEndCompetition(selectedComp.id)}>
                            <Square size={16}/> Beëindig wedstrijd
                        </button>
                    ) : (
                        <button 
                            disabled={activeCompExists || selectedComp.status === 'beëindigd'} 
                            style={{ 
                                ...styles.btnPrimary, 
                                background: selectedComp.status === 'beëindigd' ? '#94a3b8' : '#10b981',
                                cursor: (activeCompExists || selectedComp.status === 'beëindigd') ? 'not-allowed' : 'pointer',
                                opacity: (activeCompExists || selectedComp.status === 'beëindigd') ? 0.6 : 1
                            }} 
                            onClick={() => handleStartCompetition(selectedComp.id)}
                        >
                            {selectedComp.status === 'beëindigd' ? <Check size={16}/> : <Play size={16}/>}
                            {selectedComp.status === 'beëindigd' ? 'Wedstrijd voltooid' : 'Start wedstrijd'}
                        </button>
                    )}
                  </div>
                </div>

                {/* Filters toegevoegd aan frame boven deelnemerslijst */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <button 
                      style={{ ...styles.filterBtn, borderColor: filterStatus === 'alle' ? '#2563eb' : '#e2e8f0', background: filterStatus === 'alle' ? '#f0f7ff' : '#fff', color: filterStatus === 'alle' ? '#2563eb' : '#64748b' }}
                      onClick={() => setFilterStatus('alle')}
                    >
                      <Users size={14}/> Alle
                    </button>
                    <button 
                      style={{ ...styles.filterBtn, borderColor: filterStatus === 'niet-aangemeld' ? '#f59e0b' : '#e2e8f0', background: filterStatus === 'niet-aangemeld' ? '#fffbeb' : '#fff', color: filterStatus === 'niet-aangemeld' ? '#d97706' : '#64748b' }}
                      onClick={() => setFilterStatus('niet-aangemeld')}
                    >
                      <UserPlus size={14}/> Niet aangemeld
                    </button>
                    <button 
                      style={{ ...styles.filterBtn, borderColor: filterStatus === 'aangemeld' ? '#10b981' : '#e2e8f0', background: filterStatus === 'aangemeld' ? '#f0fdf4' : '#fff', color: filterStatus === 'aangemeld' ? '#10b981' : '#64748b' }}
                      onClick={() => setFilterStatus('aangemeld')}
                    >
                      <UserCheck size={14}/> Aangemeld
                    </button>
                    <button 
                      style={{ ...styles.filterBtn, borderColor: filterStatus === 'geschrapt' ? '#ef4444' : '#e2e8f0', background: filterStatus === 'geschrapt' ? '#fef2f2' : '#fff', color: filterStatus === 'geschrapt' ? '#ef4444' : '#64748b' }}
                      onClick={() => setFilterStatus('geschrapt')}
                    >
                      <UserX size={14}/> Geschrapt
                    </button>
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
                      {filteredParticipants.map(p => {
                        const isGlobalGeschrapt = p.status === 'geschrapt';
                        return (
                          <tr key={p.id} style={{ 
                            borderBottom: '1px solid #f8fafc', 
                            opacity: isGlobalGeschrapt ? 0.5 : 1,
                            borderLeft: p.aanwezig ? '4px solid #10b981' : '4px solid transparent'
                          }}>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', textDecoration: isGlobalGeschrapt ? 'line-through' : 'none' }}>{p.naam}</td>
                            <td style={{ padding: '0.75rem', color: '#64748b' }}>{p.club}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                {sortedEvents.filter(ev => p.events?.includes(ev)).map(ev => {
                                  const isGeschrapt = p.eventStatus?.[ev] === 'geschrapt' || isGlobalGeschrapt;
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
                              <button 
                                style={{ border: 'none', background: 'none', color: p.aanwezig ? '#10b981' : '#cbd5e1', cursor: 'pointer', marginRight: '8px' }}
                                onClick={() => handleToggleAttendance(p.id, p.aanwezig)}
                                title={p.aanwezig ? "Afmelden" : "Aanmelden"}
                              >
                                <CheckCircle size={18}/>
                              </button>
                              <button style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', marginRight: '8px' }}
                                onClick={() => {
                                  setEditParticipantData({ ...p });
                                  setShowEditParticipantModal(true);
                                }}>
                                <Edit2 size={16}/>
                              </button>
                              <button 
                                style={{ border: 'none', background: 'none', color: isGlobalGeschrapt ? '#10b981' : '#ef4444', cursor: 'pointer' }} 
                                onClick={() => toggleParticipantGlobalStatus(p.id, p.status)}
                                title={isGlobalGeschrapt ? "Deelnemer herstellen" : "Deelnemer schrappen"}
                              >
                                {isGlobalGeschrapt ? <RotateCcw size={16}/> : <UserMinus size={16}/>}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div style={{ textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd aan de linkerkant.</div>}
        </main>
    </div>
  );

  return (
    <div style={styles.mainWrapper}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900 }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button style={{ ...styles.btnSecondary, background: view === 'management' ? '#2563eb' : '#fff', color: view === 'management' ? '#fff' : '#475569' }} onClick={() => setView('management')}>Beheer</button>
          <button style={{ ...styles.btnSecondary, background: view === 'live' ? '#2563eb' : '#fff', color: view === 'live' ? '#fff' : '#475569' }} onClick={() => setView('live')}>Live</button>
          <div style={{ 
            marginLeft: '1rem', 
            fontWeight: 'bold', 
            fontFamily: 'monospace', 
            fontSize: '1.1rem',
            background: '#f1f5f9',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            color: '#1e293b'
          }}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {view === 'management' ? renderManagement() : (
        <LiveView 
          selectedComp={selectedComp}
          activeEvent={activeEvent}
          setActiveEvent={setActiveEvent}
          activeReeks={activeReeks}
          setActiveReeks={setActiveReeks}
          reeksenInEvent={reeksenInEvent}
          liveParticipants={liveParticipants}
          currentReeksData={currentReeksData}
          plannedTime={plannedTime}
          timeDiff={timeDiff}
          finishedReeksen={finishedReeksen}
          finishedEvents={finishedEvents}
          handleFinishReeks={handleFinishReeks}
          sortedEvents={sortedEvents}
        />
      )}

      <style>{`
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0px rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0px rgba(239, 68, 68, 0); }
        }
      `}</style>


{/* --- Modals --- */}
{showEditParticipantModal && editParticipantData && (
  <div style={styles.modalOverlay}>
    <div style={{ ...styles.card, width: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Deelnemer aanpassen</h3>
        <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowEditParticipantModal(null)} />
      </div>
      
      <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
      <input style={styles.input} value={editParticipantData.naam} onChange={e => setEditParticipantData({...editParticipantData, naam: e.target.value})} />
      
      <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Club</label>
      <input style={styles.input} value={editParticipantData.club} onChange={e => setEditParticipantData({...editParticipantData, club: e.target.value})} />

      <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Onderdelen & Planning</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedComp.events.filter(ev => editParticipantData.events?.includes(ev)).map(ev => {
            const eventKey = ev.replace(/\s/g, '');
            const detail = editParticipantData[`detail_${eventKey}`] || {};
            const isEventGeschrapt = editParticipantData.eventStatus?.[ev] === 'geschrapt';
            
            return (
              <div key={ev} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '8px', 
                background: isEventGeschrapt ? '#fee2e2' : '#f8fafc',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isEventGeschrapt ? '#fecaca' : '#e2e8f0'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', textDecoration: isEventGeschrapt ? 'line-through' : 'none' }}>{ev}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Reeks {editParticipantData[`reeks_${eventKey}`] || '-'} | Veld {detail.veld || '-'} | {detail.uur || '--:--'}
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    const currentStatus = { ...(editParticipantData.eventStatus || {}) };
                    currentStatus[ev] = isEventGeschrapt ? 'actief' : 'geschrapt';
                    setEditParticipantData({ ...editParticipantData, eventStatus: currentStatus });
                  }}
                  style={{
                    ...styles.btnSecondary,
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    background: isEventGeschrapt ? '#10b981' : '#ef4444',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  {isEventGeschrapt ? 'Herstellen' : 'Schrappen'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleUpdateParticipant}>Opslaan</button>
        <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditParticipantModal(null)}>Annuleren</button>
      </div>
    </div>
  </div>
)}

<Modals 
        showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal}
        showAddCompModal={showAddCompModal} setShowAddCompModal={setShowAddCompModal}
        showEditCompModal={showEditCompModal} setShowEditCompModal={setShowEditCompModal}
        csvInput={csvInput} setCsvInput={setCsvInput}
        handleProcessCsv={handleProcessCsv}
        newComp={newComp} setNewComp={setNewComp}
        handleAddComp={handleAddComp}
        editCompData={editCompData} setEditCompData={setEditCompData}
        handleUpdateComp={handleUpdateComp}
        selectedComp={selectedComp}
        showEditParticipantModal={showEditParticipantModal}
        setShowEditParticipantModal={setShowEditParticipantModal}
        editParticipantData={editParticipantData}
        setEditParticipantData={setEditParticipantData}
        handleUpdateParticipant={handleUpdateParticipant}
      />
    </div>
  );
};

export default App;
