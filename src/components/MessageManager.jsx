/**
 * MessageManager.jsx — SkipFlow
 *
 * Gedeeld beheer van de boodschap op het grote scherm (DisplayView).
 * Boodschappen worden per wedstrijd voorbereid als draft en pas zichtbaar
 * voor het publiek zodra ze geactiveerd worden — er is steeds maar 1
 * boodschap actief (competition.activeMessageId), met een altijd
 * beschikbare standaardboodschap ("Veel succes aan alle deelnemers") als
 * activeMessageId null is.
 *
 * Hergebruikt op twee plekken (CLAUDE.md — state via AppContext, geen
 * directe Firestore-toegang):
 *   - CompetitionDetail (tab "Boodschap")  — wedstrijdbeheerder
 *   - LiveView (tab "Boodschap")           — speaker
 */

import React, { useState, useEffect } from 'react';
import {
  Megaphone, AlertCircle, HelpCircle, ThumbsUp, Ban,
  Plus, Trash2, Pencil, Check, X, Star,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius } from '../theme';
import Button from './ui/Button';
import Badge from './ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// ICOONKEUZE — gedeeld met DisplayView.jsx voor de weergave
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGE_ICON_MAP = {
  megaphone: Megaphone,
  alert:     AlertCircle,
  question:  HelpCircle,
  thumbsup:  ThumbsUp,
};

const ICON_OPTIONS = [
  { key: '',          label: 'Geen icoon',  Icon: Ban },
  { key: 'megaphone', label: 'Megafoon',     Icon: Megaphone },
  { key: 'alert',      label: 'Uitroepteken', Icon: AlertCircle },
  { key: 'question',  label: 'Vraagteken',   Icon: HelpCircle },
  { key: 'thumbsup',  label: 'Thumbs up',    Icon: ThumbsUp },
];

const DEFAULT_TEXT = 'Veel succes aan alle deelnemers';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

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
    flex: '1 1 220px',
    minWidth: 0,
    background: color.surface,
  },
  iconPicker: {
    display: 'flex',
    gap: '4px',
  },
  iconBtn: (active) => ({
    width: '32px',
    height: '32px',
    borderRadius: radius.sm,
    border: `1px solid ${active ? color.primary : color.faintest}`,
    background: active ? color.primarySoft : color.surface,
    color: active ? color.primary : color.faint,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  card: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: color.surface,
    border: `1px solid ${active ? color.successBorder : color.border}`,
    borderRadius: radius.md,
    padding: '0.65rem 0.9rem',
  }),
  cardIcon: {
    width: '32px',
    height: '32px',
    borderRadius: radius.sm,
    background: color.surfaceAlt,
    color: color.body,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.88rem',
    fontWeight: 700,
    color: color.inkSoft,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  renameInput: {
    flex: 1,
    minWidth: 0,
    border: `1px solid ${color.primaryBorder}`,
    borderRadius: radius.sm,
    padding: '0.35rem 0.55rem',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  iconBtnSmall: (danger) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: danger ? color.danger : color.faint,
    padding: '4px',
    display: 'flex',
    flexShrink: 0,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// ICOONKIEZER
// ─────────────────────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }) {
  return (
    <div style={s.iconPicker}>
      {ICON_OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key || 'none'}
          type="button"
          title={label}
          style={s.iconBtn(value === key)}
          onClick={() => onChange(key)}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/** @param {{ competitionId: string }} props */
export default function MessageManager({ competitionId }) {
  const {
    messages, loadMessages, activeMessageId,
    createMessage, updateMessage, deleteMessage, setActiveMessage,
  } = useAppContext();

  useEffect(() => {
    loadMessages(competitionId ?? null);
  }, [competitionId, loadMessages]);

  const [newText, setNewText] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText,  setEditText]  = useState('');
  const [editIcon,  setEditIcon]  = useState('');

  const handleCreate = async () => {
    if (!newText.trim()) return;
    await createMessage(competitionId, { text: newText.trim(), icon: newIcon });
    setNewText('');
    setNewIcon('');
  };

  const handleDelete = async (message) => {
    if (!window.confirm(`Boodschap "${message.text}" verwijderen?`)) return;
    if (message.id === activeMessageId) {
      await setActiveMessage(competitionId, null);
    }
    await deleteMessage(competitionId, message.id);
  };

  const startEdit = (message) => {
    setEditingId(message.id);
    setEditText(message.text);
    setEditIcon(message.icon);
  };

  const saveEdit = async (message) => {
    const trimmed = editText.trim();
    if (trimmed) {
      await updateMessage(competitionId, message.id, { text: trimmed, icon: editIcon });
    }
    setEditingId(null);
  };

  return (
    <div style={s.wrap}>
      {/* ── Nieuwe boodschap (draft) ── */}
      <div style={s.addRow}>
        <IconPicker value={newIcon} onChange={setNewIcon} />
        <input
          style={s.addInput}
          placeholder="Nieuwe boodschap…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
        />
        <Button
          variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={handleCreate}
          disabled={!newText.trim()}
        >
          Boodschap
        </Button>
      </div>

      <div style={s.list}>
        {/* ── Standaardboodschap — geen Firestore-document, activeMessageId null ── */}
        <div style={s.card(activeMessageId === null)}>
          <div style={s.cardIcon}><Star size={15} /></div>
          <div style={s.cardText}>{DEFAULT_TEXT}</div>
          {activeMessageId === null ? (
            <Badge tone="success">Actief</Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setActiveMessage(competitionId, null)}>
              Activeren
            </Button>
          )}
        </div>

        {/* ── Voorbereide boodschappen ── */}
        {messages.map(message => {
          const isActive = message.id === activeMessageId;
          const Icon = MESSAGE_ICON_MAP[message.icon] ?? null;
          const isEditing = editingId === message.id;

          return (
            <div key={message.id} style={s.card(isActive)}>
              {isEditing ? (
                <>
                  <IconPicker value={editIcon} onChange={setEditIcon} />
                  <input
                    autoFocus
                    style={s.renameInput}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(message);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button style={s.iconBtnSmall(false)} title="Opslaan" onClick={() => saveEdit(message)}>
                    <Check size={15} />
                  </button>
                  <button style={s.iconBtnSmall(false)} title="Annuleren" onClick={() => setEditingId(null)}>
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div style={s.cardIcon}>{Icon ? <Icon size={15} /> : <Ban size={15} />}</div>
                  <div style={s.cardText} title={message.text}>{message.text}</div>
                  {isActive ? (
                    <Badge tone="success">Actief</Badge>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setActiveMessage(competitionId, message.id)}>
                      Activeren
                    </Button>
                  )}
                  <button style={s.iconBtnSmall(false)} title="Bewerken" onClick={() => startEdit(message)}>
                    <Pencil size={14} />
                  </button>
                  <button style={s.iconBtnSmall(true)} title="Verwijderen" onClick={() => handleDelete(message)}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
