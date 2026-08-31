/**
 * EditParticipantModal.jsx — SkipFlow
 *
 * Bewerken van naam, club en schrapstatus per onderdeel.
 * Laat ook toe om de deelnemer aan een NIEUW onderdeel toe te voegen, of een
 * bestaande reeks-plaats te verplaatsen ("reskip" — een deelnemer die een
 * herkansing krijgt) naar een bestaand leeg tijdslot of een nieuwe reeks
 * achteraan het onderdeel. Dit is de enige plek waar zulke correcties
 * gebeuren — Aanwezigheidsregistratie toont onderdelen enkel read-only.
 */

import React, { useMemo, useState } from 'react';
import { X, Check, Repeat, Plus } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';
import { color } from '../../../theme';
import { computeEventSlots } from '../../../eventSlots';

// ─────────────────────────────────────────────────────────────────────────────
// SLOT-PICKER — gedeeld tussen "onderdeel toevoegen" en "reskip"
// ─────────────────────────────────────────────────────────────────────────────

const ps = {
  panel: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    borderRadius: '6px',
    border: `1px solid ${color.primaryBorder}`,
    background: color.primarySoft,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: color.body,
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  smallSelect: {
    border: `1px solid ${color.faintest}`,
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    fontSize: '0.78rem',
    color: color.ink,
  },
  smallInput: {
    border: `1px solid ${color.faintest}`,
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    fontSize: '0.78rem',
    color: color.ink,
    width: '90px',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
};

/**
 * @param {Object} props
 * @param {{id:string,name:string,scoringType:string}} props.event
 * @param {Array} props.participants   alle deelnemers van de wedstrijd
 * @param {string} [props.excludeParticipantId]
 * @param {function} props.onConfirm   cb({ seriesNr, fieldNr, scheduledTime })
 * @param {function} props.onCancel
 */
function SlotPicker({ event, participants, excludeParticipantId, onConfirm, onCancel }) {
  const slots = useMemo(
    () => computeEventSlots(event.id, participants, event, excludeParticipantId),
    [event, participants, excludeParticipantId]
  );

  const hasExisting = slots.existingReeksen.length > 0;
  const [mode, setMode] = useState(hasExisting ? 'existing' : 'new');
  const [seriesNr, setSeriesNr] = useState(slots.existingReeksen[0]?.seriesNr ?? slots.nextSeriesNr);
  const [fieldNr, setFieldNr] = useState(
    slots.existingReeksen[0]?.emptyFieldNrs[0] ?? (event.scoringType === 'freestyle' ? 'A' : 1)
  );
  const [scheduledTime, setScheduledTime] = useState(slots.suggestedTime);

  const currentReeks = slots.existingReeksen.find(r => r.seriesNr === seriesNr);

  const handleReeksChange = (nr) => {
    const reeks = slots.existingReeksen.find(r => r.seriesNr === Number(nr));
    setSeriesNr(Number(nr));
    setFieldNr(reeks?.emptyFieldNrs[0] ?? 1);
  };

  const handleConfirm = () => {
    if (mode === 'existing') {
      onConfirm({ seriesNr, fieldNr, scheduledTime: currentReeks?.scheduledTime ?? scheduledTime });
    } else {
      onConfirm({ seriesNr: slots.nextSeriesNr, fieldNr, scheduledTime });
    }
  };

  return (
    <div style={ps.panel}>
      {hasExisting && (
        <label style={ps.radioLabel}>
          <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} />
          Bestaand leeg tijdslot
        </label>
      )}
      {mode === 'existing' && hasExisting && (
        <div style={ps.row}>
          <select style={ps.smallSelect} value={seriesNr} onChange={e => handleReeksChange(e.target.value)}>
            {slots.existingReeksen.map(r => (
              <option key={r.seriesNr} value={r.seriesNr}>
                Reeks {r.seriesNr} · {r.scheduledTime || '--:--'}
              </option>
            ))}
          </select>
          <select style={ps.smallSelect} value={fieldNr} onChange={e => setFieldNr(Number(e.target.value))}>
            {currentReeks?.emptyFieldNrs.map(f => (
              <option key={f} value={f}>Veld {f}</option>
            ))}
          </select>
        </div>
      )}

      <label style={ps.radioLabel}>
        <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />
        Nieuwe reeks aan het einde toevoegen (reeks {slots.nextSeriesNr})
      </label>
      {mode === 'new' && (
        <div style={ps.row}>
          {event.scoringType === 'freestyle' ? (
            <select style={ps.smallSelect} value={fieldNr} onChange={e => setFieldNr(e.target.value)}>
              <option value="A">Veld A</option>
              <option value="B">Veld B</option>
            </select>
          ) : (
            <input
              style={ps.smallInput}
              type="number"
              min={1}
              value={fieldNr}
              onChange={e => setFieldNr(Number(e.target.value))}
              placeholder="Veld"
            />
          )}
          <input
            style={ps.smallInput}
            type="time"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
          />
        </div>
      )}

      <div style={ps.actions}>
        <button
          style={{ ...s.btnPrimary, padding: '0.35rem 0.9rem', fontSize: '0.78rem' }}
          onClick={handleConfirm}
        >
          <Check size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Bevestigen
        </button>
        <button
          style={{ ...s.btnSecondary, padding: '0.35rem 0.9rem', fontSize: '0.78rem' }}
          onClick={onCancel}
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function EditParticipantModal({ competitionId, participant, onClose }) {
  const {
    competitions,
    clubs,
    participants,
    getSortedEvents,
    updateParticipant,
  } = useAppContext();

  const competition  = competitions.find(c => c.id === competitionId);
  const sortedEvents = getSortedEvents(competition);

  // Lokale kopie van entries voor optimistische UI
  const [localEntries, setLocalEntries] = useState(participant.entries);
  const [name,   setName]   = useState(participant.name);
  const [clubId, setClubId] = useState(participant.clubId);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // 'add:<eventId>' of 'reskip:<eventId>' — welk slot-picker paneel open staat
  const [activePicker, setActivePicker] = useState(null);

  // Events waaraan deze deelnemer meedoet
  const participantEvents = sortedEvents.filter(ev =>
    localEntries.some(e => e.eventId === ev.id)
  );
  const availableEvents = sortedEvents.filter(ev =>
    !localEntries.some(e => e.eventId === ev.id)
  );

  const isScratchedLocal = (eventId) =>
    localEntries.find(e => e.eventId === eventId)?.isScratched ?? false;

  const toggleScratch = (eventId) => {
    setLocalEntries(prev => prev.map(e =>
      e.eventId === eventId ? { ...e, isScratched: !e.isScratched } : e
    ));
  };

  // Deelnemerslijst voor de slot-picker: de lokale, nog-op-te-slaan wijzigingen
  // van déze deelnemer moeten meetellen bij het bepalen van bezette velden.
  const participantsForSlots = useMemo(
    () => participants.map(p => (p.id === participant.id ? { ...p, entries: localEntries } : p)),
    [participants, participant.id, localEntries]
  );

  const handleAddEvent = (eventId, slot) => {
    setLocalEntries(prev => [
      ...prev,
      {
        eventId,
        seriesNr:      slot.seriesNr,
        fieldNr:       slot.fieldNr,
        scheduledTime: slot.scheduledTime,
        isScratched:   false,
        categoryLabel: '',
      },
    ]);
    setActivePicker(null);
  };

  const handleReskip = (eventId, slot) => {
    setLocalEntries(prev => prev.map(e =>
      e.eventId === eventId
        ? { ...e, seriesNr: slot.seriesNr, fieldNr: slot.fieldNr, scheduledTime: slot.scheduledTime, isScratched: false }
        : e
    ));
    setActivePicker(null);
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
                  const pickerKey = `reskip:${ev.id}`;
                  return (
                    <div key={ev.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: scratched ? color.dangerBorder : color.border,
                          background:  scratched ? color.dangerSoft : color.surfaceAlt,
                        }}
                      >
                        <div>
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            textDecoration: scratched ? 'line-through' : 'none',
                            color: scratched ? color.faint : color.inkSoft,
                          }}>
                            {ev.name}
                          </div>
                          {entry && (
                            <div style={{ fontSize: '0.7rem', color: color.faint, marginTop: '2px' }}>
                              Reeks {entry.seriesNr} · Veld {entry.fieldNr} · {entry.scheduledTime || '--:--'}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!scratched && (
                            <button
                              onClick={() => setActivePicker(activePicker === pickerKey ? null : pickerKey)}
                              title="Verplaats naar een ander tijdslot (herkansing)"
                              style={{ ...s.btnSecondary, padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Repeat size={13} /> Reskip
                            </button>
                          )}
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
                      </div>
                      {activePicker === pickerKey && (
                        <SlotPicker
                          event={ev}
                          participants={participantsForSlots}
                          excludeParticipantId={participant.id}
                          onConfirm={slot => handleReskip(ev.id, slot)}
                          onCancel={() => setActivePicker(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {availableEvents.length > 0 && (
            <>
              <label style={{ ...s.label, marginTop: '1rem' }}>
                Onderdeel toevoegen
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableEvents.map(ev => {
                  const pickerKey = `add:${ev.id}`;
                  return (
                    <div key={ev.id}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', borderRadius: '6px',
                        border: `1px dashed ${color.faintest}`,
                      }}>
                        <span style={{ fontSize: '0.85rem', color: color.body }}>{ev.name}</span>
                        <button
                          onClick={() => setActivePicker(activePicker === pickerKey ? null : pickerKey)}
                          style={{ ...s.btnSecondary, padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={13} /> Toevoegen
                        </button>
                      </div>
                      {activePicker === pickerKey && (
                        <SlotPicker
                          event={ev}
                          participants={participantsForSlots}
                          onConfirm={slot => handleAddEvent(ev.id, slot)}
                          onCancel={() => setActivePicker(null)}
                        />
                      )}
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
