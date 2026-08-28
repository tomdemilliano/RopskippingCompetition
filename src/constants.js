export const APP_ID = 'ropescore-pro-v1';

/**
 * Login-namen zijn geen echt e-mailadres — Firebase Auth (e-mail/wachtwoord)
 * vereist er wel een. Zet een vrij getypte gebruikersnaam om naar een geldig,
 * synthetisch adres: spaties, accenten (e.g. e-accent-aigu wordt "e") en
 * andere tekens die niet in een e-mail-lokaal-deel mogen, worden weggewerkt —
 * anders geeft Firebase "auth/invalid-email" zodra iemand bv. "Tom De
 * Milliano" als naam gebruikt.
 * Gedeeld tussen AppContext.jsx en de standalone seed-pagina, dus overal
 * dezelfde omzetting (login moet dezelfde e-mail herberekenen als aanmaken).
 *
 * @param {string} username
 * @returns {string} geldig e-mailadres, of '' als er niets bruikbaars overblijft
 */
export function emailForUsername(username) {
  const DIACRITICS = /[\u0300-\u036f]/g; // Unicode combining diacritical marks
  const local = (username ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS, '') // accenten weg (é → e)
    .replace(/[^a-z0-9._-]+/g, '.')           // ongeldige tekens → punt
    .replace(/\.{2,}/g, '.')                  // geen dubbele punten
    .replace(/^\.+|\.+$/g, '');               // geen punt aan begin/einde
  return local ? `${local}@ropescore.pro.local` : '';
}

export const getFirebaseConfig = () => {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG || import.meta.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (rawConfig) {
    if (typeof rawConfig === 'string') {
      try { return JSON.parse(rawConfig); } catch (e) { console.error("Fout", e); }
    } else { return rawConfig; }
  }
  return null;
};
