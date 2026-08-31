/**
 * PodiumStage.jsx — SkipFlow
 *
 * Pure presentational podium-visual: naam podium, onderdeel, en de 3 plaatsen
 * met hun laureaten. Wordt hergebruikt op twee plekken:
 *   - PodiumView (groot scherm)     → size="full"
 *   - PodiumCeremonyPanel (speaker) → size="mini", als kleine voorvertoning
 *
 * revealStage bepaalt wat al zichtbaar is tijdens de onthulling:
 *   0 = niets, 1 = 3de plaats, 2 = 3de + 2de plaats, 3 = volledig podium.
 * Buiten de live-ceremonie (bv. beheer-preview) wordt revealStage=3 gebruikt
 * zodat de volledige samenstelling zichtbaar is.
 *
 * Krijgt alle data resolved binnen via props — doet zelf geen AppContext- of
 * Firestore-toegang (CLAUDE.md: componentregels).
 */

import React from 'react';
import { Trophy } from 'lucide-react';
import { color, radius, font } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// PLAATS-CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const PLACE_COLOR = {
  1: '#facc15', // goud
  2: '#cbd5e1', // zilver
  3: '#d97706', // brons
};

const PLACE_HEIGHT_RATIO = { 1: 1, 2: 0.72, 3: 0.55 };

// Visuele volgorde op het podium: 2de — 1ste — 3de
const VISUAL_ORDER = [2, 1, 3];

const SIZES = {
  full: {
    baseHeight: 400,
    riserWidth: '20rem',
    gap: '2rem',
    placeNr: '4.5rem',
    name: '2.2rem',
    club: '1.3rem',
    trophy: 64,
    title: '3.2rem',
    event: '1.4rem',
    logoSize: '4.5rem',
  },
  mini: {
    baseHeight: 84,
    riserWidth: '5rem',
    gap: '0.4rem',
    placeNr: '1rem',
    name: '0.68rem',
    club: '0.5rem',
    trophy: 15,
    title: '0.82rem',
    event: '0.55rem',
    logoSize: '1.3rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function resolveLaureates(place, participants, getClub) {
  return (place.participantIds ?? [])
    .map(id => {
      const p = participants.find(pp => pp.id === id);
      if (!p) return null;
      const club = p.clubId ? getClub(p.clubId) : null;
      return { id, name: p.name, clubName: club?.name ?? '', logoUrl: club?.logoUrl ?? '' };
    })
    .filter(Boolean);
}

function isPlaceRevealed(place, revealStage) {
  if (place === 3) return revealStage >= 1;
  if (place === 2) return revealStage >= 2;
  return revealStage >= 3; // plaats 1
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {{name:string, places:Array}} props.podium
 * @param {string} props.eventName
 * @param {Array} props.participants   volledige deelnemerslijst van de wedstrijd
 * @param {function} props.getClub
 * @param {number} [props.revealStage] 0-3, standaard volledig onthuld
 * @param {'full'|'mini'} [props.size]
 */
export default function PodiumStage({
  podium, eventName, participants, getClub, revealStage = 3, size = 'full',
}) {
  const d = SIZES[size] ?? SIZES.full;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: d.gap, width: '100%',
    }}>
      {/* Titel */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', color: PLACE_COLOR[1], marginBottom: '0.2rem',
        }}>
          <Trophy size={d.trophy} strokeWidth={1.5} />
          <span style={{ fontSize: d.title, fontWeight: 900, color: color.stageInk, fontFamily: font.body }}>
            {podium?.name || 'Podium'}
          </span>
        </div>
        {eventName && (
          <div style={{ fontSize: d.event, color: color.stageMuted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {eventName}
          </div>
        )}
      </div>

      {/* Podiumblokken */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: d.gap }}>
        {VISUAL_ORDER.map(placeNr => {
          const place = (podium?.places ?? []).find(pl => pl.place === placeNr) ?? { place: placeNr, participantIds: [] };
          const laureates = resolveLaureates(place, participants, getClub);
          const revealed = isPlaceRevealed(placeNr, revealStage);
          const hasLaureates = laureates.length > 0;

          return (
            <div key={placeNr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: d.riserWidth }}>
              {/* Laureaat-info boven de zuil — blijft leeg zolang niet onthuld */}
              <div style={{
                minHeight: `calc(${d.logoSize} + ${d.name} * 2 + ${d.club} + 0.8rem)`,
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                alignItems: 'center', textAlign: 'center', marginBottom: '0.6rem',
              }}>
                {revealed && hasLaureates && laureates.map((l, i) => (
                  <div key={l.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    marginBottom: i < laureates.length - 1 ? '0.5rem' : 0,
                  }}>
                    {l.logoUrl && (
                      <img
                        src={l.logoUrl}
                        alt=""
                        style={{ width: d.logoSize, height: d.logoSize, objectFit: 'contain', marginBottom: '0.3rem' }}
                      />
                    )}
                    <div style={{ fontSize: d.name, fontWeight: 900, color: color.stageInk, lineHeight: 1.15 }}>
                      {l.name}
                    </div>
                    {l.clubName && (
                      <div style={{ fontSize: d.club, color: color.stageMuted, fontWeight: 600 }}>
                        {l.clubName}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Zuil */}
              <div style={{
                width: '100%',
                height: `${d.baseHeight * PLACE_HEIGHT_RATIO[placeNr]}px`,
                background: `linear-gradient(180deg, ${PLACE_COLOR[placeNr]}33, ${PLACE_COLOR[placeNr]}11)`,
                border: `2px solid ${PLACE_COLOR[placeNr]}`,
                borderBottom: 'none',
                borderRadius: `${radius.md} ${radius.md} 0 0`,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: '0.5rem',
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: d.placeNr, fontWeight: 900, color: PLACE_COLOR[placeNr] }}>
                  {placeNr}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
