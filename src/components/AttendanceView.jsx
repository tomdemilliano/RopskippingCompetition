/**
 * AttendanceView.jsx — SkipFlow
 *
 * Aanwezigheidsregistratie voor de inkomtafel. Kiosk-scherm: grote taps,
 * één druk om aan te melden. Afwezig melden schrapt de deelnemer uit alle
 * onderdelen (scratchFromAll — timings blijven ongemoeid, CLAUDE.md) en is
 * daarom een bewuste, bevestigde stap i.p.v. een gewone toggle.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Calendar, ChevronLeft, Check, UserPlus, UserX, RotateCcw,
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
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: color.primary,
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
    marginBottom: '2px',
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

  // Filterbalk
  filterBar: {
    padding: '0.85rem 1.5rem',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
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
  chipRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  chip: (active) => ({
    background: active ? color.primary : color.surface,
    color: active ? '#fff' : color.body,
    border: `1px solid ${active ? color.primary : color.border}`,
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.3rem 0.75rem',
    borderRadius: radius.pill,
    cursor: 'pointer',
  }),

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
  statusAbsent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: color.dangerSoft,
    color: color.danger,
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
  secondaryAction: {
    background: 'none',
    border: 'none',
    color: color.faint,
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
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
    isFullyScratched, setPresence, scratchFromAll,
  } = useAppContext();

  const [selectedCompId, setSelectedCompId] = useState(null);
  const [searchTerm, setSearchTerm]         = useState('');
  const [clubFilter, setClubFilter]         = useState('alle');

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

  // Clubs die in deze wedstrijd voorkomen, voor de filterchips.
  const clubsInCompetition = useMemo(() => {
    const ids = new Set(participants.map(p => p.clubId).filter(Boolean));
    return [...ids]
      .map(id => getClub(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, getClub]);

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return participants
      .filter(p => {
        if (clubFilter !== 'alle' && p.clubId !== clubFilter) return false;
        if (!term) return true;
        return p.name.toLowerCase().includes(term) ||
          (getClub(p.clubId)?.name ?? '').toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, searchTerm, clubFilter, getClub]);

  const presentCount = participants.filter(p => p.isPresent && !isFullyScratched(p)).length;

  const handleMarkAbsent = (participant) => {
    const ok = window.confirm(
      `${participant.name} afwezig melden?\n\nDit schrapt de deelnemer uit alle onderdelen. De tijdschema's blijven ongewijzigd.`
    );
    if (!ok) return;
    scratchFromAll(selectedCompId, participant, true);
    if (participant.isPresent) setPresence(selectedCompId, participant.id, false);
  };

  const handleRestore = (participant) => {
    scratchFromAll(selectedCompId, participant, false);
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
        <div>
          <button style={s.backBtn} onClick={() => setSelectedCompId(null)}>
            <ChevronLeft size={15} /> Andere wedstrijd
          </button>
          <div style={s.compTitle}>{selectedCompetition.name}</div>
        </div>
        <div style={s.counter}>{presentCount} / {participants.length} aangemeld</div>
      </div>

      <div style={s.filterBar}>
        <div style={s.searchBar}>
          <Search size={16} color={color.faint} />
          <input
            style={s.searchInput}
            placeholder="Zoek op naam of club…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {clubsInCompetition.length > 1 && (
          <div style={s.chipRow}>
            <button style={s.chip(clubFilter === 'alle')} onClick={() => setClubFilter('alle')}>
              Alle clubs
            </button>
            {clubsInCompetition.map(club => (
              <button
                key={club.id}
                style={s.chip(clubFilter === club.id)}
                onClick={() => setClubFilter(club.id)}
              >
                {club.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={s.list}>
        {filteredParticipants.length === 0 && (
          <div style={s.emptyList}>Geen deelnemers gevonden.</div>
        )}

        {filteredParticipants.map(participant => {
          const scratched = isFullyScratched(participant);
          const club = getClub(participant.clubId);

          return (
            <div
              key={participant.id}
              style={s.row(scratched ? color.danger : participant.isPresent ? color.success : 'transparent')}
            >
              <div>
                <div style={s.rowName}>{participant.name}</div>
                <div style={s.rowClub}>{club?.name ?? '—'}</div>
              </div>

              {scratched ? (
                <div style={s.actionsCol}>
                  <div style={s.statusAbsent}><UserX size={14} /> Afwezig — geschrapt</div>
                  <button style={s.restoreBtn} onClick={() => handleRestore(participant)}>
                    <RotateCcw size={12} /> Herstellen
                  </button>
                </div>
              ) : participant.isPresent ? (
                <div style={s.actionsCol}>
                  <div style={s.statusPresent}><Check size={14} /> Aangemeld</div>
                  <button style={s.secondaryAction} onClick={() => handleMarkAbsent(participant)}>
                    Afwezig melden
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
                  <button style={s.secondaryAction} onClick={() => handleMarkAbsent(participant)}>
                    Afwezig melden
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
