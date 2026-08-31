/**
 * PodiumCeremonyPanel.jsx — SkipFlow
 *
 * Speaker-onthullingsbediening voor de podiumceremonie. Enkel op het
 * Speaker-scherm (LiveView) — de wedstrijdbeheerder krijgt alleen
 * PodiumManager (setup), geen live bediening.
 *
 * Toont links de podia op ceremonie-volgorde (navigeerbaar), rechts een
 * kleine voorvertoning van het grote scherm (PodiumStage, size="mini") en de
 * onthullingsknoppen. Schrijft uitsluitend naar competition.podiumState —
 * PodiumView (groot scherm) leest datzelfde veld en volgt automatisch mee,
 * exact zoals finishedEvents/finishedSeries al voor de reeksenvoortgang doen.
 */

import React, { useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, RotateCcw, MonitorPlay, Trophy,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow } from '../theme';
import Button from './ui/Button';
import PodiumStage from './PodiumStage';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABEL = { 1: '3e plaats', 2: '2e plaats', 3: '1e plaats' };

const s = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    flex: 1,
    overflow: 'hidden',
  },
  left: {
    background: color.surface,
    borderRight: `1px solid ${color.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  leftHeader: {
    padding: '1rem 1.25rem',
    borderBottom: `1px solid ${color.borderSoft}`,
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  podiumRow: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.75rem 1.25rem',
    cursor: 'pointer',
    borderBottom: `1px solid ${color.surfaceAlt}`,
    background: active ? color.primarySoft : color.surface,
    borderLeft: active ? `4px solid ${color.primary}` : '4px solid transparent',
  }),
  podiumOrder: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.75rem',
    fontWeight: 700,
    color: color.faint,
    minWidth: '1.2rem',
  },
  podiumRowName: (active) => ({
    fontSize: '0.85rem',
    fontWeight: 700,
    color: active ? color.primary : color.inkSoft,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  podiumRowMeta: {
    fontSize: '0.7rem',
    color: color.faint,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  right: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: color.faint,
    textAlign: 'center',
    gap: '1rem',
    padding: '2rem',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    justifyContent: 'center',
  },
  navBtn: (disabled) => ({
    background: color.surface,
    border: `1px solid ${color.faintest}`,
    borderRadius: radius.md,
    padding: '0.5rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
  }),
  navLabel: {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: color.inkSoft,
    minWidth: '140px',
    textAlign: 'center',
  },
  previewLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.72rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  previewBox: {
    background: color.stage,
    borderRadius: radius.lg,
    boxShadow: shadow.md,
    padding: '1.5rem 1rem',
    width: '360px',
    maxWidth: '90vw',
    display: 'flex',
    justifyContent: 'center',
  },
  stageRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  stageBtn: (active) => ({
    padding: '0.55rem 1.1rem',
    borderRadius: radius.pill,
    border: `1px solid ${active ? color.primary : color.faintest}`,
    background: active ? color.primary : color.surface,
    color: active ? '#fff' : color.body,
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
  }),
  actionsRow: {
    display: 'flex',
    gap: '0.6rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PodiumCeremonyPanel() {
  const {
    activeCompetition, participants, getSortedEvents, getClub,
    podiums, loadPodiums, podiumState, savePodiumState,
  } = useAppContext();

  useEffect(() => {
    loadPodiums(activeCompetition?.id ?? null);
  }, [activeCompetition?.id, loadPodiums]);

  const sortedEvents = useMemo(
    () => getSortedEvents(activeCompetition),
    [activeCompetition, getSortedEvents]
  );
  const eventName = (eventId) => sortedEvents.find(ev => ev.id === eventId)?.name ?? '';

  const activePodium = podiums.find(p => p.id === podiumState.activePodiumId) ?? null;
  const idx = activePodium ? podiums.findIndex(p => p.id === activePodium.id) : -1;

  const selectPodium = (podiumId) => {
    if (!activeCompetition) return;
    savePodiumState(activeCompetition.id, { activePodiumId: podiumId, revealStage: 0 });
  };
  const goPrev = () => { if (idx > 0) selectPodium(podiums[idx - 1].id); };
  const goNext = () => { if (idx < podiums.length - 1) selectPodium(podiums[idx + 1].id); };

  const setStage = (stage) => {
    if (!activeCompetition || !activePodium) return;
    savePodiumState(activeCompetition.id, { activePodiumId: activePodium.id, revealStage: stage });
  };
  const revealNext  = () => setStage(Math.min(3, (podiumState.revealStage ?? 0) + 1));
  const revealReset = () => setStage(0);

  if (!activeCompetition) {
    return (
      <div style={s.emptyState}>
        <Trophy size={64} color={color.faintest} strokeWidth={1.5} />
        <div style={{ fontWeight: 800, color: color.body }}>Geen actieve wedstrijd</div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* ── Podia op ceremonie-volgorde ── */}
      <div style={s.left}>
        <div style={s.leftHeader}>Podia (volgorde)</div>
        {podiums.map((p, i) => (
          <div key={p.id} style={s.podiumRow(p.id === podiumState.activePodiumId)} onClick={() => selectPodium(p.id)}>
            <span style={s.podiumOrder}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.podiumRowName(p.id === podiumState.activePodiumId)} title={p.name}>{p.name}</div>
              <div style={s.podiumRowMeta}>{eventName(p.eventId)}</div>
            </div>
          </div>
        ))}
        {podiums.length === 0 && (
          <div style={{ padding: '1.25rem', fontSize: '0.8rem', color: color.faint, fontStyle: 'italic' }}>
            Nog geen podia — maak ze hier of in Beheer aan.
          </div>
        )}
      </div>

      {/* ── Onthullingsbediening ── */}
      <div style={s.right}>
        {!activePodium ? (
          <div style={s.emptyState}>
            <Trophy size={64} color={color.faintest} strokeWidth={1.5} />
            <div>Kies links een podium om de onthulling te starten.</div>
          </div>
        ) : (
          <>
            <div style={s.navRow}>
              <button style={s.navBtn(idx <= 0)} disabled={idx <= 0} onClick={goPrev}>
                <ChevronLeft size={20} />
              </button>
              <div style={s.navLabel}>Podium {idx + 1} / {podiums.length}</div>
              <button style={s.navBtn(idx >= podiums.length - 1)} disabled={idx >= podiums.length - 1} onClick={goNext}>
                <ChevronRight size={20} />
              </button>
            </div>

            <div style={s.previewLabel}>
              <MonitorPlay size={13} /> Live op groot scherm
            </div>
            <div style={s.previewBox}>
              <PodiumStage
                podium={activePodium}
                eventName={eventName(activePodium.eventId)}
                participants={participants}
                getClub={getClub}
                revealStage={podiumState.revealStage}
                size="mini"
              />
            </div>

            <div style={s.stageRow}>
              {[1, 2, 3].map(stage => (
                <button
                  key={stage}
                  style={s.stageBtn((podiumState.revealStage ?? 0) >= stage)}
                  onClick={() => setStage(stage)}
                >
                  {STAGE_LABEL[stage]}
                </button>
              ))}
            </div>

            <div style={s.actionsRow}>
              <Button
                variant="secondary" size="sm" icon={<RotateCcw size={14} />}
                onClick={revealReset}
                disabled={(podiumState.revealStage ?? 0) === 0}
              >
                Reset onthulling
              </Button>
              <Button
                variant="primary" size="sm" icon={<ChevronRight size={14} />}
                onClick={revealNext}
                disabled={(podiumState.revealStage ?? 0) >= 3}
              >
                Volgende onthulling
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
