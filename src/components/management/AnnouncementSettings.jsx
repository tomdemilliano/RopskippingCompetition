/**
 * AnnouncementSettings.jsx — SkipFlow
 *
 * Globaal (niet per wedstrijd) beheer van de TTS-aankondigingsinstellingen:
 * de voorleesinstructie, de stem, de temperature, en de tekstvariaties
 * (introzinnen per context). Opgeslagen in settings/announcements — zie
 * DEFAULT_ANNOUNCEMENT_SETTINGS in dbSchema.js.
 *
 * Accent en spreeksnelheid hebben geen apart API-veld bij Gemini TTS — die
 * worden via de bewoording van de voorleesinstructie zelf gestuurd (zie
 * "Aankondigingen (TTS)" in ARCHITECTURE.md). Daarom geen apart
 * "snelheid"-veld hier, enkel wat écht een API-parameter is (stem, temperature).
 */

import React, { useState, useEffect } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { color, radius, shadow } from '../../theme';
import Button from '../ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem 1.75rem',
    background: color.bg,
  },
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    maxWidth: '760px',
  },
  cardTitle: {
    fontSize: '0.7rem',
    fontWeight: 900,
    color: color.faint,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: color.muted,
    marginBottom: '0.3rem',
    display: 'block',
  },
  hint: {
    fontSize: '0.72rem',
    color: color.faint,
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${color.border}`,
    borderRadius: '6px',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    color: color.ink,
    marginBottom: '1rem',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${color.border}`,
    borderRadius: '6px',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    color: color.ink,
    marginBottom: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  formActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  statusMsg: {
    fontSize: '0.82rem',
    color: color.successDark,
    marginBottom: '1rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AnnouncementSettings() {
  const { announcementSettings, defaultAnnouncementSettings, updateAnnouncementSettings } = useAppContext();

  const [form, setForm] = useState(announcementSettings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Volgt de live instellingen zolang de beheerder niet actief aan het
  // bewerken is in deze sessie — eenvoudige "laatste keer geopend"-sync,
  // consistent genoeg voor een scherm dat normaal maar door één beheerder
  // tegelijk bewerkt wordt.
  useEffect(() => {
    setForm(announcementSettings);
  }, [announcementSettings]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setVariation = (field, value) => setForm(f => ({
    ...f, textVariations: { ...f.textVariations, [field]: value },
  }));

  const handleSubmit = async () => {
    setBusy(true); setSaved(false);
    try {
      await updateAnnouncementSettings(form);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setForm(defaultAnnouncementSettings);
    setSaved(false);
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.cardTitle}>Voorleesinstructie &amp; stem</div>

        <label style={s.label}>Voorleesinstructie (stijl)</label>
        <div style={s.hint}>
          Stuurt toon, accent en spreeksnelheid van de omroeper — een korte
          stijlomschrijving, geen volledige zin met een werkwoord (bv. "vlot
          en opgewekt, met een Vlaams accent", niet "Spreek vlot en opgewekt
          met een Vlaams accent."). Wordt apart van de voor te lezen tekst
          meegestuurd, komt dus zelf nooit in de audio terecht.
        </div>
        <textarea
          style={s.textarea}
          rows={2}
          value={form.systemInstruction}
          onChange={e => set('systemInstruction', e.target.value)}
        />

        <div style={s.row2}>
          <div>
            <label style={s.label}>Stem (voiceName)</label>
            <input
              style={s.input}
              value={form.voiceName}
              onChange={e => set('voiceName', e.target.value)}
              placeholder="bv. Enceladus"
            />
          </div>
          <div>
            <label style={s.label}>Temperature (0 – 1)</label>
            <input
              type="number" min="0" max="1" step="0.1"
              style={s.input}
              value={form.temperature}
              onChange={e => set('temperature', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div style={{ ...s.hint, marginTop: '-0.75rem' }}>
          Hoger = meer variatie/expressiviteit in de stem, lager = consistenter.
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Tekstvariaties</div>

        <label style={s.label}>Generieke introzinnen (één per regel)</label>
        <textarea
          style={s.textarea}
          rows={5}
          value={form.textVariations.generic.join('\n')}
          onChange={e => setVariation('generic', e.target.value.split('\n').filter(line => line.trim() !== ''))}
        />

        <div style={s.hint}>
          Plaatshouders: <code>{'{onderdeel}'}</code> (naam van het onderdeel),{' '}
          <code>{'{vorigOnderdeel}'}</code> (vorig onderdeel, enkel bij een overgang).
        </div>

        <label style={s.label}>Eerste reeks van de wedstrijd</label>
        <input
          style={s.input}
          value={form.textVariations.firstOfCompetition}
          onChange={e => setVariation('firstOfCompetition', e.target.value)}
        />

        <label style={s.label}>Tweede reeks (van het eerste onderdeel)</label>
        <input
          style={s.input}
          value={form.textVariations.secondReeks}
          onChange={e => setVariation('secondReeks', e.target.value)}
        />

        <label style={s.label}>Eerste reeks na een overgang naar een nieuw onderdeel</label>
        <input
          style={s.input}
          value={form.textVariations.afterTransition}
          onChange={e => setVariation('afterTransition', e.target.value)}
        />

        <label style={s.label}>Laatste reeks van een onderdeel</label>
        <input
          style={s.input}
          value={form.textVariations.lastOfBlock}
          onChange={e => setVariation('lastOfBlock', e.target.value)}
        />
      </div>

      {saved && <div style={s.statusMsg}>Instellingen opgeslagen.</div>}

      <div style={s.formActions}>
        <Button variant="primary" icon={<Check size={15} />} onClick={handleSubmit} disabled={busy}>
          {busy ? 'Opslaan…' : 'Opslaan'}
        </Button>
        <Button variant="secondary" icon={<RotateCcw size={14} />} onClick={handleReset}>
          Herstel standaardwaarden
        </Button>
      </div>
    </div>
  );
}
