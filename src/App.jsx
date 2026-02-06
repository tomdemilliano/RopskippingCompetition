import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, getDoc, addDoc, deleteDoc, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ChevronRight, ChevronLeft, Activity, CheckCircle2, Trophy, Info, Clock
} from 'lucide-react';

// --- FIREBASE CONFIGURATIE ---
/*const firebaseConfig = {
  apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
  authDomain: "ropeskippingcontest.firebaseapp.com",
  projectId: "ropeskippingcontest",
  storageBucket: "ropeskippingcontest.firebasestorage.app",
  messagingSenderId: "430066523717",
  appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};
*/

/**
 * CONFIGURATIE & INITIALISATIE
 * Haalt configuratie op uit Environment Variables (Vercel/Vite/Next.js)
 */
const FirebaseConfig = () => {
  // Check voor verschillende mogelijke env namen afhankelijk van je framework
  const envConfig = 
    process.env.NEXT_PUBLIC_FIREBASE_CONFIG || 
    process.env.VITE_FIREBASE_CONFIG || 
    process.env.FIREBASE_CONFIG;

  if (envConfig) {
    try {
      return JSON.parse(envConfig);
    } catch (e) {
      console.error("Fout bij parsen van FIREBASE_CONFIG env var:", e);
    }
  }

  // Fallback voor de lokale preview omgeving
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }

  return {};
};


let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-v1';

// --- MOGELIJKE ONDERDELEN ---
const POSSIBLE_ONDERDELEN = [
  'Speed',
  'Endurance',
  'Freestyle',
  'Double under',
  'Triple under'
];

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState('live'); 
  const [activeTab, setActiveTab] = useState('speed');
  const [skippers, setSkippers] = useState({});
  const [heats, setHeats] = useState([]);
  const [competitions, setCompetitions] = useState([]); // nieuw
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null); // voor beheer
  const [participants, setParticipants] = useState({}); // deelnemers voor geselecteerde competitie
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState({
    currentSpeedHeat: 1,
    currentFreestyleHeat: 1,
    announcement: "Welkom!",
    activeCompetitionId: null, // nieuw: id van actieve wedstrijd
  });

  const [importType, setImportType] = useState('speed');
  const [csvInput, setCsvInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ type: null, msg: null });

  // beheer: formulier state
  const [newComp, setNewComp] = useState({ name: '', date: '', location: '', setActive: false });
  const [compCsvInput, setCompCsvInput] = useState(''); // CSV voor deelnemers import binnen beheer
  const [showAddModal, setShowAddModal] = useState(false);

  // Update klok elke seconde
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);

        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            setIsAuthReady(true);
          }
        });
      } catch (e) {
        console.error("Firebase Init Error", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !db) return;

    const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'skippers');
    const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'heats');
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');

    const unsubS = onSnapshot(sRef, async (d) => {
      if (d.exists()) {
        setSettings(d.data());
      } else {
        await setDoc(sRef, settings);
      }
    }, (err) => console.error("Settings error:", err));

    const unsubSk = onSnapshot(skRef, s => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setSkippers(d);
    }, (err) => console.error("Skippers error:", err));

    const unsubH = onSnapshot(hRef, s => {
      setHeats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.reeks - b.reeks));
    }, (err) => console.error("Heats error:", err));

    const unsubC = onSnapshot(cRef, s => {
      // competitie documenten bevatten: name, date, location, status, onderdelen
      setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    }, (err) => console.error("Competitions error:", err));

    return () => { unsubS(); unsubSk(); unsubH(); unsubC(); };
  }, [isAuthReady, user]);

  // luister naar participants subcollectie wanneer geselecteerde competitie verandert
  useEffect(() => {
    if (!isAuthReady || !user || !db) return;
    if (!selectedCompetitionId) {
      setParticipants({});
      return;
    }
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedCompetitionId, 'participants');
    const unsubP = onSnapshot(pRef, s => {
      const d = {};
      s.forEach(doc => d[doc.id] = doc.data());
      setParticipants(d);
    }, err => console.error("Participants error:", err));
    return () => unsubP();
  }, [isAuthReady, user, selectedCompetitionId]);

  // actieve competitie object (uit settings)
  const activeCompetition = useMemo(() => {
    return competitions.find(c => c.id === settings.activeCompetitionId) || null;
  }, [competitions, settings]);

  const currentHeat = useMemo(() => {
    const list = heats.filter(h => h.type === activeTab);
    const num = activeTab === 'speed' ? (settings.currentSpeedHeat || 1) : (settings.currentFreestyleHeat || 1);
    return list.find(h => h.reeks === num) || null;
  }, [heats, activeTab, settings]);

  const timeDifferenceInfo = useMemo(() => {
    if (!currentHeat?.uur || !currentHeat.uur.includes(':')) return null;

    try {
      const parts = currentHeat.uur.split(':');
      const h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      if (isNaN(h) || isNaN(m)) return null;

      const plannedTime = new Date(currentTime);
      plannedTime.setHours(h, m, 0, 0);

      const diffInMs = currentTime.getTime() - plannedTime.getTime();
      const diffInMins = Math.floor(diffInMs / 60000);

      return {
        minutes: diffInMins,
        isBehind: diffInMins > 0,
        isAhead: diffInMins < 0,
        label: diffInMins > 0 ? `+${diffInMins}` : `${diffInMins}`
      };
    } catch (e) {
      return null;
    }
  }, [currentHeat, currentTime]);

  // speedSlots: wanneer er een actieve competitie is, vullen we velden op basis van deelnemers die een startVeld/veldNr hebben of simpelweg show deelnemers
  const speedSlots = useMemo(() => {
    if (activeTab !== 'speed') return currentHeat?.slots || [];
    // probeer eerst gebruik te maken van currentHeat.slots (bestaat mogelijk)
    if (currentHeat?.slots?.length) {
      const fullList = [];
      for (let i = 1; i <= 10; i++) {
        const found = currentHeat?.slots?.find(s => s.veldNr === i || s.veld === `Veld ${i}`);
        fullList.push(found || { veld: `Veld ${i}`, skipperId: null, empty: true });
      }
      return fullList;
    }
    // fallback: vul met deelnemers uit actieve competitie die deelnemen aan speed
    if (activeCompetition && Object.keys(participants).length) {
      const partArr = Object.values(participants).filter(p => p.events?.includes('speed'));
      const fullList = [];
      for (let i = 1; i <= 10; i++) {
        const p = partArr[i-1];
        fullList.push(p ? { veld: `Veld ${i}`, skipperId: p.id, empty: false } : { veld: `Veld ${i}`, skipperId: null, empty: true });
      }
      return fullList;
    }
    // default
    const defaultList = [];
    for (let i = 1; i <= 10; i++) defaultList.push({ veld: `Veld ${i}`, skipperId: null, empty: true });
    return defaultList;
  }, [currentHeat, activeTab, activeCompetition, participants]);

  const updateHeat = async (delta) => {
    if (!db || !user) return;
    const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
    try {
      const currentVal = settings[key] || 1;
      await updateDoc(ref, { [key]: Math.max(1, currentVal + delta) });
    } catch (e) { console.error(e); }
  };

  const finishHeat = async () => {
    if (!currentHeat || !db || !user) return;
    try {
      const heatRef = doc(db, 'artifacts', appId, 'public', 'data', 'heats', currentHeat.id);
      await updateDoc(heatRef, { status: 'finished' });
      await updateHeat(1);
    } catch (e) { console.error(e); }
  };

  // Competitie aanmaken (nu met onderdelen array)
  const addCompetition = async ({ name, date, location, setActive=false }) => {
    if (!name || !db || !user) return;
    try {
      const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions');
      // voeg onderdelen toe als lege array zodat structuur consistent is
      const docRef = await addDoc(cRef, { name, date, location, status: 'gepland', onderdelen: [], createdAt: new Date().toISOString() });
      if (setActive) {
        const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
        await updateDoc(sRef, { activeCompetitionId: docRef.id });
      }
      setStatus({ type: 'success', msg: 'Competitie toegevoegd' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // Stel actieve competitie in
  const setActiveCompetition = async (competitionId) => {
    if (!db || !user) return;
    try {
      const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
      await updateDoc(sRef, { activeCompetitionId: competitionId });
      // zet status van deze competitie op 'actief' en andere op 'gepland' indien gewenst
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId);
      await updateDoc(compRef, { status: 'actief' });
      setStatus({ type: 'success', msg: 'Actieve wedstrijd ingesteld' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // Wijzig status van competitie
  const setCompetitionStatus = async (competitionId, newStatus) => {
    if (!db || !user) return;
    try {
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId);
      await updateDoc(compRef, { status: newStatus });
      setStatus({ type: 'success', msg: 'Status bijgewerkt' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // Verwijder competitie (en deelnemers subcollectie) - voorzichtig: hier verwijderen we alleen competitie-doc en deelnemers docs
  const deleteCompetition = async (competitionId) => {
    if (!db || !user) return;
    try {
      // verwijder deelnemers in subcollectie
      const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId, 'participants');
      if (selectedCompetitionId === competitionId) {
        for (const pid of Object.keys(participants)) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId, 'participants', pid));
        }
      } else {
        // Onzekerheid - probeer niets verder
      }
      // verwijder competitie-doc
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId));
      setStatus({ type: 'success', msg: 'Competitie verwijderd' });
      // als dit de actieve competitie was, clear settings.activeCompetitionId
      if (settings.activeCompetitionId === competitionId) {
        const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'competition');
        await updateDoc(sRef, { activeCompetitionId: null });
      }
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // ONDERDELEN BEHEREN: add / remove / move
  const addOnderdeelToCompetition = async (competitionId, onderdeel) => {
    if (!competitionId || !onderdeel || !db || !user) return;
    try {
      const comp = competitions.find(c => c.id === competitionId) || {};
      const existing = Array.isArray(comp.onderdelen) ? comp.onderdelen : [];
      if (existing.includes(onderdeel)) {
        setStatus({ type: 'error', msg: 'Onderdeel bestaat al' });
        return;
      }
      const newList = [...existing, onderdeel];
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId);
      await updateDoc(compRef, { onderdelen: newList });
      setStatus({ type: 'success', msg: 'Onderdeel toegevoegd' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const removeOnderdeelFromCompetition = async (competitionId, index) => {
    if (!competitionId || index == null || !db || !user) return;
    try {
      const comp = competitions.find(c => c.id === competitionId) || {};
      const existing = Array.isArray(comp.onderdelen) ? comp.onderdelen : [];
      if (index < 0 || index >= existing.length) return;
      const newList = [...existing.slice(0, index), ...existing.slice(index + 1)];
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId);
      await updateDoc(compRef, { onderdelen: newList });
      setStatus({ type: 'success', msg: 'Onderdeel verwijderd' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const moveOnderdeelCompetition = async (competitionId, fromIndex, toIndex) => {
    if (!competitionId || fromIndex == null || toIndex == null || !db || !user) return;
    try {
      const comp = competitions.find(c => c.id === competitionId) || {};
      const existing = Array.isArray(comp.onderdelen) ? comp.onderdelen : [];
      if (fromIndex < 0 || fromIndex >= existing.length || toIndex < 0 || toIndex >= existing.length) return;
      const arr = [...existing];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId);
      await updateDoc(compRef, { onderdelen: arr });
      setStatus({ type: 'success', msg: 'Volgorde bijgewerkt' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // CSV import deelnemers voor een competitie
  const importParticipantsForCompetition = async (competitionId, csvText) => {
    if (!competitionId || !csvText || !db || !user) return;
    setIsProcessing(true);
    try {
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      const batch = writeBatch(db);
      for (const row of rows) {
        // verwacht CSV format (voorbeeld): naam,club,events (events gescheiden door ;)
        const naam = row[0] || '';
        const club = row[1] || '';
        const eventsRaw = row[2] || '';
        const events = eventsRaw.split(';').map(e => e.trim()).filter(e => e);
        // generate id-safe
        const pid = `p_${(naam + '_' + club).replace(/[^a-zA-Z0-9]/g, '_')}`;
        const pDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId, 'participants', pid);
        batch.set(pDocRef, { id: pid, naam, club, events, createdAt: new Date().toISOString() });
        // (optioneel) ook zetten in globale skippers
        const skRef = doc(db, 'artifacts', appId, 'public', 'data', 'skippers', pid);
        batch.set(skRef, { id: pid, naam, club }, { merge: true });
      }
      await batch.commit();
      setStatus({ type: 'success', msg: 'Deelnemers geïmporteerd' });
      // herlaad deelnemers via snapshot listener
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
    setIsProcessing(false);
  };

  // Verwijder deelnemer uit competitie
  const removeParticipantFromCompetition = async (competitionId, participantId) => {
    if (!competitionId || !participantId || !db || !user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId, 'participants', participantId));
      setStatus({ type: 'success', msg: 'Deelnemer verwijderd' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  // schrappen uit onderdeel (remove event from participant.events)
  const removeParticipantFromEvent = async (competitionId, participantId, eventName) => {
    if (!competitionId || !participantId || !eventName || !db || !user) return;
    try {
      const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', competitionId, 'participants', participantId);
      // We gebruiken arrayRemove om het event te verwijderen
      await updateDoc(pRef, { events: arrayRemove(eventName) });
      setStatus({ type: 'success', msg: `${eventName} verwijderd voor deelnemer` });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const styles = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', color: '#000', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1.5rem', borderBottom: '1px solid #eee', background: '#fff', alignItems: 'center' },
    main: { flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    card: { border: '1px solid #eee', borderRadius: '1rem', padding: '1rem', width: '100%', maxWidth: '900px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    displayOverlay: { 
      position: 'fixed', 
      inset: 0, 
      backgroundColor: '#fff', 
      zIndex: 1000, 
      padding: '0.75rem 1.25rem', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      boxSizing: 'border-box'
    },
    primaryButton: { padding: '0.6rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', backgroundColor: '#2563eb', color: '#fff', fontWeight: 900 },
    outlineButton: { padding: '0.45rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #eee', background: '#fff', cursor: 'pointer' }
  };

  // helper voor toevoegen via modal
  const handleAddCompetitionFromModal = async () => {
    await addCompetition({ ...newComp });
    setNewComp({ name: '', date: '', location: '', setActive: false });
    setShowAddModal(false);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 900, fontSize: '1rem' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></span>
          <nav style={{ display: 'flex', gap: '0.25rem', background: '#f5f5f5', padding: '0.2rem', borderRadius: '0.5rem' }}>
            <button onClick={() => setView('live')} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, backgroundColor: view === 'live' ? '#fff' : 'transparent' }}>Live</button>
            <button onClick={() => setView('management')} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, backgroundColor: view === 'management' ? '#fff' : 'transparent' }}>Beheer</button>
            <button onClick={() => setView('display')} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, backgroundColor: view === 'display' ? '#fff' : 'transparent' }}>Display</button>
          </nav>
        </div>
        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{currentTime.toLocaleTimeString('nl-BE')}</div>
      </header>

      <main style={styles.main}>
        {view === 'live' && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setActiveTab('speed')} style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', border: 'none', fontWeight: 800, cursor: 'pointer', backgroundColor: activeTab === 'speed' ? '#2563eb' : '#f3f4f6', color: activeTab === 'speed' ? '#fff' : '#000' }}>SPEED</button>
              <button onClick={() => setActiveTab('freestyle')} style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', border: 'none', fontWeight: 800, cursor: 'pointer', backgroundColor: activeTab === 'freestyle' ? '#2563eb' : '#f3f4f6', color: activeTab === 'freestyle' ? '#fff' : '#000' }}>FREESTYLE</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#999' }}>REEKS</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
                <button onClick={() => updateHeat(-1)} style={{ background: '#f5f5f5', border: 'none', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer' }}><ChevronLeft size={20}/></button>
                <span style={{ fontSize: '3rem', fontWeight: 900 }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
                <button onClick={() => updateHeat(1)} style={{ background: '#f5f5f5', border: 'none', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer' }}><ChevronRight size={20}/></button>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#666' }}>
                Gepland: {currentHeat?.uur || "--:--"} {activeCompetition ? `— Wedstrijd: ${activeCompetition.name} (${activeCompetition.location || '-'}, ${activeCompetition.date || '-'})` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {speedSlots.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', padding: '0.5rem 1rem', background: s.empty ? 'transparent' : '#f9f9f9', borderRadius: '0.6rem', border: '1px solid rgba(0,0,0,0.03)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 900, color: '#2563eb', fontSize: '0.7rem' }}>{s.veld}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                    { participants[s.skipperId]?.naam || skippers[s.skipperId]?.naam || (s.empty ? "" : "...") }
                  </span>
                  <span style={{ textAlign: 'right', color: '#999', fontSize: '0.75rem' }}>
                    { participants[s.skipperId]?.club || skippers[s.skipperId]?.club || "" }
                  </span>
                </div>
              ))}
            </div>

            <button onClick={finishHeat} style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <CheckCircle2 size={18}/> VOLTOOID
            </button>
          </div>
        )}

        {view === 'management' && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontWeight: 900, margin: 0, fontSize: '1.2rem' }}>Wedstrijden (Competities)</h2>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>Beheer je wedstrijden en deelnemers</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setShowAddModal(true)} style={styles.primaryButton}>+ Nieuwe wedstrijd</button>
                <button onClick={() => { setSelectedCompetitionId(null); setCompCsvInput(''); }} style={styles.outlineButton}>Wis selectie</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', justifyContent: 'center' }}>
              <div style={{ flex: 1, maxWidth: '640px', border: '1px solid #f1f5f9', padding: '0.75rem', borderRadius: '0.8rem', background: '#fff' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', textAlign: 'center', fontWeight: 900 }}>Bestaan­de wedstrijden</h3>
                <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {competitions.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: '0.6rem', background: selectedCompetitionId === c.id ? '#f1f5ff' : '#fafafa', border: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900 }}>{c.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{c.date} — {c.location} <span style={{ marginLeft: '0.5rem', fontWeight: 900, color: c.status === 'actief' ? '#10b981' : '#94a3b8' }}>{c.status}</span></div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => { setSelectedCompetitionId(c.id); }} style={styles.outlineButton}>Select</button>
                        <button onClick={() => setActiveCompetition(c.id)} style={styles.outlineButton}>Maak actief</button>
                        <button onClick={() => setCompetitionStatus(c.id, c.status === 'gepland' ? 'actief' : (c.status === 'actief' ? 'beëindigd' : 'gepland'))} style={styles.outlineButton}>Status</button>
                        <button onClick={() => deleteCompetition(c.id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Verwijder</button>
                      </div>
                    </div>
                  ))}
                  {competitions.length === 0 && <div style={{ color: '#666', padding: '0.5rem', textAlign: 'center' }}>Geen wedstrijden gevonden</div>}
                </div>
              </div>

              <div style={{ width: '360px', border: '1px solid #f1f5f9', padding: '0.75rem', borderRadius: '0.8rem', background: '#fff' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 900 }}>Geselecteerde wedstrijd</h3>
                {!selectedCompetitionId && <div style={{ color: '#666', marginBottom: '0.5rem' }}>Selecteer een wedstrijd uit de lijst om deelnemers en onderdelen te beheren.</div>}
                {selectedCompetitionId && (
                  <>
                    <div style={{ fontWeight: 900 }}>{competitions.find(c => c.id === selectedCompetitionId)?.name || '...'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                      {competitions.find(c => c.id === selectedCompetitionId)?.date} — {competitions.find(c => c.id === selectedCompetitionId)?.location}
                    </div>

                    {/* Onderdelen beheer */}
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div style={{ fontWeight: 900, marginBottom: '0.4rem' }}>Onderdelen</div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <select id="select-onderdeel" style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: '1px solid #eee' }} defaultValue="">
                          <option value="" disabled>Voeg onderdeel toe…</option>
                          {POSSIBLE_ONDERDELEN.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            const sel = document.getElementById('select-onderdeel');
                            if (!sel) return;
                            const value = sel.value;
                            if (!value) {
                              setStatus({ type: 'error', msg: 'Selecteer een onderdeel' });
                              return;
                            }
                            addOnderdeelToCompetition(selectedCompetitionId, value);
                            sel.value = '';
                          }}
                          style={{ ...styles.primaryButton, padding: '0.45rem 0.8rem' }}
                        >
                          Voeg toe
                        </button>
                      </div>

                      <div style={{ border: '1px solid #f3f4f6', borderRadius: '0.5rem', padding: '0.5rem', background: '#fafafa' }}>
                        {(competitions.find(c => c.id === selectedCompetitionId)?.onderdelen || []).length === 0 && (
                          <div style={{ color: '#666', padding: '0.5rem' }}>Geen onderdelen toegevoegd</div>
                        )}

                        {(competitions.find(c => c.id === selectedCompetitionId)?.onderdelen || []).map((od, idx, arr) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem', borderBottom: idx !== arr.length - 1 ? '1px solid #eee' : 'none' }}>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                              <div style={{ fontWeight: 900 }}>{idx + 1}.</div>
                              <div style={{ fontWeight: 800 }}>{od}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => moveOnderdeelCompetition(selectedCompetitionId, idx, idx - 1)} disabled={idx === 0} style={styles.outlineButton}>↑</button>
                              <button onClick={() => moveOnderdeelCompetition(selectedCompetitionId, idx, idx + 1)} disabled={idx === arr.length - 1} style={styles.outlineButton}>↓</button>
                              <button onClick={() => removeOnderdeelFromCompetition(selectedCompetitionId, idx)} style={{ padding: '0.35rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Verwijder</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontWeight: 900, marginBottom: '0.4rem' }}>Import deelnemers (CSV)</div>
                    <textarea placeholder="CSV: naam,club,events(sep ;)" value={compCsvInput} onChange={e => setCompCsvInput(e.target.value)} style={{ width: '100%', height: '100px', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #eee' }} />
                    <button onClick={() => { importParticipantsForCompetition(selectedCompetitionId, compCsvInput); setCompCsvInput(''); }} disabled={isProcessing} style={{ marginTop: '0.4rem', padding: '0.6rem', width: '100%', borderRadius: '0.5rem', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 900 }}>
                      Importeer deelnemers
                    </button>

                    <hr style={{ margin: '0.75rem 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 900 }}>Deelnemers overzicht</div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{Object.keys(participants).length} deelnemers</div>
                    </div>

                    <div style={{ maxHeight: '230px', overflowY: 'auto', borderTop: '1px solid #f3f4f6' }}>
                      {Object.values(participants).map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 900 }}>{p.naam}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>{p.club} — { (p.events || []).join(', ') }</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {(p.events || []).map(ev => (
                              <button key={ev} onClick={() => removeParticipantFromEvent(selectedCompetitionId, p.id, ev)} style={{ padding: '0.25rem 0.35rem', borderRadius: '0.35rem', border: '1px solid #eee', background: '#fff', cursor: 'pointer' }}>{ev}</button>
                            ))}
                            <button onClick={() => removeParticipantFromCompetition(selectedCompetitionId, p.id)} style={{ padding: '0.25rem 0.35rem', borderRadius: '0.35rem', border: '1px solid #fee2e2', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>Verwijder</button>
                          </div>
                        </div>
                      ))}
                      {Object.keys(participants).length === 0 && <div style={{ color: '#666', padding: '0.5rem' }}>Geen deelnemers</div>}
                    </div>
                  </>
                )}

                {status.msg && <div style={{ marginTop: '0.6rem', color: status.type === 'error' ? '#dc2626' : '#10b981' }}>{status.msg}</div>}
              </div>
            </div>

            {/* Add Competition Modal */}
            {showAddModal && (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', zIndex: 1200 }}>
                <div style={{ width: '520px', background: '#fff', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Nieuwe wedstrijd toevoegen</div>
                    <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input placeholder="Naam" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #eee' }} />
                    <input placeholder="Datum (YYYY-MM-DD)" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #eee' }} />
                    <input placeholder="Locatie" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #eee' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={newComp.setActive} onChange={e => setNewComp({...newComp, setActive: e.target.checked})} /> Stel actief
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button onClick={handleAddCompetitionFromModal} style={{ ...styles.primaryButton, flex: 1 }}>Toevoegen</button>
                      <button onClick={() => setShowAddModal(false)} style={{ ...styles.outlineButton, flex: 1 }}>Annuleer</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'display' && (
          <div style={styles.displayOverlay}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, lineHeight: 1 }}>{currentHeat?.onderdeel?.toUpperCase() || (activeTab === 'speed' ? "SPEED" : "FREESTYLE")}</h1>
                <div style={{ color: '#2563eb', fontWeight: 900, fontSize: '0.8rem' }}>ROPESKIPPING LIVE</div>
                {activeCompetition && <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', fontWeight: 800 }}>{activeCompetition.name} — {activeCompetition.date} — {activeCompetition.location}</div>}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ textAlign: 'right', backgroundColor: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>DEBUG GEPLAND</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{currentHeat?.uur || "GEEN DATA"}</div>
                </div>

                <div style={{ textAlign: 'right', backgroundColor: '#000', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 }}>{currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, opacity: 0.7 }}>LIVE TIJD</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '0.6rem', marginBottom: '0.5rem', border: '1px solid #e2e8f0' }}>
               <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#64748b' }}>REEKS</span>
               <span style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color: '#0f172a' }}>{activeTab === 'speed' ? settings.currentSpeedHeat : settings.currentFreestyleHeat}</span>
               {timeDifferenceInfo && (
                  <div style={{ marginLeft: 'auto', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 900, backgroundColor: timeDifferenceInfo.isBehind ? '#fee2e2' : '#e6fffa', color: timeDifferenceInfo.isBehind ? '#dc2626' : '#065f46' }}>
                    {timeDifferenceInfo.label}m vertraging
                  </div>
               )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
              {speedSlots.map((s, i) => (
                <div key={i} style={{ 
                  flex: 1, 
                  display: 'grid', 
                  gridTemplateColumns: '80px 1.5fr 1fr', 
                  alignItems: 'center', 
                  padding: '0 1rem', 
                  borderRadius: '0.5rem', 
                  border: '1px solid #f1f5f9',
                  backgroundColor: s.empty ? 'rgba(0,0,0,0.02)' : '#fff',
                  opacity: s.empty ? 0.3 : 1,
                  boxShadow: s.empty ? 'none' : '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#2563eb' }}>{s.veld}</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{participants[s.skipperId]?.naam || skippers[s.skipperId]?.naam || (s.empty ? '' : '...')}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{participants[s.skipperId]?.club || skippers[s.skipperId]?.club || ''}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '0.25rem', left: '0.25rem', padding: '0.2rem 0.4rem', fontSize: '0.6rem', border: 'none', background: '#f1f5f9', borderRadius: '0.4rem', cursor: 'pointer' }}>Terug</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
