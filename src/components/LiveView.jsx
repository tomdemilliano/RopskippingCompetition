/**
 * LiveView.jsx — SkipFlow
 *
 * Operatorscherm tijdens een actieve wedstrijd.
 * Toont per event en reeks wie er springt, bewaakt tijdsverloop,
 * en markeert reeksen als voltooid.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle, Check,
  Mic2, FastForward, Ghost, Clock, Coffee,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow, font } from '../theme';
import { timeToMinutes } from '../timeUtils';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
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
  eventRow: (active, done) => ({
    padding: '0.9rem 1.25rem',
    cursor: 'pointer',
    borderBottom: `1px solid ${color.surfaceAlt}`,
    background: active ? color.primarySoft : done ? color.surfaceAlt : color.surface,
    color: active ? color.primary : done ? color.faint : color.body,
    fontWeight: active ? 700 : 400,
    borderLeft: active ? `4px solid ${color.primary}` : '4px solid transparent',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
  }),
  content: {
    padding: '1.5rem',
    overflowY: 'auto',
    background: color.surfaceAlt,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  compLabel: {
    textAlign: 'center',
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  navCard: {
    background: color.surface,
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '1rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  navBtn: (disabled) => ({
    background: color.surface,
    border: `1px solid ${color.faintest}`,
    borderRadius: '8px',
    padding: '0.5rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
    alignItems: 'center',
    width: '44px',
    justifyContent: 'center',
  }),
  seriesLabel: (done) => ({
    fontSize: '1.8rem',
    fontWeight: 900,
    color: done ? color.success : color.inkSoft,
    textAlign: 'center',
  }),
  seriesCount: {
    color: color.faint,
    fontWeight: 400,
    fontSize: '1.2rem',
    marginLeft: '4px',
  },
  timeInfo: {
    fontSize: '0.85rem',
    color: color.muted,
    fontWeight: 700,
    textAlign: 'center',
  },
  timeDelta: (late) => ({
    color: late ? color.danger : color.success,
    marginLeft: '6px',
  }),
  doneTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: color.success,
    fontWeight: 900,
    background: color.successSoft,
    padding: '0.5rem 1.5rem',
    borderRadius: '8px',
    border: `2px solid ${color.successBorder}`,
    fontSize: '0.875rem',
    justifyContent: 'center',
  },
  nextBtn: {
    background: color.success,
    color: color.surface,
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 2rem',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'center',
  },

  // Speed velden grid
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
    width: 'fit-content',
    margin: '0 auto',
  },
  fieldCard: (hasSkipper, done) => ({
    background: done ? color.borderSoft : hasSkipper ? color.surface : 'transparent',
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: hasSkipper ? `1px solid ${color.faintest}` : `1px dashed ${color.faintest}`,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    height: '60px',
    minWidth: '320px',
    opacity: done ? 0.6 : 1,
  }),
  fieldNrBadge: (hasSkipper, done) => ({
    background: hasSkipper ? (done ? color.faint : color.primary) : color.faintest,
    color: color.surface,
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
  }),

  // Freestyle layout
  freestyleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '860px',
    margin: '0 auto',
    width: '100%',
  },
  currentCard: (done) => ({
    background: done ? color.borderSoft : color.slate,
    color: done ? color.faint : color.surface,
    padding: '1.2rem 2rem',
    borderRadius: '16px',
    border: done ? `1px solid ${color.border}` : 'none',
  }),
  nextCard: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    padding: '1rem 1.5rem',
    borderRadius: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  programTable: {
    maxHeight: '320px',
    overflowY: 'auto',
    borderRadius: '12px',
    border: `1px solid ${color.border}`,
    background: color.surface,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: color.faint,
    textAlign: 'center',
    gap: '1.5rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calcExpectedTime(scheduledTime, timeDiff) {
  if (!scheduledTime || !timeDiff || Math.abs(timeDiff) <= 2) return scheduledTime;
  try {
    const [h, m] = scheduledTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + timeDiff, 0);
    return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return scheduledTime;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveView() {
  const {
    activeCompetition,
    participants,
    events,
    getSortedEvents,
    getClub,
    finishedEvents,
    finishedSeries,
    finishSeries,
    loadParticipants,
    blocks,
    loadBlocks,
    blockTypeLabels,
    setBlockStatus,
  } = useAppContext();

  // Deelnemers en dagtijdlijn laden voor de actieve wedstrijd — nodig omdat
  // dit scherm rechtstreeks via zijn eigen route geopend kan worden, zonder
  // eerst via Beheer te zijn gepasseerd (dat laadt ze anders zelf al).
  useEffect(() => {
    loadParticipants(activeCompetition?.id ?? null);
    loadBlocks(activeCompetition?.id ?? null);
  }, [activeCompetition?.id, loadParticipants, loadBlocks]);

  // Dagtijdlijn, op volgorde. Huidig blok = eerste blok dat nog niet
  // afgewerkt is — dit bepaalt zowel de pauzeschermen als, hieronder, welk
  // onderdeel/tijdvenster de speaker nu moet doorlopen.
  const sortedBlocks = useMemo(() =>
    [...blocks].sort((a, b) => a.order - b.order),
  [blocks]);
  const currentBlock = useMemo(() =>
    sortedBlocks.find(b => b.status !== 'afgewerkt') ?? null,
  [sortedBlocks]);
  const nextBlock = useMemo(() => {
    if (!currentBlock) return null;
    const idx = sortedBlocks.findIndex(b => b.id === currentBlock.id);
    return idx >= 0 ? (sortedBlocks[idx + 1] ?? null) : null;
  }, [sortedBlocks, currentBlock]);
  const isBreakBlock = !!currentBlock && currentBlock.type !== 'heats';
  const breakLabel = currentBlock?.label || blockTypeLabels[currentBlock?.type] || 'Pauze';

  const handleFinishBlock = () => {
    if (!activeCompetition || !currentBlock) return;
    setBlockStatus(activeCompetition.id, currentBlock.id, 'afgewerkt');
  };

  const sortedEvents = getSortedEvents(activeCompetition);

  // Actief event — initialiseer op eerste niet-voltooide event
  const firstActiveEvent = sortedEvents.find(ev => !finishedEvents.includes(ev.id)) ?? sortedEvents[0];
  const [activeEventId, setActiveEventId] = useState(null);

  // Volg de dagtijdlijn: zodra het huidige blok een "heats"-blok is, schakelt
  // de speaker automatisch naar dát onderdeel over — ook wanneer een pauze
  // net afgesloten is en het volgende blok hetzelfde of een ander onderdeel
  // hervat. Zonder blokken (bv. een wedstrijd zonder dagtijdlijn) valt dit
  // terug op het klassieke "eerste niet-voltooide event".
  useEffect(() => {
    if (currentBlock?.type === 'heats' && currentBlock.eventId) {
      if (activeEventId !== currentBlock.eventId) setActiveEventId(currentBlock.eventId);
    } else if (!currentBlock && !activeEventId && sortedEvents.length > 0) {
      setActiveEventId(firstActiveEvent?.id ?? sortedEvents[0].id);
    }
  }, [currentBlock?.id, currentBlock?.type, currentBlock?.eventId, sortedEvents.length]);

  const activeEvent = events.find(e => e.id === activeEventId) ?? null;
  const isFreestyle = activeEvent?.scoringType === 'freestyle';

  // Alle deelnemers voor het actieve event (ongescoped), gesorteerd op
  // seriesNr dan fieldNr — o.a. nodig om te bepalen of een reeks echt de
  // LAATSTE van het hele onderdeel is (i.p.v. enkel van het huidige blok).
  const allEventParticipants = useMemo(() => {
    if (!activeEventId) return [];
    return participants
      .filter(p => p.entries.some(e => e.eventId === activeEventId && !e.isScratched))
      .map(p => ({
        ...p,
        _entry: p.entries.find(e => e.eventId === activeEventId),
      }))
      .sort((a, b) => {
        if (a._entry.seriesNr !== b._entry.seriesNr) return a._entry.seriesNr - b._entry.seriesNr;
        return String(a._entry.fieldNr).localeCompare(String(b._entry.fieldNr));
      });
  }, [participants, activeEventId]);

  const allSeriesNrs = useMemo(() =>
    [...new Set(allEventParticipants.map(p => p._entry.seriesNr).filter(Boolean))].sort((a, b) => a - b),
  [allEventParticipants]);

  // Eén onderdeel kan over meerdere fysieke blokken lopen (bv. Freestyles
  // onderbroken door pauzes, of Speed/Endurance met zoveel velden dat ze
  // over 2 kolomblokken verdeeld staan maar toch 1 blok vormen — zie
  // pdfSchedule.js). Enkel wanneer een onderdeel ECHT meerdere blokken heeft,
  // wordt de deelnemerslijst afgebakend tot het tijdvenster van het huidige
  // blok — zo blijft een simpel, handmatig beheerd onderdeel (nog altijd het
  // gangbare geval) ongewijzigd zichtbaar, en verschijnt de juiste pauze
  // precies op het moment dat dát ene blok klaar is.
  const blocksForActiveEvent = useMemo(
    () => sortedBlocks.filter(b => b.type === 'heats' && b.eventId === activeEventId),
    [sortedBlocks, activeEventId]
  );
  const inSyncWithBlock = !!currentBlock && currentBlock.type === 'heats' && currentBlock.eventId === activeEventId;
  const needsBlockWindow = inSyncWithBlock && blocksForActiveEvent.length > 1;

  const eventParticipants = useMemo(() => {
    if (!needsBlockWindow) return allEventParticipants;
    const startMin = timeToMinutes(currentBlock.scheduledTime);
    const endMin = nextBlock?.scheduledTime ? timeToMinutes(nextBlock.scheduledTime) : null;
    return allEventParticipants.filter(p => {
      const mins = timeToMinutes(p._entry.scheduledTime);
      if (mins === null || startMin === null) return true; // niet te bepalen — liever tonen dan verbergen
      if (mins < startMin) return false;
      if (endMin !== null && mins >= endMin) return false;
      return true;
    });
  }, [needsBlockWindow, allEventParticipants, currentBlock, nextBlock]);

  // Unieke reeksnummers binnen het huidige (eventueel afgebakende) venster
  const seriesNrs = useMemo(() =>
    [...new Set(eventParticipants.map(p => p._entry.seriesNr).filter(Boolean))].sort((a, b) => a - b),
  [eventParticipants]);

  // Actieve reeks — initialiseer op eerste niet-voltooide reeks (zie effect hieronder)
  const doneInEvent = finishedSeries[activeEventId] ?? [];
  const [activeSeriesNr, setActiveSeriesNr] = useState(1);

  // Reset reeks bij event-wissel of bij een blok-wissel binnen hetzelfde
  // onderdeel (bv. van het eerste naar het tweede Freestyles-blok na een
  // pauze) — anders blijft activeSeriesNr hangen op de net afgesloten reeks
  // van het vorige venster.
  useEffect(() => {
    if (activeEventId) {
      const done = finishedSeries[activeEventId] ?? [];
      const first = seriesNrs.find(nr => !done.includes(nr)) ?? seriesNrs[0] ?? 1;
      setActiveSeriesNr(first);
    }
  }, [activeEventId, currentBlock?.id]);

  // Deelnemers in de actieve reeks
  const currentSeriesParticipants = useMemo(() =>
    eventParticipants.filter(p => p._entry.seriesNr === activeSeriesNr),
  [eventParticipants, activeSeriesNr]);

  // Geplande tijd van de actieve reeks
  const plannedTime = currentSeriesParticipants[0]?._entry.scheduledTime ?? null;

  // Tijdsverschil (minuten) tov geplande tijd
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const timeDiff = useMemo(() => {
    if (!plannedTime) return null;
    const [h, m] = plannedTime.split(':').map(Number);
    const planned = new Date();
    planned.setHours(h, m, 0, 0);
    return Math.floor((currentTime - planned) / 60000);
  }, [plannedTime, currentTime]);

  // Navigatiestatus
  const seriesIdx     = seriesNrs.indexOf(activeSeriesNr);
  const isFirstSeries = seriesIdx === 0;
  const isLastSeries  = seriesIdx === seriesNrs.length - 1;
  const isSeriesDone  = doneInEvent.includes(activeSeriesNr);
  const isEventDone   = finishedEvents.includes(activeEventId);

  // Max veld in huidige reeks (voor speed)
  const maxFieldNr = useMemo(() =>
    currentSeriesParticipants.reduce((max, p) => {
      const f = parseInt(p._entry.fieldNr) || 0;
      return f > max ? f : max;
    }, 0),
  [currentSeriesParticipants]);

  // Volgende deelnemers (freestyle)
  const upcomingParticipants = useMemo(() =>
    eventParticipants.filter(p => p._entry.seriesNr > activeSeriesNr),
  [eventParticipants, activeSeriesNr]);

  const handleFinishSeries = async () => {
    // "Klaar" voor het hele onderdeel (finishedEvents) betekent de ECHTE
    // laatste reeks over al zijn blokken heen — niet enkel de laatste binnen
    // het huidige, eventueel afgebakende tijdvenster.
    const isLastInEvent = activeSeriesNr === allSeriesNrs[allSeriesNrs.length - 1];
    await finishSeries(activeEventId, activeSeriesNr, isLastInEvent);

    if (!isLastSeries) {
      setActiveSeriesNr(seriesNrs[seriesIdx + 1]);
      return;
    }

    if (inSyncWithBlock && currentBlock) {
      // Dit blok (bij een enkelvoudig blok meteen ook het hele onderdeel) is
      // klaar — de dagtijdlijn schuift door naar het volgende blok (pauze of
      // een volgend/hervat onderdeel); activeEventId/activeSeriesNr volgen
      // automatisch zodra blocks vernieuwt (zie de effects hierboven).
      await setBlockStatus(activeCompetition.id, currentBlock.id, 'afgewerkt');
      return;
    }

    // Geen (gesynchroniseerd) blok voor dit onderdeel — bv. handmatige
    // navigatie naar een ander onderdeel dan wat de dagtijdlijn aangeeft.
    // Val terug op het klassieke gedrag: gewoon naar het volgend event.
    const eventIdx = sortedEvents.findIndex(e => e.id === activeEventId);
    if (eventIdx < sortedEvents.length - 1) {
      setActiveEventId(sortedEvents[eventIdx + 1].id);
    }
  };

  // ── Geen actieve wedstrijd ──────────────────────────────────────────────
  if (!activeCompetition || activeCompetition.status !== 'bezig') {
    return (
      <div style={s.emptyState}>
        <div style={{
          background: color.borderSoft, padding: '2rem', borderRadius: '50%',
          border: `4px solid ${color.border}`,
        }}>
          <Ghost size={72} color={color.faintest} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: color.body, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Geen actieve wedstrijd
          </div>
          <div style={{ fontSize: '0.875rem', maxWidth: '280px', lineHeight: 1.6 }}>
            Start een wedstrijd in het beheerscherm om de live-view te activeren.
          </div>
        </div>
      </div>
    );
  }

  // ── Huidig blok is een pauze/briefing/… i.p.v. reeksen ───────────────────
  if (isBreakBlock) {
    return (
      <div style={s.emptyState}>
        <div style={{
          background: color.primarySoft, padding: '2rem', borderRadius: '50%',
          border: `4px solid ${color.primaryBorder}`,
        }}>
          <Coffee size={72} color={color.primary} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: color.inkSoft, fontSize: '1.4rem', marginBottom: '0.5rem' }}>
            {breakLabel}
          </div>
          <div style={{ fontSize: '0.875rem', maxWidth: '280px', lineHeight: 1.6, margin: '0 auto' }}>
            Het grote scherm toont dit ook aan de deelnemers.
          </div>
        </div>
        <button style={s.nextBtn} onClick={handleFinishBlock}>
          Volgende <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div style={s.grid}>
      {/* ── Linker panel: event-lijst ── */}
      <div style={s.leftPanel}>
        <div style={s.leftHeader}>Onderdelen</div>
        {sortedEvents.map(ev => {
          const done   = finishedEvents.includes(ev.id);
          const active = ev.id === activeEventId;
          return (
            <div
              key={ev.id}
              style={s.eventRow(active, done)}
              onClick={() => setActiveEventId(ev.id)}
            >
              <span>{ev.name}</span>
              {done && <Check size={14} color={color.success} />}
            </div>
          );
        })}
      </div>

      {/* ── Rechter panel: actief event ── */}
      <div style={s.content}>
        <div style={s.compLabel}>{activeCompetition.name}</div>

        {/* Navigatiekaart */}
        <div style={s.navCard}>
          <div style={s.navRow}>
            <button
              style={s.navBtn(isFirstSeries)}
              disabled={isFirstSeries}
              onClick={() => setActiveSeriesNr(seriesNrs[seriesIdx - 1])}
            >
              <ChevronLeft size={20} />
            </button>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={s.seriesLabel(isSeriesDone)}>
                {isFreestyle ? activeEvent?.name : 'Reeks'} {activeSeriesNr}
                <span style={s.seriesCount}>/ {seriesNrs.length}</span>
              </div>
              <div style={s.timeInfo}>
                Gepland: {plannedTime || '--:--'}
                {timeDiff !== null && !isSeriesDone && Math.abs(timeDiff) > 2 && (
                  <span style={s.timeDelta(timeDiff > 0)}>
                    ({timeDiff > 0 ? '+' : ''}{timeDiff} min → {calcExpectedTime(plannedTime, timeDiff)})
                  </span>
                )}
              </div>
            </div>

            <button
              style={s.navBtn(isLastSeries)}
              disabled={isLastSeries}
              onClick={() => setActiveSeriesNr(seriesNrs[seriesIdx + 1])}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Voltooiknop of voltooiindicator */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isSeriesDone ? (
              <div style={s.doneTag}>
                <CheckCircle size={18} /> VOLTOOID
              </div>
            ) : (
              <button style={s.nextBtn} onClick={handleFinishSeries}>
                {isLastSeries ? `${activeEvent?.name} klaar` : 'Volgende'}
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* ── Speed: velden grid ── */}
        {!isFreestyle && (
          <div style={s.fieldsGrid}>
            {[...Array(maxFieldNr || 0)].map((_, i) => {
              const fieldNr  = i + 1;
              const skipper  = currentSeriesParticipants.find(
                p => parseInt(p._entry.fieldNr) === fieldNr
              );
              const club = skipper ? getClub(skipper.clubId) : null;
              return (
                <div key={fieldNr} style={s.fieldCard(!!skipper, isSeriesDone)}>
                  <div style={s.fieldNrBadge(!!skipper, isSeriesDone)}>{fieldNr}</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontWeight: 800, fontSize: '1rem',
                      color: skipper ? color.inkSoft : color.faintest,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {skipper?.name ?? '---'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: color.faint }}>
                      {club?.name ?? ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Freestyle: huidige + volgende ── */}
        {isFreestyle && (
          <div style={s.freestyleWrap}>
            {/* Huidige springer */}
            <div style={s.currentCard(isSeriesDone)}>
              {!isSeriesDone && (
                <div style={{
                  fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.4rem',
                  fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <Mic2 size={13} /> NU AAN DE BEURT
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.1 }}>
                    {currentSeriesParticipants[0]?.name ?? '---'}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.8, marginTop: '2px' }}>
                    {getClub(currentSeriesParticipants[0]?.clubId)?.name ?? ''}
                  </div>
                </div>
                <div style={{
                  background: isSeriesDone ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.15)',
                  padding: '0.5rem 1rem', borderRadius: '10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.8 }}>VELD</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>
                    {currentSeriesParticipants[0]?._entry.fieldNr ?? '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Volgende + programma (alleen als reeks niet klaar) */}
            {!isSeriesDone && upcomingParticipants.length > 0 && (
              <>
                {/* Eerstvolgende */}
                <div style={s.nextCard}>
                  <div>
                    <div style={{
                      color: color.muted, fontWeight: 700, fontSize: '0.65rem',
                      display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px',
                    }}>
                      <FastForward size={13} /> VOLGENDE
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color.inkSoft }}>
                      {upcomingParticipants[0].name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: color.muted }}>
                      {getClub(upcomingParticipants[0].clubId)?.name ?? ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: color.muted }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: color.slate }}>
                      VELD {upcomingParticipants[0]._entry.fieldNr}
                    </div>
                    <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                      <Clock size={12} />
                      {calcExpectedTime(upcomingParticipants[0]._entry.scheduledTime, timeDiff)}
                    </div>
                  </div>
                </div>

                {/* Verder programma */}
                {upcomingParticipants.length > 1 && (
                  <div>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 900, color: color.faint,
                      marginBottom: '0.5rem', letterSpacing: '0.05em',
                    }}>
                      VERDER PROGRAMMA
                    </div>
                    <div style={s.programTable}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead style={{ position: 'sticky', top: 0, background: color.surfaceAlt, zIndex: 1 }}>
                          <tr style={{ color: color.muted, borderBottom: `2px solid ${color.borderSoft}` }}>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700 }}>Tijd</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700 }}>Veld</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700 }}>Skipper</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 700 }}>Club</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingParticipants.slice(1).map((p, idx) => {
                            const expected  = calcExpectedTime(p._entry.scheduledTime, timeDiff);
                            const isDelayed = expected !== p._entry.scheduledTime;
                            return (
                              <tr key={idx} style={{ borderBottom: `1px solid ${color.borderSoft}` }}>
                                <td style={{ padding: '0.6rem 1rem', color: isDelayed ? color.danger : color.muted }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> {expected}
                                  </span>
                                </td>
                                <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: color.slate }}>
                                  {p._entry.fieldNr}
                                </td>
                                <td style={{ padding: '0.6rem 1rem', fontWeight: 800, color: color.inkSoft }}>
                                  {p.name}
                                </td>
                                <td style={{ padding: '0.6rem 1rem', color: color.muted }}>
                                  {getClub(p.clubId)?.name ?? ''}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
