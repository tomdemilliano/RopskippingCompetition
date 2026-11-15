/**
 * announcementNames.js — SkipFlow
 *
 * Haalt de voornaam uit een deelnemersnaam, en bepaalt welke naam een club
 * voorgelezen krijgt — voor de automatische TTS-aankondigingen (zie
 * "Aankondigingen (TTS)" in ARCHITECTURE.md). Puur — geen React, geen
 * Firestore (CLAUDE.md).
 *
 * `participant.name` is altijd één string "ACHTERNAAM Voornaam" (zie
 * dbSchema.js): de achternaam volledig in hoofdletters (kan uit meerdere
 * woorden bestaan, bv. "VAN DEN BRANDEN"), gevolgd door de voornaam met een
 * hoofdletter (kan ook uit meerdere/gekoppelde woorden bestaan, bv. "Laure
 * Sien-Yue"). Enkel de voornaam mag voorgelezen worden.
 */

/**
 * Haalt de voornaam uit een "ACHTERNAAM Voornaam"-string. Gebruikt `\p{Lu}`
 * ("elke hoofdletter", Unicode-aware, `u`-vlag) i.p.v. het ASCII-only `[A-Z]`
 * zodat achternamen met accenten (GABRIËLS, TOTTÉ, HEMMERYCKX) correct als
 * hoofdletterblok herkend worden. De greedy-aard van `[\p{Lu}\s]+` laat de
 * regex-engine terugkrabbelen tot net vóór de voornaam begint, wat zowel
 * meerdelige achternamen ("VAN DEN BRANDEN") als meerdelige/gekoppelde
 * voornamen ("Laure Sien-Yue") correct splitst.
 *
 * Het vangstgroepje vereist zelf ook een hoofdletter gevolgd door een
 * kleine letter (`\p{Lu}\p{Ll}`) — dat dwingt af dat de gevonden "voornaam"
 * ook echt een voornaam-vorm heeft, en voorkomt dat een volledig in
 * hoofdletters getypte naam (bv. een clubnaam als "JOLLY JUMPERS", geen
 * geldige deelnemersnaam maar wel een mogelijke foutieve invoer) per ongeluk
 * in twee stukken geknipt wordt.
 *
 * Geen match (bv. een naam van één woord, of die de conventie niet volgt) ⇒
 * val terug op de volledige string — nooit een lege of foutieve uitspraak.
 *
 * @param {string} fullName
 * @returns {string}
 */
export function extractFirstName(fullName) {
  if (!fullName) return '';
  const match = fullName.match(/^[\p{Lu}\s]+\s+(\p{Lu}\p{Ll}.*)$/u);
  return match ? match[1].trim() : fullName.trim();
}

/**
 * Welke naam een club voorgelezen krijgt: de ingestelde voorleesnaam
 * (`club.announceAsName`) indien aanwezig, anders de volledige clubnaam.
 * @param {{ name?: string, announceAsName?: string }|null} club
 * @returns {string}
 */
export function resolveClubAnnounceName(club) {
  if (!club) return '';
  return (club.announceAsName || club.name || '').trim();
}
