/**
 * AnnouncementManager.jsx — SkipFlow
 *
 * Wedstrijdbeheerder-tab "Aankondigingen" in CompetitionDetail.jsx: laat de
 * beheerder in bulk de voorleesteksten én (per onderdeel) de audio van de
 * speed/endurance/triple-under-reeksen genereren, i.p.v. dit per reeks op
 * het speakerscherm te moeten doen. Bevat ook een reeksnavigator om
 * gegenereerde teksten na te kijken/aan te passen en de audio te
 * beluisteren — een eigen, lichtere review-UI (géén hergebruik van
 * AnnouncementPanel.jsx: dat bevat speaker-specifieke zaken — het vaste
 * "skippers klaar"-fragment, de preload-bufferbadge, de "genereer audio
 * voor heel dit onderdeel"-knop — die hier niet thuishoren). Enkel
 * zichtbaar wanneer competition.isAnnouncementsEnabled aan staat (zie
 * CompetitionDetail.jsx) — zelfde patroon als PodiumManager.jsx/
 * MessageManager.jsx: data/acties via AppContext, geen eigen Firestore-
 * toegang (CLAUDE.md).
 */

import React, { useState, useEffect } from 'react';
import { Volume2, FileText, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow } from '../theme';
import Button from './ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrap: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '1120px',
  },
  intro: {
    fontSize: '0.85rem',
    color: color.muted,
    lineHeight: 1.5,
    maxWidth: '760px',
  },
  statusMsg: {
    fontSize: '0.82rem',
    color: color.successDark,
    background: color.successSoft,
    border: `1px solid ${color.successBorder}`,
    borderRadius: radius.sm,
    padding: '0.5rem 0.75rem',
  },
  errorMsg: {
    fontSize: '0.82rem',
    color: color.dangerDark,
    background: color.dangerSoft,
    border: `1px solid ${color.dangerBorder}`,
    borderRadius: radius.sm,
    padding: '0.5rem 0.7rem',
  },
  columns: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.5rem',
  },
  leftColumn: {
    flex: '0 0 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  eventCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    padding: '0.75rem 1rem',
    background: color.surfaceAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
  },
  eventName: {
    fontWeight: 700,
    fontSize: '0.88rem',
    color: color.inkSoft,
  },
  eventCoverage: {
    fontSize: '0.78rem',
    color: color.muted,
  },
  eventActionsStacked: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    alignItems: 'flex-end',
  },
  empty: {
    fontSize: '0.85rem',
    color: color.faint,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  navigatorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  eventSelect: {
    flex: 1,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    color: color.ink,
  },
  seriesNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  seriesLabel: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: color.inkSoft,
    minWidth: '4.5rem',
    textAlign: 'center',
  },
  navBtn: {
    border: `1px solid ${color.border}`,
    background: color.surface,
    borderRadius: radius.sm,
    padding: '0.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },

  // Review-paneel (rechterkolom)
  reviewCard: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
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
  audioPlaceholder: {
    fontSize: '0.8rem',
    color: color.faint,
    fontStyle: 'italic',
    background: color.surfaceAlt,
    border: `1px dashed ${color.faintest}`,
    borderRadius: radius.sm,
    padding: '0.6rem 0.75rem',
  },
  audioPlayer: {
    width: '100%',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW-PANEEL VOOR ÉÉN REEKS — tekst bewerken + audio (re)genereren/beluisteren.
// Bewust geen hergebruik van AnnouncementPanel.jsx: dat is toegesneden op de
// live speaker-workflow (vast "skippers klaar"-fragment, preload-buffer,
// bulk-knop voor het hele onderdeel) — hier volstaat tekst + audio voor
// precies de gekozen reeks.
// ─────────────────────────────────────────────────────────────────────────────

function AnnouncementReview({ competitionId, eventId, seriesNr }) {
  const {
    announcements,
    generateAnnouncementTextForReeks,
    updateAnnouncementText,
    generateAnnouncementAudio,
  } = useAppContext();

  const announcement = announcements.find(a => a.eventId === eventId && a.seriesNr === seriesNr) ?? null;

  const [textDraft, setTextDraft] = useState(announcement?.text ?? '');
  const [editing, setEditing] = useState(false);
  const [busyText, setBusyText] = useState(false);
  const [busyAudio, setBusyAudio] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) setTextDraft(announcement?.text ?? '');
  }, [announcement?.id, announcement?.text, editing]);

  useEffect(() => { setError(''); }, [eventId, seriesNr]);

  const isStale = !!announcement && announcement.audioTextVersion !== announcement.textVersion;

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
    <div style={s.reviewCard}>
      {!announcement ? (
        <div>
          <div style={{ ...s.audioPlaceholder, marginBottom: '0.75rem' }}>
            Nog geen tekst voor deze reeks.
          </div>
          <Button variant="primary" icon={<FileText size={14} />} onClick={handleGenerateText} disabled={busyText}>
            {busyText ? 'Bezig…' : 'Tekst genereren'}
          </Button>
        </div>
      ) : (
        <>
          <textarea
            style={s.textarea}
            value={textDraft}
            onFocus={() => setEditing(true)}
            onChange={e => setTextDraft(e.target.value)}
            onBlur={handleBlur}
            rows={11}
          />

          <div style={s.actionsRow}>
            {isStale && (
              <span style={s.staleBadge}><AlertTriangle size={12} /> Audio verouderd</span>
            )}
            <Button variant="secondary" size="sm" icon={<FileText size={13} />} onClick={handleGenerateText} disabled={busyText}>
              {busyText ? 'Bezig…' : 'Tekst opnieuw genereren'}
            </Button>
            <Button variant="secondary" size="sm" icon={<Volume2 size={13} />} onClick={handleGenerateAudio} disabled={busyAudio}>
              {busyAudio
                ? 'Bezig…'
                : (announcement.audioUrl ? 'Audio opnieuw genereren' : 'Audio genereren')}
            </Button>
          </div>

          {announcement.audioUrl ? (
            <audio key={announcement.audioUrl} style={s.audioPlayer} src={announcement.audioUrl} controls />
          ) : (
            <div style={s.audioPlaceholder}>Nog geen audio gegenereerd voor deze reeks.</div>
          )}

          {announcement.status === 'genereren-mislukt' && (
            <div style={s.errorMsg}>Genereren van audio is eerder mislukt — probeer opnieuw.</div>
          )}
        </>
      )}

      {error && <div style={s.errorMsg}>{error}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/** @param {{ competitionId: string }} props */
export default function AnnouncementManager({ competitionId }) {
  const {
    loadAnnouncements,
    generateAnnouncementTexts,
    generateAnnouncementAudioForBlock,
    getAnnouncementCoverage,
  } = useAppContext();

  useEffect(() => {
    loadAnnouncements(competitionId ?? null);
  }, [competitionId, loadAnnouncements]);

  const [busyTexts, setBusyTexts] = useState(false);
  // Per-onderdeel knoppen (tekst én audio) kunnen gelijktijdig bezig zijn —
  // apart bijhouden i.p.v. één gedeelde busyEventId, anders blokkeert de
  // ene knop onterecht de andere voor hetzelfde onderdeel.
  const [busyTextEventId, setBusyTextEventId] = useState(null);
  const [busyAudioEventId, setBusyAudioEventId] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const coverage = getAnnouncementCoverage();

  // ── Reeksnavigator — nakijken/aanpassen van gegenereerde teksten ────────
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedSeriesNr, setSelectedSeriesNr] = useState(1);

  useEffect(() => {
    if (!selectedEventId && coverage.length > 0) {
      setSelectedEventId(coverage[0].eventId);
    }
  }, [coverage, selectedEventId]);

  const selectedCoverage = coverage.find(c => c.eventId === selectedEventId);

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    setSelectedSeriesNr(1);
  };

  const handleGenerateTexts = async () => {
    setBusyTexts(true); setStatus(''); setError('');
    try {
      await generateAnnouncementTexts(competitionId);
      setStatus('Ontbrekende teksten gegenereerd.');
    } catch (err) {
      setError(err.message ?? 'Teksten genereren mislukt.');
    } finally {
      setBusyTexts(false);
    }
  };

  const handleGenerateTextsForEvent = async (eventId) => {
    setBusyTextEventId(eventId); setStatus(''); setError('');
    try {
      await generateAnnouncementTexts(competitionId, eventId);
      setStatus('Teksten gegenereerd voor dit onderdeel.');
    } catch (err) {
      setError(err.message ?? 'Teksten genereren mislukt.');
    } finally {
      setBusyTextEventId(null);
    }
  };

  const handleGenerateAudioForEvent = async (eventId) => {
    setBusyAudioEventId(eventId); setStatus(''); setError('');
    try {
      await generateAnnouncementAudioForBlock(competitionId, eventId);
      setStatus('Audio gegenereerd voor dit onderdeel.');
    } catch (err) {
      setError(err.message ?? 'Audio genereren mislukt.');
    } finally {
      setBusyAudioEventId(null);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.intro}>
        Genereer in één keer de voorleesteksten (en per onderdeel de audio)
        voor alle speed/endurance/triple-under-reeksen van deze wedstrijd —
        i.p.v. dit per reeks op het speakerscherm te moeten doen. Bestaande
        (ook handmatig aangepaste) teksten worden nooit overschreven. Rechts
        kan je per reeks de gegenereerde tekst nakijken, aanpassen en de
        audio beluisteren.
      </div>

      <Button variant="primary" icon={<Volume2 size={15} />} onClick={handleGenerateTexts} disabled={busyTexts}>
        {busyTexts ? 'Bezig…' : 'Genereer alle ontbrekende teksten'}
      </Button>

      {status && <div style={s.statusMsg}>{status}</div>}
      {error && <div style={s.errorMsg}>{error}</div>}

      {coverage.length === 0 ? (
        <div style={s.empty}>
          Nog geen speed/endurance/triple-under-onderdelen gevonden in de dagtijdlijn.
        </div>
      ) : (
        <div style={s.columns}>
          <div style={s.leftColumn}>
            {coverage.map(c => (
              <div key={c.eventId} style={s.eventCard}>
                <div>
                  <div style={s.eventName}>{c.eventName}</div>
                  <div style={s.eventCoverage}>
                    {c.withText}/{c.total} teksten · {c.withAudio}/{c.total} audio
                  </div>
                </div>
                <div style={s.eventActionsStacked}>
                  <Button
                    variant="secondary" size="sm"
                    icon={<FileText size={13} />}
                    onClick={() => handleGenerateTextsForEvent(c.eventId)}
                    disabled={busyTextEventId === c.eventId}
                  >
                    {busyTextEventId === c.eventId ? 'Bezig…' : 'Genereer tekst voor dit onderdeel'}
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    icon={<Volume2 size={13} />}
                    onClick={() => handleGenerateAudioForEvent(c.eventId)}
                    disabled={busyAudioEventId === c.eventId}
                  >
                    {busyAudioEventId === c.eventId ? 'Bezig…' : 'Genereer audio voor dit onderdeel'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div style={s.rightColumn}>
            <div style={s.sectionTitle}>Teksten nakijken &amp; aanpassen</div>

            <div style={s.navigatorRow}>
              <select
                style={s.eventSelect}
                value={selectedEventId ?? ''}
                onChange={e => handleSelectEvent(e.target.value)}
              >
                {coverage.map(c => (
                  <option key={c.eventId} value={c.eventId}>{c.eventName}</option>
                ))}
              </select>

              {selectedCoverage && (
                <div style={s.seriesNav}>
                  <button
                    style={s.navBtn}
                    disabled={selectedSeriesNr <= 1}
                    onClick={() => setSelectedSeriesNr(n => Math.max(1, n - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={s.seriesLabel}>
                    Reeks {selectedSeriesNr} / {selectedCoverage.total}
                  </span>
                  <button
                    style={s.navBtn}
                    disabled={selectedSeriesNr >= selectedCoverage.total}
                    onClick={() => setSelectedSeriesNr(n => Math.min(selectedCoverage.total, n + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {selectedEventId && (
              <AnnouncementReview
                competitionId={competitionId}
                eventId={selectedEventId}
                seriesNr={selectedSeriesNr}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
