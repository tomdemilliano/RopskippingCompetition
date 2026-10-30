/**
 * fieldLayout.js — SkipFlow
 *
 * Pure helper voor niet-freestyle (speed) reeksen: hoeveel velden heeft een
 * reeks structureel, en welke daarvan zijn leeg?
 *
 * Bij PDF-import kan een veld voor één specifieke reeks volledig leeg
 * blijven (niets ingevuld in het schema voor dat tijdstip/veld) — er
 * bestaat dan geen entry om dat veld te tonen. `maxFieldNr()` wordt daarom
 * bewust berekend over een RUIMERE set deelnemers (alle reeksen van het
 * onderdeel, niet enkel de getoonde reeks): vult een andere reeks van
 * hetzelfde onderdeel dat veldnummer wél, dan bestaat het veld structureel
 * en moet elke reeks het dus minstens als leeg plekje tonen i.p.v. het
 * stilzwijgend weg te laten.
 *
 * Een leeg veld (geen entry) en een geschrapte deelnemer (entry met
 * isScratched, al uit de deelnemerslijst gefilterd vóór dit punt) zien er
 * hierdoor vanzelf identiek uit — beide zijn gewoon "geen entry op dit
 * veldnummer" — zonder dat deze module het onderscheid zelf moet kennen.
 *
 * Puur berekening — geen Firestore-toegang, geen React.
 */

/**
 * @param {Array} participantsWithEntry  deelnemers met een `_entry`-veld,
 *   over zoveel mogelijk reeksen van het onderdeel heen
 * @returns {number}
 */
export function maxFieldNr(participantsWithEntry) {
  return participantsWithEntry.reduce((max, p) => {
    const f = parseInt(p._entry.fieldNr) || 0;
    return f > max ? f : max;
  }, 0);
}

/**
 * Padt de deelnemers van ÉÉN reeks aan tot fieldNr 1..max — ontbrekende
 * velden krijgen een `{ _isEmpty: true, _entry: { fieldNr } }` placeholder.
 * @param {Array} seriesParticipants  deelnemers van de getoonde reeks
 * @param {number} max
 */
export function padFieldList(seriesParticipants, max) {
  const list = [];
  for (let v = 1; v <= max; v++) {
    const found = seriesParticipants.find(p => parseInt(p._entry.fieldNr) === v);
    list.push(found ?? { _isEmpty: true, _entry: { fieldNr: v } });
  }
  return list;
}
