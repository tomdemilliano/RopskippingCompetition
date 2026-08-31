/**
 * PodiumManager.jsx — SkipFlow
 *
 * Gedeeld podiumbeheer: aanmaken/hernoemen/verwijderen van podia per
 * onderdeel, laureaten toewijzen per plaats, en de ceremonie-volgorde
 * bepalen (globaal over de hele wedstrijd, niet per onderdeel).
 *
 * Hergebruikt op twee plekken (CLAUDE.md — state via AppContext, geen
 * directe Firestore-toegang):
 *   - CompetitionDetail (tab "Podium")  — wedstrijdbeheerder
 *   - LiveView (tab "Podium")           — speaker
 *
 * Leeftijdscategorie/geslacht/provincie worden bewust NIET als apart veld
 * aangeboden — de naam van het podium is vrije tekst, de gebruiker zorgt
 * zelf voor een correcte benaming (zie CLAUDE.md-overleg met de gebruiker).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius } from '../theme';
import Button from './ui/Button';
import Badge from './ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const PLACE_COLOR = { 1: '#ca8a04', 2: '#64748b', 3: '#b45309' };

const s = {
  wrap: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  addRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    background: color.surfaceAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: '0.75rem 1rem',
  },
  addInput: {
    border: `1px solid ${color.faintest}`,
    borderRadius: radius.sm,
    padding: '0.45rem 0.65rem',
    fontSize: '0.82rem',
    flex: '1 1 200px',
    minWidth: 0,
    background: color.surface,
  },
  empty: {
    textAlign: 'center',
    color: color.faint,
    fontSize: '0.85rem',
    padding: '2rem',
    fontStyle: 'italic',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.7rem 1rem',
  },
  orderBtns: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  orderBtn: (disabled) => ({
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.25 : 1,
    color: color.faint,
    display: 'flex',
  }),
  cardMain: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  cardName: {
    fontWeight: 800,
    fontSize: '0.92rem',
    color: color.inkSoft,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    fontSize: '0.72rem',
    color: color.faint,
  },
  iconBtn: (danger) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: danger ? color.danger : color.faint,
    padding: '4px',
    display: 'flex',
    flexShrink: 0,
  }),
  renameInput: {
    border: `1px solid ${color.primaryBorder}`,
    borderRadius: radius.sm,
    padding: '0.3rem 0.5rem',
    fontSize: '0.85rem',
    fontWeight: 700,
    width: '100%',
    boxSizing: 'border-box',
  },
  body: {
    padding: '0 1rem 1rem',
    borderTop: `1px solid ${color.borderSoft}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.25rem',
  },
  placeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  placeLabel: (placeNr) => ({
    fontSize: '0.7rem',
    fontWeight: 900,
    color: PLACE_COLOR[placeNr],
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginTop: '0.6rem',
  }),
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: color.surfaceAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding: '0.25rem 0.65rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: color.inkSoft,
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: color.faint,
    display: 'flex',
  },
  placeSelect: {
    border: `1px solid ${color.faintest}`,
    borderRadius: radius.sm,
    padding: '0.3rem 0.5rem',
    fontSize: '0.78rem',
    color: color.body,
    background: color.surface,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/** @param {{ competitionId: string }} props */
export default function PodiumManager({ competitionId }) {
  const {
    competitions, participants, getSortedEvents, getClub,
    podiums, loadPodiums,
    createPodium, updatePodium, deletePodium,
  } = useAppContext();

  const competition = competitions.find(c => c.id === competitionId) ?? null;
  const sortedEvents = useMemo(() => getSortedEvents(competition), [competition, getSortedEvents]);

  useEffect(() => {
    loadPodiums(competitionId ?? null);
  }, [competitionId, loadPodiums]);

  const [newEventId, setNewEventId] = useState('');
  const [newName,    setNewName]    = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState('');

  const eventName = (eventId) =>
    sortedEvents.find(ev => ev.id === eventId)?.name ?? '— onbekend onderdeel —';

  const eventParticipants = (eventId) =>
    participants.filter(p => p.entries.some(e => e.eventId === eventId && !e.isScratched));

  const handleCreate = async () => {
    if (!newEventId || !newName.trim()) return;
    const maxOrder = podiums.reduce((m, p) => Math.max(m, p.order), 0);
    await createPodium(competitionId, {
      eventId: newEventId,
      name:    newName.trim(),
      order:   maxOrder + 1,
      places:  [],
    });
    setNewName('');
  };

  const handleMove = async (podiumId, direction) => {
    const idx = podiums.findIndex(p => p.id === podiumId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= podiums.length) return;
    const a = podiums[idx];
    const b = podiums[swapIdx];
    await Promise.all([
      updatePodium(competitionId, a.id, { order: b.order }),
      updatePodium(competitionId, b.id, { order: a.order }),
    ]);
  };

  const handleDelete = async (podium) => {
    if (!window.confirm(`Podium "${podium.name}" verwijderen?`)) return;
    await deletePodium(competitionId, podium.id);
  };

  const startRename = (podium) => {
    setEditingId(podium.id);
    setEditName(podium.name);
  };

  const saveRename = async (podium) => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== podium.name) {
      await updatePodium(competitionId, podium.id, { name: trimmed });
    }
    setEditingId(null);
  };

  const handleAddLaureate = (podium, place, participantId) => {
    if (!participantId) return;
    const newPlaces = podium.places.map(pl =>
      pl.place === place ? { ...pl, participantIds: [...pl.participantIds, participantId] } : pl
    );
    updatePodium(competitionId, podium.id, { places: newPlaces });
  };

  const handleRemoveLaureate = (podium, place, participantId) => {
    const newPlaces = podium.places.map(pl =>
      pl.place === place ? { ...pl, participantIds: pl.participantIds.filter(id => id !== participantId) } : pl
    );
    updatePodium(competitionId, podium.id, { places: newPlaces });
  };

  return (
    <div style={s.wrap}>
      {/* ── Nieuw podium ── */}
      <div style={s.addRow}>
        <select style={s.addInput} value={newEventId} onChange={e => setNewEventId(e.target.value)}>
          <option value="">Kies onderdeel…</option>
          {sortedEvents.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <input
          style={s.addInput}
          placeholder="Naam podium (bv. Meisjes U12, Jongens, Prov. Antwerpen…)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <Button
          variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={handleCreate}
          disabled={!newEventId || !newName.trim()}
        >
          Podium
        </Button>
      </div>

      {/* ── Podiumlijst ── */}
      {podiums.length === 0 ? (
        <div style={s.empty}>Nog geen podia aangemaakt voor deze wedstrijd.</div>
      ) : (
        <div style={s.list}>
          {podiums.map((podium, idx) => {
            const expanded = expandedId === podium.id;
            const filledCount = podium.places.filter(pl => pl.participantIds.length > 0).length;
            const evParticipants = eventParticipants(podium.eventId);
            const usedIds = new Set(podium.places.flatMap(pl => pl.participantIds));

            return (
              <div key={podium.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.orderBtns}>
                    <button
                      style={s.orderBtn(idx === 0)}
                      disabled={idx === 0}
                      title="Naar boven"
                      onClick={() => handleMove(podium.id, 'up')}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      style={s.orderBtn(idx === podiums.length - 1)}
                      disabled={idx === podiums.length - 1}
                      title="Naar beneden"
                      onClick={() => handleMove(podium.id, 'down')}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <Trophy size={18} color={color.warning} style={{ flexShrink: 0 }} />

                  <div style={s.cardMain} onClick={() => setExpandedId(expanded ? null : podium.id)}>
                    {editingId === podium.id ? (
                      <input
                        autoFocus
                        style={s.renameInput}
                        value={editName}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveRename(podium);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <div style={s.cardName} title={podium.name}>{podium.name}</div>
                    )}
                    <div style={s.cardMeta}>{eventName(podium.eventId)}</div>
                  </div>

                  <Badge tone={filledCount === 3 ? 'success' : 'neutral'}>{filledCount}/3</Badge>

                  {editingId === podium.id ? (
                    <>
                      <button style={s.iconBtn(false)} title="Opslaan" onClick={() => saveRename(podium)}>
                        <Check size={15} />
                      </button>
                      <button style={s.iconBtn(false)} title="Annuleren" onClick={() => setEditingId(null)}>
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <button style={s.iconBtn(false)} title="Hernoemen" onClick={() => startRename(podium)}>
                      <Pencil size={14} />
                    </button>
                  )}
                  <button style={s.iconBtn(true)} title="Verwijderen" onClick={() => handleDelete(podium)}>
                    <Trash2 size={15} />
                  </button>
                  <button
                    style={s.iconBtn(false)}
                    title={expanded ? 'Inklappen' : 'Uitklappen'}
                    onClick={() => setExpandedId(expanded ? null : podium.id)}
                  >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {expanded && (
                  <div style={s.body}>
                    {[1, 2, 3].map(placeNr => {
                      const place = podium.places.find(pl => pl.place === placeNr);
                      const options = evParticipants.filter(p => !usedIds.has(p.id));
                      return (
                        <div key={placeNr} style={s.placeBlock}>
                          <div style={s.placeLabel(placeNr)}>{placeNr}e plaats</div>
                          <div style={s.chipsRow}>
                            {place.participantIds.map(pid => {
                              const p = participants.find(pp => pp.id === pid);
                              return (
                                <span key={pid} style={s.chip}>
                                  {p?.name ?? '— verwijderde deelnemer —'}
                                  <button
                                    style={s.chipRemove}
                                    title="Verwijderen"
                                    onClick={() => handleRemoveLaureate(podium, placeNr, pid)}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              );
                            })}
                            <select
                              style={s.placeSelect}
                              value=""
                              onChange={e => handleAddLaureate(podium, placeNr, e.target.value)}
                            >
                              <option value="">+ Laureaat toevoegen…</option>
                              {options.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}{p.clubId ? ` (${getClub(p.clubId)?.name ?? ''})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
