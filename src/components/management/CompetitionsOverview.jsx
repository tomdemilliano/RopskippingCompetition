/**
 * CompetitionsOverview.jsx — RopeScore Pro
 *
 * Startpagina van de beheer-view.
 * Toont alle wedstrijden gesorteerd op datum (oplopend),
 * met naam, datum, locatie, type, onderdelen en deelnemersstatus.
 *
 * Acties: wedstrijd toevoegen, bewerken, verwijderen.
 * Klikken op een kaart navigeert naar CompetitionDetail.
 */

import React, { useState, useMemo } from 'react';
import {
  Plus, Calendar, MapPin, Trophy, ChevronRight,
  Trash2, Edit2, Users, AlertCircle, CheckCircle2,
  Radio, Flag,
} from 'lucide-react';
import { useAppContext } from '../../AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  page: {
    flex: 1,
    overflowY: 'auto',
    background: '#f1f5f9',
    padding: '2rem',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 900,
    color: '#0f172a',
    margin: 0,
  },
  subheading: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginTop: '2px',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1.25rem',
    fontWeight: 700,
    fontSize: '0.875rem',
    cursor: 'pointer',
  },

  // Sectie
  section: {
    marginBottom: '2rem',
  },
  sectionLabel: {
    fontSize: '0.65rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sectionDot: (color) => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),

  // Kaarten grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '1rem',
  },

  // Wedstrijdkaart
  card: (isLive, isDone, isSelected) => ({
    background: '#fff',
    borderRadius: '12px',
    border: '2px solid',
    borderColor: isLive
      ? '#ef4444'
      : isSelected
        ? '#2563eb'
        : isDone
          ? '#e2e8f0'
          : '#e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.15s',
    overflow: 'hidden',
    opacity: isDone ? 0.75 : 1,
    boxShadow: isLive
      ? '0 0 0 3px rgba(239,68,68,0.15)'
      : '0 1px 3px rgba(0,0,0,0.06)',
  }),
  cardTop: (isLive) => ({
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #f1f5f9',
    background: isLive ? '#fef2f2' : 'transparent',
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
    color: isDone ? '#64748b' : '#1e293b',
    lineHeight: 1.2,
    flex: 1,
  }),
  badges: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
    alignItems: 'center',
  },
  badgeLive: {
    background: '#ef4444',
    color: '#fff',
    fontSize: '0.55rem',
    padding: '3px 7px',
    borderRadius: '4px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  badgeDone: {
    background: '#94a3b8',
    color: '#fff',
    fontSize: '0.55rem',
    padding: '3px 7px',
    borderRadius: '4px',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
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
    color: '#64748b',
  },

  // Kaart onderkant
  cardBottom: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  statChip: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: color ?? '#475569',
    background: color ? `${color}15` : '#f8fafc',
    padding: '3px 8px',
    borderRadius: '6px',
    border: `1px solid ${color ? `${color}30` : '#e2e8f0'}`,
  }),
  cardActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: (danger) => ({
    background: 'none',
    border: '1px solid',
    borderColor: danger ? '#fecaca' : '#e2e8f0',
    color: danger ? '#ef4444' : '#94a3b8',
    padding: '5px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  }),

  // Open wedstrijd knop
  detailBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
  },

  // Lege staat
  empty: {
    textAlign: 'center',
    padding: '3rem',
    color: '#94a3b8',
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
    participants,
    participantsCompId,
    loadParticipants,
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

  const live    = sorted.filter(c => c.status === 'bezig');
  const open    = sorted.filter(c => c.status === 'open');
  const done    = sorted.filter(c => c.status === 'beëindigd');

  // Deelnemerstelling: laad lazy per wedstrijd op hover/click
  // We gebruiken een simpele teller: het aantal participants dat momenteel
  // geladen is via de context voor een wedstrijd. Voor een snelle indicatie
  // tonen we of er al data beschikbaar is.
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
        style={s.card(isLive, isDone, false)}
        onClick={() => onSelectCompetition(comp.id)}
      >
        {/* Bovenste deel */}
        <div style={s.cardTop(isLive)}>
          <div style={s.cardTitleRow}>
            <div style={s.cardName(isDone)}>{comp.name}</div>
            <div style={s.badges}>
              {isLive && (
                <span style={s.badgeLive}>
                  <Radio size={8} /> LIVE
                </span>
              )}
              {isDone && (
                <span style={s.badgeDone}>VOLTOOID</span>
              )}
            </div>
          </div>

          <div style={s.metaRow}>
            {comp.date && (
              <span style={s.metaItem}>
                <Calendar size={12} color="#94a3b8" />
                {comp.date}
              </span>
            )}
            {comp.location && (
              <span style={s.metaItem}>
                <MapPin size={12} color="#94a3b8" />
                {comp.location}
              </span>
            )}
            <span style={s.metaItem}>
              <Trophy size={12} color="#94a3b8" />
              {typeName}
            </span>
          </div>
        </div>

        {/* Onderste deel */}
        <div style={s.cardBottom}>
          <div style={s.statsRow}>
            <span style={s.statChip(eventCount > 0 ? '#2563eb' : '#94a3b8')}>
              <Flag size={11} />
              {eventCount} onderdelen
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Acties — niet tonen voor live wedstrijden */}
            {!isLive && (
              <div style={s.cardActions} onClick={e => e.stopPropagation()}>
                <button
                  style={s.actionBtn(false)}
                  title="Bewerken"
                  onClick={(e) => handleEdit(e, comp.id)}
                >
                  <Edit2 size={13} />
                </button>
                {!isLive && (
                  <button
                    style={s.actionBtn(true)}
                    title="Verwijderen"
                    onClick={(e) => handleDelete(e, comp)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}

            <button style={s.detailBtn}>
              Openen <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const totalCount = competitions.length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.heading}>Wedstrijden</h1>
          <div style={s.subheading}>
            {totalCount === 0
              ? 'Nog geen wedstrijden aangemaakt'
              : `${totalCount} wedstrijd${totalCount !== 1 ? 'en' : ''} in totaal`}
          </div>
        </div>
        <button style={s.newBtn} onClick={onNewCompetition}>
          <Plus size={16} />
          Nieuwe wedstrijd
        </button>
      </div>

      {/* Live */}
      {live.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionLabel}>
            <div style={s.sectionDot('#ef4444')} />
            Nu bezig
          </div>
          <div style={s.grid}>
            {live.map(renderCard)}
          </div>
        </div>
      )}

      {/* Gepland */}
      {open.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionLabel}>
            <div style={s.sectionDot('#2563eb')} />
            Gepland
          </div>
          <div style={s.grid}>
            {open.map(renderCard)}
          </div>
        </div>
      )}

      {/* Voltooid */}
      {done.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionLabel}>
            <div style={s.sectionDot('#94a3b8')} />
            Voltooid
          </div>
          <div style={s.grid}>
            {done.map(renderCard)}
          </div>
        </div>
      )}

      {/* Leeg */}
      {totalCount === 0 && (
        <div style={s.empty}>
          <div style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>🏆</div>
          Nog geen wedstrijden. Klik op "Nieuwe wedstrijd" om te beginnen.
        </div>
      )}
    </div>
  );
}
