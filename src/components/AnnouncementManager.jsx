/**
 * AnnouncementManager.jsx — SkipFlow
 *
 * Wedstrijdbeheerder-tab "Aankondigingen" in CompetitionDetail.jsx: laat de
 * beheerder in bulk de voorleesteksten (en per onderdeel de audio) van de
 * speed/endurance/triple-under-reeksen genereren, i.p.v. dit per reeks via
 * AnnouncementPanel.jsx (speakerscherm) te moeten doen. Enkel zichtbaar
 * wanneer competition.isAnnouncementsEnabled aan staat (zie
 * CompetitionDetail.jsx) — zelfde patroon als PodiumManager.jsx/
 * MessageManager.jsx: data/acties via AppContext, geen eigen Firestore-
 * toegang (CLAUDE.md).
 */

import React, { useState, useEffect } from 'react';
import { Volume2, RefreshCw } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius } from '../theme';
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
  const [busyEventId, setBusyEventId] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const coverage = getAnnouncementTextCoverage();

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

  const handleGenerateAudioForEvent = async (eventId) => {
    setBusyEventId(eventId); setStatus(''); setError('');
    try {
      await generateAnnouncementAudioForBlock(competitionId, eventId);
      setStatus('Audio gegenereerd voor dit onderdeel.');
    } catch (err) {
      setError(err.message ?? 'Audio genereren mislukt.');
    } finally {
      setBusyEventId(null);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.intro}>
        Genereer in één keer de voorleesteksten voor alle speed/endurance/
        triple-under-reeksen van deze wedstrijd — i.p.v. dit per reeks op het
        speakerscherm te moeten doen. Bestaande (ook handmatig aangepaste)
        teksten worden nooit overschreven.
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
            <Button
              variant="secondary" size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => handleGenerateAudioForEvent(c.eventId)}
              disabled={busyEventId === c.eventId}
            >
              {busyEventId === c.eventId ? 'Bezig…' : 'Genereer audio voor dit onderdeel'}
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
