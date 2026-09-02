/**
 * AppContext.jsx — SkipFlow
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
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
} from 'firebase/auth';

import {
  initDb,
  isScratchedFromEvent,
  isFullyScratched,
  hasPermission,
  settingsFactory,
  competitionTypeFactory,
  eventFactory,
  clubFactory,
  competitionFactory,
  participantFactory,
  blockFactory,
  podiumFactory,
  messageFactory,
  BLOCK_TYPE_LABELS,
  userFactory,
} from './dbSchema';

import { APP_ID, getFirebaseConfig, emailForUsername } from './constants';

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
  // authReady: Firebase is geïnitialiseerd en de auth-status is één keer
  // gecontroleerd (ongeacht of er iemand ingelogd is).
  // currentUser: Firebase Auth user object, of null als niemand ingelogd is.
  // userProfile: het bijhorende users/{uid}-document (rol + rechten).
  const [authReady, setAuthReady]   = useState(false);
  const [authError, setAuthError]   = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // ── Gebruikersbeheer (enkel geladen door het beheerder-only scherm) ──────
  const [users, setUsers]                 = useState([]);
  const usersUnsubRef                     = useRef(null);

  // ── Collectiedata ────────────────────────────────────────────────────────
  const [competitions, setCompetitions]         = useState([]);
  const [events, setEvents]                     = useState([]);
  const [clubs, setClubs]                       = useState([]);
  const [competitionTypes, setCompetitionTypes] = useState([]);

  // ── Settings ─────────────────────────────────────────────────────────────
  const [activeCompetitionId, setActiveCompetitionId] = useState(null);
  // finishedEvents/finishedSeries leven op het competition-document zelf
  // (zie dbSchema.js) en worden hieronder afgeleid van activeCompetition.

  // ── Deelnemers (per wedstrijd geladen) ───────────────────────────────────
  const [participants, setParticipants]               = useState([]);
  const [participantsCompId, setParticipantsCompId]   = useState(null);
  const participantUnsubRef                           = useRef(null);

  // ── Blocks — dagtijdlijn (per wedstrijd geladen) ─────────────────────────
  const [blocks, setBlocks]                 = useState([]);
  const [blocksCompId, setBlocksCompId]     = useState(null);
  const blockUnsubRef                       = useRef(null);

  // ── Podiums (per wedstrijd geladen) ──────────────────────────────────────
  const [podiums, setPodiums]               = useState([]);
  const [podiumsCompId, setPodiumsCompId]   = useState(null);
  const podiumUnsubRef                      = useRef(null);

  // ── Messages — boodschappen groot scherm (per wedstrijd geladen) ─────────
  const [messages, setMessages]             = useState([]);
  const [messagesCompId, setMessagesCompId] = useState(null);
  const messageUnsubRef                     = useRef(null);

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

        const auth    = getAuth(app);
        const db      = getFirestore(app);
        const storage = getStorage(app);
        initDb(db, APP_ID, storage);

        // Geen automatische (anonieme) sign-in meer — de gebruiker moet
        // zich aanmelden via login(). We tonen enkel of er al een sessie is.
        onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
          setAuthReady(true);
        });
      } catch (err) {
        setAuthError(err.message ?? String(err));
      }
    };

    init();
  }, []);

  // ── Gebruikersprofiel volgen zodra iemand ingelogd is ────────────────────
  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    return userFactory.subscribeOne(currentUser.uid, setUserProfile);
  }, [currentUser]);

  // ─────────────────────────────────────────────────────────────────────────
  // REALTIME LISTENERS
  // Starten zodra iemand ingelogd is (Firestore-rules vereisen een sessie).
  // Worden automatisch opgeruimd bij het uitloggen.
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [
      competitionFactory.subscribe(setCompetitions),
      eventFactory.subscribe(setEvents),
      clubFactory.subscribe(setClubs),
      competitionTypeFactory.subscribe(setCompetitionTypes),

      settingsFactory.subscribeCompetition(({ activeCompetitionId: id }) => {
        setActiveCompetitionId(id ?? null);
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [currentUser]);

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
  // BLOCKS — laden per geselecteerde wedstrijd
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start realtime listener voor de blokken (dagtijdlijn) van een wedstrijd.
   * Stopt de vorige listener automatisch.
   */
  const loadBlocks = useCallback((competitionId) => {
    if (blockUnsubRef.current) {
      blockUnsubRef.current();
      blockUnsubRef.current = null;
    }

    if (!competitionId) {
      setBlocks([]);
      setBlocksCompId(null);
      return;
    }

    setBlocksCompId(competitionId);
    blockUnsubRef.current = blockFactory.subscribe(competitionId, setBlocks);
  }, []);

  useEffect(() => {
    return () => {
      if (blockUnsubRef.current) blockUnsubRef.current();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PODIUMS — laden per geselecteerde wedstrijd
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start realtime listener voor de podia van een wedstrijd.
   * Stopt de vorige listener automatisch.
   */
  const loadPodiums = useCallback((competitionId) => {
    if (podiumUnsubRef.current) {
      podiumUnsubRef.current();
      podiumUnsubRef.current = null;
    }

    if (!competitionId) {
      setPodiums([]);
      setPodiumsCompId(null);
      return;
    }

    setPodiumsCompId(competitionId);
    podiumUnsubRef.current = podiumFactory.subscribe(competitionId, setPodiums);
  }, []);

  useEffect(() => {
    return () => {
      if (podiumUnsubRef.current) podiumUnsubRef.current();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGES — laden per geselecteerde wedstrijd
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start realtime listener voor de voorbereide boodschappen van een wedstrijd.
   * Stopt de vorige listener automatisch.
   */
  const loadMessages = useCallback((competitionId) => {
    if (messageUnsubRef.current) {
      messageUnsubRef.current();
      messageUnsubRef.current = null;
    }

    if (!competitionId) {
      setMessages([]);
      setMessagesCompId(null);
      return;
    }

    setMessagesCompId(competitionId);
    messageUnsubRef.current = messageFactory.subscribe(competitionId, setMessages);
  }, []);

  useEffect(() => {
    return () => {
      if (messageUnsubRef.current) messageUnsubRef.current();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // AFGELEIDE DATA
  // ─────────────────────────────────────────────────────────────────────────

  const activeCompetition = competitions.find(c => c.id === activeCompetitionId) ?? null;
  const finishedEvents = activeCompetition?.finishedEvents ?? [];
  const finishedSeries = activeCompetition?.finishedSeries ?? {};
  const podiumState = activeCompetition?.podiumState ?? { activePodiumId: null, revealStage: 0 };

  // Standaardboodschap voor het grote scherm — activeMessageId null betekent
  // altijd deze, nooit een apart opgeslagen document (zie dbSchema.js#MESSAGES).
  const DEFAULT_DISPLAY_MESSAGE = { id: null, text: 'Veel succes aan alle deelnemers', icon: '' };
  const activeMessageId = activeCompetition?.activeMessageId ?? null;
  const activeMessage = messages.find(m => m.id === activeMessageId) ?? DEFAULT_DISPLAY_MESSAGE;

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

  /** Heeft de ingelogde gebruiker recht op dit scherm? Beheerder = altijd. */
  const checkPermission = useCallback((key) => hasPermission(userProfile, key), [userProfile]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — auth & gebruikers
  // ─────────────────────────────────────────────────────────────────────────

  /** Meld aan met gebruikersnaam + wachtwoord. */
  const login = useCallback(async (username, password) => {
    const email = emailForUsername(username);
    if (!email) throw new Error('Ongeldige gebruikersnaam.');
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  /** Meld af. */
  const logout = useCallback(async () => {
    const auth = getAuth();
    await signOut(auth);
  }, []);

  /**
   * Maak een nieuwe gebruiker aan (enkel bruikbaar door een beheerder).
   * Gebruikt een tijdelijke, secundaire Firebase-app-instantie zodat de
   * sessie van de beheerder die dit aanroept niet verstoord wordt —
   * createUserWithEmailAndPassword logt anders automatisch in als het
   * nieuwe account.
   */
  const createUser = useCallback(async ({ username, password, role, permissions }) => {
    const email = emailForUsername(username);
    if (!email) throw new Error('Ongeldige gebruikersnaam.');
    const firebaseConfig = getFirebaseConfig();
    const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await userFactory.create(cred.user.uid, {
        username: username.trim(), role, permissions,
      });
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }
  }, []);

  /** Pas rol en/of rechten van een bestaande gebruiker aan. */
  const updateUser = useCallback((uid, data) => {
    return userFactory.update(uid, data);
  }, []);

  /**
   * Verwijder het profiel van een gebruiker (zie userFactory.delete —
   * verwijdert het Firebase Auth-account zelf niet, enkel de rechten).
   */
  const deleteUser = useCallback((uid) => {
    return userFactory.delete(uid);
  }, []);

  /** Start de gebruikerslijst-listener (enkel het gebruikersbeheer-scherm roept dit aan). */
  const loadUsers = useCallback(() => {
    if (usersUnsubRef.current) return; // al actief
    usersUnsubRef.current = userFactory.subscribe(setUsers);
  }, []);

  useEffect(() => {
    return () => {
      if (usersUnsubRef.current) usersUnsubRef.current();
    };
  }, []);

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
    // Geen reset van finishedEvents/finishedSeries hier: die leven op het
    // competition-document zelf (start als [] / {} bij create()), dus
    // hervatten van een gepauzeerde wedstrijd behoudt gewoon zijn voortgang.
    await competitionFactory.setStatus(competitionId, 'bezig');
    await settingsFactory.setActiveCompetition(competitionId);
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
    if (!activeCompetition) throw new Error('Geen actieve wedstrijd.');

    const newFinishedSeries = {
      ...finishedSeries,
      [eventId]: [...(finishedSeries[eventId] ?? []), seriesNr],
    };
    const newFinishedEvents = isLastInEvent && !finishedEvents.includes(eventId)
      ? [...finishedEvents, eventId]
      : finishedEvents;

    return competitionFactory.saveProgress(activeCompetition.id, {
      finishedEvents: newFinishedEvents,
      finishedSeries: newFinishedSeries,
    });
  }, [activeCompetition, finishedEvents, finishedSeries]);

  /**
   * Markeer één of meerdere reeksen terug als niet-afgelopen — om
   * vergissingen recht te zetten, in ÉÉN atomaire schrijfactie. Reeksen zijn
   * sequentieel: elke latere reeks van hetzelfde onderdeel die al klaar was,
   * wordt automatisch mee heropend (je kan geen reeks 5 "klaar" hebben terwijl
   * reeks 3 heropend is; seriesNr=1 wist dus de volledige voortgang van het
   * onderdeel). Elk onderdeel verliest ook zijn "volledig afgewerkt"-vlag.
   *
   * Neemt bewust een LIJST van { eventId, seriesNr } i.p.v. één per aanroep:
   * de heropenen-cascade (blockCascade.js) moet vaak meerdere onderdelen
   * tegelijk terugzetten (reeks X van onderdeel A heropenen sleept een later,
   * al afgewerkt onderdeel B mee). Los na elkaar aanroepen zou telkens zijn
   * eigen momentopname van finishedSeries als basis nemen — competitionFactory
   * .saveProgress vervangt het hele veld (geen deep merge), dus de laatste
   * losse write zou de vorige stilzwijgend overschrijven. Daarom hier één
   * berekening op één consistente basis, gevolgd door één write.
   *
   * Neemt ook bewust een expliciete competitionId i.p.v. altijd activeCompetition
   * te gebruiken: LiveView werkt enkel op de live wedstrijd, maar Beheer
   * (CompetitionDetail) moet dit ook kunnen voor een wedstrijd die niet live
   * staat. De bijhorende dagtijdlijn-blokken heropenen de schermen zelf (zie
   * blockCascade.js) — dat vereist de block-tijdvenster-logica die daar al
   * leeft, niet hier gedupliceerd.
   *
   * @param {string} competitionId
   * @param {Array<{eventId: string, seriesNr: number}>} resets
   */
  const unfinishSeries = useCallback((competitionId, resets) => {
    const comp = competitions.find(c => c.id === competitionId);
    if (!comp) throw new Error('Wedstrijd niet gevonden.');

    const newFinishedSeries = { ...(comp.finishedSeries ?? {}) };
    let newFinishedEvents = comp.finishedEvents ?? [];

    for (const { eventId, seriesNr } of resets) {
      newFinishedSeries[eventId] = (newFinishedSeries[eventId] ?? []).filter(nr => nr < seriesNr);
      newFinishedEvents = newFinishedEvents.filter(id => id !== eventId);
    }

    return competitionFactory.saveProgress(competitionId, {
      finishedEvents: newFinishedEvents,
      finishedSeries: newFinishedSeries,
    });
  }, [competitions]);

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

  const importParticipantsMultiEvent = useCallback((competitionId, existingParticipants, rowsByEvent) => {
    return participantFactory.importMultiEventBatch(
      competitionId, existingParticipants, rowsByEvent
    );
  }, []);

  const createParticipant = useCallback((competitionId, data) => {
    return participantFactory.create(competitionId, data);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — clubs
  // ─────────────────────────────────────────────────────────────────────────

  const createClub = useCallback((data) => {
    return clubFactory.create(data);
  }, []);

  const updateClub = useCallback((clubId, data) => {
    return clubFactory.update(clubId, data);
  }, []);

  const uploadClubLogo = useCallback((clubId, file) => {
    return clubFactory.uploadLogo(clubId, file);
  }, []);

  const findClubByName = useCallback((name) => {
    return clubFactory.findByName(name, clubs);
  }, [clubs]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — blocks (dagtijdlijn)
  // ─────────────────────────────────────────────────────────────────────────

  const createBlock = useCallback((competitionId, data) => {
    return blockFactory.create(competitionId, data);
  }, []);

  const updateBlock = useCallback((competitionId, blockId, data) => {
    return blockFactory.update(competitionId, blockId, data);
  }, []);

  const setBlockStatus = useCallback((competitionId, blockId, status) => {
    return blockFactory.setStatus(competitionId, blockId, status);
  }, []);

  const deleteBlock = useCallback((competitionId, blockId) => {
    return blockFactory.delete(competitionId, blockId);
  }, []);

  const importBlocks = useCallback((competitionId, blocksData) => {
    return blockFactory.importBatch(competitionId, blocksData);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — podiums (Fase 3)
  // ─────────────────────────────────────────────────────────────────────────

  const createPodium = useCallback((competitionId, data) => {
    return podiumFactory.create(competitionId, data);
  }, []);

  const updatePodium = useCallback((competitionId, podiumId, data) => {
    return podiumFactory.update(competitionId, podiumId, data);
  }, []);

  const deletePodium = useCallback((competitionId, podiumId) => {
    return podiumFactory.delete(competitionId, podiumId);
  }, []);

  /** Welk podium de speaker nu toont + hoever de onthulling staat (0-3). */
  const savePodiumState = useCallback((competitionId, newState) => {
    return competitionFactory.savePodiumState(competitionId, newState);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS — boodschappen groot scherm
  // ─────────────────────────────────────────────────────────────────────────

  const createMessage = useCallback((competitionId, data) => {
    return messageFactory.create(competitionId, data);
  }, []);

  const updateMessage = useCallback((competitionId, messageId, data) => {
    return messageFactory.update(competitionId, messageId, data);
  }, []);

  const deleteMessage = useCallback((competitionId, messageId) => {
    return messageFactory.delete(competitionId, messageId);
  }, []);

  /** messageId = null → terug naar de standaardboodschap. */
  const setActiveMessage = useCallback((competitionId, messageId) => {
    return competitionFactory.saveActiveMessage(competitionId, messageId);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────────────

  const value = {
    // Auth
    authReady,
    authError,
    currentUser,
    userProfile,
    hasPermission: checkPermission,
    login,
    logout,

    // Gebruikersbeheer
    users,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,

    // Collectiedata
    competitions,
    events,
    clubs,
    competitionTypes,

    // Deelnemers
    participants,
    participantsCompId,
    loadParticipants,

    // Blocks (dagtijdlijn)
    blocks,
    blocksCompId,
    loadBlocks,

    // Podiums (Fase 3)
    podiums,
    podiumsCompId,
    loadPodiums,
    podiumState,

    // Messages (boodschappen groot scherm)
    messages,
    messagesCompId,
    loadMessages,
    activeMessage,
    activeMessageId,

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
    blockTypeLabels: BLOCK_TYPE_LABELS,

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
    unfinishSeries,

    // Actions — deelnemers
    setPresence,
    scratchFromEvent,
    scratchFromAll,
    updateParticipant,
    importParticipants,
    importParticipantsMultiEvent,
    createParticipant,

    // Actions — clubs
    createClub,
    updateClub,
    uploadClubLogo,
    findClubByName,

    // Actions — blocks
    createBlock,
    updateBlock,
    setBlockStatus,
    deleteBlock,
    importBlocks,

    // Actions — podiums
    createPodium,
    updatePodium,
    deletePodium,
    savePodiumState,

    // Actions — boodschappen
    createMessage,
    updateMessage,
    deleteMessage,
    setActiveMessage,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
