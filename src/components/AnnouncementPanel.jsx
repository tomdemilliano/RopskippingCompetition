/**
 * AnnouncementPanel.jsx — SkipFlow
 *
 * Aankondigingsvak voor de speaker in LiveView.jsx — enkel gerenderd wanneer
 * `activeCompetition.isAnnouncementsEnabled` aan staat EN de huidige reeks
 * geen freestyle is (zie LiveView.jsx). Toont/bewerkt de tekst voor de
 * huidige reeks, genereert audio op aanvraag, speelt ze af en schakelt
 * daarna automatisch door naar het vaste "skippers klaar, jury klaar?"-
 * fragment. Data/acties komen volledig via AppContext — geen eigen
 * Firestore-toegang (CLAUDE.md).
 *
 * Zie "Aankondigingen (TTS)" in ARCHITECTURE.md.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2, PlayCircle, Repeat, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow } from '../theme';

const FIXED_CLIP_URL = '/audio/skippers-klaar-jury-klaar.wav';

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
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: color.primary,
    border: 'none',
    borderRadius: radius.sm,
    padding: '0.45rem 0.9rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#fff',
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
  blockActionRow: {
    borderTop: `1px solid ${color.borderSoft}`,
    paddingTop: '0.6rem',
    display: 'flex',
    justifyContent: 'flex-end',
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
    generateAnnouncementAudioForBlock,
    getAnnouncementPreloadStatus,
  } = useAppContext();

  const announcement = announcements.find(a => a.eventId === eventId && a.seriesNr === seriesNr) ?? null;

  const [textDraft, setTextDraft] = useState(announcement?.text ?? '');
  const [editing, setEditing]     = useState(false);
  const [busyText, setBusyText]   = useState(false);
  const [busyAudio, setBusyAudio] = useState(false);
  const [busyBlock, setBusyBlock] = useState(false);
  const [error, setError]         = useState('');

  const audioRef = useRef(null);
  const fixedAudioRef = useRef(null);

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

  const handlePlay = () => {
    if (!announcement?.audioUrl || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const handlePlayFixedClip = () => {
    if (!fixedAudioRef.current) return;
    fixedAudioRef.current.currentTime = 0;
    fixedAudioRef.current.play();
  };

  const handleGenerateForBlock = async () => {
    setBusyBlock(true); setError('');
    try {
      await generateAnnouncementAudioForBlock(competitionId, eventId);
    } catch (err) {
      setError(err.message ?? 'Genereren voor dit onderdeel mislukt.');
    } finally {
      setBusyBlock(false);
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

            {announcement.audioUrl && !isStale && (
              <button style={s.btnPrimary} onClick={handlePlay}>
                <PlayCircle size={14} /> Afspelen
              </button>
            )}

            <button style={s.btnGhost} onClick={handlePlayFixedClip}>
              <Repeat size={12} /> "Skippers klaar?" herhalen
            </button>
          </div>

          {announcement.status === 'genereren-mislukt' && (
            <div style={s.errorMsg}>Genereren van audio is eerder mislukt — probeer opnieuw.</div>
          )}
        </>
      )}

      {error && <div style={s.errorMsg}>{error}</div>}

      <div style={s.blockActionRow}>
        <button style={s.btnGhost} onClick={handleGenerateForBlock} disabled={busyBlock}>
          <RefreshCw size={13} />
          {busyBlock ? 'Bezig met genereren…' : 'Genereer audio voor heel dit onderdeel'}
        </button>
      </div>

      {/* Audio voor de aankondiging zelf — ketent automatisch door naar het
          vaste tweede fragment zodra ze afgelopen is. */}
      <audio
        ref={audioRef}
        src={announcement?.audioUrl || undefined}
        onEnded={handlePlayFixedClip}
        style={{ display: 'none' }}
      />
      {/* Vast, niet-gegenereerd tweede fragment — ook los herhaalbaar. */}
      <audio ref={fixedAudioRef} src={FIXED_CLIP_URL} style={{ display: 'none' }} />
    </div>
  );
}
