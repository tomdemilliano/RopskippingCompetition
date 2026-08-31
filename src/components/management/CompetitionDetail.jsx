/**
 * CompetitionDetail.jsx — SkipFlow
 *
 * Rechterkolom van de beheer-view.
 * Toont de geselecteerde wedstrijd met:
 *   - Header: naam, type, status, actieknoppen
 *   - EventsPanel: onderdelen met upload-knop per event
 *   - Programma: dagtijdlijn (blocks)
 *   - ParticipantsList: gefilterde deelnemerslijst met aanwezigheid en schrappen
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit2, Trash2, Play, Square, Ghost, Check,
  CheckCircle, Users, UserPlus, UserCheck, UserX,
  Search, RotateCcw, UserMinus, Upload, ChevronLeft, ChevronRight,
  Plus, ListTodo, Flag, Trophy, Megaphone,
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { color, radius, shadow } from '../../theme';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import PodiumManager from '../PodiumManager';
import MessageManager from '../MessageManager';

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
    color: color.faint,
    fontSize: '0.9rem',
  },
  header: {
    padding: '0.85rem 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.6rem',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  compName: {
    fontSize: '1.05rem',
    fontWeight: 900,
    color: color.inkSoft,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  compMeta: {
    fontSize: '0.78rem',
    color: color.muted,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Interne tabs (Wedstrijd / Deelnemers)
  tabsBar: {
    display: 'flex',
    padding: '0 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    gap: '0.25rem',
  },
  tab: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.65rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: active ? color.primary : color.muted,
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? color.primary : 'transparent'}`,
    cursor: 'pointer',
    marginBottom: '-1px',
  }),
  tabScroll: {
    flex: 1,
    overflowY: 'auto',
  },
  iconBtn: (danger) => ({
    background: color.surface,
    color: danger ? color.danger : color.body,
    border: `1px solid ${danger ? color.dangerBorder : color.faintest}`,
    padding: '0.45rem',
    borderRadius: radius.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  }),

  // "Wedstrijd"-tab: onderdelen (compact) links, programma (smaller, capped
  // breedte) rechts — geen van beide moet vechten om ruimte met de
  // deelnemerslijst, die zit voortaan op haar eigen tab.
  overviewGrid: {
    display: 'flex',
    gap: '1.25rem',
    alignItems: 'flex-start',
    padding: '1.1rem 1.5rem',
    flexWrap: 'wrap',
  },
  panel: {
    background: color.surfaceAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: '0.85rem 1rem',
  },
  panelLabel: {
    fontSize: '0.66rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.6rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  // Events panel — compacte verticale lijst i.p.v. brede kaarten
  eventsPanel: {
    flex: '1 1 280px',
    minWidth: '260px',
    maxWidth: '360px',
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '260px',
    overflowY: 'auto',
    paddingRight: '2px',
  },
  eventRow: (hasParticipants) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.55rem',
    background: color.surface,
    borderRadius: radius.sm,
    border: `1px solid ${color.borderSoft}`,
    borderLeft: `3px solid ${hasParticipants ? color.success : color.warning}`,
    fontSize: '0.78rem',
  }),
  eventRowName: {
    flex: 1,
    fontWeight: 700,
    color: color.inkSoft,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventCount: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: color.faint,
    flexShrink: 0,
  },
  uploadBtn: {
    background: 'none',
    color: color.primary,
    border: 'none',
    padding: '3px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  orderBtns: {
    display: 'flex',
    flexShrink: 0,
  },
  orderBtn: (disabled) => ({
    background: 'none',
    border: 'none',
    padding: '1px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
    alignItems: 'center',
    color: color.faint,
  }),

  // Programma (blocks) — smalle kolom, geen volle breedte
  programmaPanel: {
    flex: '1 1 340px',
    minWidth: '300px',
    maxWidth: '460px',
  },
  blockRow: (done) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.55rem',
    borderRadius: radius.sm,
    background: done ? color.surface : '#fff',
    border: `1px solid ${color.borderSoft}`,
    marginBottom: '4px',
    fontSize: '0.76rem',
    opacity: done ? 0.55 : 1,
  }),
  blockOrder: {
    fontFamily: "'IBM Plex Mono', monospace",
    color: color.faint,
    minWidth: '1.1rem',
    textAlign: 'right',
    fontSize: '0.72rem',
  },
  blockTime: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700,
    color: color.body,
    minWidth: '2.7rem',
    fontSize: '0.72rem',
  },
  blockLabel: {
    flex: 1,
    fontWeight: 700,
    color: color.inkSoft,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  blocksScroll: {
    maxHeight: '260px',
    overflowY: 'auto',
    paddingRight: '2px',
  },
  addBlockForm: {
    display: 'flex',
    gap: '0.35rem',
    marginTop: '0.6rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  addBlockInput: {
    border: `1px solid ${color.faintest}`,
    borderRadius: radius.sm,
    padding: '0.35rem 0.5rem',
    fontSize: '0.75rem',
    background: color.surface,
    minWidth: 0,
    flex: '1 1 90px',
  },

  // Participants list
  participantsPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: color.surface,
  },
  filterBar: {
    padding: '0.9rem 1.75rem',
    borderBottom: `1px solid ${color.borderSoft}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
    flexShrink: 0,
  },
  filterBtns: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: (active, c) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0.35rem 0.75rem',
    borderRadius: radius.pill,
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: `1px solid ${active ? c : color.border}`,
    background: active ? `${c}15` : color.surface,
    color: active ? c : color.muted,
    transition: 'all 0.12s',
  }),
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    background: color.surfaceAlt,
    padding: '0.55rem 0.85rem',
    borderRadius: radius.sm,
    gap: '0.5rem',
    maxWidth: '360px',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '100%',
    fontSize: '0.85rem',
    color: color.inkSoft,
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
    padding: '0.7rem 1.75rem',
    textAlign: 'left',
    color: color.faint,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    position: 'sticky',
    top: 0,
    background: color.surface,
    borderBottom: `1px solid ${color.borderSoft}`,
    zIndex: 1,
  },
  td: {
    padding: '0.7rem 1.75rem',
    borderBottom: `1px solid ${color.borderSoft}`,
  },
  actionBtn: (c) => ({
    border: 'none',
    background: 'none',
    color: c ?? color.faint,
    cursor: 'pointer',
    padding: '3px',
    display: 'inline-flex',
    alignItems: 'center',
  }),
  eventBadge: (scratched) => ({
    display: 'inline-block',
    fontSize: '0.62rem',
    fontWeight: 700,
    background: scratched ? color.dangerSoft : color.borderSoft,
    color: scratched ? color.danger : color.body,
    textDecoration: scratched ? 'line-through' : 'none',
    padding: '2px 6px',
    borderRadius: '4px',
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
 * @param {function} props.onImportPdf     — opent PdfImportModal (volledig wedstrijdschema)
 * @param {function} props.onEditParticipant — cb(participant) opent EditParticipantModal
 * @param {function} props.onAddParticipant — opent AddParticipantModal
 */
export default function CompetitionDetail({
  competitionId,
  onEdit,
  onImport,
  onImportPdf,
  onEditParticipant,
  onAddParticipant,
}) {
  const {
    competitions,
    competitionTypes,
    events,
    participants,
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
    scratchFromAll,
    blocks,
    loadBlocks,
    blockTypeLabels,
    createBlock,
    setBlockStatus,
    deleteBlock,
  } = useAppContext();

  // 'wedstrijd' (onderdelen + programma) | 'deelnemers' (volle hoogte)
  const [detailTab, setDetailTab] = useState('wedstrijd');

  const [filterStatus, setFilterStatus] = useState('alle');
  const [searchTerm,   setSearchTerm]   = useState('');

  const [newBlockType,    setNewBlockType]    = useState('pauze');
  const [newBlockEventId, setNewBlockEventId] = useState('');
  const [newBlockLabel,   setNewBlockLabel]   = useState('');
  const [newBlockTime,    setNewBlockTime]    = useState('');

  const competition = competitions.find(c => c.id === competitionId) ?? null;

  // Laad deelnemers en programma (blocks) bij selectie
  useEffect(() => {
    if (competitionId) {
      loadParticipants(competitionId);
      loadBlocks(competitionId);
    }
  }, [competitionId, loadParticipants, loadBlocks]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks]
  );

  const handleAddBlock = async () => {
    if (newBlockType === 'heats' && !newBlockEventId) return;
    const maxOrder = sortedBlocks.reduce((m, b) => Math.max(m, b.order), 0);
    await createBlock(competition.id, {
      type:          newBlockType,
      eventId:       newBlockType === 'heats' ? newBlockEventId : '',
      label:         newBlockType === 'heats' ? '' : newBlockLabel,
      scheduledTime: newBlockTime,
      order:         maxOrder + 1,
    });
    setNewBlockEventId('');
    setNewBlockLabel('');
    setNewBlockTime('');
  };

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

  const FILTERS = [
    { key: 'alle',           label: 'Alle',           icon: <Users size={13} />,     c: color.primary },
    { key: 'niet-aangemeld', label: 'Niet aangemeld', icon: <UserPlus size={13} />,  c: color.warning },
    { key: 'aangemeld',      label: 'Aangemeld',      icon: <UserCheck size={13} />, c: color.success },
    { key: 'geschrapt',      label: 'Geschrapt',      icon: <UserX size={13} />,     c: color.danger },
  ];

  return (
    <div style={s.content}>
      {/* ── Header (compact) ── */}
      <div style={s.header}>
        <div>
          <div style={s.headerTop}>
            <div style={s.compName}>
              {competition.name}
              {isLive && <Badge tone="solidDanger">LIVE</Badge>}
            </div>
            <div style={s.compMeta}>
              {compTypeName}
              {competition.location && ` · ${competition.location}`}
              {competition.date && ` · ${competition.date}`}
            </div>
          </div>
        </div>

        <div style={s.actions}>
          {!isLive && !isDone && (
            <>
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={onImportPdf}>
                Wedstrijdschema (PDF)
              </Button>
              <button style={s.iconBtn(false)} title="Bewerken" onClick={onEdit}>
                <Edit2 size={15} />
              </button>
              <button style={s.iconBtn(true)} title="Verwijderen" onClick={handleDelete}>
                <Trash2 size={15} />
              </button>
            </>
          )}

          {isLive ? (
            <>
              <Button variant="outlineDanger" size="sm" icon={<Ghost size={15} />} onClick={() => stopCompetitionLive(competition.id)}>
                Stop live
              </Button>
              <Button variant="danger" size="sm" icon={<Square size={14} />} onClick={() => endCompetition(competition.id)}>
                Beëindig
              </Button>
            </>
          ) : isDone ? (
            <Button variant="ghost" size="sm" icon={<Check size={14} />} disabled>
              Voltooid
            </Button>
          ) : (
            <Button variant="success" size="sm" icon={<Play size={14} />} onClick={handleStart}>
              Start wedstrijd
            </Button>
          )}
        </div>
      </div>

      {/* ── Interne tabs ── */}
      <div style={s.tabsBar}>
        <button style={s.tab(detailTab === 'wedstrijd')} onClick={() => setDetailTab('wedstrijd')}>
          <ListTodo size={14} /> Wedstrijd
        </button>
        <button style={s.tab(detailTab === 'deelnemers')} onClick={() => setDetailTab('deelnemers')}>
          <Users size={14} /> Deelnemers
          <Badge tone="neutral">{participants.length}</Badge>
        </button>
        <button style={s.tab(detailTab === 'podium')} onClick={() => setDetailTab('podium')}>
          <Trophy size={14} /> Podium
        </button>
        <button style={s.tab(detailTab === 'boodschap')} onClick={() => setDetailTab('boodschap')}>
          <Megaphone size={14} /> Boodschap
        </button>
      </div>

      {/* ── Tab: Wedstrijd (onderdelen + programma) ── */}
      {detailTab === 'wedstrijd' && (
      <div style={s.tabScroll}>
      <div style={s.overviewGrid}>

      {/* ── Events panel ── */}
      <div style={{ ...s.panel, ...s.eventsPanel }}>
        <div style={s.panelLabel}><Flag size={11} /> Onderdelen</div>
        <div style={s.eventsList}>
          {sortedEvents.map((ev, idx) => {
            const count = participantCountByEvent[ev.id] ?? 0;
            return (
              <div key={ev.id} style={s.eventRow(count > 0)}>
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
                <span style={s.eventRowName} title={ev.name}>{idx + 1}. {ev.name}</span>
                <span style={s.eventCount}>{count}</span>
                <button
                  style={s.uploadBtn}
                  title="Importeer CSV"
                  onClick={() => onImport(ev.id)}
                >
                  <Upload size={13} />
                </button>
              </div>
            );
          })}
          {sortedEvents.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: color.faint, fontStyle: 'italic' }}>
              Nog geen onderdelen voor dit wedstrijdtype.
            </div>
          )}
        </div>
      </div>

      {/* ── Programma (dagtijdlijn) ── */}
      <div style={{ ...s.panel, ...s.programmaPanel }}>
        <div style={s.panelLabel}><ListTodo size={11} /> Programma (dagtijdlijn)</div>

        {sortedBlocks.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: color.faint, fontStyle: 'italic', marginBottom: '0.4rem' }}>
            Nog geen blokken — komt automatisch mee bij PDF-import, of hieronder manueel toevoegen.
          </div>
        )}

        <div style={s.blocksScroll}>
          {sortedBlocks.map(b => {
            const done = b.status === 'afgewerkt';
            const label = b.type === 'heats'
              ? (events.find(e => e.id === b.eventId)?.name ?? '— onbekend onderdeel —')
              : (b.label || blockTypeLabels[b.type] || b.type);
            return (
              <div key={b.id} style={s.blockRow(done)}>
                <span style={s.blockOrder}>{b.order}</span>
                <span style={s.blockTime}>{b.scheduledTime || '--:--'}</span>
                <span style={s.blockLabel}>{label}</span>
                <Badge tone="neutral">{b.type}</Badge>
                <button
                  style={s.actionBtn(done ? color.warning : color.success)}
                  title={done ? 'Heropenen' : 'Markeer afgewerkt'}
                  onClick={() => setBlockStatus(competition.id, b.id, done ? 'gepland' : 'afgewerkt')}
                >
                  {done ? <RotateCcw size={15} /> : <Check size={15} />}
                </button>
                <button
                  style={s.actionBtn(color.danger)}
                  title="Verwijderen"
                  onClick={() => deleteBlock(competition.id, b.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={s.addBlockForm}>
          <select
            style={s.addBlockInput}
            value={newBlockType}
            onChange={e => setNewBlockType(e.target.value)}
          >
            <option value="heats">Onderdeel (reeksen)</option>
            {Object.entries(blockTypeLabels).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>

          {newBlockType === 'heats' ? (
            <select
              style={s.addBlockInput}
              value={newBlockEventId}
              onChange={e => setNewBlockEventId(e.target.value)}
            >
              <option value="">Kies onderdeel…</option>
              {sortedEvents.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          ) : (
            <input
              style={s.addBlockInput}
              placeholder="Label (optioneel)"
              value={newBlockLabel}
              onChange={e => setNewBlockLabel(e.target.value)}
            />
          )}

          <input
            style={s.addBlockInput}
            type="time"
            value={newBlockTime}
            onChange={e => setNewBlockTime(e.target.value)}
          />

          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAddBlock}>
            Blok
          </Button>
        </div>
      </div>

      </div>
      </div>
      )}

      {/* ── Tab: Deelnemers (volle hoogte) ── */}
      {detailTab === 'deelnemers' && (
      <div style={s.participantsPanel}>
        <div style={s.filterBar}>
          <div style={s.filterBtns}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                style={s.filterBtn(filterStatus === f.key, f.c)}
                onClick={() => setFilterStatus(f.key)}
              >
                {f.icon} {f.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: color.body, fontWeight: 700 }}>
              {filteredParticipants.length} skippers
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={s.searchBar}>
              <Search size={15} color={color.faint} />
              <input
                style={s.searchInput}
                placeholder="Zoek op naam of club…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="secondary" size="sm" icon={<UserPlus size={14} />} onClick={onAddParticipant}>
              Nieuwe deelnemer
            </Button>
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
                      borderLeft: `3px solid ${p.isPresent ? color.success : 'transparent'}`,
                    }}
                  >
                    <td style={s.td}>
                      <span style={{
                        fontWeight: 700,
                        color: color.inkSoft,
                        textDecoration: fullyScratched ? 'line-through' : 'none',
                      }}>
                        {p.name}
                      </span>
                    </td>

                    <td style={{ ...s.td, color: color.muted }}>
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
                        style={s.actionBtn(p.isPresent ? color.success : color.faintest)}
                        title={p.isPresent ? 'Aangemeld' : 'Niet aangemeld'}
                        onClick={() => setPresence(competition.id, p.id, !p.isPresent)}
                      >
                        <CheckCircle size={17} />
                      </button>

                      {/* Bewerken */}
                      <button
                        style={{ ...s.actionBtn(color.primary), marginLeft: '6px' }}
                        title="Bewerken"
                        onClick={() => onEditParticipant(p)}
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Schrappen / herstellen */}
                      <button
                        style={{ ...s.actionBtn(fullyScratched ? color.success : color.danger), marginLeft: '6px' }}
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
      )}

      {/* ── Tab: Podium (podia + laureaten) ── */}
      {detailTab === 'podium' && (
      <div style={s.tabScroll}>
        <PodiumManager competitionId={competition.id} />
      </div>
      )}

      {/* ── Tab: Boodschap (groot scherm) ── */}
      {detailTab === 'boodschap' && (
      <div style={s.tabScroll}>
        <MessageManager competitionId={competition.id} />
      </div>
      )}
    </div>
  );
}
