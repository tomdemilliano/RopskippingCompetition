/**
 * liveProgress.js — SkipFlow
 *
 * Pure logica: "wat is nu aan de beurt" in een wedstrijd — welk onderdeel,
 * welke reeks, welke deelnemers. Geëxtraheerd uit `DisplayView.jsx` (groot
 * scherm) zodat `MobileLiveView.jsx` (mobiele weergave) exact dezelfde,
 * al geteste afleiding hergebruikt i.p.v. ze te herhalen. Geen React, geen
 * Firestore-toegang — zelfde categorie als `fieldLayout.js`/`eventSlots.js`.
 *
 * Bewust NIET hier (blijft bij de afnemer, zie ARCHITECTURE.md §Live
 * voortgang voor de volledige redenering):
 *   - tijdsafwijking t.o.v. het schema (`timeDiff`/`calcExpectedTime`) —
 *     hangt af van de "huidige tijd", React-state, niet puur herleidbaar.
 *   - de volledige "volgende"-opbouw met cross-event-lookahead en
 *     dagtijdlijn-blokken ertussen gemengd (`nextList`/`displayList`) —
 *     DisplayView-specifiek, uitgebreider dan wat de mobiele weergave nodig
 *     heeft.
 *   - de meerdere-blokken-pauzeweergave (`breakSequence`) — DisplayView-
 *     specifiek; de mobiele weergave toont in plaats daarvan een eigen,
 *     bewust minimale pauze-regel.
 */

/**
 * @param {{
 *   competition: {typeId:string, eventOrder:Object},
 *   events: Array,
 *   competitionTypes: Array,
 *   participants: Array,
 *   blocks: Array,
 *   finishedEvents: string[],
 *   finishedSeries: Object.<string, number[]>,
 * }} args
 */
export function deriveLiveProgress({
  competition, events, competitionTypes, participants, blocks,
  finishedEvents, finishedSeries,
}) {
  // Gesorteerde events van de wedstrijd — inline van
  // AppContext.jsx#getSortedEvents: dat leest competitionTypes/events uit de
  // ingelogde AppContext-state, die hier niet bestaat (dit bestand kent enkel
  // de plain-object args die een afnemer meegeeft).
  const compType = competitionTypes.find(t => t.id === competition?.typeId);
  let sortedEvents = [];
  if (compType) {
    const order = Object.keys(competition.eventOrder ?? {}).length > 0
      ? competition.eventOrder
      : compType.defaultEventOrder;
    sortedEvents = [...compType.eventIds]
      .map(id => events.find(e => e.id === id))
      .filter(Boolean)
      .sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
  }

  // Huidig blok in de dagtijdlijn — eerste blok dat nog niet afgewerkt is.
  const sortedAllBlocks = [...blocks].sort((a, b) => a.order - b.order);
  const currentBlock = sortedAllBlocks.find(b => b.status !== 'afgewerkt') ?? null;

  // Het huidige blok zelf, of — als het een pauze/briefing/proefjury/... is —
  // het eerstvolgende heats-blok erna: zolang de wedstrijd in zo'n
  // informatief blok zit, is DAT onderdeel het onderdeel waar de dagtijdlijn
  // zo meteen naartoe gaat, en dus wat "officieel actief" getoond moet
  // worden — niet het eerste onderdeel uit de abstracte onderdelen-volgorde.
  let currentOrNextHeatsBlock = null;
  if (currentBlock) {
    if (currentBlock.type === 'heats') {
      currentOrNextHeatsBlock = currentBlock;
    } else {
      const startIdx = sortedAllBlocks.findIndex(b => b.id === currentBlock.id);
      if (startIdx !== -1) {
        for (let i = startIdx; i < sortedAllBlocks.length; i++) {
          if (sortedAllBlocks[i].type === 'heats') {
            currentOrNextHeatsBlock = sortedAllBlocks[i];
            break;
          }
        }
      }
    }
  }

  // Officieel actief event: het onderdeel van currentOrNextHeatsBlock (de
  // echte dagtijdlijn) — met de oude, op sortedEvents gebaseerde aanpak enkel
  // als terugval (geen dagtijdlijn ingesteld, of het blok verwijst naar een
  // intussen verwijderd onderdeel).
  const blockEvent = currentOrNextHeatsBlock
    ? events.find(ev => ev.id === currentOrNextHeatsBlock.eventId)
    : null;
  const officialEvent = blockEvent
    ?? sortedEvents.find(ev => !finishedEvents.includes(ev.id))
    ?? sortedEvents[0]
    ?? null;

  const isFreestyle = officialEvent?.scoringType === 'freestyle';

  // Deelnemers voor het officiële event
  const eventParticipants = !officialEvent ? [] : participants
    .filter(p => p.entries.some(e => e.eventId === officialEvent.id && !e.isScratched))
    .map(p => ({
      ...p,
      _entry: p.entries.find(e => e.eventId === officialEvent.id),
    }))
    .sort((a, b) => {
      if (a._entry.seriesNr !== b._entry.seriesNr) return a._entry.seriesNr - b._entry.seriesNr;
      return String(a._entry.fieldNr).localeCompare(String(b._entry.fieldNr));
    });

  // Unieke reeksnummers
  const seriesNrs = [...new Set(eventParticipants.map(p => p._entry.seriesNr).filter(Boolean))]
    .sort((a, b) => a - b);

  // Officieel actieve reeks = eerste reeks nog niet voltooid
  const doneInEvent = finishedSeries[officialEvent?.id] ?? [];
  const officialSeriesNr = seriesNrs.find(nr => !doneInEvent.includes(nr)) ?? seriesNrs[0] ?? 1;

  const totalSeries = seriesNrs.length;
  const isBreakBlock = !!currentBlock && currentBlock.type !== 'heats';

  // Deelnemers in de officiële reeks
  const currentSkippers = eventParticipants.filter(p => p._entry.seriesNr === officialSeriesNr);
  const plannedTime = currentSkippers[0]?._entry.scheduledTime ?? null;

  // Is er al effectief voortgang? Zolang er nog niets afgewerkt is — ook niet
  // als er vóór de eerste reeks meerdere informatieve blokken doorlopen zijn
  // (deuren, briefing, ...) — is een "verschil tov het geplande uur" zinloos.
  const hasProgressStarted = finishedEvents.length > 0
    || Object.values(finishedSeries).some(arr => (arr?.length ?? 0) > 0);

  return {
    sortedEvents, sortedAllBlocks, currentBlock, currentOrNextHeatsBlock,
    officialEvent, isFreestyle, eventParticipants, seriesNrs, officialSeriesNr,
    totalSeries, isBreakBlock, currentSkippers, plannedTime, hasProgressStarted,
  };
}
