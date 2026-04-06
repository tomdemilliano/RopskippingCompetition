/**
 * seedData.js — RopeScore Pro
 *
 * Vult de Firestore-collecties `events` en `competitionTypes` éénmalig
 * met de basisdata. Idempotent: bestaande documenten worden niet overschreven.
 *
 * Gebruik:
 *   import { runSeed } from './seedData';
 *   const result = await runSeed();
 *
 * Geeft een SeedResult-object terug met tellers en eventuele fouten.
 */

import { eventFactory, competitionTypeFactory } from './dbSchema';

// ─────────────────────────────────────────────────────────────────────────────
// BRONDATA
// Gebaseerd op constants.js — dit is de enige plek waar deze data
// nog als constante staat. Na het seeden leeft alles in Firestore.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alle unieke onderdelen met hun scoringType en standaard sorteervolgorde.
 * scoringType "freestyle" → meerdere skippers na elkaar op één veld
 * scoringType "speed"     → meerdere skippers gelijktijdig op verschillende velden
 */
const SEED_EVENTS = [
  { name: 'Speed',              scoringType: 'speed',     sortOrder: 1  },
  { name: 'Endurance',          scoringType: 'speed',     sortOrder: 2  },
  { name: 'Triple under',       scoringType: 'speed',     sortOrder: 3  },
  { name: 'Double under Relay', scoringType: 'speed',     sortOrder: 4  },
  { name: 'SR Speed Relay',     scoringType: 'speed',     sortOrder: 5  },
  { name: 'DD Speed Relay',     scoringType: 'speed',     sortOrder: 6  },
  { name: 'DD Speed Sprint',    scoringType: 'speed',     sortOrder: 7  },
  { name: 'Freestyle',          scoringType: 'freestyle', sortOrder: 8  },
  { name: 'SR2',                scoringType: 'freestyle', sortOrder: 9  },
  { name: 'SR4',                scoringType: 'freestyle', sortOrder: 10 },
  { name: 'DD3',                scoringType: 'freestyle', sortOrder: 11 },
  { name: 'DD4',                scoringType: 'freestyle', sortOrder: 12 },
  { name: 'SR Team Freestyle',  scoringType: 'freestyle', sortOrder: 13 },
  { name: 'DD Team Freestyle',  scoringType: 'freestyle', sortOrder: 14 },
];

/**
 * Wedstrijdtypes met hun standaard event-namen (worden omgezet naar eventIds
 * nadat de events aangemaakt zijn).
 * defaultEventOrder volgt de volgorde in de array (index + 1).
 */
const SEED_COMPETITION_TYPES = [
  {
    name:       'A Masters',
    eventNames: ['Speed', 'Endurance', 'Freestyle', 'Triple under'],
  },
  {
    name:       'B/C Masters',
    eventNames: ['Speed', 'Endurance', 'Freestyle'],
  },
  {
    name:       'mini Masters',
    eventNames: ['Speed', 'Endurance', 'Freestyle'],
  },
  {
    name:       'A Teams',
    eventNames: [
      'SR Speed Relay', 'DD Speed Relay', 'DD Speed Sprint',
      'Double under Relay', 'SR2', 'SR4', 'DD3', 'DD4',
    ],
  },
  {
    name:       'B Teams',
    eventNames: [
      'SR Speed Relay', 'DD Speed Relay', 'DD Speed Sprint',
      'SR2', 'SR4', 'DD3', 'DD4',
    ],
  },
  {
    name:       'C Teams',
    eventNames: [
      'SR Speed Relay', 'DD Speed Relay',
      'SR Team Freestyle', 'DD Team Freestyle',
    ],
  },
  {
    name:       'mini Teams',
    eventNames: [
      'SR Speed Relay', 'DD Speed Relay',
      'SR Team Freestyle', 'DD Team Freestyle',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SeedResult
 * @property {boolean}  success
 * @property {number}   eventsCreated       nieuw aangemaakte events
 * @property {number}   eventsSkipped       al bestaande events (niet aangeraakt)
 * @property {number}   typesCreated        nieuw aangemaakte competitionTypes
 * @property {number}   typesSkipped        al bestaande types (niet aangeraakt)
 * @property {string[]} warnings            niet-fatale meldingen
 * @property {string}   error               foutmelding bij failure
 */

/**
 * Voer de seed uit. Idempotent — veilig om meerdere keren te draaien.
 * @returns {Promise<SeedResult>}
 */
export async function runSeed() {
  const result = {
    success:       false,
    eventsCreated: 0,
    eventsSkipped: 0,
    typesCreated:  0,
    typesSkipped:  0,
    warnings:      [],
    error:         '',
  };

  try {
    // ── Stap 1: Events seeden ─────────────────────────────────────────────

    const existingEvents = await eventFactory.getAll();
    const existingEventNames = new Set(existingEvents.map(e => e.name));

    // Naam → id mapping — wordt gebruikt bij competitionTypes
    const eventIdByName = Object.fromEntries(
      existingEvents.map(e => [e.name, e.id])
    );

    for (const seedEvent of SEED_EVENTS) {
      if (existingEventNames.has(seedEvent.name)) {
        result.eventsSkipped++;
        continue;
      }

      const newId = await eventFactory.create({
        name:        seedEvent.name,
        scoringType: seedEvent.scoringType,
        sortOrder:   seedEvent.sortOrder,
      });

      eventIdByName[seedEvent.name] = newId;
      result.eventsCreated++;
    }

    // ── Stap 2: CompetitionTypes seeden ──────────────────────────────────

    const existingTypes = await competitionTypeFactory.getAll();
    const existingTypeNames = new Set(existingTypes.map(t => t.name));

    for (const seedType of SEED_COMPETITION_TYPES) {
      if (existingTypeNames.has(seedType.name)) {
        result.typesSkipped++;
        continue;
      }

      // Zet event-namen om naar eventIds
      const eventIds = [];
      const defaultEventOrder = {};

      seedType.eventNames.forEach((eventName, index) => {
        const eventId = eventIdByName[eventName];
        if (!eventId) {
          result.warnings.push(
            `CompetitionType "${seedType.name}": event "${eventName}" niet gevonden — overgeslagen.`
          );
          return;
        }
        eventIds.push(eventId);
        defaultEventOrder[eventId] = index + 1;
      });

      await competitionTypeFactory.create({
        name:               seedType.name,
        eventIds,
        defaultEventOrder,
      });

      result.typesCreated++;
    }

    result.success = true;

  } catch (err) {
    result.error = err.message ?? String(err);
  }

  return result;
}
