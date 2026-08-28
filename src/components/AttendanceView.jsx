/**
 * AttendanceView.jsx — RopeScore Pro
 *
 * Aanwezigheidsregistratie voor de inkomtafel.
 * Placeholder voor Fase 1 — de route en het rechtenmodel zijn al aangesloten
 * (zie CLAUDE.md-conform via AppContext), de kiosk-UI zelf volgt in Fase 1.
 */

import React from 'react';
import { ClipboardCheck } from 'lucide-react';

const s = {
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    textAlign: 'center',
    gap: '1.5rem',
  },
  icon: {
    background: '#f1f5f9',
    padding: '2rem',
    borderRadius: '50%',
    border: '4px solid #e2e8f0',
  },
  title: {
    fontWeight: 800,
    color: '#475569',
    fontSize: '1.1rem',
    marginBottom: '0.5rem',
  },
  sub: {
    fontSize: '0.875rem',
    maxWidth: '320px',
    lineHeight: 1.6,
  },
};

export default function AttendanceView() {
  return (
    <div style={s.empty}>
      <div style={s.icon}>
        <ClipboardCheck size={72} color="#cbd5e1" strokeWidth={1.5} />
      </div>
      <div>
        <div style={s.title}>Aanwezigheidsregistratie volgt</div>
        <div style={s.sub}>
          Dit scherm komt in de volgende fase. Aanwezigheid en schrappen kan tot dan via
          Beheer → wedstrijd → deelnemerslijst.
        </div>
      </div>
    </div>
  );
}
