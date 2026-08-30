/**
 * PodiumView.jsx — SkipFlow
 *
 * Podium- en prijsuitreikingsscherm voor het grote scherm.
 * Placeholder voor Fase 3 — de route en het rechtenmodel zijn al aangesloten,
 * de podium-onthulling zelf (zie ARCHITECTURE.md) volgt in Fase 3.
 */

import React from 'react';
import { Trophy, X } from 'lucide-react';

export default function PodiumView({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0f172a', color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.5rem', zIndex: 9999,
    }}>
      <Trophy size={72} color="#475569" strokeWidth={1.5} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem' }}>
          Podium volgt
        </div>
        <div style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '360px', lineHeight: 1.6 }}>
          De podium-onthulling voor de prijsuitreiking komt in Fase 3.
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: '1rem',
          padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
          background: '#334155', color: '#fff', cursor: 'pointer', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}
      >
        <X size={16} /> Terug naar beheer
      </button>
    </div>
  );
}
