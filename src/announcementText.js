/**
 * announcementText.js — SkipFlow
 *
 * Bouwt de aankondigingstekst voor één reeks van een speed-onderdeel (speed/
 * endurance/triple under — nooit freestyle), voor de automatische TTS-
 * aankondigingen op het speakerscherm. Puur — geen React, geen Firestore
 * (CLAUDE.md), in dezelfde stijl als fieldLayout.js/blockParticipants.js.
 *
 * Veralgemeende versie van een eerder, zelfgebouwd Google Sheets/Apps
 * Script-systeem van de gebruiker, dat een VASTE volgorde van twee
 * onderdelen veronderstelde (altijd eerst "Speed 30 sec", dan "Endurance").
 * Hier wordt de echte dagtijdlijn-volgorde (`sortedAllBlocks`, gesorteerd op
 * `order`) afgelopen — dezelfde aanpak als DisplayView.jsx's
 * `currentOrNextHeatsBlock`/`officialEvent`-logica — zodat dit ook correct
 * werkt wanneer onderdelen niet in de gebruikelijke volgorde gepland staan
 * (bv. Freestyles vóór Speed, een situatie die deze sessie al een echte bug
 * opleverde in DisplayView vóór die fix).
 *
 * Zie "Aankondigingen (TTS)" in ARCHITECTURE.md voor de volledige uitleg.
 */

import { extractFirstName, resolveClubAnnounceName } from './announcementNames';
import { padFieldList } from './fieldLayout';

// ─────────────────────────────────────────────────────────────────────────────
// ZINNETJESPOOL — variatie in de intro, context-afhankelijk
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_INTROS = [
  'We gaan verder met ',
  'En dan is het ',
  'Vervolgens is het ',
  'We gaan door met ',
  'De volgende reeks is ',
  'Dan nu ',
  'We vervolgen met ',
];

function pickGenericIntro() {
  return GENERIC_INTROS[Math.floor(Math.random() * GENERIC_INTROS.length)];
}

function buildIntro(context) {
  switch (context.kind) {
    case 'first-of-competition':
      return `We beginnen met ${context.eventName} en starten met `;
    case 'second-reeks':
      return 'zo... dat was de eerste reeks, we gaan verder met ';
    case 'after-transition':
      return `Dat was de laatste reeks van ${context.prevEventName}, we gaan onmiddellijk verder met ${context.eventName} en we starten met `;
    case 'last-of-block':
      return `en dan de laatste reeks van ${context.eventName} met `;
    default:
      return pickGenericIntro();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT — waar in de dagtijdlijn zit deze reeks?
// ─────────────────────────────────────────────────────────────────────────────

function resolveEventForBlock(block, events) {
  return events.find(e => e.id === block.eventId) ?? null;
}

/** Index van het EERSTE heats-blok in sortedAllBlocks voor een gegeven event. */
function firstHeatsBlockIndexForEvent(sortedAllBlocks, eventId) {
  return sortedAllBlocks.findIndex(b => b.type === 'heats' && b.eventId === eventId);
}

/** Zoekt, terugwaarts vanaf (niet-inclusief) index, het dichtstbijzijnde
 * heats-blok van een ANDER onderdeel — "wat kwam hiervoor". */
function findPrecedingDifferentEventBlock(sortedAllBlocks, beforeIndex, eventId) {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const b = sortedAllBlocks[i];
    if (b.type === 'heats' && b.eventId !== eventId) return b;
  }
  return null;
}

/**
 * Bepaalt de context-categorie van deze reeks binnen de ECHTE dagtijdlijn.
 * @param {Object} event
 * @param {number} seriesNr
 * @param {number|null} totalSeriesForEvent  totaal aantal reeksen van dit
 *   onderdeel (ken je de deelnemerslijst niet volledig, geef null — dan
 *   wordt "laatste reeks van het blok" nooit herkend, enkel de generieke pool)
 * @param {Array} sortedAllBlocks
 * @param {Array} events
 * @returns {{ kind: string, eventName?: string, prevEventName?: string }}
 */
export function resolveReeksContext({ event, seriesNr, totalSeriesForEvent, sortedAllBlocks, events }) {
  const firstIdxForEvent = firstHeatsBlockIndexForEvent(sortedAllBlocks, event.id);

  const firstSpeedBlock = sortedAllBlocks.find(b =>
    b.type === 'heats' && resolveEventForBlock(b, events)?.scoringType === 'speed'
  );
  const isFirstSpeedEvent = !!firstSpeedBlock && firstSpeedBlock.eventId === event.id;

  if (isFirstSpeedEvent && seriesNr === 1) {
    return { kind: 'first-of-competition', eventName: event.name };
  }
  if (isFirstSpeedEvent && seriesNr === 2) {
    return { kind: 'second-reeks' };
  }

  if (seriesNr === 1 && firstIdxForEvent > 0) {
    const prevBlock = findPrecedingDifferentEventBlock(sortedAllBlocks, firstIdxForEvent, event.id);
    if (prevBlock) {
      const prevEvent = resolveEventForBlock(prevBlock, events);
      return { kind: 'after-transition', eventName: event.name, prevEventName: prevEvent?.name ?? '' };
    }
  }

  if (totalSeriesForEvent != null && seriesNr === totalSeriesForEvent) {
    return { kind: 'last-of-block', eventName: event.name };
  }

  return { kind: 'generic' };
}

// ─────────────────────────────────────────────────────────────────────────────
// VELDENLIJST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bouwt per veld één regel ("op veld N Voornaam van Club" of "Veld N blijft
 * leeg"), met "en " enkel vóór de allerlaatste regel — exact de opmaak van
 * de oorspronkelijke, gevalideerde implementatie.
 */
function buildFieldLines(paddedList, getClub) {
  const lines = paddedList.map(p => {
    if (p._isEmpty) return `Veld ${p._entry.fieldNr} blijft leeg`;
    const voornaam = extractFirstName(p.name);
    const clubName = resolveClubAnnounceName(getClub(p.clubId));
    return `op veld ${p._entry.fieldNr} ${voornaam} van ${clubName}`;
  });
  if (lines.length > 0) {
    lines[lines.length - 1] = `en ${lines[lines.length - 1]}`;
  }
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOFDFUNCTIE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {{id: string, name: string, scoringType: string}} params.event
 * @param {number} params.seriesNr
 * @param {number|null} [params.totalSeriesForEvent]  zie resolveReeksContext
 * @param {Array} params.seriesParticipants  deelnemers van DEZE reeks, met `_entry` (fieldNr)
 * @param {number} params.maxFieldNr         zie fieldLayout.js#maxFieldNr
 * @param {function} params.getClub          (clubId) => Club|null
 * @param {Array} params.sortedAllBlocks     alle blokken van de wedstrijd, op order
 * @param {Array} params.events              alle CompetitionEvents
 * @returns {string}
 */
export function buildAnnouncementText({
  event, seriesNr, totalSeriesForEvent = null, seriesParticipants, maxFieldNr,
  getClub, sortedAllBlocks, events,
}) {
  const context = resolveReeksContext({ event, seriesNr, totalSeriesForEvent, sortedAllBlocks, events });
  const intro = buildIntro(context);

  const paddedList = padFieldList(seriesParticipants, maxFieldNr);
  const lines = buildFieldLines(paddedList, getClub);

  if (lines.length === 0) return intro.trim();
  return intro + lines[0] + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
}
