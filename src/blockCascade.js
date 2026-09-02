/**
 * blockCascade.js — SkipFlow
 *
 * Gedeelde "heropenen"-cascadelogica voor de dagtijdlijn. Zowel LiveView
 * (reeks-niveau, via de Heropenen-knop naast VOLTOOID) als CompetitionDetail
 * (blok-niveau, via de Heropenen-knop in Programma) moeten bij het
 * terugzetten van voortgang hetzelfde doen: alles vanaf een bepaald punt in
 * de dagtijdlijn dat al 'afgewerkt' was, hoort terug open te staan — zowel
 * de blokken zelf (elk type: heats, pauze, briefing, proefjury,
 * prijsuitreiking, ...) als de finishedSeries van elk onderdeel waarvan een
 * heats-blok in dat bereik valt.
 *
 * Puur berekening — geen Firestore-toegang, geen React. De aanroeper voert
 * de eigenlijke writes uit (setBlockStatus / unfinishSeries).
 */

/**
 * @param {Array} sortedBlocks   alle blokken van de wedstrijd, op order
 * @param {number} rollbackOrder  laagste order die terug opengezet moet worden
 * @param {string} [skipEventId]  onderdeel waarvan finishedSeries al apart
 *   (partieel, op reeksniveau) aangepast is — wordt hier niet nogmaals
 *   volledig gereset. Weglaten (blok-niveau heropenen) reset gewoon elk
 *   onderdeel dat in het bereik valt, inclusief het geklikte blok zelf.
 * @returns {{ blocksToReopen: Array, eventIdsToReset: string[] }}
 */
export function computeReopenCascade(sortedBlocks, rollbackOrder, skipEventId = null) {
  const blocksToReopen = sortedBlocks.filter(b =>
    b.order >= rollbackOrder && b.status === 'afgewerkt'
  );

  const eventIdsToReset = [...new Set(
    blocksToReopen
      .filter(b => b.type === 'heats' && b.eventId && b.eventId !== skipEventId)
      .map(b => b.eventId)
  )];

  return { blocksToReopen, eventIdsToReset };
}
