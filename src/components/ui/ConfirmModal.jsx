/**
 * ConfirmModal.jsx — SkipFlow UI-kit
 *
 * Generieke bevestigingsmodal voor destructieve/onomkeerbare acties
 * (verwijderen, wedstrijd beëindigen, ...) — i.p.v. het inconsistent ogende
 * native `window.confirm()`. Zelfstandig stijlobject (geen afhankelijkheid
 * van modalStyles.js, dat in management/modals/ leeft) zodat dit component
 * ook buiten het beheerscherm herbruikbaar is.
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { color, radius, shadow } from '../../theme';
import Button from './Button';

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  dialog: {
    background: color.surface,
    borderRadius: radius.lg,
    border: `1px solid ${color.border}`,
    boxShadow: shadow.lg,
    width: '420px',
    maxWidth: '92vw',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '1.1rem 1.25rem 0.75rem',
  },
  title: {
    fontWeight: 900,
    fontSize: '1rem',
    color: color.inkSoft,
    flex: 1,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: color.faint,
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    padding: '0 1.25rem 1.1rem',
    fontSize: '0.85rem',
    color: color.body,
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    padding: '1rem 1.25rem',
    borderTop: `1px solid ${color.borderSoft}`,
  },
};

/**
 * @param {string} title
 * @param {React.ReactNode} message
 * @param {string} [confirmLabel]
 * @param {string} [cancelLabel]
 * @param {boolean} [danger]   rood accent + danger-knop i.p.v. primary
 * @param {() => void} onConfirm
 * @param {() => void} onClose
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Bevestigen',
  cancelLabel = 'Annuleren',
  danger = false,
  onConfirm,
  onClose,
}) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.dialog} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          {danger && <AlertTriangle size={20} color={color.danger} />}
          <div style={s.title}>{title}</div>
          <button style={s.closeBtn} onClick={onClose}><X size={17} /></button>
        </div>
        <div style={s.body}>{message}</div>
        <div style={s.footer}>
          <Button variant="secondary" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
