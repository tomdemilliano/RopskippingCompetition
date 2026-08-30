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

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#f8fafc',
  },

  // Wedstrijdkeuze
  pickerWrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '520px',
    margin: '0 auto',
    width: '100%',
  },
  pickerTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: '0.25rem',
  },
  pickerCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1rem 1.2rem',
    cursor: 'pointer',
  },
  pickerName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  pickerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '3px',
  },
  emptyPicker: {
    color: '#94a3b8',
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
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
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
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  compTitle: {
    fontWeight: 800,
    fontSize: '1rem',
    color: '#1e293b',
  },
  counter: {
    background: '#0f9d70',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.4rem 0.9rem',
    borderRadius: '99px',
  },

  // Filterbalk
  filterBar: {
    padding: '0.85rem 1.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flexShrink: 0,
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    background: '#f1f5f9',
    padding: '0.6rem 0.9rem',
    borderRadius: '8px',
    gap: '0.5rem',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '100%',
    fontSize: '0.95rem',
  },
  chipRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  chip: (active) => ({
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#475569',
    border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.3rem 0.75rem',
    borderRadius: '99px',
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
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderLeft: `4px solid ${borderColor}`,
    borderRadius: '10px',
    padding: '0.9rem 1.1rem',
  }),
  rowName: {
    fontWeight: 700,
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  rowClub: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '2px',
  },
  statusPresent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#e7f8f1',
    color: '#0f9d70',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '99px',
  },
  statusAbsent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#fdeceb',
    color: '#dc3545',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '99px',
  },
  meldAanBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryAction: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
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
    border: '1px solid #cbd5e1',
    color: '#64748b',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.3rem 0.6rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  emptyList: {
    color: '#94a3b8',
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
            <div key={comp.id} style={s.pickerCard} onClick={() => setSelectedCompId(comp.id)}>
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
          <Search size={16} color="#94a3b8" />
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
              style={s.row(scratched ? '#dc3545' : participant.isPresent ? '#0f9d70' : 'transparent')}
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
