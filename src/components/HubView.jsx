/**
 * HubView.jsx — SkipFlow
 *
 * Landingspagina. Toont tegels naar elk scherm waar de ingelogde gebruiker
 * recht op heeft — navigatie tussen schermen gebeurt voortaan enkel van hier
 * uit, niet meer via de header (zie App.jsx). Speaker en Groot scherm tonen
 * duidelijk of, en welke, wedstrijd actief is.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, ClipboardCheck, Mic2, MonitorPlay, Trophy, Radio, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow, font } from '../theme';
import Badge from './ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  page: {
    flex: 1,
    overflowY: 'auto',
    background: color.bg,
    padding: '2.5rem 2rem',
  },
  inner: {
    maxWidth: '1080px',
    margin: '0 auto',
  },
  greeting: {
    fontSize: '0.85rem',
    color: color.muted,
    fontWeight: 600,
    marginBottom: '0.3rem',
  },
  heading: {
    fontSize: '1.7rem',
    fontWeight: 900,
    color: color.ink,
    margin: '0 0 2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.1rem',
  },
  tile: (accent) => ({
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.xl,
    padding: '1.5rem',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    minHeight: '160px',
    boxShadow: shadow.sm,
    transition: 'transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease',
    borderTop: `4px solid ${accent}`,
  }),
  tileIcon: (accent) => ({
    width: '46px',
    height: '46px',
    borderRadius: radius.md,
    background: `${accent}18`,
    color: accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  tileTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  tileTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: color.ink,
  },
  tileSub: {
    fontSize: '0.82rem',
    color: color.muted,
    lineHeight: 1.5,
    flex: 1,
  },
  tileFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginTop: 'auto',
  },
  openHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: color.primary,
  },
  empty: {
    textAlign: 'center',
    color: color.muted,
    fontSize: '0.9rem',
    padding: '3rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEGELDEFINITIE
// ─────────────────────────────────────────────────────────────────────────────

function useTiles() {
  const { userProfile, hasPermission, activeCompetition } = useAppContext();
  const isAdmin = userProfile?.role === 'beheerder';

  const liveBadge = activeCompetition
    ? <Badge tone="danger" icon={<Radio size={9} />}>LIVE — {activeCompetition.name}</Badge>
    : <Badge tone="neutral">Geen actieve wedstrijd</Badge>;

  const all = [
    {
      key: 'beheer', path: '/beheer', visible: isAdmin,
      icon: Settings, accent: color.slate,
      title: 'Beheer', sub: 'Wedstrijden, clubs en gebruikers beheren.',
    },
    {
      key: 'aanwezigheid', path: '/aanwezigheid', visible: hasPermission('aanwezigheid'),
      icon: ClipboardCheck, accent: color.primary,
      title: 'Aanwezigheid', sub: 'Aanwezigheidsregistratie aan de inkomtafel.',
    },
    {
      key: 'speaker', path: '/speaker', visible: hasPermission('speaker'),
      icon: Mic2, accent: color.success,
      title: 'Speaker', sub: 'Operatorscherm tijdens de wedstrijd — reeksen aankondigen.',
      badge: liveBadge,
    },
    {
      key: 'scherm', path: '/scherm', visible: hasPermission('backstage'),
      icon: MonitorPlay, accent: '#0891b2',
      title: 'Groot scherm', sub: 'Voor in de opwarmruimte — huidige en volgende reeks.',
      badge: liveBadge,
    },
    {
      key: 'podium', path: '/scherm/podium', visible: hasPermission('podium'),
      icon: Trophy, accent: color.warning,
      title: 'Podium', sub: 'Podium-onthulling voor de prijsuitreiking.',
    },
  ];

  return all.filter(t => t.visible);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function HubView() {
  const navigate = useNavigate();
  const { userProfile } = useAppContext();
  const tiles = useTiles();

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.greeting}>Welkom terug{userProfile?.username ? `, ${userProfile.username}` : ''}</div>
        <h1 style={s.heading}>Wat wil je doen?</h1>

        {tiles.length === 0 ? (
          <div style={s.empty}>
            Je account heeft nog geen rechten op een scherm. Vraag de beheerder om toegang.
          </div>
        ) : (
          <div style={s.grid}>
            {tiles.map(tile => {
              const Icon = tile.icon;
              return (
                <div
                  key={tile.key}
                  style={s.tile(tile.accent)}
                  onClick={() => navigate(tile.path)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = shadow.md;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = shadow.sm;
                  }}
                >
                  <div style={s.tileTitleRow}>
                    <div style={s.tileIcon(tile.accent)}>
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    {tile.badge}
                  </div>
                  <div>
                    <div style={s.tileTitle}>{tile.title}</div>
                    <div style={s.tileSub}>{tile.sub}</div>
                  </div>
                  <div style={s.tileFooter}>
                    <span style={s.openHint}>
                      Openen <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
