/**
 * blockParticipants.js — SkipFlow
 *
 * Pure helper: welke deelnemers/entries horen bij een gegeven heats-blok in
 * de dagtijdlijn. Eén onderdeel kan over meerdere fysieke blokken lopen (bv.
 * Freestyles onderbroken door pauzes, of Speed/Endurance met zoveel velden
 * dat ze over 2 kolomblokken verdeeld staan maar toch 1 blok vormen — zie
 * pdfSchedule.js) — enkel wanneer een onderdeel ECHT meerdere blokken heeft,
 * wordt de deelnemerslijst afgebakend tot het tijdvenster van het gevraagde
 * blok.
 *
 * Dit is dezelfde afbakeningslogica als LiveView.jsx's `eventParticipants`
 * (daar berekend voor het "huidige" blok/event), maar hier geparametriseerd
 * op een willekeurig, expliciet blok — nodig omdat CompetitionDetail.jsx
 * (Beheer) élk blok moet kunnen tonen bij een klik, niet enkel het live-
 * actieve. Bewust een apart, klein bestand i.p.v. hergebruik forceren tussen
 * de twee schermen: LiveView's versie is verweven met zijn eigen navigatie-
 * state (currentBlock/activeEventId/activeSeriesNr) en blijft daar ongemoeid
 * — enkel de onderliggende tijdvenster-berekening is hier apart, puur
 * getrokken.
 *
 * Puur berekening — geen Firestore-toegang, geen React.
 */

import { timeToMinutes } from './timeUtils';

/**
 * @param {Object|null} block        het aangeklikte blok (enkel zinvol voor type === 'heats')
 * @param {Array} sortedBlocks       alle blokken van de wedstrijd, op order
 * @param {Array} participants       alle deelnemers van de wedstrijd
 * @returns {{ seriesNrs: number[], entriesBySeriesNr: Map<number, Array> }}
 *   entriesBySeriesNr bevat deelnemers met een `_entry`-veld (de entry voor
 *   dit event), gesorteerd per reeks op fieldNr.
 */
export function resolveBlockEntries(block, sortedBlocks, participants) {
  if (!block || block.type !== 'heats' || !block.eventId) {
    return { seriesNrs: [], entriesBySeriesNr: new Map() };
  }

  const allEventParticipants = participants
    .filter(p => p.entries.some(e => e.eventId === block.eventId && !e.isScratched))
    .map(p => ({ ...p, _entry: p.entries.find(e => e.eventId === block.eventId) }));

  const eventBlocks = sortedBlocks.filter(b => b.type === 'heats' && b.eventId === block.eventId);
  const idx = sortedBlocks.findIndex(b => b.id === block.id);
  const nextBlock = idx >= 0 ? (sortedBlocks[idx + 1] ?? null) : null;

  const scoped = eventBlocks.length > 1
    ? allEventParticipants.filter(p => {
        const mins = timeToMinutes(p._entry.scheduledTime);
        const startMin = timeToMinutes(block.scheduledTime);
        const endMin = nextBlock?.scheduledTime ? timeToMinutes(nextBlock.scheduledTime) : null;
        if (mins === null || startMin === null) return true; // niet te bepalen — liever tonen dan verbergen
        if (mins < startMin) return false;
        if (endMin !== null && mins >= endMin) return false;
        return true;
      })
    : allEventParticipants;

  const entriesBySeriesNr = new Map();
  for (const p of scoped) {
    const nr = p._entry.seriesNr;
    if (!entriesBySeriesNr.has(nr)) entriesBySeriesNr.set(nr, []);
    entriesBySeriesNr.get(nr).push(p);
  }
  for (const list of entriesBySeriesNr.values()) {
    list.sort((a, b) => String(a._entry.fieldNr).localeCompare(String(b._entry.fieldNr)));
  }

  const seriesNrs = [...entriesBySeriesNr.keys()].sort((a, b) => a - b);
  return { seriesNrs, entriesBySeriesNr };
}
