/**
 * MobileLiveView.jsx — SkipFlow
 *
 * Publieke, mobiel-compacte live-weergave — bereikbaar via
 * /mobile.html?id=<competitionId> (QR-code op het groot scherm,
 * zie DisplayView.jsx), zonder login.
 *
 * GEEN useAppContext() — bewuste, gedocumenteerde uitzondering op CLAUDE.md's
 * "componenten lezen via AppContext"-regel: er is hier geen ingelogde
 * AppContext (zie mobile-main.jsx, dat net als seed-main.jsx een volledig
 * losstaande bootstrap is, zonder firebase/auth). Leest rechtstreeks via
 * dbSchema.js-factories, met initDb() al opgezet door mobile-main.jsx.
 *
 * Leest UITSLUITEND het ene, expliciete wedstrijd-ID uit de URL — nooit "de
 * toevallig actieve wedstrijd" (competitionFactory.subscribeOne, geen
 * collectie-brede subscribe). Dat is wat de link uniek per wedstrijd maakt,
 * laat vervallen zodra de beheerder de wedstrijd beëindigt, en voorkomt dat
 * een oude link ooit naar een andere, later actieve wedstrijd "meeschuift" —
 * zie ARCHITECTURE.md — Mobiele publieke live-weergave.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  competitionFactory, eventFactory, clubFactory, competitionTypeFactory,
  participantFactory, blockFactory, messageFactory,
} from '../dbSchema';
import { color, radius, font } from '../theme';
import { deriveLiveProgress } from '../liveProgress';
import { maxFieldNr, padFieldList } from '../fieldLayout';

const DEFAULT_DISPLAY_MESSAGE = { id: null, text: 'Veel succes aan alle deelnemers', icon: '' };

// Hoeveel freestyle-deelnemers er na de huidige getoond worden — expliciete
// gebruikerskeuze voor de mobiele weergave (groot scherm toont 8).
const FREESTYLE_UPCOMING_COUNT = 10;

/** Veldenlijst voor één reeks van een speed-event, aangevuld met lege velden. */
function buildFieldList(seriesNr, eventParticipants) {
  const raw = eventParticipants.filter(p => p._entry.seriesNr === seriesNr);
  return padFieldList(raw, maxFieldNr(eventParticipants));
}

/** Pill naast de naam van een deelnemer die via een reskip hier staat. */
function ReskipPill() {
  return (
    <span style={{
      marginLeft: '0.5rem',
      background: color.warning,
      color: color.stage,
      fontSize: '0.65rem',
      fontWeight: 800,
      padding: '1px 7px',
      borderRadius: radius.pill,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      verticalAlign: 'middle',
    }}>
      Reskip
    </span>
  );
}

function FallbackScreen({ title, subtitle }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: color.stage, color: color.stageInk,
      fontFamily: font.body, padding: '2rem', textAlign: 'center', boxSizing: 'border-box',
    }}>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.5rem' }}>{title}</div>
        {subtitle && <div style={{ color: color.stageMuted }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export default function MobileLiveView({ competitionId }) {
  // undefined = nog niet geladen, null = bestaat niet (meer) / geweigerd.
  const [competition, setCompetition] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [competitionTypes, setCompetitionTypes] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [messages, setMessages] = useState([]);

  // De ene, expliciete wedstrijd uit de link — nooit de collectie-brede
  // subscribe() (zie bestandskop).
  useEffect(() => {
    if (!competitionId) return;
    setCompetition(undefined);
    const unsub = competitionFactory.subscribeOne(competitionId, setCompetition);
    return unsub;
  }, [competitionId]);

  // Gedeelde referentiedata — publiek leesbaar, onvoorwaardelijk nodig om
  // namen te kunnen tonen.
  useEffect(() => {
    const unsubEvents = eventFactory.subscribe(setEvents);
    const unsubClubs = clubFactory.subscribe(setClubs);
    const unsubTypes = competitionTypeFactory.subscribe(setCompetitionTypes);
    return () => { unsubEvents(); unsubClubs(); unsubTypes(); };
  }, []);

  // Wedstrijd-specifieke data — enkel opvragen zolang de wedstrijd zelf
  // bekend en 'bezig' is (anders weigert de publieke leesregel dit sowieso).
  useEffect(() => {
    if (!competitionId || !competition || competition.status !== 'bezig') {
      setParticipants([]);
      setBlocks([]);
      setMessages([]);
      return;
    }
    const unsubParticipants = participantFactory.subscribe(competitionId, setParticipants);
    const unsubBlocks = blockFactory.subscribe(competitionId, setBlocks);
    const unsubMessages = messageFactory.subscribe(competitionId, setMessages);
    return () => { unsubParticipants(); unsubBlocks(); unsubMessages(); };
  }, [competitionId, competition?.status]);

  const getClub = (clubId) => clubs.find(c => c.id === clubId) ?? null;

  const activeMessage = useMemo(() => {
    if (!competition) return DEFAULT_DISPLAY_MESSAGE;
    return messages.find(m => m.id === competition.activeMessageId) ?? DEFAULT_DISPLAY_MESSAGE;
  }, [messages, competition]);

  // ── Terugvalschermen — nooit terugvallen op een andere wedstrijd ────────
  if (!competitionId) {
    return <FallbackScreen title="Ongeldige link" subtitle="Deze link verwijst niet naar een wedstrijd." />;
  }
  if (competition === undefined) {
    return <FallbackScreen title="Laden…" />;
  }
  if (competition === null || competition.status !== 'bezig') {
    return (
      <FallbackScreen
        title="Deze link is niet meer geldig"
        subtitle="De wedstrijd is beëindigd, of nog niet gestart."
      />
    );
  }

  const {
    officialEvent, isFreestyle, eventParticipants, seriesNrs, officialSeriesNr,
    totalSeries, isBreakBlock, currentSkippers, plannedTime,
  } = deriveLiveProgress({
    competition, events, competitionTypes, participants, blocks,
    finishedEvents: competition.finishedEvents, finishedSeries: competition.finishedSeries,
  });

  const nowList = isFreestyle ? currentSkippers : buildFieldList(officialSeriesNr, eventParticipants);

  // "Volgende", onderdeel-afhankelijk — freestyle: de 10 eerstvolgende
  // deelnemers; speed/endurance/triple under: de volledige volgende heat
  // (alle velden), niet enkel een samenvattende regel.
  const nextSeriesNr = isFreestyle ? null : seriesNrs[seriesNrs.indexOf(officialSeriesNr) + 1];
  const nextList = isFreestyle
    ? eventParticipants.filter(p => p._entry.seriesNr > officialSeriesNr).slice(0, FREESTYLE_UPCOMING_COUNT)
    : (nextSeriesNr != null ? buildFieldList(nextSeriesNr, eventParticipants) : []);

  return (
    <div style={{
      minHeight: '100vh', background: color.stage, color: color.stageInk,
      fontFamily: font.body, padding: '1rem', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>{competition.name}</div>
        <div style={{ color: color.info, fontWeight: 700, fontSize: '0.95rem' }}>
          {officialEvent?.name ?? '—'}
        </div>
      </div>

      {/* Boodschap-banner */}
      <div style={{
        background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: radius.lg, padding: '0.6rem 1rem', marginBottom: '0.75rem',
        fontWeight: 800, fontSize: '0.9rem', textAlign: 'center',
      }}>
        {activeMessage.text}
      </div>

      {isBreakBlock ? (
        // Minimale pauze-regel — geen volledige meerdere-blokken-doorloop
        // zoals op het groot scherm (bevestigd met de gebruiker).
        <div style={{
          background: 'rgba(30,41,59,0.4)', border: `2px dashed ${color.info}`,
          borderRadius: radius.lg, padding: '1rem', textAlign: 'center', marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: color.info }}>⏸ Pauze</div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
            Volgende: {officialEvent?.name ?? '—'}{plannedTime ? ` om ${plannedTime}` : ''}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            color: color.stageMuted, fontWeight: 700, fontSize: '0.75rem',
            textTransform: 'uppercase', marginBottom: '0.4rem',
          }}>
            Nu bezig — Reeks {officialSeriesNr} / {totalSeries}
          </div>
          <div style={{
            background: 'rgba(30,41,59,0.4)', borderRadius: radius.md,
            padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem',
          }}>
            {nowList.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                opacity: p._isEmpty ? 0.4 : 1,
              }}>
                <span style={{
                  background: color.slate, color: '#fff', minWidth: '1.6rem',
                  textAlign: 'center', borderRadius: '4px', fontSize: '0.75rem',
                  fontWeight: 700, padding: '0.1rem 0.3rem', flexShrink: 0,
                }}>
                  {p._entry?.fieldNr ?? '-'}
                </span>
                <span style={{ fontStyle: p._isEmpty ? 'italic' : 'normal' }}>
                  {p._isEmpty ? '---' : p.name}
                </span>
                {!p._isEmpty && p._entry?.isReskip && <ReskipPill />}
                {!p._isEmpty && p.clubId && (
                  <span style={{ color: color.stageMuted, fontSize: '0.78rem' }}>
                    ({getClub(p.clubId)?.name ?? ''})
                  </span>
                )}
              </div>
            ))}
            {nowList.length === 0 && (
              <div style={{ color: color.stageMuted, fontStyle: 'italic', fontSize: '0.85rem' }}>
                De wedstrijd is afgelopen.
              </div>
            )}
          </div>
        </div>
      )}

      {nextList.length > 0 && (
        <div>
          <div style={{
            color: color.stageMuted, fontWeight: 700, fontSize: '0.75rem',
            textTransform: 'uppercase', marginBottom: '0.4rem',
          }}>
            Volgende
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {nextList.map((p, i) => (
              <div key={i} style={{
                background: 'rgba(30,41,59,0.3)', borderRadius: radius.sm,
                padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center',
                gap: '0.6rem', opacity: p._isEmpty ? 0.4 : 1,
              }}>
                <span style={{
                  background: color.slate, color: '#fff', minWidth: '1.5rem',
                  textAlign: 'center', borderRadius: '4px', fontSize: '0.72rem',
                  fontWeight: 700, padding: '0.1rem 0.3rem', flexShrink: 0,
                }}>
                  {p._entry?.fieldNr ?? '-'}
                </span>
                <span style={{ fontStyle: p._isEmpty ? 'italic' : 'normal', fontSize: '0.88rem' }}>
                  {p._isEmpty ? '---' : p.name}
                </span>
                {!p._isEmpty && p._entry?.isReskip && <ReskipPill />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
