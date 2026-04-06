/**
 * LiveView.jsx — RopeScore Pro
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
  Mic2, FastForward, Ghost, Clock,
} from 'lucide-react';
import { useAppContext } from '../AppContext';

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
    background: '#fff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  leftHeader: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #eee',
    fontSize: '0.7rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  eventRow: (active, done) => ({
    padding: '0.9rem 1.25rem',
    cursor: 'pointer',
    borderBottom: '1px solid #f8fafc',
    background: active ? '#f0f7ff' : done ? '#f8fafc' : '#fff',
    color: active ? '#2563eb' : done ? '#94a3b8' : '#475569',
    fontWeight: active ? 700 : 400,
    borderLeft: active ? '4px solid #2563eb' : '4px solid transparent',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
  }),
  content: {
    padding: '1.5rem',
    overflowY: 'auto',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  compLabel: {
    textAlign: 'center',
    fontSize: '0.7rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  navCard: {
    background: '#fff',
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
    background: '#fff',
    border: '1px solid #cbd5e1',
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
    color: done ? '#10b981' : '#1e293b',
    textAlign: 'center',
  }),
  seriesCount: {
    color: '#94a3b8',
    fontWeight: 400,
    fontSize: '1.2rem',
    marginLeft: '4px',
  },
  timeInfo: {
    fontSize: '0.85rem',
    color: '#64748b',
    fontWeight: 700,
    textAlign: 'center',
  },
  timeDelta: (late) => ({
    color: late ? '#ef4444' : '#10b981',
    marginLeft: '6px',
  }),
  doneTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#10b981',
    fontWeight: 900,
    background: '#f0fdf4',
    padding: '0.5rem 1.5rem',
    borderRadius: '8px',
    border: '2px solid #bbf7d0',
    fontSize: '0.875rem',
    justifyContent: 'center',
  },
  nextBtn: {
    background: '#10b981',
    color: '#fff',
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
    background: done ? '#f1f5f9' : hasSkipper ? '#fff' : 'transparent',
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: hasSkipper ? '1px solid #cbd5e1' : '1px dashed #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    height: '60px',
    minWidth: '320px',
    opacity: done ? 0.6 : 1,
  }),
  fieldNrBadge: (hasSkipper, done) => ({
    background: hasSkipper ? (done ? '#94a3b8' : '#2563eb') : '#cbd5e1',
    color: '#fff',
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
    background: done ? '#f1f5f9' : '#334155',
    color: done ? '#94a3b8' : '#fff',
    padding: '1.2rem 2rem',
    borderRadius: '16px',
    border: done ? '1px solid #e2e8f0' : 'none',
  }),
  nextCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
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
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: '#94a3b8',
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
  } = useAppContext();

  const sortedEvents = getSortedEvents(activeCompetition);

  // Actief event — initialiseer op eerste niet-voltooide event
  const firstActiveEvent = sortedEvents.find(ev => !finishedEvents.includes(ev.id)) ?? sortedEvents[0];
  const [activeEventId, setActiveEventId] = useState(null);

  useEffect(() => {
    if (sortedEvents.length > 0 && !activeEventId) {
      setActiveEventId(firstActiveEvent?.id ?? sortedEvents[0].id);
    }
  }, [sortedEvents.length]);

  const activeEvent = events.find(e => e.id === activeEventId) ?? null;
  const isFreestyle = activeEvent?.scoringType === 'freestyle';

  // Deelnemers voor het actieve event, gesorteerd op seriesNr dan fieldNr
  const eventParticipants = useMemo(() => {
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

  // Unieke reeksnummers voor dit event
  const seriesNrs = useMemo(() =>
    [...new Set(eventParticipants.map(p => p._entry.seriesNr).filter(Boolean))].sort((a, b) => a - b),
  [eventParticipants]);

  // Actieve reeks — initialiseer op eerste niet-voltooide reeks
  const doneInEvent = finishedSeries[activeEventId] ?? [];
  const firstActiveSeries = seriesNrs.find(nr => !doneInEvent.includes(nr)) ?? seriesNrs[0] ?? 1;
  const [activeSeriesNr, setActiveSeriesNr] = useState(1);

  // Reset reeks bij event-wissel
  useEffect(() => {
    if (activeEventId) {
      const done = finishedSeries[activeEventId] ?? [];
      const first = seriesNrs.find(nr => !done.includes(nr)) ?? seriesNrs[0] ?? 1;
      setActiveSeriesNr(first);
    }
  }, [activeEventId]);

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
    const isLastInEvent = isLastSeries;
    await finishSeries(activeEventId, activeSeriesNr, isLastInEvent);

    if (!isLastSeries) {
      setActiveSeriesNr(seriesNrs[seriesIdx + 1]);
    } else {
      // Ga naar volgend event
      const eventIdx = sortedEvents.findIndex(e => e.id === activeEventId);
      if (eventIdx < sortedEvents.length - 1) {
        setActiveEventId(sortedEvents[eventIdx + 1].id);
      }
    }
  };

  // ── Geen actieve wedstrijd ──────────────────────────────────────────────
  if (!activeCompetition || activeCompetition.status !== 'bezig') {
    return (
      <div style={s.emptyState}>
        <div style={{
          background: '#f1f5f9', padding: '2rem', borderRadius: '50%',
          border: '4px solid #e2e8f0',
        }}>
          <Ghost size={72} color="#cbd5e1" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: '#475569', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Geen actieve wedstrijd
          </div>
          <div style={{ fontSize: '0.875rem', maxWidth: '280px', lineHeight: 1.6 }}>
            Start een wedstrijd in het beheerscherm om de live-view te activeren.
          </div>
        </div>
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
              {done && <Check size={14} color="#10b981" />}
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
                      color: skipper ? '#1e293b' : '#cbd5e1',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {skipper?.name ?? '---'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
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
                      color: '#64748b', fontWeight: 700, fontSize: '0.65rem',
                      display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px',
                    }}>
                      <FastForward size={13} /> VOLGENDE
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>
                      {upcomingParticipants[0].name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {getClub(upcomingParticipants[0].clubId)?.name ?? ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#64748b' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
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
                      fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8',
                      marginBottom: '0.5rem', letterSpacing: '0.05em',
                    }}>
                      VERDER PROGRAMMA
                    </div>
                    <div style={s.programTable}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                          <tr style={{ color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>
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
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.6rem 1rem', color: isDelayed ? '#ef4444' : '#64748b' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> {expected}
                                  </span>
                                </td>
                                <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: '#334155' }}>
                                  {p._entry.fieldNr}
                                </td>
                                <td style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#1e293b' }}>
                                  {p.name}
                                </td>
                                <td style={{ padding: '0.6rem 1rem', color: '#64748b' }}>
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
