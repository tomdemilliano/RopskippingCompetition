/**
 * CompetitionDetail.jsx — RopeScore Pro
 *
 * Rechterkolom van de beheer-view.
 * Toont de geselecteerde wedstrijd met:
 *   - Header: naam, type, status, actieknoppen
 *   - EventsPanel: onderdelen met upload-knop per event
 *   - ParticipantsList: gefilterde deelnemerslijst met aanwezigheid en schrappen
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit2, Trash2, Play, Square, Ghost, Check,
  CheckCircle, Users, UserPlus, UserCheck, UserX,
  Search, RotateCcw, UserMinus, Upload, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../../AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  header: {
    padding: '1.25rem 1.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.25rem',
  },
  compName: {
    fontSize: '1.2rem',
    fontWeight: 900,
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  compMeta: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '2px',
  },
  badgeLive: {
    background: '#ef4444',
    color: '#fff',
    fontSize: '0.6rem',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 900,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  btnIcon: (danger) => ({
    background: '#fff',
    color: danger ? '#ef4444' : '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.4rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  }),
  btnPrimary: (color) => ({
    background: color ?? '#2563eb',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }),
  btnSecondary: {
    background: '#fff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  // Events panel
  eventsPanel: {
    padding: '1rem 1.5rem',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  eventsPanelLabel: {
    fontSize: '0.65rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.6rem',
  },
  eventsScroll: {
    display: 'flex',
    gap: '0.75rem',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  eventCard: (hasParticipants) => ({
    minWidth: '200px',
    padding: '0.75rem',
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    borderLeft: `4px solid ${hasParticipants ? '#10b981' : '#f59e0b'}`,
    flexShrink: 0,
  }),
  eventCardName: {
    fontWeight: 900,
    fontSize: '0.8rem',
    color: '#1e293b',
    marginBottom: '4px',
  },
  eventCardMeta: {
    fontSize: '0.65rem',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  eventCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventCount: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#475569',
  },
  uploadBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  orderBtns: {
    display: 'flex',
    gap: '2px',
    marginBottom: '4px',
  },
  orderBtn: (disabled) => ({
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '3px',
    padding: '2px 4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
  }),

  // Participants list
  participantsPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#fff',
  },
  filterBar: {
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flexShrink: 0,
  },
  filterBtns: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: (active, color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0.3rem 0.7rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${active ? color : '#e2e8f0'}`,
    background: active ? `${color}18` : '#fff',
    color: active ? color : '#64748b',
  }),
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    background: '#f1f5f9',
    padding: '0.4rem 0.75rem',
    borderRadius: '6px',
    gap: '0.5rem',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '100%',
    fontSize: '0.85rem',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    padding: '0.6rem 1rem',
    textAlign: 'left',
    color: '#94a3b8',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    position: 'sticky',
    top: 0,
    background: '#fff',
    borderBottom: '1px solid #eee',
    zIndex: 1,
  },
  td: {
    padding: '0.65rem 1rem',
    borderBottom: '1px solid #f8fafc',
  },
  actionBtn: (color) => ({
    border: 'none',
    background: 'none',
    color: color ?? '#94a3b8',
    cursor: 'pointer',
    padding: '2px',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  eventBadge: (scratched) => ({
    display: 'inline-block',
    fontSize: '0.6rem',
    background: scratched ? '#fee2e2' : '#f1f5f9',
    color: scratched ? '#ef4444' : '#475569',
    textDecoration: scratched ? 'line-through' : 'none',
    padding: '2px 5px',
    borderRadius: '3px',
    marginRight: '3px',
    marginBottom: '2px',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {string}   props.competitionId
 * @param {function} props.onEdit          — opent EditCompetitionModal
 * @param {function} props.onImport        — cb(eventId) opent ImportModal
 * @param {function} props.onEditParticipant — cb(participant) opent EditParticipantModal
 */
export default function CompetitionDetail({
  competitionId,
  onEdit,
  onImport,
  onEditParticipant,
}) {
  const {
    competitions,
    competitionTypes,
    events,
    participants,
    participantsCompId,
    loadParticipants,
    getSortedEvents,
    getClub,
    isScratchedFromEvent,
    isFullyScratched,
    startCompetition,
    stopCompetitionLive,
    endCompetition,
    deleteCompetition,
    saveEventOrder,
    setPresence,
    scratchFromEvent,
    scratchFromAll,
  } = useAppContext();

  const [filterStatus, setFilterStatus] = useState('alle');
  const [searchTerm,   setSearchTerm]   = useState('');

  const competition = competitions.find(c => c.id === competitionId) ?? null;

  // Laad deelnemers bij selectie
  useEffect(() => {
    if (competitionId) loadParticipants(competitionId);
  }, [competitionId, loadParticipants]);

  const sortedEvents = useMemo(
    () => getSortedEvents(competition),
    [competition, getSortedEvents]
  );

  // Deelnemers gefilterd en gesorteerd
  const filteredParticipants = useMemo(() => {
    return participants
      .filter(p => {
        const fullyScratched = isFullyScratched(p);
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (getClub(p.clubId)?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase());

        if (filterStatus === 'aangemeld')     return matchesSearch && p.isPresent && !fullyScratched;
        if (filterStatus === 'niet-aangemeld') return matchesSearch && !p.isPresent && !fullyScratched;
        if (filterStatus === 'geschrapt')     return matchesSearch && fullyScratched;
        return matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filterStatus, searchTerm, isFullyScratched, getClub]);

  // Aantal deelnemers per event (actief)
  const participantCountByEvent = useMemo(() => {
    const counts = {};
    sortedEvents.forEach(ev => {
      counts[ev.id] = participants.filter(
        p => p.entries.some(e => e.eventId === ev.id && !e.isScratched)
      ).length;
    });
    return counts;
  }, [participants, sortedEvents]);

  // Event volgorde aanpassen
  const handleMoveEvent = async (eventId, direction) => {
    const order = { ...(competition.eventOrder ?? {}) };
    sortedEvents.forEach((ev, idx) => {
      if (order[ev.id] === undefined) order[ev.id] = idx + 1;
    });
    const idx    = sortedEvents.findIndex(e => e.id === eventId);
    const target = direction === 'left' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sortedEvents.length) return;
    const targetId = sortedEvents[target].id;
    [order[eventId], order[targetId]] = [order[targetId], order[eventId]];
    await saveEventOrder(competition.id, order);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Weet je zeker dat je "${competition.name}" wilt verwijderen?`)) return;
    await deleteCompetition(competition.id);
  };

  const handleStart = async () => {
    try {
      await startCompetition(competition.id);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!competition) {
    return (
      <div style={s.content}>
        <div style={s.empty}>
          Selecteer een wedstrijd uit de lijst.
        </div>
      </div>
    );
  }

  const isLive  = competition.status === 'bezig';
  const isDone  = competition.status === 'beëindigd';
  const compTypeName = competitionTypes.find(t => t.id === competition.typeId)?.name ?? '—';

  return (
    <div style={s.content}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div>
            <div style={s.compName}>
              {competition.name}
              {isLive && <span style={s.badgeLive}>LIVE</span>}
            </div>
            <div style={s.compMeta}>
              {compTypeName}
              {competition.location && ` · ${competition.location}`}
              {competition.date && ` · ${competition.date}`}
            </div>
          </div>

          <div style={s.actions}>
            {!isLive && !isDone && (
              <>
                <button style={s.btnIcon(false)} title="Bewerken" onClick={onEdit}>
                  <Edit2 size={15} />
                </button>
                <button style={s.btnIcon(true)} title="Verwijderen" onClick={handleDelete}>
                  <Trash2 size={15} />
                </button>
              </>
            )}

            {isLive ? (
              <>
                <button
                  style={{ ...s.btnSecondary, color: '#ef4444', borderColor: '#fca5a5' }}
                  onClick={() => stopCompetitionLive(competition.id)}
                >
                  <Ghost size={15} /> Stop live
                </button>
                <button
                  style={s.btnPrimary('#ef4444')}
                  onClick={() => endCompetition(competition.id)}
                >
                  <Square size={14} /> Beëindig
                </button>
              </>
            ) : isDone ? (
              <button style={{ ...s.btnPrimary('#94a3b8'), cursor: 'default' }} disabled>
                <Check size={14} /> Voltooid
              </button>
            ) : (
              <button style={s.btnPrimary('#10b981')} onClick={handleStart}>
                <Play size={14} /> Start wedstrijd
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Events panel ── */}
      <div style={s.eventsPanel}>
        <div style={s.eventsPanelLabel}>Onderdelen</div>
        <div style={s.eventsScroll}>
          {sortedEvents.map((ev, idx) => {
            const count = participantCountByEvent[ev.id] ?? 0;
            return (
              <div key={ev.id} style={s.eventCard(count > 0)}>
                <div style={s.orderBtns}>
                  <button
                    style={s.orderBtn(idx === 0)}
                    disabled={idx === 0}
                    onClick={() => handleMoveEvent(ev.id, 'left')}
                  >
                    <ChevronLeft size={11} />
                  </button>
                  <button
                    style={s.orderBtn(idx === sortedEvents.length - 1)}
                    disabled={idx === sortedEvents.length - 1}
                    onClick={() => handleMoveEvent(ev.id, 'right')}
                  >
                    <ChevronRight size={11} />
                  </button>
                </div>
                <div style={s.eventCardName}>{idx + 1}. {ev.name}</div>
                <div style={s.eventCardMeta}>
                  {ev.scoringType === 'freestyle' ? 'Freestyle' : 'Speed'}
                </div>
                <div style={s.eventCardFooter}>
                  <span style={s.eventCount}>{count} skippers</span>
                  <button
                    style={s.uploadBtn}
                    title="Importeer CSV"
                    onClick={() => onImport(ev.id)}
                  >
                    <Upload size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Deelnemerslijst ── */}
      <div style={s.participantsPanel}>
        <div style={s.filterBar}>
          <div style={s.filterBtns}>
            {[
              { key: 'alle',          label: 'Alle',          icon: <Users size={13} />,     color: '#2563eb' },
              { key: 'niet-aangemeld',label: 'Niet aangemeld',icon: <UserPlus size={13} />,   color: '#f59e0b' },
              { key: 'aangemeld',     label: 'Aangemeld',     icon: <UserCheck size={13} />,  color: '#10b981' },
              { key: 'geschrapt',     label: 'Geschrapt',     icon: <UserX size={13} />,      color: '#ef4444' },
            ].map(f => (
              <button
                key={f.key}
                style={s.filterBtn(filterStatus === f.key, f.color)}
                onClick={() => setFilterStatus(f.key)}
              >
                {f.icon} {f.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
              {filteredParticipants.length} skippers
            </span>
          </div>

          <div style={s.searchBar}>
            <Search size={15} color="#94a3b8" />
            <input
              style={s.searchInput}
              placeholder="Zoek op naam of club…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>SKIPPER</th>
                <th style={s.th}>CLUB</th>
                <th style={s.th}>ONDERDELEN</th>
                <th style={{ ...s.th, textAlign: 'right' }}>ACTIES</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map(p => {
                const fullyScratched = isFullyScratched(p);
                const club = getClub(p.clubId);

                return (
                  <tr
                    key={p.id}
                    style={{
                      opacity: fullyScratched ? 0.5 : 1,
                      borderLeft: p.isPresent ? '3px solid #10b981' : '3px solid transparent',
                    }}
                  >
                    <td style={s.td}>
                      <span style={{
                        fontWeight: 700,
                        textDecoration: fullyScratched ? 'line-through' : 'none',
                      }}>
                        {p.name}
                      </span>
                    </td>

                    <td style={{ ...s.td, color: '#64748b' }}>
                      {club?.name ?? '—'}
                    </td>

                    <td style={s.td}>
                      {sortedEvents
                        .filter(ev => p.entries.some(e => e.eventId === ev.id))
                        .map(ev => {
                          const scratched = isScratchedFromEvent(p, ev.id);
                          return (
                            <span key={ev.id} style={s.eventBadge(scratched)}>
                              {ev.name.charAt(0)}
                            </span>
                          );
                        })}
                    </td>

                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {/* Aanwezigheid */}
                      <button
                        style={s.actionBtn(p.isPresent ? '#10b981' : '#cbd5e1')}
                        title={p.isPresent ? 'Aangemeld' : 'Niet aangemeld'}
                        onClick={() => setPresence(competition.id, p.id, !p.isPresent)}
                      >
                        <CheckCircle size={17} />
                      </button>

                      {/* Bewerken */}
                      <button
                        style={{ ...s.actionBtn('#2563eb'), marginLeft: '6px' }}
                        title="Bewerken"
                        onClick={() => onEditParticipant(p)}
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Schrappen / herstellen */}
                      <button
                        style={{ ...s.actionBtn(fullyScratched ? '#10b981' : '#ef4444'), marginLeft: '6px' }}
                        title={fullyScratched ? 'Herstellen' : 'Schrappen'}
                        onClick={() => scratchFromAll(competition.id, p, !fullyScratched)}
                      >
                        {fullyScratched ? <RotateCcw size={15} /> : <UserMinus size={15} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
