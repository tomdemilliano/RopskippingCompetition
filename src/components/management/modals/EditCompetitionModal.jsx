/**
 * EditCompetitionModal.jsx — RopeScore Pro
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';

export default function EditCompetitionModal({ competitionId, onClose }) {
  const { competitions, competitionTypes, updateCompetition } = useAppContext();
  const competition = competitions.find(c => c.id === competitionId);

  const [form, setForm] = useState({
    name:     competition?.name     ?? '',
    date:     competition?.date     ?? '',
    location: competition?.location ?? '',
    typeId:   competition?.typeId   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Naam is verplicht.'); return; }
    setSaving(true);
    try {
      await updateCompetition(competitionId, form);
      onClose();
    } catch (err) {
      setError(err.message ?? 'Onbekende fout.');
      setSaving(false);
    }
  };

  if (!competition) return null;

  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <div style={s.dialogHeader}>
          <span style={s.dialogTitle}>Wedstrijd bewerken</span>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Naam *</label>
          <input
            style={s.input}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
          />

          <label style={s.label}>Type</label>
          <select
            style={s.input}
            value={form.typeId}
            onChange={e => set('typeId', e.target.value)}
          >
            {competitionTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Datum</label>
              <input
                type="date"
                style={s.input}
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Locatie</label>
              <input
                style={s.input}
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </div>
          </div>

          {error && <div style={s.errorMsg}>{error}</div>}
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
