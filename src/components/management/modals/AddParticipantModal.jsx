/**
 * AddParticipantModal.jsx — SkipFlow
 *
 * Handmatig een deelnemer aanmaken (bv. een laattijdige inschrijving) —
 * enkel naam en club. Onderdelen worden meteen daarna toegevoegd via
 * EditParticipantModal ("+ Onderdeel toevoegen"), dat de nieuwe deelnemer
 * na aanmaken automatisch opent.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';
import { color } from '../../../theme';

export default function AddParticipantModal({ competitionId, onClose, onCreated }) {
  const { clubs, createParticipant } = useAppContext();

  const [name,   setName]   = useState('');
  const [clubId, setClubId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Naam is verplicht.'); return; }
    setSaving(true);
    try {
      const id = await createParticipant(competitionId, { name: name.trim(), clubId });
      onCreated(id);
    } catch (err) {
      setError(err.message ?? 'Onbekende fout.');
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <div style={s.dialogHeader}>
          <span style={s.dialogTitle}>Nieuwe deelnemer</span>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Naam *</label>
          <input
            style={s.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="bijv. Jan Peeters"
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

          <div style={{ fontSize: '0.78rem', color: color.muted, marginTop: '0.25rem' }}>
            Onderdelen wijs je in het volgende scherm toe.
          </div>

          {error && <div style={s.errorMsg}>{error}</div>}
        </div>

        <div style={s.footer}>
          <button style={s.btnSecondary} onClick={onClose}>Annuleren</button>
          <button style={s.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Aanmaken…' : 'Aanmaken'}
          </button>
        </div>
      </div>
    </div>
  );
}
