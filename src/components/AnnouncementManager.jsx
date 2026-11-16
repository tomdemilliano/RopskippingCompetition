/**
 * AnnouncementManager.jsx — SkipFlow
 *
 * Wedstrijdbeheerder-tab "Aankondigingen" in CompetitionDetail.jsx: laat de
 * beheerder in bulk de voorleesteksten én (per onderdeel) de audio van de
 * speed/endurance/triple-under-reeksen genereren, i.p.v. dit per reeks via
 * AnnouncementPanel.jsx (speakerscherm) te moeten doen. Bevat ook een
 * reeksnavigator om gegenereerde teksten na te kijken/aan te passen —
 * hergebruikt AnnouncementPanel.jsx rechtstreeks (zelfde tekst-/audio-
 * bewerklogica, geen duplicatie). Enkel zichtbaar wanneer
 * competition.isAnnouncementsEnabled aan staat (zie CompetitionDetail.jsx)
 * — zelfde patroon als PodiumManager.jsx/MessageManager.jsx: data/acties
 * via AppContext, geen eigen Firestore-toegang (CLAUDE.md).
 */

import React, { useState, useEffect } from 'react';
import { Volume2, RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius } from '../theme';
import Button from './ui/Button';
import AnnouncementPanel from './AnnouncementPanel';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrap: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '620px',
  },
  intro: {
    fontSize: '0.85rem',
    color: color.muted,
    lineHeight: 1.5,
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
    padding: '0.5rem 0.75rem',
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
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
  empty: {
    fontSize: '0.85rem',
    color: color.faint,
    fontStyle: 'italic',
  },
  eventActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  sectionTitle: {
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginTop: '0.5rem',
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
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/** @param {{ competitionId: string }} props */
export default function AnnouncementManager({ competitionId }) {
  const {
    loadAnnouncements,
    generateAnnouncementTexts,
    generateAnnouncementAudioForBlock,
    getAnnouncementTextCoverage,
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

  const coverage = getAnnouncementTextCoverage();

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
        (ook handmatig aangepaste) teksten worden nooit overschreven. Onderaan
        kan je per reeks de gegenereerde tekst nakijken en zo nodig aanpassen.
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
        coverage.map(c => (
          <div key={c.eventId} style={s.eventRow}>
            <div>
              <div style={s.eventName}>{c.eventName}</div>
              <div style={s.eventCoverage}>{c.withText}/{c.total} reeksen hebben al tekst</div>
            </div>
            <div style={s.eventActions}>
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
                icon={<RefreshCw size={13} />}
                onClick={() => handleGenerateAudioForEvent(c.eventId)}
                disabled={busyAudioEventId === c.eventId}
              >
                {busyAudioEventId === c.eventId ? 'Bezig…' : 'Genereer audio voor dit onderdeel'}
              </Button>
            </div>
          </div>
        ))
      )}

      {coverage.length > 0 && (
        <>
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
            <AnnouncementPanel
              competitionId={competitionId}
              eventId={selectedEventId}
              seriesNr={selectedSeriesNr}
            />
          )}
        </>
      )}
    </div>
  );
}
