/**
 * EditParticipantModal.jsx — RopeScore Pro
 *
 * Bewerken van naam, club en schrapstatus per onderdeel.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';

export default function EditParticipantModal({ competitionId, participant, onClose }) {
  const {
    competitions,
    clubs,
    getSortedEvents,
    isScratchedFromEvent,
    updateParticipant,
    scratchFromEvent,
  } = useAppContext();

  const competition  = competitions.find(c => c.id === competitionId);
  const sortedEvents = getSortedEvents(competition);

  // Lokale kopie van entries voor optimistische UI
  const [localEntries, setLocalEntries] = useState(participant.entries);
  const [name,   setName]   = useState(participant.name);
  const [clubId, setClubId] = useState(participant.clubId);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Events waaraan deze deelnemer meedoet
  const participantEvents = sortedEvents.filter(ev =>
    localEntries.some(e => e.eventId === ev.id)
  );

  const isScratchedLocal = (eventId) =>
    localEntries.find(e => e.eventId === eventId)?.isScratched ?? false;

  const toggleScratch = (eventId) => {
    setLocalEntries(prev => prev.map(e =>
      e.eventId === eventId ? { ...e, isScratched: !e.isScratched } : e
    ));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Naam is verplicht.'); return; }
    setSaving(true);
    try {
      // Naam en club updaten
      await updateParticipant(competitionId, participant.id, {
        name:    name.trim(),
        clubId,
        entries: localEntries,
      });
      onClose();
    } catch (err) {
      setError(err.message ?? 'Onbekende fout.');
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <div style={s.dialogHeader}>
          <span style={s.dialogTitle}>Deelnemer bewerken</span>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Naam *</label>
          <input
            style={s.input}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />

          <label style={s.label}>Club</label>
          <select
            style={s.input}
            value={clubId}
            onChange={e => setClubId(e.target.value)}
          >
            <option value="">— Geen club —</option>
            {[...clubs]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            }
          </select>

          {participantEvents.length > 0 && (
            <>
              <label style={{ ...s.label, marginTop: '0.5rem' }}>
                Onderdelen
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participantEvents.map(ev => {
                  const scratched = isScratchedLocal(ev.id);
                  const entry = localEntries.find(e => e.eventId === ev.id);
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: scratched ? '#fecaca' : '#e2e8f0',
                        background:  scratched ? '#fef2f2' : '#f8fafc',
                      }}
                    >
                      <div>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          textDecoration: scratched ? 'line-through' : 'none',
                          color: scratched ? '#94a3b8' : '#1e293b',
                        }}>
                          {ev.name}
                        </div>
                        {entry && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            Reeks {entry.seriesNr} · Veld {entry.fieldNr} · {entry.scheduledTime || '--:--'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleScratch(ev.id)}
                        style={{
                          ...scratched ? s.btnPrimary : s.btnDanger,
                          padding: '0.3rem 0.75rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        {scratched ? 'Herstellen' : 'Schrappen'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <div style={{ ...s.errorMsg, marginTop: '1rem' }}>{error}</div>}
        </div>

        <div style={s.footer}>
          <button style={s.btnSecondary} onClick={onClose}>Annuleren</button>
          <button style={s.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
