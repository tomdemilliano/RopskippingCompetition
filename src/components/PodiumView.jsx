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

import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, X, Trophy } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { color, font } from '../theme';
import PodiumStage from './PodiumStage';

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
      background: color.stage, color: color.stageInk,
      fontFamily: font.body,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 9999,
    }}>
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

      {/* ── Hoofdinhoud — bovenaan uitgelijnd zodat de podiumnaam bovenaan het scherm staat ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: activePodium ? 'flex-start' : 'center',
        padding: '3rem 2rem', overflow: 'hidden',
      }}>
        {activePodium ? (
          <PodiumStage
            podium={activePodium}
            eventName={eventName}
            participants={participants}
            getClub={getClub}
            revealStage={podiumState.revealStage}
            size="full"
          />
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
