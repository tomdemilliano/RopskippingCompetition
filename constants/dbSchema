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
 *   settings/progress             singleton — voortgang live wedstrijd
 *   competitionTypes/{id}         wedstrijdtypes met standaard events
 *   events/{id}                   beschikbare onderdelen (globaal)
 *   clubs/{id}                    clubs + logo
 *   competitions/{id}             wedstrijden
 *   competitions/{id}/participants/{id}   deelnemers per wedstrijd
 *
 * Afgeleide properties (nooit opgeslagen in Firestore):
 *   isScratchedFromEvent(participant, eventId) → boolean
 *   isFullyScratched(participant)              → boolean
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

  settingsProgress: () =>
    doc(getDb(), 'artifacts', getAppId(), 'public', 'data', 'settings', 'progress'),

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
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONVERTERS
// Zet ruwe Firestore-snapshots om naar schone app-objecten en vice versa.
// ─────────────────────────────────────────────────────────────────────────────

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
 * @property {string} createdAt
 */
const competitionConverter = {
  fromFirestore(snapshot) {
    const d = snapshot.data();
    return {
      id:          snapshot.id,
      name:        d.name        ?? '',
      date:        d.date        ?? '',
      location:    d.location    ?? '',
      typeId:      d.typeId      ?? '',
      status:      d.status      ?? 'open',
      eventOrder:  d.eventOrder  ?? {},
      createdAt:   d.createdAt   ?? '',
    };
  },
  toFirestore({ name, date, location, typeId, status, eventOrder }) {
    return { name, date, location, typeId, status, eventOrder };
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

  /**
   * Luister naar de live voortgang.
   * @param {function} callback  cb({ finishedEvents, finishedSeries })
   * @returns {function} unsubscribe
   */
  subscribeProgress(callback) {
    return onSnapshot(paths.settingsProgress(), (snap) => {
      callback(
        snap.exists()
          ? snap.data()
          : { finishedEvents: [], finishedSeries: {} }
      );
    });
  },

  /** Stel de actieve wedstrijd in (of wis met null). */
  setActiveCompetition(competitionId) {
    return setDoc(paths.settingsCompetition(), {
      activeCompetitionId: competitionId,
    });
  },

  /** Sla voortgang op. */
  saveProgress({ finishedEvents, finishedSeries }) {
    return setDoc(paths.settingsProgress(), { finishedEvents, finishedSeries });
  },

  /** Reset voortgang (bij start nieuwe wedstrijd). */
  resetProgress() {
    return setDoc(paths.settingsProgress(), {
      finishedEvents: [],
      finishedSeries: {},
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
