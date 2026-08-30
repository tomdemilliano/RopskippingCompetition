/**
 * timeUtils.js — SkipFlow
 *
 * Kleine, gedeelde tijd-helper voor "HH:MM"-strings (scheduledTime op
 * entries en blocks). Puur rekenwerk, geen JSX — gebruikt door pdfSchedule.js
 * (PDF-import) en LiveView.jsx (blok-tijdvensters voor de dagtijdlijn).
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * "8:45" -> 525 (minuten sinds middernacht). Nodig omdat de PDF-tijden niet
 * altijd met een voorloopnul genoteerd staan ("8:45" i.p.v. "08:45") — een
 * lexicografische string-vergelijking zou dan bv. "8:45" > "13:05" geven.
 * @param {string} time
 * @returns {number|null}
 */
export function timeToMinutes(time) {
  const m = TIME_RE.exec((time ?? '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
