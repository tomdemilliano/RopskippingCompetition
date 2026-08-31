/**
 * PodiumView.jsx — SkipFlow
 *
 * Podium- en prijsuitreikingsscherm voor het grote scherm (Fase 3).
 *
 * Volgt uitsluitend competition.podiumState ({activePodiumId, revealStage}),
 * geschreven door de speaker via PodiumCeremonyPanel — exact hetzelfde
 * synchronisatiepatroon als finishedEvents/finishedSeries voor DisplayView.
 * Geen eigen navigatie: dit scherm is puur een weergave.
 *
 * Data komt volledig uit AppContext — geen directe Firebase-toegang.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X, Trophy } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, radius, shadow, font } from '../theme';
import PodiumStage from './PodiumStage';

// Belgische vlag (zwart/geel/rood) als "wapperende" achtergrond voor een
// BK-podium. Twee eerdere pogingen (schuivende glans, feTurbulence-ruis)
// oogden respectievelijk te zwak en als een vervormende smurrie i.p.v. een
// soepele golving. Dit bouwt de golf zelf analytisch op — geen ruis: de vlag
// bestaat uit dunne horizontale stroken die elk een klein stukje horizontaal
// verschuiven volgens de som van twee zuivere sinusgolven (verschillende
// golflengte/snelheid, voor een organischer ritme dan één perfecte golf).
// Dat laat de verticale kleurgrenzen (zwart|geel|rood) golvend meebewegen,
// precies zoals stof rond een vlaggenmast rimpelt. Volledig via React-state
// + requestAnimationFrame — puur inline SVG/DOM, geen Tailwind, geen CSS-
// modules, geen los stijlbestand (CLAUDE.md).
const BELGIAN_FLAG_COLORS = ['#000000', '#FDDA25', '#EF3340'];

const FLAG_VB_W = 300;
const FLAG_VB_H = 200;
const FLAG_STRIPS = 32;
const FLAG_STRIP_H = FLAG_VB_H / FLAG_STRIPS;
// Max horizontale uitwijking — bepaalt hoeveel breder elke band getekend
// wordt (padding) zodat een strook nooit een gat laat zien aan de rand.
const FLAG_MAX_DX = 22;

function flagOffsetAt(yCenter, phase) {
  const wave1 = 15 * Math.sin((2 * Math.PI * yCenter) / 105 + phase);
  const wave2 = 6 * Math.sin((2 * Math.PI * yCenter) / 52 - phase * 1.35);
  return wave1 + wave2;
}

function BelgianFlagBackground() {
  const [phase, setPhase] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase(p => p + dt * 1.6); // ~1 volledige golfcyclus per ~4s
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // Enkel de buitenste twee randen (uiterst links van de zwarte band, uiterst
  // rechts van de rode band) krijgen extra breedte — genoeg om de maximale
  // uitwijking in beide richtingen te dekken zonder ooit een gat te tonen.
  // De binnengrenzen tussen de banden blijven exact op 1/3 en 2/3, anders
  // zou de opvulling de kleuren van de buurband overschilderen.
  const pad = FLAG_MAX_DX + 2;
  const bandW = FLAG_VB_W / 3;

  return (
    <svg
      width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${FLAG_VB_W} ${FLAG_VB_H}`}
      style={{ position: 'absolute', inset: 0, zIndex: -1 }}
      aria-hidden="true"
    >
      {Array.from({ length: FLAG_STRIPS }, (_, i) => {
        const y = i * FLAG_STRIP_H;
        const yCenter = y + FLAG_STRIP_H / 2;
        const dx = flagOffsetAt(yCenter, phase);
        return (
          <g key={i} transform={`translate(${dx}, 0)`}>
            <rect x={-pad}          y={y} width={bandW + pad} height={FLAG_STRIP_H + 0.6} fill={BELGIAN_FLAG_COLORS[0]} />
            <rect x={bandW}         y={y} width={bandW}       height={FLAG_STRIP_H + 0.6} fill={BELGIAN_FLAG_COLORS[1]} />
            <rect x={bandW * 2}     y={y} width={bandW + pad} height={FLAG_STRIP_H + 0.6} fill={BELGIAN_FLAG_COLORS[2]} />
          </g>
        );
      })}
    </svg>
  );
}

export default function PodiumView({ onClose }) {
  const {
    activeCompetition, events, getClub,
    participants, loadParticipants,
    podiums, loadPodiums, podiumState,
  } = useAppContext();

  // Deelnemers en podia laden voor de actieve wedstrijd — dit scherm kan
  // rechtstreeks via zijn eigen route geopend worden, zonder eerst via
  // Beheer of Speaker te zijn gepasseerd.
  useEffect(() => {
    loadParticipants(activeCompetition?.id ?? null);
    loadPodiums(activeCompetition?.id ?? null);
  }, [activeCompetition?.id, loadParticipants, loadPodiums]);

  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // De browser verlaat fullscreen ook zelf bij Esc — dit synchroniseert onze
  // state (en dus de header-zichtbaarheid) met dat native gedrag, i.p.v. enkel
  // te reageren op de eigen knop.
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const activePodium = podiums.find(p => p.id === podiumState.activePodiumId) ?? null;
  const eventName = activePodium ? (events.find(e => e.id === activePodium.eventId)?.name ?? '') : '';
  const isBelgianFlag = !!activePodium?.isBelgianChampionship;

  // ── Geen actieve wedstrijd ──────────────────────────────────────────────
  if (!activeCompetition) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: color.stage, color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Geen actieve wedstrijd</h1>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 2rem', borderRadius: '8px', border: 'none',
              background: color.slate, color: 'white', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Terug naar beheer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: color.stage,
      color: color.stageInk,
      fontFamily: font.body,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 9999,
    }}>
      {isBelgianFlag && <BelgianFlagBackground />}

      {/* ── Top bar — verborgen in fullscreen; Esc verlaat fullscreen en toont hem terug ── */}
      {!isFullscreen && (
        <div style={{
          padding: '0.875rem 2rem',
          background: 'rgba(30,41,59,0.8)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>
            {activeCompetition.name}
            <span style={{ color: color.info, marginLeft: '1rem', fontWeight: 400 }}>
              | Prijsuitreiking
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: 'white', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: color.danger, border: 'none', color: 'white',
                padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Hoofdinhoud — lager op het scherm zodat de namen centraler staan ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: activePodium ? 'flex-start' : 'center',
        padding: activePodium ? '14vh 2rem 2rem' : '3rem 2rem',
        overflow: 'hidden',
      }}>
        {activePodium ? (
          <div style={isBelgianFlag ? {
            background: color.stageCard,
            borderRadius: radius.xl,
            boxShadow: shadow.lg,
            padding: '2.5rem 3rem',
          } : undefined}>
            <PodiumStage
              podium={activePodium}
              eventName={eventName}
              participants={participants}
              getClub={getClub}
              revealStage={podiumState.revealStage}
              size="full"
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: color.stageMuted }}>
            <Trophy size={80} color={color.body} strokeWidth={1.5} />
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: color.stageInk, marginTop: '1.5rem' }}>
              Wachten op de speaker…
            </div>
            <div style={{ fontSize: '0.95rem', marginTop: '0.5rem', maxWidth: '360px' }}>
              Zodra de speaker een podium selecteert, verschijnt de onthulling hier.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
