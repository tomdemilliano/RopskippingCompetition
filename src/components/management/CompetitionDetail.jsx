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
  Search, RotateCcw, UserMinus, Upload, ChevronUp, ChevronDown,
  Plus, ListTodo, Flag, Trophy, Megaphone, Repeat, X, Info,
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { color, radius, shadow } from '../../theme';
import { computeReopenCascade } from '../../blockCascade';
import { resolveBlockEntries } from '../../blockParticipants';
import { BLOCK_ICON_OPTIONS, resolveBlockIconKey, getBlockIcon } from '../../blockIcons';
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

  // "Algemeen"-tab: wedstrijdgegevens + onderdelen, compact naast elkaar
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

  // Wedstrijdgegevens panel
  infoPanel: {
    flex: '1 1 280px',
    minWidth: '260px',
    maxWidth: '380px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.35rem 0',
    fontSize: '0.82rem',
    borderBottom: `1px solid ${color.borderSoft}`,
  },
  infoLabel: {
    color: color.faint,
    fontWeight: 700,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  infoValue: {
    color: color.inkSoft,
    fontWeight: 600,
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Events panel — compacte verticale lijst
  eventsPanel: {
    flex: '1 1 280px',
    minWidth: '260px',
    maxWidth: '420px',
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
    flexDirection: 'column',
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

  // Programma (blocks) — volle breedte, lange dagtijdlijnen hebben de ruimte nodig
  // "Programma"-tab: dagtijdlijn links, reeksen/deelnemers van het
  // geselecteerde blok rechts — beide over de volle hoogte van het scherm
  // (geen tabScroll: dit is net als de Deelnemers-tab een volle-hoogte
  // layout, geen lange-pagina-scroll).
  programmaSplit: {
    flex: 1,
    display: 'flex',
    gap: '1.25rem',
    padding: '1.1rem 1.5rem',
    overflow: 'hidden',
    minHeight: 0,
  },
  programmaLeftPanel: {
    flex: '0 0 380px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  programmaRightPanel: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  blockRow: (done, selected, clickable) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.55rem',
    borderRadius: radius.sm,
    background: done ? color.surface : '#fff',
    border: `1px solid ${selected ? color.primary : color.borderSoft}`,
    marginBottom: '4px',
    fontSize: '0.76rem',
    opacity: done ? 0.55 : 1,
    cursor: clickable ? 'pointer' : 'default',
  }),
  blockEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.55rem',
    borderRadius: radius.sm,
    border: `1px solid ${color.primaryBorder}`,
    background: color.primarySoft,
    marginBottom: '4px',
  },
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
    flex: 1,
    overflowY: 'auto',
    paddingRight: '2px',
  },
  addBlockForm: {
    display: 'flex',
    gap: '0.35rem',
    marginTop: '0.6rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexShrink: 0,
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

  // Reeksdeelnemers — rechterpaneel van de Programma-tab, toont de reeksen
  // en deelnemers van het in de dagtijdlijn geselecteerde blok
  reeksPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.6rem',
    flexShrink: 0,
  },
  panelCloseBtn: {
    background: 'none',
    border: 'none',
    color: color.faint,
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  reeksScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '2px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  reeksEmptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    color: color.faint,
    fontSize: '0.85rem',
    textAlign: 'center',
    padding: '2rem',
  },
  reeksGroup: {
    border: `1px solid ${color.borderSoft}`,
    borderRadius: radius.sm,
    padding: '0.4rem 0.5rem',
    background: color.surface,
  },
  reeksGroupHeader: {
    fontSize: '0.66rem',
    fontWeight: 800,
    color: color.faint,
    marginBottom: '0.3rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  reeksParticipantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.15rem 0',
    fontSize: '0.76rem',
  },
  reeksFieldNr: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 700,
    color: color.faint,
    minWidth: '1.3rem',
    fontSize: '0.7rem',
  },
  reeksParticipantName: {
    fontWeight: 700,
    color: color.inkSoft,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reeksEmptyLabel: {
    fontStyle: 'italic',
    color: color.faintest,
    flex: '1 1 auto',
  },
  reeksClubName: {
    color: color.muted,
    fontSize: '0.7rem',
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '110px',
  },
  // Freestyle: alle info van één reeks op dezelfde rij — compacter dan het
  // gestapelde speed/endurance-overzicht, zodat meer reeksen op het scherm
  // passen (freestyle heeft doorgaans maar 1-2 deelnemers per reeks).
  reeksRowCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.3rem 0.6rem',
    border: `1px solid ${color.borderSoft}`,
    borderRadius: radius.sm,
    background: color.surface,
    fontSize: '0.76rem',
    flexWrap: 'wrap',
  },
  reeksRowLabel: {
    fontSize: '0.66rem',
    fontWeight: 800,
    color: color.faint,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flexShrink: 0,
    minWidth: '82px',
  },
  reeksCompactEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    paddingLeft: '0.5rem',
    borderLeft: `1px solid ${color.borderSoft}`,
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
 * @param {function} props.onEditParticipant — cb(participant, eventId?) opent EditParticipantModal;
 *   eventId optioneel om meteen de reskip-picker van dat onderdeel te openen
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
    updateBlock,
    deleteBlock,
    unfinishSeries,
  } = useAppContext();

  // 'algemeen' (wedstrijdgegevens + onderdelen) | 'programma' (dagtijdlijn +
  // reeksdeelnemers, volle hoogte) | 'deelnemers' (volle hoogte)
  const [detailTab, setDetailTab] = useState('algemeen');

  const [filterStatus, setFilterStatus] = useState('alle');
  const [searchTerm,   setSearchTerm]   = useState('');

  const [newBlockType,    setNewBlockType]    = useState('pauze');
  const [newBlockEventId, setNewBlockEventId] = useState('');
  const [newBlockLabel,   setNewBlockLabel]   = useState('');
  const [newBlockTime,    setNewBlockTime]    = useState('');
  const [newBlockIcon,    setNewBlockIcon]    = useState('');

  // Welk heats-blok in Programma aangeklikt is — toont zijn reeksen/
  // deelnemers in een paneel ernaast.
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  // Welk blok in Programma bewerkt wordt (benaming + starttijd), en zijn
  // lokale formuliervelden.
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editBlockLabel, setEditBlockLabel] = useState('');
  const [editBlockTime,  setEditBlockTime]  = useState('');
  const [editBlockIcon,  setEditBlockIcon]  = useState('');

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

  const selectedBlock = sortedBlocks.find(b => b.id === selectedBlockId) ?? null;
  const blockEntries = useMemo(
    () => resolveBlockEntries(selectedBlock, sortedBlocks, participants, events),
    [selectedBlock, sortedBlocks, participants, events]
  );
  const isFreestyleSelected = events.find(e => e.id === selectedBlock?.eventId)?.scoringType === 'freestyle';

  // Blok markeren als afgewerkt: gewoon de status wijzigen, geen cascade
  // nodig. Heropenen zet dit blok en alles wat chronologisch erna al
  // afgewerkt was terug open (elk bloktype), en reset de finishedSeries van
  // elk onderdeel waarvan een heats-blok in dat bereik valt — inclusief het
  // geklikte blok zelf als het er een is. Bevat het blok geen reeksen (geen
  // heats-blok in het heropende bereik), dan verandert enkel de status.
  const handleToggleBlock = async (block) => {
    const done = block.status === 'afgewerkt';
    if (!done) {
      await setBlockStatus(competition.id, block.id, 'afgewerkt');
      return;
    }

    const ok = window.confirm(
      'Dit blok heropenen?\n\n' +
      'Alle reeksen van dit blok, en alle latere blokken/reeksen die al klaar waren, worden ook teruggezet.'
    );
    if (!ok) return;

    // Alle meegesleepte onderdelen in ÉÉN unfinishSeries-aanroep resetten,
    // niet los na elkaar — anders zou elke losse aanroep zijn eigen
    // momentopname van finishedSeries als basis nemen en de wijziging van de
    // vorige aanroep overschrijven (zie AppContext.jsx#unfinishSeries).
    const { blocksToReopen, eventIdsToReset } = computeReopenCascade(sortedBlocks, block.order);
    const resets = eventIdsToReset.map(eventId => ({ eventId, seriesNr: 1 }));
    await Promise.all([
      ...blocksToReopen.map(b => setBlockStatus(competition.id, b.id, 'gepland')),
      ...(resets.length > 0 ? [unfinishSeries(competition.id, resets)] : []),
    ]);
  };

  const handleAddBlock = async () => {
    if (newBlockType === 'heats' && !newBlockEventId) return;
    const maxOrder = sortedBlocks.reduce((m, b) => Math.max(m, b.order), 0);
    await createBlock(competition.id, {
      type:          newBlockType,
      eventId:       newBlockType === 'heats' ? newBlockEventId : '',
      label:         newBlockType === 'heats' ? '' : newBlockLabel,
      scheduledTime: newBlockTime,
      order:         maxOrder + 1,
      icon:          newBlockIcon,
    });
    setNewBlockEventId('');
    setNewBlockLabel('');
    setNewBlockTime('');
    setNewBlockIcon('');
  };

  const startEditBlock = (block) => {
    setEditingBlockId(block.id);
    setEditBlockLabel(block.label ?? '');
    setEditBlockTime(block.scheduledTime ?? '');
    setEditBlockIcon(block.icon ?? '');
  };

  const cancelEditBlock = () => setEditingBlockId(null);

  const handleSaveBlockEdit = async (block) => {
    const data = { scheduledTime: editBlockTime, icon: editBlockIcon };
    if (block.type !== 'heats') data.label = editBlockLabel.trim();
    await updateBlock(competition.id, block.id, data);
    setEditingBlockId(null);
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

  // Aantal deelnemers per status — los van de zoek-/filterkeuze, zodat de
  // filterknoppen altijd de volledige stand van zaken tonen (live, want
  // participants komt uit een Firestore-listener). searchTerm blijft dus
  // bewust buiten deze telling.
  const filterCounts = useMemo(() => {
    const counts = { alle: participants.length, aangemeld: 0, 'niet-aangemeld': 0, geschrapt: 0 };
    for (const p of participants) {
      if (isFullyScratched(p)) counts.geschrapt++;
      else if (p.isPresent) counts.aangemeld++;
      else counts['niet-aangemeld']++;
    }
    return counts;
  }, [participants, isFullyScratched]);

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
        <button style={s.tab(detailTab === 'algemeen')} onClick={() => setDetailTab('algemeen')}>
          <Info size={14} /> Algemeen
        </button>
        <button style={s.tab(detailTab === 'programma')} onClick={() => setDetailTab('programma')}>
          <ListTodo size={14} /> Programma
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
      {detailTab === 'algemeen' && (
      <div style={s.tabScroll}>
      <div style={s.overviewGrid}>

      {/* ── Wedstrijdgegevens panel ── */}
      <div style={{ ...s.panel, ...s.infoPanel }}>
        <div style={s.panelLabel}><Info size={11} /> Wedstrijdgegevens</div>
        <div style={s.infoRow}>
          <span style={s.infoLabel}>Naam</span>
          <span style={s.infoValue} title={competition.name}>{competition.name}</span>
        </div>
        <div style={s.infoRow}>
          <span style={s.infoLabel}>Type</span>
          <span style={s.infoValue} title={compTypeName}>{compTypeName}</span>
        </div>
        <div style={s.infoRow}>
          <span style={s.infoLabel}>Locatie</span>
          <span style={s.infoValue} title={competition.location}>{competition.location || '—'}</span>
        </div>
        <div style={s.infoRow}>
          <span style={s.infoLabel}>Datum</span>
          <span style={s.infoValue}>{competition.date || '—'}</span>
        </div>
        {!isLive && !isDone && (
          <Button
            variant="secondary" size="sm" icon={<Edit2 size={14} />}
            onClick={onEdit}
            style={{ marginTop: '0.75rem' }}
          >
            Bewerken
          </Button>
        )}
      </div>

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
                    <ChevronUp size={11} />
                  </button>
                  <button
                    style={s.orderBtn(idx === sortedEvents.length - 1)}
                    disabled={idx === sortedEvents.length - 1}
                    onClick={() => handleMoveEvent(ev.id, 'right')}
                  >
                    <ChevronDown size={11} />
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

      </div>
      </div>
      )}

      {/* ── Tab: Programma (dagtijdlijn + reeksdeelnemers, volle hoogte) ── */}
      {detailTab === 'programma' && (
      <div style={s.programmaSplit}>

        {/* ── Links: dagtijdlijn ── */}
        <div style={{ ...s.panel, ...s.programmaLeftPanel }}>
          <div style={s.panelLabel}><ListTodo size={11} /> Programma (dagtijdlijn)</div>

          {sortedBlocks.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: color.faint, fontStyle: 'italic', marginBottom: '0.4rem' }}>
              Nog geen blokken — komt automatisch mee bij PDF-import, of hieronder manueel toevoegen.
            </div>
          )}

          <div style={s.blocksScroll}>
            {sortedBlocks.map(b => {
              const done = b.status === 'afgewerkt';
              const clickable = b.type === 'heats';
              const selected = b.id === selectedBlockId;
              const blockEvent = b.type === 'heats' ? events.find(e => e.id === b.eventId) : null;
              const label = b.type === 'heats'
                ? (blockEvent?.name ?? '— onbekend onderdeel —')
                : (b.label || blockTypeLabels[b.type] || b.type);
              const BlockIcon = getBlockIcon(resolveBlockIconKey(b, blockEvent));

              if (b.id === editingBlockId) {
                return (
                  <div key={b.id} style={s.blockEditRow}>
                    {b.type !== 'heats' && (
                      <input
                        style={s.addBlockInput}
                        placeholder="Label"
                        value={editBlockLabel}
                        onChange={e => setEditBlockLabel(e.target.value)}
                        autoFocus
                      />
                    )}
                    <input
                      style={s.addBlockInput}
                      type="time"
                      value={editBlockTime}
                      onChange={e => setEditBlockTime(e.target.value)}
                    />
                    <select
                      style={s.addBlockInput}
                      value={editBlockIcon}
                      onChange={e => setEditBlockIcon(e.target.value)}
                    >
                      <option value="">Icoon: automatisch</option>
                      {BLOCK_ICON_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      style={s.actionBtn(color.success)}
                      title="Opslaan"
                      onClick={() => handleSaveBlockEdit(b)}
                    >
                      <Check size={15} />
                    </button>
                    <button
                      style={s.actionBtn(color.faint)}
                      title="Annuleren"
                      onClick={cancelEditBlock}
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={b.id}
                  style={s.blockRow(done, selected, clickable)}
                  onClick={clickable ? () => setSelectedBlockId(selected ? null : b.id) : undefined}
                >
                  <span style={s.blockOrder}>{b.order}</span>
                  <span style={s.blockTime}>{b.scheduledTime || '--:--'}</span>
                  <BlockIcon size={14} color={color.faint} />
                  <span style={s.blockLabel}>{label}</span>
                  <Badge tone="neutral">{b.type}</Badge>
                  <button
                    style={s.actionBtn(color.primary)}
                    title="Bewerken"
                    onClick={(e) => { e.stopPropagation(); startEditBlock(b); }}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    style={s.actionBtn(done ? color.warning : color.success)}
                    title={done ? 'Heropenen' : 'Markeer afgewerkt'}
                    onClick={(e) => { e.stopPropagation(); handleToggleBlock(b); }}
                  >
                    {done ? <RotateCcw size={15} /> : <Check size={15} />}
                  </button>
                  <button
                    style={s.actionBtn(color.danger)}
                    title="Verwijderen"
                    onClick={(e) => { e.stopPropagation(); deleteBlock(competition.id, b.id); }}
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

            <select
              style={s.addBlockInput}
              value={newBlockIcon}
              onChange={e => setNewBlockIcon(e.target.value)}
            >
              <option value="">Icoon: automatisch</option>
              {BLOCK_ICON_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAddBlock}>
              Blok
            </Button>
          </div>
        </div>

        {/* ── Rechts: reeksen & deelnemers van het geselecteerde blok ── */}
        <div style={{ ...s.panel, ...s.programmaRightPanel }}>
          {selectedBlock ? (
            <>
              <div style={s.reeksPanelHeader}>
                <div style={{ ...s.panelLabel, marginBottom: 0 }}>
                  <Users size={11} /> {events.find(e => e.id === selectedBlock.eventId)?.name ?? '— onbekend onderdeel —'}
                </div>
                <button style={s.panelCloseBtn} title="Sluiten" onClick={() => setSelectedBlockId(null)}>
                  <X size={15} />
                </button>
              </div>

              {blockEntries.seriesNrs.length === 0 && (
                <div style={{ fontSize: '0.78rem', color: color.faint, fontStyle: 'italic' }}>
                  Geen deelnemers gevonden voor dit blok.
                </div>
              )}

              <div style={s.reeksScroll}>
                {blockEntries.seriesNrs.map(nr => {
                  const rows = blockEntries.entriesBySeriesNr.get(nr);
                  const reeksTime = rows.find(p => !p._isEmpty)?._entry.scheduledTime || '--:--';

                  if (isFreestyleSelected) {
                    return (
                      <div key={nr} style={s.reeksRowCompact}>
                        <span style={s.reeksRowLabel}>Reeks {nr} · {reeksTime}</span>
                        {rows.map(p => (
                          <span key={p.id ?? `empty-${nr}-${p._entry.fieldNr}`} style={s.reeksCompactEntry}>
                            <span style={s.reeksFieldNr}>{p._entry.fieldNr}</span>
                            {p._isEmpty ? (
                              <span style={s.reeksEmptyLabel}>— leeg —</span>
                            ) : (
                              <>
                                <span style={s.reeksParticipantName} title={p.name}>{p.name}</span>
                                <span style={s.reeksClubName} title={getClub(p.clubId)?.name}>
                                  {getClub(p.clubId)?.name ?? '—'}
                                </span>
                                <button
                                  style={s.actionBtn(color.primary)}
                                  title="Reskip — verplaats naar een ander tijdslot"
                                  onClick={() => onEditParticipant(p, selectedBlock.eventId)}
                                >
                                  <Repeat size={14} />
                                </button>
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <div key={nr} style={s.reeksGroup}>
                      <div style={s.reeksGroupHeader}>
                        Reeks {nr} · {reeksTime}
                      </div>
                      {rows.map(p => (
                        <div key={p.id ?? `empty-${nr}-${p._entry.fieldNr}`} style={s.reeksParticipantRow}>
                          <span style={s.reeksFieldNr}>{p._entry.fieldNr}</span>
                          {p._isEmpty ? (
                            <span style={s.reeksEmptyLabel}>— leeg —</span>
                          ) : (
                            <>
                              <span style={s.reeksParticipantName} title={p.name}>{p.name}</span>
                              <span style={s.reeksClubName} title={getClub(p.clubId)?.name}>
                                {getClub(p.clubId)?.name ?? '—'}
                              </span>
                              <button
                                style={s.actionBtn(color.primary)}
                                title="Reskip — verplaats naar een ander tijdslot"
                                onClick={() => onEditParticipant(p, selectedBlock.eventId)}
                              >
                                <Repeat size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={s.reeksEmptyState}>
              <ListTodo size={32} color={color.faintest} />
              <div>Selecteer een blok in de dagtijdlijn om de reeksen en deelnemers te bekijken.</div>
            </div>
          )}
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
                {f.icon} {f.label} ({filterCounts[f.key] ?? 0})
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
