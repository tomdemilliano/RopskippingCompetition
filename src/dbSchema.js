/**
 * dbSchema.js — RopeScore Pro
 *
 * ENIGE toegestane bestand voor Firestore-toegang.
 * Importeer nooit rechtstreeks firebase/firestore in pages of components.
 *
 * Structuur:
 *   1. Initialisatie  — db-instantie instellen
 *   2. Path helpers   — Firestore-paden als functies
 *   3. Converters     — Firestore-data ↔ app-objecten
 *   4. Factories      — lees/schrijf-operaties per entiteit
 *
 * Collecties:
 *   settings/competition          singleton — actieve wedstrijd pointer
 *   users/{uid}                   gebruikers + rechten (doc-id = Firebase Auth uid)
 *   competitionTypes/{id}         wedstrijdtypes met standaard events
 *   events/{id}                   beschikbare onderdelen (globaal)
 *   clubs/{id}                    clubs + logo
 *   competitions/{id}             wedstrijden — incl. finishedEvents/finishedSeries
 *   competitions/{id}/participants/{id}   deelnemers per wedstrijd
 *   competitions/{id}/blocks/{id}         dagtijdlijn: blok → onderdeel (optioneel) → reeks
 *
 * Voortgang van een live wedstrijd (finishedEvents/finishedSeries) leeft op
 * het competition-document zelf, niet in een los singleton — zo verliest
 * pauzeren + hervatten van dezelfde wedstrijd nooit de voortgang, en heeft
 * elk dagdeel op een wedstrijddag automatisch zijn eigen voortgang.
 *
 * Afgeleide properties (nooit opgeslagen in Firestore):
 *   isScratchedFromEvent(participant, eventId) → boolean
 *   isFullyScratched(participant)              → boolean
 *   hasPermission(user, key)                   → boolean
 */

import {
  getFirestore,
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIALISATIE
// ─────────────────────────────────────────────────────────────────────────────

let _db = null;
let _appId = null;

/**
 * Initialiseer de DB-laag. Roep dit eenmalig aan vanuit App.jsx
 * nadat Firebase geïnitialiseerd is.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} appId
 */
export function initDb(db, appId) {
  _db = db;
  _appId = appId;
}

function getDb() {
  if (!_db) throw new Error('dbSchema: initDb() is nog niet aangeroepen.');
  return _db;
}

function getAppId() {
  if (!_appId) throw new Error('dbSchema: initDb() is nog niet aangeroepen.');
  return _appId;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATH HELPERS
// Geeft Firestore DocumentReference of CollectionReference terug.
// Nooit rechtstreeks gebruiken buiten dit bestand.
// ─────────────────────────────────────────────────────────────────────────────

const paths = {
  // Settings (singleton docs)
  settingsCompetition: () =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'settings', 'competition'),

  // Users — doc-id is de Firebase Auth uid
  users: () =>
    collection(getDb(), 'artifacts', getAppId(), 'public', 'data', 'users'),

  user: (uid) =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'users', uid),

  // CompetitionTypes
  competitionTypes: () =>
    collection(getDb(), 'artifacts', getAppId(), 'public', 'data', 'competitionTypes'),

  competitionType: (typeId) =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'competitionTypes', typeId),

  // Events
  events: () =>
    collection(getDb(), 'artifacts', getAppId(), 'public', 'data', 'events'),

  event: (eventId) =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'events', eventId),

  // Clubs
  clubs: () =>
    collection(getDb(), 'artifacts', getAppId(), 'public', 'data', 'clubs'),

  club: (clubId) =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'clubs', clubId),

  // Competitions
  competitions: () =>
    collection(getDb(), 'artifacts', getAppId(), 'public', 'data', 'competitions'),

  competition: (competitionId) =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'competitions', competitionId),

  // Participants (subcollectie onder competition)
  participants: (competitionId) =>
    collection(
      getDb(),
      'artifacts', getAppId(), 'public', 'data',
      'competitions', competitionId, 'participants'
    ),

  participant: (competitionId, participantId) =>
    doc(
      getDb(),
      'artifacts', getAppId(), 'public', 'data',
      'competitions', competitionId, 'participants', participantId
    ),

  // Blocks (subcollectie onder competition) — wedstrijd → blok → onderdeel → reeks
  blocks: (competitionId) =>
    collection(
      getDb(),
      'artifacts', getAppId(), 'public', 'data',
      'competitions', competitionId, 'blocks'
    ),

  block: (competitionId, blockId) =>
    doc(
      getDb(),
      'artifacts', getAppId(), 'public', 'data',
      'competitions', competitionId, 'blocks', blockId
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONVERTERS
// Zet ruwe Firestore-snapshots om naar schone app-objecten en vice versa.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} UserPermissions
 * @property {boolean} speaker
 * @property {boolean} backstage       groot scherm, opwarmruimte
 * @property {boolean} podium
 * @property {boolean} aanwezigheid
 */

/**
 * @typedef {Object} AppUser
 * @property {string} id                 Firebase Auth uid
 * @property {string} username           login-naam, uniek
 * @property {string} role               "beheerder" | "medewerker"
 * @property {UserPermissions} permissions   enkel relevant voor "medewerker" — een
 *                                            beheerder heeft altijd overal recht op
 * @property {string} createdAt
 */
const EMPTY_PERMISSIONS = {
  speaker: false, backstage: false, podium: false, aanwezigheid: false,
};

const userConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:          snapshot.id,
      username:    d.username    ?? '',
      role:        d.role        ?? 'medewerker',
      permissions: { ...EMPTY_PERMISSIONS, ...(d.permissions ?? {}) },
      createdAt:   d.createdAt   ?? '',
    };
  },
  toFirestore({ username, role, permissions }) {
    return { username, role, permissions: { ...EMPTY_PERMISSIONS, ...permissions } };
  },
};

/**
 * @typedef {Object} CompetitionType
 * @property {string}   id
 * @property {string}   name
 * @property {string[]} eventIds
 * @property {Object.<string, number>} defaultEventOrder
 */
const competitionTypeConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:                 snapshot.id,
      name:               d.name               ?? '',
      eventIds:           d.eventIds            ?? [],
      defaultEventOrder:  d.defaultEventOrder   ?? {},
    };
  },
  toFirestore({ name, eventIds, defaultEventOrder }) {
    return { name, eventIds, defaultEventOrder };
  },
};

/**
 * @typedef {Object} CompetitionEvent
 * @property {string} id
 * @property {string} name
 * @property {string} scoringType   "speed" | "freestyle"
 * @property {number} sortOrder
 */
const eventConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:          snapshot.id,
      name:        d.name        ?? '',
      scoringType: d.scoringType ?? 'speed',
      sortOrder:   d.sortOrder   ?? 0,
    };
  },
  toFirestore({ name, scoringType, sortOrder }) {
    return { name, scoringType, sortOrder };
  },
};

/**
 * @typedef {Object} Club
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} city
 * @property {string} country
 * @property {string} logoStoragePath
 * @property {string} logoUrl
 * @property {string} createdAt
 */
const clubConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:               snapshot.id,
      name:             d.name             ?? '',
      shortName:        d.shortName        ?? '',
      city:             d.city             ?? '',
      country:          d.country          ?? 'BE',
      logoStoragePath:  d.logoStoragePath  ?? '',
      logoUrl:          d.logoUrl          ?? '',
      createdAt:        d.createdAt        ?? '',
    };
  },
  toFirestore({ name, shortName, city, country, logoStoragePath, logoUrl }) {
    return { name, shortName, city, country, logoStoragePath, logoUrl };
  },
};

/**
 * @typedef {Object} Competition
 * @property {string} id
 * @property {string} name
 * @property {string} date            "YYYY-MM-DD"
 * @property {string} location
 * @property {string} typeId          ref → competitionTypes/{id}
 * @property {string} status          "open" | "bezig" | "beëindigd"
 * @property {Object.<string, number>} eventOrder   overschrijft defaultEventOrder
 * @property {string[]} finishedEvents            eventIds volledig afgewerkt
 * @property {Object.<string, number[]>} finishedSeries   seriesNrs afgewerkt per eventId
 * @property {string} createdAt
 */
const competitionConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:               snapshot.id,
      name:             d.name             ?? '',
      date:             d.date             ?? '',
      location:         d.location         ?? '',
      typeId:           d.typeId           ?? '',
      status:           d.status           ?? 'open',
      eventOrder:       d.eventOrder       ?? {},
      finishedEvents:   d.finishedEvents   ?? [],
      finishedSeries:   d.finishedSeries   ?? {},
      createdAt:        d.createdAt        ?? '',
    };
  },
  toFirestore({ name, date, location, typeId, status, eventOrder, finishedEvents = [], finishedSeries = {} }) {
    return { name, date, location, typeId, status, eventOrder, finishedEvents, finishedSeries };
  },
};

/**
 * @typedef {Object} Entry
 * @property {string}          eventId         ref → events/{id}
 * @property {number}          seriesNr
 * @property {number|string}   fieldNr         1-10 voor speed, "A"/"B" voor freestyle
 * @property {string}          scheduledTime   "HH:MM"
 * @property {boolean}         isScratched
 */

/**
 * @typedef {Object} Participant
 * @property {string}  id
 * @property {string}  name
 * @property {string}  clubId        ref → clubs/{id}
 * @property {string}  externalId    "{name}_{clubId}"
 * @property {boolean} isPresent
 * @property {Entry[]} entries
 * @property {string}  createdAt
 */
const participantConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:         snapshot.id,
      name:       d.name       ?? '',
      clubId:     d.clubId     ?? '',
      externalId: d.externalId ?? '',
      isPresent:  d.isPresent  ?? false,
      entries:    (d.entries   ?? []).map(normalizeEntry),
      createdAt:  d.createdAt  ?? '',
    };
  },
  toFirestore({ name, clubId, externalId, isPresent, entries }) {
    return { name, clubId, externalId, isPresent, entries };
  },
};

/** Zorg dat een entry-object altijd alle velden heeft. */
function normalizeEntry(raw) {
  return {
    eventId:       raw.eventId       ?? '',
    seriesNr:      raw.seriesNr      ?? 0,
    fieldNr:       raw.fieldNr       ?? '',
    scheduledTime: raw.scheduledTime ?? '',
    isScratched:   raw.isScratched   ?? false,
  };
}

/**
 * @typedef {Object} Block
 * @property {string} id
 * @property {string} type           "heats" | "pauze" | "lunchpauze" | "deuren" |
 *                                    "briefing" | "proefjury" | "prijsuitreiking"
 * @property {string} eventId        ref → events/{id} — enkel bij type "heats"
 * @property {string} label          vrije tekst — enkel bij een niet-heats type
 * @property {string} scheduledTime  "HH:MM"
 * @property {number} order          positie in de dagtijdlijn
 * @property {string} status         "gepland" | "actief" | "afgewerkt"
 */
const blockConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:            snapshot.id,
      type:          d.type          ?? 'heats',
      eventId:       d.eventId       ?? '',
      label:         d.label         ?? '',
      scheduledTime: d.scheduledTime ?? '',
      order:         d.order         ?? 0,
      status:        d.status        ?? 'gepland',
    };
  },
  toFirestore({ type, eventId = '', label = '', scheduledTime = '', order = 0, status = 'gepland' }) {
    return { type, eventId, label, scheduledTime, order, status };
  },
};

/** Standaardlabel per bloktype, gebruikt wanneer een blok geen eigen label heeft. */
export const BLOCK_TYPE_LABELS = {
  pauze:           'Pauze',
  lunchpauze:      'Lunchpauze',
  deuren:          'Deuren open',
  briefing:        'Jurybriefing',
  proefjury:       'Proefjury',
  prijsuitreiking: 'Prijsuitreiking',
};

/**
 * Heeft deze gebruiker recht op een bepaald scherm?
 * Een beheerder heeft altijd overal recht op — nooit apart opslaan.
 * @param {AppUser|null} user
 * @param {'speaker'|'backstage'|'podium'|'aanwezigheid'} key
 * @returns {boolean}
 */
export function hasPermission(user, key) {
  if (!user) return false;
  return user.role === 'beheerder' || !!user.permissions?.[key];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AFGELEIDE PROPERTIES
// Bereken altijd live — nooit opslaan in Firestore.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is een deelnemer geschrapt van een specifiek onderdeel?
 * @param {Participant} participant
 * @param {string} eventId
 * @returns {boolean}
 */
export function isScratchedFromEvent(participant, eventId) {
  const entry = participant.entries.find(e => e.eventId === eventId);
  return entry?.isScratched ?? false;
}

/**
 * Is een deelnemer volledig geschrapt (alle onderdelen)?
 * @param {Participant} participant
 * @returns {boolean}
 */
export function isFullyScratched(participant) {
  return (
    participant.entries.length > 0 &&
    participant.entries.every(e => e.isScratched)
  );
}

/**
 * Geeft de entries van een deelnemer gesorteerd op seriesNr dan fieldNr.
 * @param {Participant} participant
 * @returns {Entry[]}
 */
export function sortedEntries(participant) {
  return [...participant.entries].sort((a, b) => {
    if (a.seriesNr !== b.seriesNr) return a.seriesNr - b.seriesNr;
    return String(a.fieldNr).localeCompare(String(b.fieldNr));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

// ── SETTINGS ─────────────────────────────────────────────────────────────────

export const settingsFactory = {
  /**
   * Luister naar de actieve wedstrijd pointer.
   * @param {function} callback  cb({ activeCompetitionId })
   * @returns {function} unsubscribe
   */
  subscribeCompetition(callback) {
    return onSnapshot(paths.settingsCompetition(), (snap) => {
      callback(snap.exists() ? snap.data() : { activeCompetitionId: null });
    });
  },

  /** Stel de actieve wedstrijd in (of wis met null). */
  setActiveCompetition(competitionId) {
    return setDoc(paths.settingsCompetition(), {
      activeCompetitionId: competitionId,
    });
  },
};

// ── COMPETITION TYPES ─────────────────────────────────────────────────────────

export const competitionTypeFactory = {
  /**
   * Éénmalig alle types ophalen (geen realtime nodig — zelden gewijzigd).
   * @returns {Promise<CompetitionType[]>}
   */
  async getAll() {
    const snap = await getDocs(paths.competitionTypes());
    return snap.docs.map(competitionTypeConverter.fromFirestore);
  },

  /**
   * Luister naar alle types.
   * @param {function} callback  cb(CompetitionType[])
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    return onSnapshot(paths.competitionTypes(), (snap) => {
      callback(snap.docs.map(competitionTypeConverter.fromFirestore));
    });
  },

  /**
   * Maak een nieuw wedstrijdtype aan.
   * @param {{ name: string, eventIds: string[], defaultEventOrder: Object }} data
   * @returns {Promise<string>} nieuw id
   */
  async create({ name, eventIds, defaultEventOrder }) {
    const ref = await addDoc(
      paths.competitionTypes(),
      competitionTypeConverter.toFirestore({ name, eventIds, defaultEventOrder })
    );
    return ref.id;
  },

  /**
   * Pas een bestaand type aan.
   * @param {string} typeId
   * @param {{ name?: string, eventIds?: string[], defaultEventOrder?: Object }} data
   */
  update(typeId, data) {
    return updateDoc(paths.competitionType(typeId), data);
  },

  /**
   * Verwijder een type.
   * Controleer eerst of er wedstrijden aan gekoppeld zijn.
   * @param {string} typeId
   */
  delete(typeId) {
    return deleteDoc(paths.competitionType(typeId));
  },
};

// ── EVENTS ────────────────────────────────────────────────────────────────────

export const eventFactory = {
  /**
   * Éénmalig alle events ophalen.
   * @returns {Promise<CompetitionEvent[]>}
   */
  async getAll() {
    const snap = await getDocs(paths.events());
    return snap.docs
      .map(eventConverter.fromFirestore)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Luister naar alle events.
   * @param {function} callback  cb(CompetitionEvent[])
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    return onSnapshot(paths.events(), (snap) => {
      const sorted = snap.docs
        .map(eventConverter.fromFirestore)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      callback(sorted);
    });
  },

  /**
   * Maak een nieuw event aan.
   * @param {{ name: string, scoringType: string, sortOrder: number }} data
   * @returns {Promise<string>} nieuw id
   */
  async create({ name, scoringType, sortOrder }) {
    const ref = await addDoc(
      paths.events(),
      eventConverter.toFirestore({ name, scoringType, sortOrder })
    );
    return ref.id;
  },

  /**
   * Pas een bestaand event aan.
   * @param {string} eventId
   * @param {{ name?: string, scoringType?: string, sortOrder?: number }} data
   */
  update(eventId, data) {
    return updateDoc(paths.event(eventId), data);
  },

  /**
   * Verwijder een event.
   * Controleer eerst of het event in gebruik is bij competitionTypes.
   * @param {string} eventId
   */
  delete(eventId) {
    return deleteDoc(paths.event(eventId));
  },
};

// ── CLUBS ─────────────────────────────────────────────────────────────────────

export const clubFactory = {
  /**
   * Luister naar alle clubs.
   * @param {function} callback  cb(Club[])
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    return onSnapshot(paths.clubs(), (snap) => {
      callback(snap.docs.map(clubConverter.fromFirestore));
    });
  },

  /**
   * Zoek een club op naam (case-insensitief, getrimmed).
   * Geeft exacte en fuzzy matches terug zodat de UI kan beslissen.
   *
   * @param {string} name
   * @param {Club[]} allClubs   geef de al-geladen clubs-array mee (vermijdt extra query)
   * @returns {{ exact: Club|null, fuzzy: Club[] }}
   */
  findByName(name, allClubs) {
    const normalized = name.trim().toLowerCase();
    const exact = allClubs.find(
      (c) => c.name.trim().toLowerCase() === normalized
    ) ?? null;
    const fuzzy = exact
      ? []
      : allClubs.filter((c) => {
          const d = levenshtein(c.name.trim().toLowerCase(), normalized);
          return d > 0 && d <= 2;
        });
    return { exact, fuzzy };
  },

  /**
   * Maak een nieuwe club aan.
   * @param {{ name: string, shortName: string, city?: string, country?: string }} data
   * @returns {Promise<string>} nieuw clubId
   */
  async create({ name, shortName, city = '', country = 'BE' }) {
    const ref = await addDoc(
      paths.clubs(),
      clubConverter.toFirestore({
        name,
        shortName,
        city,
        country,
        logoStoragePath: '',
        logoUrl: '',
      })
    );
    return ref.id;
  },

  /**
   * Pas een club aan.
   * @param {string} clubId
   * @param {Partial<Club>} data
   */
  update(clubId, data) {
    return updateDoc(paths.club(clubId), data);
  },

  /**
   * Sla een nieuw logo-pad en -URL op na een upload.
   * @param {string} clubId
   * @param {string} logoStoragePath
   * @param {string} logoUrl
   */
  updateLogo(clubId, logoStoragePath, logoUrl) {
    return updateDoc(paths.club(clubId), { logoStoragePath, logoUrl });
  },
};

// ── COMPETITIONS ──────────────────────────────────────────────────────────────

export const competitionFactory = {
  /**
   * Luister naar alle wedstrijden.
   * @param {function} callback  cb(Competition[])
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    return onSnapshot(paths.competitions(), (snap) => {
      callback(snap.docs.map(competitionConverter.fromFirestore));
    });
  },

  /**
   * Maak een nieuwe wedstrijd aan.
   * eventOrder wordt initieel overgenomen van het competitionType.
   *
   * @param {{ name: string, date: string, location: string, typeId: string, eventOrder: Object }} data
   * @returns {Promise<string>} nieuw id
   */
  async create({ name, date, location, typeId, eventOrder = {} }) {
    const ref = await addDoc(
      paths.competitions(),
      {
        ...competitionConverter.toFirestore({
          name, date, location, typeId, status: 'open', eventOrder,
        }),
        createdAt: new Date().toISOString(),
      }
    );
    return ref.id;
  },

  /**
   * Pas een wedstrijd aan.
   * @param {string} competitionId
   * @param {Partial<Competition>} data
   */
  update(competitionId, data) {
    return updateDoc(paths.competition(competitionId), data);
  },

  /**
   * Verander de status van een wedstrijd.
   * @param {string} competitionId
   * @param {'open'|'bezig'|'beëindigd'} status
   */
  setStatus(competitionId, status) {
    return updateDoc(paths.competition(competitionId), { status });
  },

  /**
   * Sla een aangepaste event-volgorde op.
   * @param {string} competitionId
   * @param {Object.<string, number>} eventOrder
   */
  saveEventOrder(competitionId, eventOrder) {
    return updateDoc(paths.competition(competitionId), { eventOrder });
  },

  /**
   * Sla de live voortgang van deze wedstrijd op.
   * Leeft op het competition-document zelf — niet in een los singleton —
   * zodat pauzeren en hervatten van dezelfde wedstrijd de voortgang bewaart.
   * @param {string} competitionId
   * @param {{ finishedEvents: string[], finishedSeries: Object.<string, number[]> }} progress
   */
  saveProgress(competitionId, { finishedEvents, finishedSeries }) {
    return updateDoc(paths.competition(competitionId), { finishedEvents, finishedSeries });
  },

  /**
   * Verwijder een wedstrijd inclusief alle deelnemers.
   * @param {string} competitionId
   */
  async delete(competitionId) {
    const batch = writeBatch(getDb());
    const pSnap = await getDocs(paths.participants(competitionId));
    pSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(paths.competition(competitionId));
    return batch.commit();
  },
};

// ── PARTICIPANTS ──────────────────────────────────────────────────────────────

export const participantFactory = {
  /**
   * Luister naar alle deelnemers van een wedstrijd.
   * @param {string} competitionId
   * @param {function} callback  cb(Participant[])
   * @returns {function} unsubscribe
   */
  subscribe(competitionId, callback) {
    return onSnapshot(paths.participants(competitionId), (snap) => {
      callback(snap.docs.map(participantConverter.fromFirestore));
    });
  },

  /**
   * Pas aanwezigheid aan.
   * @param {string} competitionId
   * @param {string} participantId
   * @param {boolean} isPresent
   */
  setPresence(competitionId, participantId, isPresent) {
    return updateDoc(
      paths.participant(competitionId, participantId),
      { isPresent }
    );
  },

  /**
   * Schrap of herstel een deelnemer van een specifiek onderdeel.
   * Wijzigt alleen de isScratched-vlag op de betrokken entry.
   *
   * @param {string}      competitionId
   * @param {Participant} participant     huidig participant-object (voor entries)
   * @param {string}      eventId
   * @param {boolean}     isScratched
   */
  setScratchedForEvent(competitionId, participant, eventId, isScratched) {
    const updatedEntries = participant.entries.map((e) =>
      e.eventId === eventId ? { ...e, isScratched } : e
    );
    return updateDoc(
      paths.participant(competitionId, participant.id),
      { entries: updatedEntries }
    );
  },

  /**
   * Schrap of herstel een deelnemer van alle onderdelen tegelijk.
   * @param {string}      competitionId
   * @param {Participant} participant
   * @param {boolean}     isScratched
   */
  setScratchedForAll(competitionId, participant, isScratched) {
    const updatedEntries = participant.entries.map((e) => ({
      ...e,
      isScratched,
    }));
    return updateDoc(
      paths.participant(competitionId, participant.id),
      { entries: updatedEntries }
    );
  },

  /**
   * Pas naam of club aan.
   * @param {string} competitionId
   * @param {string} participantId
   * @param {{ name?: string, clubId?: string }} data
   */
  update(competitionId, participantId, data) {
    return updateDoc(paths.participant(competitionId, participantId), data);
  },

  /**
   * Importeer deelnemers uit een geparseerde CSV voor één event.
   *
   * Elke rij bevat:
   *   { name, clubId, externalId, seriesNr, fieldNr, scheduledTime }
   *
   * Matching: zoek bestaande participant op externalId.
   *   - Gevonden → voeg entry toe of update bestaande entry voor dit event.
   *   - Niet gevonden → maak nieuwe participant aan.
   *
   * @param {string}      competitionId
   * @param {string}      eventId
   * @param {Participant[]} existingParticipants   al geladen lijst (vermijdt extra query)
   * @param {Array<{
   *   name: string,
   *   clubId: string,
   *   externalId: string,
   *   seriesNr: number,
   *   fieldNr: number|string,
   *   scheduledTime: string,
   *   isPause?: boolean
   * }>} rows
   */
  async importBatch(competitionId, eventId, existingParticipants, rows) {
    const batch = writeBatch(getDb());

    for (const row of rows) {
      const newEntry = normalizeEntry({
        eventId,
        seriesNr:      row.seriesNr,
        fieldNr:       row.fieldNr,
        scheduledTime: row.scheduledTime,
        isScratched:   false,
      });

      const existing = existingParticipants.find(
        (p) => p.externalId === row.externalId
      );

      if (existing) {
        // Vervang entry voor dit event als die al bestaat, anders voeg toe
        const otherEntries = existing.entries.filter(
          (e) => e.eventId !== eventId
        );
        batch.update(
          paths.participant(competitionId, existing.id),
          { entries: [...otherEntries, newEntry] }
        );
      } else {
        const newRef = doc(paths.participants(competitionId));
        batch.set(newRef, {
          name:       row.name,
          clubId:     row.clubId,
          externalId: row.externalId,
          isPresent:  false,
          entries:    [newEntry],
          createdAt:  new Date().toISOString(),
        });
      }
    }

    return batch.commit();
  },

  /**
   * Verwijder een deelnemer volledig.
   * @param {string} competitionId
   * @param {string} participantId
   */
  delete(competitionId, participantId) {
    return deleteDoc(paths.participant(competitionId, participantId));
  },
};

// ── BLOCKS ────────────────────────────────────────────────────────────────────
// wedstrijd → blok → onderdeel (optioneel, enkel bij type "heats") → reeks.
// Reeksen zelf blijven afgeleid uit participant.entries[] — er is geen apart
// heat-document. Vervangt de vroegere PAUZE_-naamhack (een nep-deelnemer om
// een pauze te markeren) door een eerste-klas schema-item.

export const blockFactory = {
  /**
   * Luister naar alle blokken van een wedstrijd, gesorteerd op order.
   * @param {string} competitionId
   * @param {function} callback  cb(Block[])
   * @returns {function} unsubscribe
   */
  subscribe(competitionId, callback) {
    return onSnapshot(paths.blocks(competitionId), (snap) => {
      const sorted = snap.docs
        .map(blockConverter.fromFirestore)
        .sort((a, b) => a.order - b.order);
      callback(sorted);
    });
  },

  /**
   * Maak een nieuw blok aan.
   * @param {string} competitionId
   * @param {{ type: string, eventId?: string, label?: string, scheduledTime?: string, order?: number }} data
   * @returns {Promise<string>} nieuw id
   */
  async create(competitionId, data) {
    const ref = await addDoc(
      paths.blocks(competitionId),
      blockConverter.toFirestore(data)
    );
    return ref.id;
  },

  /**
   * Pas een bestaand blok aan.
   * @param {string} competitionId
   * @param {string} blockId
   * @param {Partial<Block>} data
   */
  update(competitionId, blockId, data) {
    return updateDoc(paths.block(competitionId, blockId), data);
  },

  /**
   * Verander de status van een blok (bv. bij "volgende" in Speaker/Display).
   * @param {string} competitionId
   * @param {string} blockId
   * @param {'gepland'|'actief'|'afgewerkt'} status
   */
  setStatus(competitionId, blockId, status) {
    return updateDoc(paths.block(competitionId, blockId), { status });
  },

  /**
   * Verwijder een blok.
   * @param {string} competitionId
   * @param {string} blockId
   */
  delete(competitionId, blockId) {
    return deleteDoc(paths.block(competitionId, blockId));
  },
};

// ── USERS ─────────────────────────────────────────────────────────────────────
// Topcollectie, niet gebonden aan een wedstrijd — net als clubs. Doc-id is de
// Firebase Auth uid. Een gebruiker wordt aangemaakt via een tijdelijke,
// secundaire Firebase-app-instantie in de UI-laag (AppContext.createUser),
// zodat de sessie van de beheerder die de aanmaak doet niet verstoord wordt —
// dbSchema.js zelf raakt Firebase Auth niet aan, enkel Firestore.

export const userFactory = {
  /**
   * Éénmalig alle gebruikers ophalen (bv. om te checken of er al een
   * beheerder bestaat, zoals de bootstrap-stap op de seed-pagina doet).
   * @returns {Promise<AppUser[]>}
   */
  async getAll() {
    const snap = await getDocs(paths.users());
    return snap.docs.map(userConverter.fromFirestore);
  },

  /**
   * Luister naar alle gebruikers (voor het gebruikersbeheer-scherm).
   * @param {function} callback  cb(AppUser[])
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    return onSnapshot(paths.users(), (snap) => {
      callback(snap.docs.map(userConverter.fromFirestore));
    });
  },

  /**
   * Luister naar het profiel van één gebruiker (voor de ingelogde gebruiker zelf).
   * @param {string} uid
   * @param {function} callback  cb(AppUser|null)
   * @returns {function} unsubscribe
   */
  subscribeOne(uid, callback) {
    return onSnapshot(paths.user(uid), (snap) => {
      callback(snap.exists() ? userConverter.fromFirestore(snap) : null);
    });
  },

  /**
   * Maak het Firestore-profiel voor een net aangemaakt Auth-account aan.
   * @param {string} uid
   * @param {{ username: string, role: string, permissions: UserPermissions }} data
   */
  create(uid, data) {
    return setDoc(paths.user(uid), {
      ...userConverter.toFirestore(data),
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Pas rol en/of rechten van een gebruiker aan.
   * @param {string} uid
   * @param {{ role?: string, permissions?: UserPermissions }} data
   */
  update(uid, data) {
    return updateDoc(paths.user(uid), data);
  },

  /**
   * Verwijder het Firestore-profiel van een gebruiker.
   * Verwijdert NIET het onderliggende Firebase Auth-account (dat vereist de
   * Admin SDK, dus een backend) — de gebruiker kan zich nadien nog technisch
   * aanmelden bij Firebase Auth, maar zonder profiel geeft de app geen enkel
   * recht meer (hasPermission() geeft dan overal false).
   * @param {string} uid
   */
  delete(uid) {
    return deleteDoc(paths.user(uid));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. HULPFUNCTIES (intern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Levenshtein-afstand tussen twee strings.
 * Gebruikt voor fuzzy club-matching bij import.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
