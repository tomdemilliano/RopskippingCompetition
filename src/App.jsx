import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, addDoc, getDocs, setDoc
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, X, Search, Star, Edit2, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, Info, RotateCcw, Clock, MapPin, UserPlus, UserMinus, Play, Square, Check, ChevronRight, ChevronLeft, Mic2, FastForward, Flag, Users, UserCheck, UserX, Ghost, Calendar
} from 'lucide-react';

// Importeer de nieuwe bestanden
import { APP_ID, COMPETITION_TYPES, isFreestyleType, getFirebaseConfig } from './constants';
import { styles } from './styles';
import LiveView from './components/LiveView';
import Modals from './components/Modals';

const firebaseConfig = getFirebaseConfig();
let app, auth, db;
const appId = APP_ID; 

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
  const [activeTab, setActiveTab] = useState('gepland');
  
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
      if (!firebaseConfig) return;
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
      // Filter pauzes eruit voor de management lijst
      if (p.status === 'pauze') return false;      
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
        // Bij freestyle sorteren we op de tekstwaarde van het veld (A, B)
        return (a[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || '').toString().localeCompare((b[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || '').toString());
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

  const handleStopLive = async (compId) => {
    if (window.confirm("Weet je zeker dat je de Live-status wilt stoppen? De wedstrijd blijft bestaan maar is niet langer actief.")) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', compId), { status: 'open' });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition'), { activeCompetitionId: null });
    }
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
        const veld = row['veld'] || ''; 

        // Check of dit een pauze/intermezzo is
        const isPauze = !naam && !veld && club;

        if (naam || isPauze) {
          const identifier = isPauze ? `PAUZE_${reeks}_${uur}` : naam;
          const existing = currentParts.find(p => p.naam === identifier);
          
          const eventData = {
            events: Array.from(new Set([...(existing?.events || []), eventName])),
            [eventKey]: reeks,
            [detailKey]: { uur, veld, club }
          };

          if (existing) {
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants', existing.id), eventData);
          } else {
            const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id, 'participants'));
            batch.set(newRef, { 
              naam: identifier, 
              club: club, 
              ...eventData, 
              status: isPauze ? 'pauze' : 'actief', 
              aanwezig: isPauze ? true : false 
            });
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
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex >= 0 && targetIndex < sortedEvents.length) {
      const targetEvent = sortedEvents[targetIndex];
      const temp = newOrder[eventName];
      newOrder[eventName] = newOrder[targetEvent];
      newOrder[targetEvent] = temp;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { eventOrder: newOrder });
    }
  };

  const renderCompCard = (c) => {
    const isSelected = selectedCompetitionId === c.id;
    const isBezig = c.status === 'bezig';
    const isDone = c.status === 'beëindigd';
    const statusData = getCompDataStatus(c.id);

    return (
      <div key={c.id} onClick={() => setSelectedCompetitionId(c.id)} style={{
        padding: '1rem', borderRadius: '8px', cursor: 'pointer', position: 'relative',
        border: '2px solid', 
        borderColor: isBezig ? '#ef4444' : (isSelected ? '#2563eb' : (isDone ? '#e2e8f0' : 'transparent')),
        backgroundColor: isDone ? '#f1f5f9' : (isSelected ? '#f0f7ff' : '#fff'),
        marginBottom: '0.75rem',
        transition: 'all 0.2s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isDone ? '#64748b' : '#1e293b' }}>{c.name}</div>
            {isBezig && <span style={styles.badgeLive}>LIVE</span>}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Calendar size={12}/> {c.date || 'Geen datum'}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{c.type}</div>
        
        {activeTab === 'gepland' && !statusData.isComplete && (
            <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '6px', fontWeight: 'bold' }}>
                ! {statusData.missingCount} onderdelen zonder deelnemers
            </div>
        )}
      </div>
    );
  };

  const renderManagement = () => {
    const sortedComps = [...competitions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const beëindigd = sortedComps.filter(c => c.status === 'beëindigd');
    const overige = sortedComps.filter(c => c.status !== 'beëindigd');
    const gepland = overige.filter(c => !getCompDataStatus(c.id).isComplete);
    const startklaar = overige.filter(c => getCompDataStatus(c.id).isComplete);

    const getTabData = () => {
        if (activeTab === 'gepland') return { list: gepland, emptyText: 'Geen geplande wedstrijden' };
        if (activeTab === 'startklaar') return { list: startklaar, emptyText: 'Geen startklare wedstrijden' };
        return { list: beëindigd, emptyText: 'Geen voltooide wedstrijden' };
    };

    const { list: currentList, emptyText } = getTabData();

    return (
      <div style={{ ...styles.layoutGrid, gridTemplateColumns: '320px 1fr' }}>
          <aside style={{ ...styles.column, overflowY: 'auto', background: '#f8fafc', padding: '1rem' }}>
            <button style={{ ...styles.btnPrimary, marginBottom: '1.5rem', width: '100%', justifyContent: 'center', height: '45px' }} onClick={() => setShowAddCompModal(true)}>
                + Nieuwe wedstrijd
            </button>
            
            <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <button 
                    onClick={() => setActiveTab('gepland')}
                    style={{ flex: 1, border: 'none', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', background: activeTab === 'gepland' ? '#fff' : 'transparent', color: activeTab === 'gepland' ? '#2563eb' : '#64748b' }}>
                    GEPLAND
                </button>
                <button 
                    onClick={() => setActiveTab('startklaar')}
                    style={{ flex: 1, border: 'none', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', background: activeTab === 'startklaar' ? '#fff' : 'transparent', color: activeTab === 'startklaar' ? '#2563eb' : '#64748b' }}>
                    STARTKLAAR
                </button>
                <button 
                    onClick={() => setActiveTab('beëindigd')}
                    style={{ flex: 1, border: 'none', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', background: activeTab === 'beëindigd' ? '#fff' : 'transparent', color: activeTab === 'beëindigd' ? '#2563eb' : '#64748b' }}>
                    VOLTOOID
                </button>
            </div>

            <div>
                {currentList.length > 0 ? currentList.map(renderCompCard) : (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        {emptyText}
                    </div>
                )}
            </div>
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
                      {selectedComp.status !== 'bezig' && (
                        <>
                          <button style={styles.btnSecondary} onClick={() => {
                            setEditCompData({ name: selectedComp.name, date: selectedComp.date, location: selectedComp.location, type: selectedComp.type });
                            setShowEditCompModal(true);
                          }}><Edit2 size={16}/></button>
                          <button style={{ ...styles.btnSecondary, color: '#ef4444' }} onClick={handleDeleteComp}><Trash2 size={16}/></button>
                        </>
                      )}
                      
                      {selectedComp.status === 'bezig' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              style={{ ...styles.btnSecondary, borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }} 
                              onClick={() => handleStopLive(selectedComp.id)}
                            >
                              <Ghost size={16}/> Stop live
                            </button>
                            <button style={{ ...styles.btnPrimary, background: '#ef4444' }} onClick={() => handleEndCompetition(selectedComp.id)}>
                                <Square size={16}/> Beëindig wedstrijd
                            </button>
                          </div>
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

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '0.5rem' }}>ONDERDELEN</div>
                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                      {sortedEvents.map((ond, idx) => {
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
                          <div key={ond} style={{ 
                            minWidth: '220px', 
                            padding: '0.75rem', 
                            background: '#fff', 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0',
                            borderLeft: `4px solid ${count > 0 ? '#10b981' : '#f59e0b'}` 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontWeight: 900, fontSize: '0.8rem' }}>{idx + 1}. {ond}</span>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <button onClick={() => moveEvent(ond, 'left')} title="Naar links" style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', padding: '2px' }} disabled={idx === 0}><ChevronLeft size={12}/></button>
                                <button onClick={() => moveEvent(ond, 'right')} title="Naar rechts" style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', padding: '2px' }} disabled={idx === sortedEvents.length - 1}><ChevronRight size={12}/></button>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748b', margin: '4px 0' }}>
                              {reeksen.size} reeksen {!isSpecial && `| ${maxVeld || '-'} velden`}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{count} skippers</span>
                              <button 
                                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer' }} 
                                onClick={() => setShowUploadModal(ond)}
                              >
                                <Upload size={12}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
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

                        <div style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>
                            {filteredParticipants.length} skippers getoond
                        </div>
                    </div>
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
                                >
                                  <CheckCircle size={18}/>
                                </button>
                                <button style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', marginRight: '8px' }}
                                  onClick={() => { setEditParticipantData({ ...p }); setShowEditParticipantModal(true); }}>
                                  <Edit2 size={16}/>
                                </button>
                                <button 
                                  style={{ border: 'none', background: 'none', color: isGlobalGeschrapt ? '#10b981' : '#ef4444', cursor: 'pointer' }} 
                                  onClick={() => toggleParticipantGlobalStatus(p.id, p.status)}
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
            ) : <div style={{ textAlign: 'center', padding: '10rem', color: '#94a3b8' }}>Selecteer een wedstrijd uit de lijst aan de linkerkant.</div>}
          </main>
      </div>
    );
  };

  return (
    <div style={styles.mainWrapper}>
      <header style={styles.header}>
        <div style={{ fontWeight: 900 }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button style={{ ...styles.btnSecondary, background: view === 'management' ? '#2563eb' : '#fff', color: view === 'management' ? '#fff' : '#475569' }} onClick={() => setView('management')}>Beheer</button>
          <button style={{ ...styles.btnSecondary, background: view === 'live' ? '#2563eb' : '#fff', color: view === 'live' ? '#fff' : '#475569' }} onClick={() => setView('live')}>Live</button>
          <div style={{ marginLeft: '1rem', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '6px', color: '#1e293b' }}>
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

      <Modals 
        showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal}
        csvInput={csvInput} setCsvInput={setCsvInput} handleUploadCsv={handleUploadCsv}
        showEditParticipantModal={showEditParticipantModal} setShowEditParticipantModal={setShowEditParticipantModal}
        editParticipantData={editParticipantData} setEditParticipantData={setEditParticipantData}
        handleUpdateParticipant={handleUpdateParticipant} selectedComp={selectedComp}
        showAddCompModal={showAddCompModal} setShowAddCompModal={setShowAddCompModal}
        newComp={newComp} setNewComp={setNewComp} handleCreateComp={handleCreateComp}
        showEditCompModal={showEditCompModal} setShowEditCompModal={setShowEditCompModal}
        editCompData={editCompData} setEditCompData={setEditCompData} handleUpdateComp={handleUpdateComp}
      />
    </div>
  );
};

export default App;
