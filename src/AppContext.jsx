/**
 * AppContext.jsx — RopeScore Pro
 *
 * Centrale React context voor alle Firebase-data en globale app-state.
 * Componenten lezen data via useAppContext() — nooit rechtstreeks via factories.
 * Schrijfoperaties verlopen via de actions die de context exporteert.
 *
 * Structuur:
 *   - Firebase init + auth
 *   - Realtime listeners (competitions, events, clubs, competitionTypes, settings)
 *   - Participants worden per wedstrijd geladen via loadParticipants()
 *   - Actions: alles wat data schrijft
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import {
  initDb,
  isScratchedFromEvent,
  isFullyScratched,
  settingsFactory,
  competitionTypeFactory,
  eventFactory,
  clubFactory,
  competitionFactory,
  participantFactory,
} from './dbSchema';
import { APP_ID, getFirebaseConfig } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SETUP
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext moet binnen AppProvider gebruikt worden.');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {

  // ── Auth ────────────────────────────────────────────────────────────────
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  // ── Collectiedata ────────────────────────────────────────────────────────
  const [competitions, setCompetitions]         = useState([]);
  const [events, setEvents]                     = useState([]);
  const [clubs, setClubs]                       = useState([]);
  const [competitionTypes, setCompetitionTypes] = useState([]);

  // ── Settings / voortgang ─────────────────────────────────────────────────
  const [activeCompetitionId, setActiveCompetitionId] = useState(null);
  const [finishedEvents, setFinishedEvents]           = useState([]);
  const [finishedSeries, setFinishedSeries]           = useState({});

  // ── Deelnemers (per wedstrijd geladen) ───────────────────────────────────
  const [participants, setParticipants]               = useState([]);
  const [participantsCompId, setParticipantsCompId]   = useState(null);
  const participantUnsubRef                           = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // FIREBASE INIT
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const firebaseConfig = getFirebaseConfig();
        if (!firebaseConfig) throw new Error('Geen Firebase-configuratie gevonden.');

        const app = !getApps().length
          ? initializeApp(firebaseConfig)
          : getApps()[0];

        const auth = getAuth(app);
        const db   = getFirestore(app);

        onAuthStateChanged(auth, (user) => {
          if (user) {
            initDb(db, APP_ID);
            setAuthReady(true);
          }
        });

        await signInAnonymously(auth);
      } catch (err) {
        setAuthError(err.message ?? String(err));
      }
    };

    init();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // REALTIME LISTENERS
  // Starten zodra auth klaar is. Worden automatisch opgeruimd.
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authReady) return;

    const unsubs = [
      competitionFactory.subscribe(setCompetitions),
      eventFactory.subscribe(setEvents),
      clubFactory.subscribe(setClubs),
      competitionTypeFactory.subscribe(setCompetitionTypes),

      settingsFactory.subscribeCompetition(({ activeCompetitionId: id }) => {
        setActiveCompetitionId(id ?? null);
      }),

      settingsFactory.subscribeProgress(({ finishedEvents: fe, finishedSeries: fs }) => {
        setFinishedEvents(fe ?? []);
        setFinishedSeries(fs ?? {});
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [authReady]);

  // ─────────────────────────────────────────────────────────────────────────
  // PARTICIPANTS — laden per geselecteerde wedstrijd
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start realtime listener voor deelnemers van een wedstrijd.
   * Stopt de vorige listener automatisch.
   */
  const loadParticipants = useCallback((competitionId) => {
    // Stop vorige listener
    if (participantUnsubRef.current) {
      participantUnsubRef.current();
      participantUnsubRef.current = null;
    }

    if (!competitionId) {
      setParticipants([]);
      setParticipantsCompId(null);
      return;
    }

    setParticipantsCompId(competitionId);
    participantUnsubRef.current = participantFactory.subscribe(
      competitionId,
      setParticipants
    );
  }, []);

  // Opruimen bij unmount
  useEffect(() => {
    return () => {
      if (participantUnsubRef.current) participantUnsubRef.current();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // AFGELEIDE DATA
  // ─────────────────────────────────────────────────────────────────────────

  const activeCompetition = competitions.find(c => c.id === activeCompetitionId) ?? null;

  /** Geeft de gesorteerde events voor een wedstrijd terug. */
  const getSortedEvents = useCallback((competition) => {
    if (!competition) return [];

    // Haal eventIds op via het competitionType
    const compType = competitionTypes.find(t => t.id === competition.typeId);
    if (!compType) return [];

    // Gebruik competition.eventOrder als override, anders defaultEventOrder van het type
    const order = Object.keys(competition.eventOrder ?? {}).length > 0
      ? competition.eventOrder
      : compType.defaultEventOrder;

    return [...compType.eventIds]
      .map(id => events.find(e => e.id === id))
      .filter(Boolean)
      .sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
  }, [competitions, competitionTypes, events]);

  /** Geeft een club-object terug op basis van id. */
  const getClub = useCallback((clubId) => {
    return clubs.find(c => c.id === clubId) ?? null;
  }, [clubs]);

  /** Geeft een event-object terug op basis van id. */
  const getEvent = useCallback((eventId) => {
    return events.find(e => e.id === eventId) ?? null;
  }, [events]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — wedstrijden
  // ─────────────────────────────────────────────────────────────────────────

  const createCompetition = useCallback(async (data) => {
    const compType = competitionTypes.find(t => t.id === data.typeId);
    const eventOrder = compType?.defaultEventOrder ?? {};
    return competitionFactory.create({ ...data, eventOrder });
  }, [competitionTypes]);

  const updateCompetition = useCallback((competitionId, data) => {
    return competitionFactory.update(competitionId, data);
  }, []);

  const deleteCompetition = useCallback((competitionId) => {
    return competitionFactory.delete(competitionId);
  }, []);

  const startCompetition = useCallback(async (competitionId) => {
    const alreadyActive = competitions.some(c => c.status === 'bezig');
    if (alreadyActive) throw new Error('Er is al een wedstrijd bezig.');
    await competitionFactory.setStatus(competitionId, 'bezig');
    await settingsFactory.setActiveCompetition(competitionId);
    await settingsFactory.resetProgress();
  }, [competitions]);

  const stopCompetitionLive = useCallback(async (competitionId) => {
    await competitionFactory.setStatus(competitionId, 'open');
    await settingsFactory.setActiveCompetition(null);
  }, []);

  const endCompetition = useCallback(async (competitionId) => {
    await competitionFactory.setStatus(competitionId, 'beëindigd');
    await settingsFactory.setActiveCompetition(null);
  }, []);

  const saveEventOrder = useCallback((competitionId, eventOrder) => {
    return competitionFactory.saveEventOrder(competitionId, eventOrder);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — voortgang (live)
  // ─────────────────────────────────────────────────────────────────────────

  const finishSeries = useCallback(async (eventId, seriesNr, isLastInEvent) => {
    const newFinishedSeries = {
      ...finishedSeries,
      [eventId]: [...(finishedSeries[eventId] ?? []), seriesNr],
    };
    const newFinishedEvents = isLastInEvent && !finishedEvents.includes(eventId)
      ? [...finishedEvents, eventId]
      : finishedEvents;

    return settingsFactory.saveProgress({
      finishedEvents: newFinishedEvents,
      finishedSeries: newFinishedSeries,
    });
  }, [finishedEvents, finishedSeries]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — deelnemers
  // ─────────────────────────────────────────────────────────────────────────

  const setPresence = useCallback((competitionId, participantId, isPresent) => {
    return participantFactory.setPresence(competitionId, participantId, isPresent);
  }, []);

  const scratchFromEvent = useCallback((competitionId, participant, eventId, isScratched) => {
    return participantFactory.setScratchedForEvent(
      competitionId, participant, eventId, isScratched
    );
  }, []);

  const scratchFromAll = useCallback((competitionId, participant, isScratched) => {
    return participantFactory.setScratchedForAll(
      competitionId, participant, isScratched
    );
  }, []);

  const updateParticipant = useCallback((competitionId, participantId, data) => {
    return participantFactory.update(competitionId, participantId, data);
  }, []);

  const importParticipants = useCallback((competitionId, eventId, existingParticipants, rows) => {
    return participantFactory.importBatch(
      competitionId, eventId, existingParticipants, rows
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — clubs
  // ─────────────────────────────────────────────────────────────────────────

  const createClub = useCallback((data) => {
    return clubFactory.create(data);
  }, []);

  const findClubByName = useCallback((name) => {
    return clubFactory.findByName(name, clubs);
  }, [clubs]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────────────

  const value = {
    // Auth
    authReady,
    authError,

    // Collectiedata
    competitions,
    events,
    clubs,
    competitionTypes,

    // Deelnemers
    participants,
    participantsCompId,
    loadParticipants,

    // Settings
    activeCompetitionId,
    activeCompetition,
    finishedEvents,
    finishedSeries,

    // Afgeleide helpers
    getSortedEvents,
    getClub,
    getEvent,
    isScratchedFromEvent,
    isFullyScratched,

    // Actions — wedstrijden
    createCompetition,
    updateCompetition,
    deleteCompetition,
    startCompetition,
    stopCompetitionLive,
    endCompetition,
    saveEventOrder,

    // Actions — voortgang
    finishSeries,

    // Actions — deelnemers
    setPresence,
    scratchFromEvent,
    scratchFromAll,
    updateParticipant,
    importParticipants,

    // Actions — clubs
    createClub,
    findClubByName,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
