/**
 * DisplayView.jsx — SkipFlow
 *
 * Groot scherm voor in de zaal. Toont de huidige reeks en wie er
 * straks aan de beurt zijn, met tijdsindicatie.
 *
 * Volgt de "officiële" voortgang uit finishedEvents/finishedSeries —
 * niet de operator-cursor uit LiveView.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Maximize2, Minimize2, Clock, X, Coffee, Activity, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow, font } from '../theme';
import { MESSAGE_ICON_MAP } from './MessageManager';
import { timeToMinutes } from '../timeUtils';

const BREAK_ICONS = { proefjury: Activity };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calcExpectedTime(scheduledTime, timeDiff) {
  if (!scheduledTime || !timeDiff) return scheduledTime;
  try {
    const [h, m] = scheduledTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + timeDiff, 0);
    return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return scheduledTime;
  }
}

/** Afwijking t.o.v. het geplande uur — enkel zichtbaar vanaf > 2 minuten. */
function TimeDeviationBadge({ timeDiff }) {
  if (timeDiff === null || Math.abs(timeDiff) <= 2) return null;
  return (
    <span style={{
      marginLeft: '0.5rem', fontWeight: 700, fontSize: '0.85rem',
      color: timeDiff > 0 ? '#f87171' : '#34d399',
    }}>
      {timeDiff > 0 ? `+${timeDiff}` : timeDiff} min
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DisplayView({ onClose }) {
  const {
    activeCompetition,
    participants,
    events,
    getSortedEvents,
    getClub,
    finishedEvents,
    finishedSeries,
    loadParticipants,
    blocks,
    loadBlocks,
    blockTypeLabels,
    loadMessages,
    activeMessage,
  } = useAppContext();

  // Deelnemers, dagtijdlijn en boodschap laden voor de actieve wedstrijd —
  // nodig omdat dit scherm rechtstreeks via zijn eigen route geopend kan
  // worden, zonder eerst via Beheer te zijn gepasseerd (dat laadt ze anders
  // zelf al).
  useEffect(() => {
    loadParticipants(activeCompetition?.id ?? null);
    loadBlocks(activeCompetition?.id ?? null);
    loadMessages(activeCompetition?.id ?? null);
  }, [activeCompetition?.id, loadParticipants, loadBlocks, loadMessages]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime,  setCurrentTime]  = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const sortedEvents = getSortedEvents(activeCompetition);

  // Officieel actief event = eerste event dat nog niet in finishedEvents staat
  const officialEvent = useMemo(() =>
    sortedEvents.find(ev => !finishedEvents.includes(ev.id)) ?? sortedEvents[0] ?? null,
  [sortedEvents, finishedEvents]);

  const isFreestyle = officialEvent?.scoringType === 'freestyle';

  // Deelnemers voor het officiële event
  const eventParticipants = useMemo(() => {
    if (!officialEvent) return [];
    return participants
      .filter(p => p.entries.some(e => e.eventId === officialEvent.id && !e.isScratched))
      .map(p => ({
        ...p,
        _entry: p.entries.find(e => e.eventId === officialEvent.id),
      }))
      .sort((a, b) => {
        if (a._entry.seriesNr !== b._entry.seriesNr) return a._entry.seriesNr - b._entry.seriesNr;
        return String(a._entry.fieldNr).localeCompare(String(b._entry.fieldNr));
      });
  }, [participants, officialEvent]);

  // Unieke reeksnummers
  const seriesNrs = useMemo(() =>
    [...new Set(eventParticipants.map(p => p._entry.seriesNr).filter(Boolean))].sort((a, b) => a - b),
  [eventParticipants]);

  // Officieel actieve reeks = eerste reeks nog niet voltooid
  const doneInEvent = finishedSeries[officialEvent?.id] ?? [];
  const officialSeriesNr = useMemo(() =>
    seriesNrs.find(nr => !doneInEvent.includes(nr)) ?? seriesNrs[0] ?? 1,
  [seriesNrs, doneInEvent]);

  const totalSeries = seriesNrs.length;

  // Deelnemers in de officiële reeks
  const currentSkippers = useMemo(() =>
    eventParticipants.filter(p => p._entry.seriesNr === officialSeriesNr),
  [eventParticipants, officialSeriesNr]);

  const plannedTime = currentSkippers[0]?._entry.scheduledTime ?? null;

  // Tijdsverschil in minuten
  const timeDiff = useMemo(() => {
    if (!plannedTime) return null;
    const [h, m] = plannedTime.split(':').map(Number);
    const planned = new Date();
    planned.setHours(h, m, 0, 0);
    return Math.floor((currentTime - planned) / 60000);
  }, [plannedTime, currentTime]);

  // Huidig blok in de dagtijdlijn — eerste blok dat nog niet afgewerkt is.
  const currentBlock = useMemo(() =>
    [...blocks].sort((a, b) => a.order - b.order).find(b => b.status !== 'afgewerkt') ?? null,
  [blocks]);
  const isBreakBlock = !!currentBlock && currentBlock.type !== 'heats';
  const breakLabel = currentBlock?.label || blockTypeLabels[currentBlock?.type] || 'Pauze';
  const BreakIcon = BREAK_ICONS[currentBlock?.type] ?? Coffee;

  const MessageIcon = MESSAGE_ICON_MAP[activeMessage.icon] ?? null;

  // Volledig veldlijst (speed: aanvullen met lege velden)
  const fullFieldsList = useMemo(() => {
    if (isFreestyle || currentSkippers.length === 0) return currentSkippers;
    const maxField = Math.max(...currentSkippers.map(p => parseInt(p._entry.fieldNr) || 0), 0);
    const list = [];
    for (let v = 1; v <= maxField; v++) {
      const skipper = currentSkippers.find(p => parseInt(p._entry.fieldNr) === v);
      list.push(skipper ?? { _isEmpty: true, _entry: { fieldNr: v } });
    }
    return list;
  }, [currentSkippers, isFreestyle]);

  // Volgende lijst — zelfde event of volgend event. Bij speed (meerdere
  // velden per reeks) delen alle rijen dezelfde scheduledTime — daarom
  // krijgt zo'n groep ook groupSeriesNr/groupSeriesTotal mee, zodat het uur
  // één keer bovenaan getoond kan worden i.p.v. overbodig op elke rij.
  const { nextList, nextEventObj, isNextEvent, nextIsFreestyle, groupSeriesNr, groupSeriesTotal } = useMemo(() => {
    const empty = { nextList: [], nextEventObj: null, isNextEvent: false, nextIsFreestyle: false, groupSeriesNr: null, groupSeriesTotal: null };
    if (!officialEvent) return empty;

    const currentSeriesIdx = seriesNrs.indexOf(officialSeriesNr);
    const hasMoreSeries = currentSeriesIdx < seriesNrs.length - 1;

    if (hasMoreSeries) {
      const nextNr   = seriesNrs[currentSeriesIdx + 1];
      const nextList = isFreestyle
        ? eventParticipants.filter(p => p._entry.seriesNr > officialSeriesNr).slice(0, 8)
        : (() => {
            const raw = eventParticipants.filter(p => p._entry.seriesNr === nextNr);
            const max = Math.max(...raw.map(p => parseInt(p._entry.fieldNr) || 0), 0);
            const list = [];
            for (let v = 1; v <= max; v++) {
              const s = raw.find(p => parseInt(p._entry.fieldNr) === v);
              list.push(s ?? { _isEmpty: true, _entry: { fieldNr: v } });
            }
            return list;
          })();
      return {
        nextList, nextEventObj: officialEvent, isNextEvent: false,
        nextIsFreestyle: isFreestyle,
        groupSeriesNr: isFreestyle ? null : nextNr,
        groupSeriesTotal: isFreestyle ? null : totalSeries,
      };
    }

    // Zoek volgend event met deelnemers
    const currentEventIdx = sortedEvents.findIndex(e => e.id === officialEvent.id);
    for (let i = currentEventIdx + 1; i < sortedEvents.length; i++) {
      const nextEv   = sortedEvents[i];
      const nextFreestyle = nextEv.scoringType === 'freestyle';
      const nextParts = participants
        .filter(p => p.entries.some(e => e.eventId === nextEv.id && !e.isScratched))
        .map(p => ({ ...p, _entry: p.entries.find(e => e.eventId === nextEv.id) }))
        .sort((a, b) => {
          if (a._entry.seriesNr !== b._entry.seriesNr) return a._entry.seriesNr - b._entry.seriesNr;
          return String(a._entry.fieldNr).localeCompare(String(b._entry.fieldNr));
        });

      if (nextParts.length > 0) {
        const firstNr = nextParts[0]._entry.seriesNr;
        const list = nextFreestyle
          ? nextParts.slice(0, 8)
          : (() => {
              const raw = nextParts.filter(p => p._entry.seriesNr === firstNr);
              const max = Math.max(...raw.map(p => parseInt(p._entry.fieldNr) || 0), 0);
              const result = [];
              for (let v = 1; v <= max; v++) {
                const s = raw.find(p => parseInt(p._entry.fieldNr) === v);
                result.push(s ?? { _isEmpty: true, _entry: { fieldNr: v } });
              }
              return result;
            })();
        return {
          nextList: list, nextEventObj: nextEv, isNextEvent: true,
          nextIsFreestyle: nextFreestyle,
          groupSeriesNr: nextFreestyle ? null : firstNr,
          groupSeriesTotal: nextFreestyle ? null : new Set(nextParts.map(p => p._entry.seriesNr)).size,
        };
      }
    }

    return empty;
  }, [officialEvent, officialSeriesNr, seriesNrs, eventParticipants, sortedEvents, participants, isFreestyle, totalSeries]);

  // "Volgende"-lijst verrijkt met tussenliggende pauze/briefing/proefjury/
  // prijsuitreiking-blokken uit de dagtijdlijn — die vielen voorheen
  // volledig weg omdat nextList enkel uit deelnemers werd opgebouwd.
  // Elk blok krijgt de tijd van het eerstvolgende, nog niet lege veld als
  // fallback (velden zonder skipper in de speed-lijst delen gewoon de
  // reekstijd van hun reeks), zodat de sortering nooit door ontbrekende
  // scheduledTime op lege plekken verstoord wordt.
  const displayList = useMemo(() => {
    if (nextList.length === 0) return [];

    const groupTime = nextList.find(p => !p._isEmpty)?._entry?.scheduledTime ?? null;
    const skipperItems = nextList.map(p => ({
      kind: 'skipper',
      data: p,
      _min: timeToMinutes(p._entry?.scheduledTime) ?? timeToMinutes(groupTime),
    }));

    const startMin = timeToMinutes(plannedTime);
    const blockItems = startMin === null ? [] : blocks
      .filter(b => b.type !== 'heats')
      .map(b => ({ kind: 'block', data: b, _min: timeToMinutes(b.scheduledTime) }))
      .filter(b => b._min !== null && b._min > startMin);

    const merged = [...skipperItems, ...blockItems].sort((a, b) => {
      const am = a._min ?? Infinity;
      const bm = b._min ?? Infinity;
      if (am !== bm) return am - bm;
      if (a.kind !== b.kind) return a.kind === 'block' ? -1 : 1;
      return 0;
    });

    // Enkel blokken behouden die vóór of tussen de al getoonde skippers
    // vallen — een blok dat pas ná het laatste getoonde item plaatsvindt
    // hoort (nog) niet in deze preview thuis.
    const lastSkipperIdx = merged.reduce((last, item, i) => item.kind === 'skipper' ? i : last, -1);
    return merged.slice(0, lastSkipperIdx + 1);
  }, [nextList, blocks, plannedTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ── Geen actieve wedstrijd ──────────────────────────────────────────────
  if (!activeCompetition || activeCompetition.status !== 'bezig') {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: color.stage, color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Geen actieve wedstrijd</h1>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 2rem', borderRadius: '8px', border: 'none',
              background: color.slate, color: 'white', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Terug naar beheer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: color.stage, color: color.stageInk,
      fontFamily: font.body,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 9999,
    }}>
      {/* ── Top bar ── */}
      <div style={{
        padding: '0.875rem 2rem',
        background: 'rgba(30,41,59,0.8)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>
          {activeCompetition.name}
          <span style={{ color: color.info, marginLeft: '1rem', fontWeight: 400 }}>
            | {officialEvent?.name ?? '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            style={{
              background: color.danger, border: 'none', color: 'white',
              padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Boodschap — prominent, apart afgerond vak vlak onder de header ── */}
      <div style={{
        position: 'relative',
        margin: '0.75rem 2rem 0',
        padding: '0.75rem 1.5rem',
        background: 'rgba(37,99,235,0.18)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: radius.lg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {MessageIcon && (
          <MessageIcon
            size={22} color={color.info}
            style={{ position: 'absolute', left: '1.5rem', flexShrink: 0 }}
          />
        )}
        <div style={{ fontSize: '1.1rem', fontWeight: 800, textAlign: 'center' }}>
          {activeMessage.text}
        </div>
      </div>

      {/* ── Hoofdinhoud ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Links: huidige reeks */}
        <div style={{
          width: '30%', padding: '1.5rem 1.75rem',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(15,23,42,0.3)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1 }}>
            {!isBreakBlock && (
              <div style={{
                color: color.stageMuted, fontSize: '0.875rem', fontWeight: 700,
                marginBottom: '0.75rem', textTransform: 'uppercase',
              }}>
                Nu bezig: Reeks {officialSeriesNr} van {totalSeries}
              </div>
            )}

            {isBreakBlock ? (
              <div style={{
                background: 'rgba(56,189,248,0.1)',
                padding: '3rem 1rem', borderRadius: '12px',
                border: `2px dashed ${color.info}`, textAlign: 'center',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '1.5rem', marginTop: '1rem',
              }}>
                <BreakIcon size={100} color={color.info} strokeWidth={1.5} />
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: color.info, letterSpacing: '2px', textTransform: 'uppercase' }}>
                  {breakLabel}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(30,41,59,0.4)', padding: '1rem',
                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
              }}>
                {fullFieldsList.map((p, i) => (
                  <div key={i} style={{
                    fontSize: '0.95rem', display: 'flex',
                    alignItems: 'center', gap: '0.75rem',
                    opacity: p._isEmpty ? 0.4 : 1,
                  }}>
                    <span style={{
                      background: color.slate, color: '#fff',
                      minWidth: '1.8rem', textAlign: 'center',
                      padding: '0.1rem 0.3rem', borderRadius: '4px',
                      fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {p._entry?.fieldNr ?? '-'}
                    </span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontStyle: p._isEmpty ? 'italic' : 'normal' }}>
                        {p._isEmpty ? '---' : p.name}
                      </span>
                      {!p._isEmpty && p.clubId && (
                        <span style={{ color: color.muted, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                          ({getClub(p.clubId)?.name ?? ''})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tijdsinfo */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ color: color.stageMuted, fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              TIJDSSCHEMA
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={24} color={color.info} />
              {currentTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            {timeDiff !== null && timeDiff !== 0 && (
              <div style={{
                marginTop: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
                background: timeDiff > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                color: timeDiff > 0 ? '#f87171' : '#34d399',
                fontSize: '0.875rem', fontWeight: 700,
              }}>
                {timeDiff > 0 ? `+${timeDiff} min` : `${timeDiff} min`}
              </div>
            )}
          </div>
        </div>

        {/* Rechts: volgende */}
        <div style={{ flex: 1, padding: '1.25rem 2rem', overflowY: 'auto' }}>
          <div style={{
            marginBottom: '1rem',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
          }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: color.stageInk }}>
              Volgende
            </h2>
            {isNextEvent && nextEventObj && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: color.info, color: color.stage,
                padding: '0.35rem 0.9rem', borderRadius: '10px',
                fontWeight: 800, fontSize: '0.9rem',
              }}>
                <ChevronRight size={18} />
                {nextEventObj.name.toUpperCase()}
              </div>
            )}
          </div>

          {displayList.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 5px' }}>
              <thead>
                <tr style={{ color: color.muted, fontSize: '0.85rem', textAlign: 'left' }}>
                  <th style={{ padding: '0 0.875rem' }}>Verwacht</th>
                  <th style={{ padding: '0 0.875rem' }}>Veld</th>
                  <th style={{ padding: '0 0.875rem' }}>Skipper / Team</th>
                  <th style={{ padding: '0 0.875rem' }}>Club</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Bij speed delen alle rijen van displayList dezelfde reeks
                  // (groupSeriesNr) — het uur wordt dan één keer bovenaan
                  // getoond i.p.v. overbodig op elke rij (freestyle-rijen
                  // kunnen wél elk een eigen tijdstip hebben, dus daar blijft
                  // het per-rij uur staan).
                  const isGrouped = !nextIsFreestyle && groupSeriesNr !== null;
                  let groupHeaderShown = false;

                  return displayList.map((item, idx) => {
                    if (item.kind === 'block') {
                      const b = item.data;
                      const BlockIcon = BREAK_ICONS[b.type] ?? Coffee;
                      const label = b.label || blockTypeLabels[b.type] || b.type;
                      return (
                        <tr key={`block-${b.id}`} style={{ fontSize: '1.1rem' }}>
                          <td colSpan={4} style={{
                            padding: '0.6rem 0.875rem',
                            borderRadius: '8px',
                            background: 'rgba(56,189,248,0.12)',
                            border: `1px dashed ${color.info}`,
                            boxSizing: 'border-box',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: color.info, fontWeight: 800 }}>
                              <BlockIcon size={18} />
                              {label.toUpperCase()}
                              {b.scheduledTime && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.9rem', opacity: 0.85 }}>
                                  {b.scheduledTime}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const p        = item.data;
                    const entry    = p._entry;
                    const expected = calcExpectedTime(entry?.scheduledTime, timeDiff);
                    const showGroupHeaderNow = isGrouped && !groupHeaderShown;
                    if (showGroupHeaderNow) groupHeaderShown = true;

                    return (
                      <React.Fragment key={idx}>
                        {showGroupHeaderNow && (
                          <tr>
                            <td colSpan={4} style={{ padding: '0.4rem 0.875rem 0.6rem' }}>
                              <div style={{
                                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                              }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: color.stageInk }}>
                                  Reeks {groupSeriesNr}
                                  <span style={{ color: color.stageMuted, fontWeight: 400, fontSize: '1.1rem' }}> / {groupSeriesTotal}</span>
                                </span>
                                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: color.stageMuted }}>
                                  {expected || '--:--'}
                                  <TimeDeviationBadge timeDiff={timeDiff} />
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr style={{
                          background: 'rgba(30,41,59,0.4)',
                          fontSize: '1.3rem',
                          opacity: p._isEmpty ? 0.5 : 1,
                        }}>
                          <td style={{
                            padding: '0.5rem 0.875rem',
                            borderRadius: '8px 0 0 8px',
                            fontWeight: 800, color: color.stageMuted,
                          }}>
                            {!isGrouped && (
                              <>
                                {expected || '--:--'}
                                <TimeDeviationBadge timeDiff={timeDiff} />
                              </>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.875rem' }}>
                            <span style={{
                              background: color.slate, color: '#fff',
                              minWidth: '2rem', display: 'inline-block',
                              textAlign: 'center', padding: '0.1rem 0.5rem',
                              borderRadius: '5px',
                            }}>
                              {entry?.fieldNr ?? '-'}
                            </span>
                          </td>
                          <td style={{
                            padding: '0.5rem 0.875rem',
                            fontWeight: 800,
                            fontStyle: p._isEmpty ? 'italic' : 'normal',
                          }}>
                            {p._isEmpty ? '---' : p.name}
                          </td>
                          <td style={{
                            padding: '0.5rem 0.875rem',
                            borderRadius: '0 8px 8px 0',
                            color: color.stageMuted, fontSize: '1.1rem',
                          }}>
                            {p.clubId ? getClub(p.clubId)?.name ?? '' : ''}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          ) : (
            <div style={{
              marginTop: '3rem', textAlign: 'center', padding: '2.5rem',
              background: 'rgba(30,41,59,0.4)', borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: color.stageMuted }}>
                De wedstrijd is afgelopen
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
