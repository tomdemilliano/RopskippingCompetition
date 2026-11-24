/**
 * AnnouncementPanel.jsx — SkipFlow
 *
 * Aankondigingsvak voor de speaker in LiveView.jsx — enkel gerenderd wanneer
 * `activeCompetition.isAnnouncementsEnabled` aan staat EN de huidige reeks
 * geen freestyle is (zie LiveView.jsx). Toont/bewerkt de tekst voor de
 * huidige reeks en genereert audio op aanvraag. Afspelen gebeurt NIET hier
 * — dat loopt via de audiospeler in LiveView.jsx's navigatievak (boven de
 * "Volgende"-knop), zodat de speaker niet tussen dit vak en de navigatie
 * moet wisselen om een aankondiging te starten. Data/acties komen volledig
 * via AppContext — geen eigen Firestore-toegang (CLAUDE.md).
 *
 * Zie "Aankondigingen (TTS)" in ARCHITECTURE.md.
 */

import React, { useState, useEffect } from 'react';
import { Volume2, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: '1rem 1.25rem',
    maxWidth: '620px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  preloadBadge: (ready, total) => ({
    fontSize: '0.72rem',
    fontWeight: 700,
    color: total === 0 ? color.faint : ready >= total ? color.successDark : color.warning,
    background: total === 0 ? color.surfaceAlt : ready >= total ? color.successSoft : color.warningSoft,
    border: `1px solid ${total === 0 ? color.border : ready >= total ? color.successBorder : color.warningBorder}`,
    borderRadius: radius.pill,
    padding: '0.2rem 0.65rem',
  }),
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    padding: '0.6rem 0.75rem',
    fontSize: '0.88rem',
    color: color.ink,
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    padding: '0.45rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: color.body,
    cursor: 'pointer',
  },
  btnGhost: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: `1px solid ${color.faintest}`,
    borderRadius: radius.sm,
    padding: '0.4rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: color.muted,
    cursor: 'pointer',
  },
  staleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: color.warning,
    background: color.warningSoft,
    border: `1px solid ${color.warningBorder}`,
    borderRadius: radius.pill,
    padding: '0.2rem 0.6rem',
  },
  emptyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  emptyText: {
    fontSize: '0.82rem',
    color: color.faint,
    fontStyle: 'italic',
  },
  errorMsg: {
    fontSize: '0.78rem',
    color: color.dangerDark,
    background: color.dangerSoft,
    border: `1px solid ${color.dangerBorder}`,
    borderRadius: radius.sm,
    padding: '0.5rem 0.7rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string} props.competitionId
 * @param {string} props.eventId    het actieve onderdeel (altijd scoringType 'speed')
 * @param {number} props.seriesNr   de actieve reeks
 */
export default function AnnouncementPanel({ competitionId, eventId, seriesNr }) {
  const {
    announcements,
    generateAnnouncementTextForReeks,
    updateAnnouncementText,
    generateAnnouncementAudio,
    getAnnouncementPreloadStatus,
  } = useAppContext();

  const announcement = announcements.find(a => a.eventId === eventId && a.seriesNr === seriesNr) ?? null;

  const [textDraft, setTextDraft] = useState(announcement?.text ?? '');
  const [editing, setEditing]     = useState(false);
  const [busyText, setBusyText]   = useState(false);
  const [busyAudio, setBusyAudio] = useState(false);
  const [error, setError]         = useState('');

  // De draft volgt het Firestore-document, behalve tijdens actief bewerken
  // (anders zou een live-update van elders de speaker's eigen tekst onder
  // handen wegtrekken terwijl die nog aan het typen is).
  useEffect(() => {
    if (!editing) setTextDraft(announcement?.text ?? '');
  }, [announcement?.id, announcement?.text, editing]);

  // Reset foutmelding bij het wisselen van reeks.
  useEffect(() => { setError(''); }, [eventId, seriesNr]);

  const isStale = !!announcement && announcement.audioTextVersion !== announcement.textVersion;
  const { ready, total } = getAnnouncementPreloadStatus(competitionId);

  const handleGenerateText = async () => {
    setBusyText(true); setError('');
    try {
      await generateAnnouncementTextForReeks(competitionId, eventId, seriesNr);
    } catch (err) {
      setError(err.message ?? 'Tekst genereren mislukt.');
    } finally {
      setBusyText(false);
    }
  };

  const handleBlur = async () => {
    setEditing(false);
    if (!announcement || textDraft === announcement.text) return;
    try {
      await updateAnnouncementText(competitionId, announcement.id, textDraft);
    } catch (err) {
      setError(err.message ?? 'Tekst opslaan mislukt.');
    }
  };

  const handleGenerateAudio = async () => {
    if (!announcement) return;
    setBusyAudio(true); setError('');
    try {
      await generateAnnouncementAudio(competitionId, announcement);
    } catch (err) {
      setError(err.message ?? 'Audio genereren mislukt.');
    } finally {
      setBusyAudio(false);
    }
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={s.title}><Volume2 size={13} /> Aankondiging</span>
        <span style={s.preloadBadge(ready, total)}>
          Buffer: {ready}/{total} klaar
        </span>
      </div>

      {!announcement ? (
        <div style={s.emptyRow}>
          <span style={s.emptyText}>Nog geen tekst voor deze reeks.</span>
          <button style={s.btn} onClick={handleGenerateText} disabled={busyText}>
            {busyText ? 'Bezig…' : 'Tekst genereren'}
          </button>
        </div>
      ) : (
        <>
          <textarea
            style={s.textarea}
            value={textDraft}
            onFocus={() => setEditing(true)}
            onChange={e => setTextDraft(e.target.value)}
            onBlur={handleBlur}
            rows={4}
          />

          <div style={s.actionsRow}>
            {isStale && (
              <span style={s.staleBadge}><AlertTriangle size={12} /> Audio verouderd</span>
            )}

            <button style={s.btnGhost} onClick={handleGenerateText} disabled={busyText}>
              {busyText ? 'Bezig…' : 'Tekst opnieuw genereren'}
            </button>

            <button style={s.btn} onClick={handleGenerateAudio} disabled={busyAudio}>
              {busyAudio
                ? 'Bezig…'
                : (announcement.audioUrl ? 'Audio opnieuw genereren' : 'Audio genereren')}
            </button>
          </div>

          {announcement.status === 'genereren-mislukt' && (
            <div style={s.errorMsg}>Genereren van audio is eerder mislukt — probeer opnieuw.</div>
          )}
        </>
      )}

      {error && <div style={s.errorMsg}>{error}</div>}
    </div>
  );
}
