/**
 * CompetitionsOverview.jsx — SkipFlow
 *
 * Startpagina van de beheer-view.
 * Toont alle wedstrijden gesorteerd op datum (oplopend),
 * met naam, datum, locatie, type, onderdelen en deelnemersstatus.
 *
 * Acties: wedstrijd toevoegen, bewerken, verwijderen.
 * Klikken op een kaart navigeert naar CompetitionDetail.
 */

import React, { useMemo } from 'react';
import {
  Plus, Calendar, MapPin, Trophy, ChevronRight,
  Trash2, Edit2, Radio, Flag,
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { color, radius, shadow } from '../../theme';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  page: {
    flex: 1,
    overflowY: 'auto',
    background: color.bg,
    padding: '2rem 1.75rem',
  },
  inner: {
    maxWidth: '1080px',
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 900,
    color: color.ink,
    margin: 0,
  },
  subheading: {
    fontSize: '0.85rem',
    color: color.faint,
    marginTop: '2px',
  },

  // Sectie
  section: {
    marginBottom: '2rem',
  },
  sectionLabel: {
    fontSize: '0.68rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sectionDot: (c) => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: c,
    flexShrink: 0,
  }),

  // Kaarten grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '1rem',
  },

  // Wedstrijdkaart
  card: (isLive, isDone) => ({
    background: color.surface,
    borderRadius: radius.lg,
    border: `1px solid ${isLive ? color.dangerBorder : color.border}`,
    cursor: 'pointer',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    overflow: 'hidden',
    opacity: isDone ? 0.75 : 1,
    boxShadow: isLive ? shadow.focus(color.danger) : shadow.sm,
  }),
  cardTop: (isLive) => ({
    padding: '1rem 1.25rem',
    borderBottom: `1px solid ${color.borderSoft}`,
    background: isLive ? color.dangerSoft : 'transparent',
  }),
  cardTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  },
  cardName: (isDone) => ({
    fontWeight: 800,
    fontSize: '1rem',
    color: isDone ? color.muted : color.inkSoft,
    lineHeight: 1.2,
    flex: 1,
  }),
  metaRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: color.muted,
  },

  // Kaart onderkant
  cardBottom: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statChip: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: active ? color.primaryDark : color.muted,
    background: active ? color.primarySoft : color.surfaceAlt,
    padding: '3px 8px',
    borderRadius: '6px',
    border: `1px solid ${active ? color.primaryBorder : color.border}`,
  }),
  cardActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: (danger) => ({
    background: 'none',
    border: '1px solid',
    borderColor: danger ? color.dangerBorder : color.border,
    color: danger ? color.danger : color.faint,
    padding: '5px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  }),

  // Lege staat
  empty: {
    textAlign: 'center',
    padding: '3rem',
    color: color.faint,
    fontSize: '0.875rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {function} props.onSelectCompetition   cb(competitionId)
 * @param {function} props.onNewCompetition
 * @param {function} props.onEditCompetition     cb(competitionId)
 */
export default function CompetitionsOverview({
  onSelectCompetition,
  onNewCompetition,
  onEditCompetition,
}) {
  const {
    competitions,
    competitionTypes,
    deleteCompetition,
  } = useAppContext();

  // Sorteer alle wedstrijden op datum oplopend (geen datum → achteraan)
  const sorted = useMemo(() =>
    [...competitions].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    }),
  [competitions]);

  const live = sorted.filter(c => c.status === 'bezig');
  const open = sorted.filter(c => c.status === 'open');
  const done = sorted.filter(c => c.status === 'beëindigd');

  const getTypeName = (typeId) =>
    competitionTypes.find(t => t.id === typeId)?.name ?? '—';

  const getEventCount = (competition) => {
    const compType = competitionTypes.find(t => t.id === competition.typeId);
    return compType?.eventIds?.length ?? 0;
  };

  const handleDelete = async (e, competition) => {
    e.stopPropagation();
    if (!window.confirm(`Weet je zeker dat je "${competition.name}" wilt verwijderen?`)) return;
    await deleteCompetition(competition.id);
  };

  const handleEdit = (e, competitionId) => {
    e.stopPropagation();
    onEditCompetition(competitionId);
  };

  const renderCard = (comp) => {
    const isLive = comp.status === 'bezig';
    const isDone = comp.status === 'beëindigd';
    const eventCount = getEventCount(comp);
    const typeName = getTypeName(comp.typeId);

    return (
      <div
        key={comp.id}
        style={s.card(isLive, isDone)}
        onClick={() => onSelectCompetition(comp.id)}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
      >
        <div style={s.cardTop(isLive)}>
          <div style={s.cardTitleRow}>
            <div style={s.cardName(isDone)}>{comp.name}</div>
            {isLive && <Badge tone="solidDanger" icon={<Radio size={8} />}>LIVE</Badge>}
            {isDone && <Badge tone="neutral">VOLTOOID</Badge>}
          </div>

          <div style={s.metaRow}>
            {comp.date && (
              <span style={s.metaItem}><Calendar size={12} />{comp.date}</span>
            )}
            {comp.location && (
              <span style={s.metaItem}><MapPin size={12} />{comp.location}</span>
            )}
            <span style={s.metaItem}><Trophy size={12} />{typeName}</span>
          </div>
        </div>

        <div style={s.cardBottom}>
          <span style={s.statChip(eventCount > 0)}>
            <Flag size={11} />
            {eventCount} onderdelen
          </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {!isLive && (
              <div style={s.cardActions} onClick={e => e.stopPropagation()}>
                <button style={s.actionBtn(false)} title="Bewerken" onClick={(e) => handleEdit(e, comp.id)}>
                  <Edit2 size={13} />
                </button>
                <button style={s.actionBtn(true)} title="Verwijderen" onClick={(e) => handleDelete(e, comp)}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}
            <Button variant="secondary" size="sm">
              Openen <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const totalCount = competitions.length;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.topBar}>
          <div>
            <h1 style={s.heading}>Wedstrijden</h1>
            <div style={s.subheading}>
              {totalCount === 0
                ? 'Nog geen wedstrijden aangemaakt'
                : `${totalCount} wedstrijd${totalCount !== 1 ? 'en' : ''} in totaal`}
            </div>
          </div>
          <Button variant="primary" icon={<Plus size={16} />} onClick={onNewCompetition}>
            Nieuwe wedstrijd
          </Button>
        </div>

        {live.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionLabel}><div style={s.sectionDot(color.danger)} />Nu bezig</div>
            <div style={s.grid}>{live.map(renderCard)}</div>
          </div>
        )}

        {open.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionLabel}><div style={s.sectionDot(color.primary)} />Gepland</div>
            <div style={s.grid}>{open.map(renderCard)}</div>
          </div>
        )}

        {done.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionLabel}><div style={s.sectionDot(color.faint)} />Voltooid</div>
            <div style={s.grid}>{done.map(renderCard)}</div>
          </div>
        )}

        {totalCount === 0 && (
          <div style={s.empty}>
            <div style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>🏆</div>
            Nog geen wedstrijden. Klik op "Nieuwe wedstrijd" om te beginnen.
          </div>
        )}
      </div>
    </div>
  );
}
