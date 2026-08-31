/**
 * eventSlots.js — SkipFlow
 *
 * Pure logica om voor een onderdeel te bepalen welke tijdslot-opties er zijn
 * om een deelnemer aan toe te voegen of naar te verplaatsen ("reskip") —
 * gebruikt door EditParticipantModal (zowel "+ Onderdeel toevoegen" als
 * "Reskip"). Werkt enkel op de al-geladen participants-array, geen
 * Firestore-toegang hier (zie CLAUDE.md — dat verloopt via dbSchema.js).
 *
 * Twee soorten opties:
 *   - een leeg veld in een BESTAANDE reeks (enkel zinvol bij speed — een
 *     freestyle-reeks heeft altijd precies 1 deelnemer, dus nooit een "leeg"
 *     veld in de gangbare zin)
 *   - een NIEUWE reeks, achteraan het onderdeel toegevoegd
 *
 * Een veld telt als leeg wanneer geen enkele NIET-geschrapte entry het
 * bezet — een geschrapte deelnemer laat zijn veld dus vrij voor herbruik,
 * consistent met hoe LiveView/DisplayView geschrapte entries al onzichtbaar
 * maken in het reeksenraster.
 */

/**
 * @param {string} eventId
 * @param {Array}  participants          alle deelnemers van de wedstrijd
 * @param {{scoringType:string}} event
 * @param {string} [excludeParticipantId] deelnemer die zelf verplaatst wordt
 *                                        (reskip) — zijn eigen huidige slot
 *                                        telt niet mee als "bezet"
 * @returns {{
 *   scoringType: string,
 *   existingReeksen: Array<{ seriesNr: number, scheduledTime: string, emptyFieldNrs: number[] }>,
 *   nextSeriesNr: number,
 *   suggestedTime: string,
 * }}
 */
export function computeEventSlots(eventId, participants, event, excludeParticipantId = null) {
  const entries = [];
  for (const p of participants) {
    if (p.id === excludeParticipantId) continue;
    const e = p.entries.find(en => en.eventId === eventId);
    if (e) entries.push(e);
  }

  const seriesNrs = [...new Set(entries.map(e => e.seriesNr).filter(Boolean))].sort((a, b) => a - b);
  const nextSeriesNr = (seriesNrs[seriesNrs.length - 1] ?? 0) + 1;
  const lastEntry = entries
    .filter(e => e.seriesNr === seriesNrs[seriesNrs.length - 1])
    .sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))[0];
  const suggestedTime = lastEntry?.scheduledTime ?? '';

  const scoringType = event?.scoringType ?? 'speed';
  let existingReeksen = [];

  if (scoringType !== 'freestyle') {
    existingReeksen = seriesNrs.map(seriesNr => {
      const reeksEntries = entries.filter(e => e.seriesNr === seriesNr);
      const occupied = new Set(
        reeksEntries.filter(e => !e.isScratched).map(e => parseInt(e.fieldNr) || 0)
      );
      const maxFieldNr = Math.max(0, ...reeksEntries.map(e => parseInt(e.fieldNr) || 0));
      const emptyFieldNrs = [];
      for (let f = 1; f <= maxFieldNr; f++) {
        if (!occupied.has(f)) emptyFieldNrs.push(f);
      }
      return {
        seriesNr,
        scheduledTime: reeksEntries[0]?.scheduledTime ?? '',
        emptyFieldNrs,
      };
    }).filter(r => r.emptyFieldNrs.length > 0);
  }

  return { scoringType, existingReeksen, nextSeriesNr, suggestedTime };
}
