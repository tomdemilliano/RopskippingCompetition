/**
 * AttendanceView.jsx — SkipFlow
 *
 * Aanwezigheidsregistratie voor de inkomtafel. Kiosk-scherm: grote taps,
 * één druk om aan te melden. Afwezig melden gebeurt hier bewust NIET — de
 * coach meldt afwezigheden aan de wedstrijdleiding, die de deelnemer dan
 * elders (CompetitionDetail.jsx, wedstrijdbeheer) schrapt via
 * `scratchFromAll`. Een deelnemer die zo (volledig) geschrapt wordt,
 * verdwijnt hier meteen uit de lijst (`isFullyScratched`) — deze lijst
 * draait enkel nog om "is deze deelnemer al aangemeld", niet om schrappen.
 *
 * Standaard toont de lijst enkel de nog niet aangemelde deelnemers (de
 * grote filterknoppen bovenaan het scherm wisselen naar "Aangemeld"). Een
 * per ongeluk aangemelde deelnemer kan in die "Aangemeld"-weergave terug op
 * "nog niet aangemeld" gezet worden.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Calendar, ChevronLeft, Check, CheckCircle, UserPlus, RotateCcw,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: color.bg,
  },

  // Wedstrijdkeuze
  pickerWrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '520px',
    margin: '0 auto',
    width: '100%',
  },
  pickerTitle: {
    fontSize: '1.1rem',
    fontWeight: 900,
    color: color.ink,
    marginBottom: '0.5rem',
  },
  pickerCard: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: '1rem 1.2rem',
    cursor: 'pointer',
    transition: 'transform 0.12s ease',
  },
  pickerName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: color.inkSoft,
  },
  pickerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.8rem',
    color: color.muted,
    marginTop: '3px',
  },
  emptyPicker: {
    color: color.faint,
    fontSize: '0.85rem',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '2rem',
  },

  // Header met wedstrijdnaam + teller
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.9rem 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    gap: '1rem',
    flexWrap: 'wrap',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  backIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    flexShrink: 0,
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.muted,
    cursor: 'pointer',
  },
  compTitle: {
    fontWeight: 800,
    fontSize: '1rem',
    color: color.ink,
  },
  counter: {
    background: color.success,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.4rem 0.9rem',
    borderRadius: radius.pill,
  },

  // Lichaam: clubs-zijbalk links, hoofdinhoud rechts
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },

  // Clubs-zijbalk — breed genoeg voor de langste clubnaam ("ROPE SKIPPING
  // OOSTENDE VZW") zonder afkapping (ellipsis).
  sidebar: {
    width: '280px',
    flexShrink: 0,
    borderRight: `1px solid ${color.border}`,
    background: color.surface,
    overflowY: 'auto',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sidebarLabel: {
    fontSize: '0.66rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '0.4rem 0.6rem 0.5rem',
  },
  clubBtn: (active) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    width: '100%',
    textAlign: 'left',
    background: active ? color.primarySoft : 'none',
    color: active ? color.primary : color.body,
    border: 'none',
    borderRadius: radius.sm,
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  }),
  clubBtnNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flex: 1,
    minWidth: 0,
  },
  clubBtnName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  clubBtnCount: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: color.faint,
    flexShrink: 0,
  },

  // Grote filterknoppen bovenaan het scherm — wisselen tussen "nog niet
  // aangemeld" (standaard) en "aangemeld" i.p.v. een losse dropdown/checkbox,
  // consistent met de "kiosk-scherm: grote taps"-opzet van deze view.
  filterBar: {
    display: 'flex',
    gap: '0.6rem',
    padding: '0.9rem 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  },
  filterBtn: (active) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '0.9rem 1rem',
    borderRadius: radius.md,
    border: `2px solid ${active ? color.primary : color.border}`,
    background: active ? color.primarySoft : color.surface,
    color: active ? color.primary : color.body,
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
  }),
  filterBtnCount: (active) => ({
    fontSize: '0.8rem',
    fontWeight: 700,
    color: active ? color.primary : color.faint,
  }),

  // Hoofdinhoud
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  searchBarWrap: {
    padding: '0.85rem 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    background: color.surfaceAlt,
    padding: '0.6rem 0.9rem',
    borderRadius: radius.md,
    gap: '0.5rem',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '100%',
    fontSize: '0.95rem',
    color: color.ink,
  },

  // Lijst
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.9rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  row: (borderColor) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `4px solid ${borderColor}`,
    borderRadius: radius.lg,
    padding: '0.9rem 1.1rem',
    boxShadow: shadow.sm,
  }),
  rowName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: color.inkSoft,
  },
  rowClub: {
    fontSize: '0.8rem',
    color: color.muted,
    marginTop: '2px',
  },
  eventPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '6px',
  },
  eventPill: (scratched) => ({
    fontSize: '0.68rem',
    fontWeight: 700,
    background: scratched ? color.dangerSoft : color.surfaceAlt,
    color: scratched ? color.danger : color.body,
    textDecoration: scratched ? 'line-through' : 'none',
    padding: '2px 8px',
    borderRadius: radius.pill,
    border: `1px solid ${scratched ? color.dangerBorder : color.border}`,
  }),
  statusPresent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: color.successSoft,
    color: color.successDark,
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.5rem 0.9rem',
    borderRadius: radius.pill,
  },
  meldAanBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: color.primary,
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.55rem 1rem',
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  noticeBar: {
    margin: '0.9rem 1.5rem 0',
    padding: '0.75rem 1rem',
    background: color.warningSoft,
    border: `1px solid ${color.warningBorder}`,
    color: color.warning,
    borderRadius: radius.md,
    fontSize: '0.85rem',
    fontWeight: 700,
    textAlign: 'center',
  },
  actionsCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  restoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'none',
    border: `1px solid ${color.border}`,
    color: color.muted,
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.3rem 0.6rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyList: {
    color: color.faint,
    fontSize: '0.85rem',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '2rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AttendanceView() {
  const {
    competitions, participants, loadParticipants, getClub,
    isFullyScratched, isScratchedFromEvent, setPresence,
    getSortedEvents,
  } = useAppContext();

  const [selectedCompId, setSelectedCompId] = useState(null);
  const [searchTerm, setSearchTerm]         = useState('');
  const [clubFilter, setClubFilter]         = useState('alle');
  // Standaard enkel de nog niet aangemelde deelnemers tonen — dat is wat de
  // inkomtafel het meest nodig heeft. "aangemeld" laat toe een per ongeluk
  // aangemelde deelnemer terug te zetten (zie handleUndoCheckIn hieronder).
  const [statusFilter, setStatusFilter]     = useState('niet-aangemeld');

  useEffect(() => {
    loadParticipants(selectedCompId);
  }, [selectedCompId, loadParticipants]);

  // Competities relevant voor aanwezigheid: nog niet beëindigd.
  const selectableCompetitions = useMemo(() =>
    [...competitions]
      .filter(c => c.status !== 'beëindigd')
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
  [competitions]);

  const selectedCompetition = competitions.find(c => c.id === selectedCompId) ?? null;
  const sortedEvents = useMemo(
    () => getSortedEvents(selectedCompetition),
    [selectedCompetition, getSortedEvents]
  );

  // Een volledig geschrapte deelnemer verdwijnt hier meteen uit beeld — deze
  // lijst gaat enkel nog over aanmelden, niet over schrappen (dat gebeurt
  // elders, in het wedstrijdbeheer). Alle verdere afleidingen (clublijst,
  // tellingen, filtering) vertrekken bewust van deze lijst, niet van de
  // ruwe `participants`.
  const activeParticipants = useMemo(
    () => participants.filter(p => !isFullyScratched(p)),
    [participants, isFullyScratched]
  );

  // Clubs die in deze wedstrijd voorkomen, alfabetisch — voor de zijbalk.
  const clubsInCompetition = useMemo(() => {
    const ids = new Set(activeParticipants.map(p => p.clubId).filter(Boolean));
    return [...ids]
      .map(id => getClub(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeParticipants, getClub]);

  // Aantal deelnemers per club (totaal + al aangemeld), voor het telletje en
  // het "volledig aangemeld"-vinkje naast elke clubnaam.
  const clubStats = useMemo(() => {
    const stats = {};
    for (const p of activeParticipants) {
      if (!p.clubId) continue;
      const entry = stats[p.clubId] ?? (stats[p.clubId] = { total: 0, present: 0 });
      entry.total += 1;
      if (p.isPresent) entry.present += 1;
    }
    return stats;
  }, [activeParticipants]);

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const wantPresent = statusFilter === 'aangemeld';
    return activeParticipants
      .filter(p => {
        if (p.isPresent !== wantPresent) return false;
        if (clubFilter !== 'alle' && p.clubId !== clubFilter) return false;
        if (!term) return true;
        return p.name.toLowerCase().includes(term) ||
          (getClub(p.clubId)?.name ?? '').toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeParticipants, searchTerm, clubFilter, statusFilter, getClub]);

  const presentCount = activeParticipants.filter(p => p.isPresent).length;
  const notPresentCount = activeParticipants.length - presentCount;

  const handleUndoCheckIn = (participant) => {
    setPresence(selectedCompId, participant.id, false);
  };

  // ── Wedstrijdkeuze ────────────────────────────────────────────────────────
  if (!selectedCompetition) {
    return (
      <div style={s.wrapper}>
        <div style={s.pickerWrap}>
          <div style={s.pickerTitle}>Kies een wedstrijd</div>
          {selectableCompetitions.length === 0 && (
            <div style={s.emptyPicker}>Geen wedstrijden om aanwezigheid voor te registreren.</div>
          )}
          {selectableCompetitions.map(comp => (
            <div
              key={comp.id}
              style={s.pickerCard}
              onClick={() => setSelectedCompId(comp.id)}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              <div style={s.pickerName}>{comp.name}</div>
              <div style={s.pickerMeta}>
                <Calendar size={13} />
                {comp.date || 'Geen datum'}
                {comp.location && ` · ${comp.location}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Aanwezigheidslijst ──────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>
      <div style={s.topBar}>
        <div style={s.titleRow}>
          <button style={s.backIconBtn} onClick={() => setSelectedCompId(null)} title="Andere wedstrijd">
            <ChevronLeft size={18} />
          </button>
          <div style={s.compTitle}>{selectedCompetition.name}</div>
        </div>
        <div style={s.counter}>{presentCount} / {activeParticipants.length} aangemeld</div>
      </div>

      <div style={s.filterBar}>
        <button
          style={s.filterBtn(statusFilter === 'niet-aangemeld')}
          onClick={() => setStatusFilter('niet-aangemeld')}
        >
          Nog niet aangemeld
          <span style={s.filterBtnCount(statusFilter === 'niet-aangemeld')}>{notPresentCount}</span>
        </button>
        <button
          style={s.filterBtn(statusFilter === 'aangemeld')}
          onClick={() => setStatusFilter('aangemeld')}
        >
          Aangemeld
          <span style={s.filterBtnCount(statusFilter === 'aangemeld')}>{presentCount}</span>
        </button>
      </div>

      <div style={s.body}>
        {clubsInCompetition.length > 1 && (
          <div style={s.sidebar}>
            <div style={s.sidebarLabel}>Clubs</div>
            <button style={s.clubBtn(clubFilter === 'alle')} onClick={() => setClubFilter('alle')}>
              <span style={s.clubBtnNameWrap}>
                {activeParticipants.length > 0 && presentCount === activeParticipants.length && (
                  <CheckCircle size={13} color={color.success} />
                )}
                <span style={s.clubBtnName}>Alle clubs</span>
              </span>
              <span style={s.clubBtnCount}>{presentCount}/{activeParticipants.length}</span>
            </button>
            {clubsInCompetition.map(club => {
              const stat = clubStats[club.id] ?? { total: 0, present: 0 };
              const allPresent = stat.total > 0 && stat.present === stat.total;
              return (
                <button
                  key={club.id}
                  style={s.clubBtn(clubFilter === club.id)}
                  onClick={() => setClubFilter(club.id)}
                >
                  <span style={s.clubBtnNameWrap}>
                    {allPresent && <CheckCircle size={13} color={color.success} />}
                    <span style={s.clubBtnName} title={club.name}>{club.name}</span>
                  </span>
                  <span style={s.clubBtnCount}>{stat.present}/{stat.total}</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={s.main}>
          <div style={s.searchBarWrap}>
            <div style={s.searchBar}>
              <Search size={16} color={color.faint} />
              <input
                style={s.searchInput}
                placeholder="Zoek op naam of club…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={s.noticeBar}>
            Afwezigheden moeten door de coach gemeld worden aan de wedstrijdleiding.
          </div>

          <div style={s.list}>
            {filteredParticipants.length === 0 && (
              <div style={s.emptyList}>Geen deelnemers gevonden.</div>
            )}

            {filteredParticipants.map(participant => {
              const club = getClub(participant.clubId);

              return (
                <div
                  key={participant.id}
                  style={s.row(participant.isPresent ? color.success : 'transparent')}
                >
                  <div>
                    <div style={s.rowName}>{participant.name}</div>
                    <div style={s.rowClub}>{club?.name ?? '—'}</div>
                    <div style={s.eventPills}>
                      {sortedEvents
                        .filter(ev => participant.entries.some(e => e.eventId === ev.id))
                        .map(ev => (
                          <span key={ev.id} style={s.eventPill(isScratchedFromEvent(participant, ev.id))}>
                            {ev.name}
                          </span>
                        ))}
                    </div>
                  </div>

                  {participant.isPresent ? (
                    <div style={s.actionsCol}>
                      <div style={s.statusPresent}><Check size={14} /> Aangemeld</div>
                      <button style={s.restoreBtn} onClick={() => handleUndoCheckIn(participant)}>
                        <RotateCcw size={12} /> Zet terug op niet aangemeld
                      </button>
                    </div>
                  ) : (
                    <div style={s.actionsCol}>
                      <button
                        style={s.meldAanBtn}
                        onClick={() => setPresence(selectedCompId, participant.id, true)}
                      >
                        <UserPlus size={15} /> Meld aan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
