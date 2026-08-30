/**
 * ClubManagement.jsx — SkipFlow
 *
 * Clubbeheer — stamdata-sectie in Beheer. Nu: naam, kortnaam, plaats, land
 * en logo (voor het podiumscherm in Fase 3). Bewust opgezet als uitbreidbare
 * sectie voor later — niet enkel een logo-uploadformulier.
 */

import React, { useState, useRef } from 'react';
import { Plus, Edit2, Upload, Check, X } from 'lucide-react';
import { useAppContext } from '../../AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    background: '#f8fafc',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    maxWidth: '760px',
  },
  cardTitle: {
    fontSize: '0.7rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#0f9d70',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.45rem 0.9rem',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    padding: '0.6rem 0',
    borderBottom: '1px solid #f1f5f9',
  },
  logoThumb: (hasLogo) => ({
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: hasLogo ? '#fff' : '#eaf1ff',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2563eb',
    fontWeight: 800,
    fontSize: '0.7rem',
    flexShrink: 0,
    overflow: 'hidden',
  }),
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  clubName: {
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#1e293b',
  },
  clubMeta: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  logoStatus: (missing) => ({
    fontSize: '0.72rem',
    fontWeight: 700,
    color: missing ? '#ef4444' : '#0f9d70',
    minWidth: '110px',
  }),
  iconBtn: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: '6px',
    padding: '0.4rem',
    cursor: 'pointer',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
  },
  uploadLabel: {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: '6px',
    padding: '0.4rem',
    cursor: 'pointer',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '0.3rem',
    display: 'block',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
  },
  formActions: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '0.5rem',
  },
  submitBtn: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1.2rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cancelBtn: {
    background: '#fff',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '0.6rem 1.2rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};

const EMPTY_FORM = { name: '', shortName: '', city: '', country: 'BE' };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ClubManagement() {
  const { clubs, createClub, updateClub, uploadClubLogo } = useAppContext();

  const [editingId, setEditingId] = useState(null); // null = geen form, 'new' = nieuwe club
  const [form, setForm]           = useState(EMPTY_FORM);
  const [busy, setBusy]           = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRefs = useRef({});

  const sortedClubs = [...clubs].sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId('new');
  };

  const openEdit = (club) => {
    setForm({ name: club.name, shortName: club.shortName, city: club.city, country: club.country });
    setEditingId(club.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.shortName.trim()) return;
    setBusy(true);
    try {
      if (editingId === 'new') {
        await createClub(form);
      } else {
        await updateClub(editingId, form);
      }
      closeForm();
    } finally {
      setBusy(false);
    }
  };

  const handleLogoChange = async (club, file) => {
    if (!file) return;
    setUploadingId(club.id);
    try {
      await uploadClubLogo(club.id, file);
    } catch (err) {
      alert('Logo uploaden mislukt: ' + (err.message ?? err));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.headerRow}>
          <div style={{ ...s.cardTitle, marginBottom: 0 }}>Clubs ({clubs.length})</div>
          {editingId === null && (
            <button style={s.newBtn} onClick={openNew}>
              <Plus size={14} /> Nieuwe club
            </button>
          )}
        </div>

        {sortedClubs.map(club => {
          const missingLogo = !club.logoUrl;
          return (
            <div key={club.id} style={s.row}>
              <div style={s.logoThumb(!!club.logoUrl)}>
                {club.logoUrl
                  ? <img src={club.logoUrl} alt={club.name} style={s.logoImg} />
                  : (club.shortName || club.name).slice(0, 3).toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <div style={s.clubName}>{club.name}</div>
                <div style={s.clubMeta}>{club.city || '—'} · {club.country}</div>
              </div>

              <div style={s.logoStatus(missingLogo)}>
                {missingLogo ? 'Logo ontbreekt' : 'Logo ✓'}
              </div>

              <input
                ref={el => { fileInputRefs.current[club.id] = el; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleLogoChange(club, e.target.files?.[0])}
              />
              <label
                style={s.uploadLabel}
                title="Logo uploaden"
                onClick={() => fileInputRefs.current[club.id]?.click()}
              >
                {uploadingId === club.id ? '…' : <Upload size={15} />}
              </label>

              <button style={s.iconBtn} title="Bewerken" onClick={() => openEdit(club)}>
                <Edit2 size={15} />
              </button>
            </div>
          );
        })}

        {clubs.length === 0 && editingId === null && (
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.6rem 0' }}>
            Nog geen clubs — clubs ontstaan ook automatisch bij het importeren van deelnemers.
          </div>
        )}
      </div>

      {editingId !== null && (
        <div style={s.card}>
          <div style={s.cardTitle}>{editingId === 'new' ? 'Nieuwe club' : 'Club bewerken'}</div>
          <div style={s.form}>
            <div>
              <label style={s.label}>Naam</label>
              <input
                style={s.input}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label style={s.label}>Kortnaam</label>
              <input
                style={s.input}
                value={form.shortName}
                onChange={e => setForm({ ...form, shortName: e.target.value })}
              />
            </div>
            <div>
              <label style={s.label}>Plaats</label>
              <input
                style={s.input}
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label style={s.label}>Land</label>
              <input
                style={s.input}
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div style={s.formActions}>
              <button style={s.submitBtn} onClick={handleSubmit} disabled={busy}>
                <Check size={15} /> {busy ? 'Bezig…' : 'Opslaan'}
              </button>
              <button style={s.cancelBtn} onClick={closeForm}>
                <X size={15} /> Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
