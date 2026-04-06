/**
 * CompetitionList.jsx — RopeScore Pro
 *
 * Linkerkolom van de beheer-view.
 * Toont wedstrijden gegroepeerd in drie tabs: Gepland / Startklaar / Voltooid.
 *
 * Een wedstrijd is "startklaar" als elk event in het competitionType
 * minstens één actieve (niet-geschrapte) deelnemer heeft.
 */

import React, { useState, useMemo } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useAppContext } from '../../AppContext';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  sidebar: {
    width: '300px',
    background: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  topBar: {
    padding: '1rem',
    borderBottom: '1px solid #e2e8f0',
  },
  newBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1rem',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  tabBar: {
    display: 'flex',
    background: '#e2e8f0',
    margin: '0.75rem',
    padding: '3px',
    borderRadius: '8px',
    gap: '2px',
    flexShrink: 0,
  },
  tab: (active) => ({
    flex: 1,
    border: 'none',
    padding: '6px 4px',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: '6px',
    cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: active ? '#2563eb' : '#64748b',
    transition: 'all 0.15s',
  }),
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 0.75rem 1rem',
  },
  empty: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontStyle: 'italic',
  },
  card: (selected, isLive, isDone) => ({
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '0.5rem',
    border: '2px solid',
    borderColor: isLive
      ? '#ef4444'
      : selected
        ? '#2563eb'
        : isDone
          ? '#e2e8f0'
          : 'transparent',
    background: isDone
      ? '#f1f5f9'
      : selected
        ? '#f0f7ff'
        : '#fff',
    transition: 'all 0.15s',
  }),
  cardName: (isDone) => ({
    fontWeight: 700,
    fontSize: '0.875rem',
    color: isDone ? '#64748b' : '#1e293b',
    marginBottom: '3px',
  }),
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    color: '#94a3b8',
    marginBottom: '2px',
  },
  cardType: {
    fontSize: '0.65rem',
    color: '#cbd5e1',
  },
  badgeLive: {
    background: '#ef4444',
    color: '#fff',
    fontSize: '0.55rem',
    padding: '2px 5px',
    borderRadius: '3px',
    fontWeight: 900,
    letterSpacing: '0.05em',
  },
  warning: {
    fontSize: '0.65rem',
    color: '#f59e0b',
    fontWeight: 700,
    marginTop: '5px',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'gepland',    label: 'GEPLAND'    },
  { key: 'startklaar', label: 'STARTKLAAR' },
  { key: 'voltooid',   label: 'VOLTOOID'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {string}   props.selectedId        — geselecteerde wedstrijd-id
 * @param {function} props.onSelect          — cb(competitionId)
 * @param {function} props.onNewCompetition  — opent AddCompetitionModal
 */
export default function CompetitionList({ selectedId, onSelect, onNewCompetition }) {
  const { competitions, competitionTypes, events } = useAppContext();
  const [activeTab, setActiveTab] = useState('gepland');

  // Bereken per wedstrijd hoeveel events nog geen deelnemers hebben.
  // Omdat we hier geen participantsdata per wedstrijd hebben (die wordt
  // pas geladen bij selectie), tonen we alleen of het type volledig
  // geconfigureerd is op basis van de eventIds in het type.
  const getCompletionInfo = useMemo(() => {
    return (competition) => {
      const compType = competitionTypes.find(t => t.id === competition.typeId);
      if (!compType) return { isConfigured: false, eventCount: 0 };
      return {
        isConfigured: compType.eventIds.length > 0,
        eventCount:   compType.eventIds.length,
      };
    };
  }, [competitionTypes]);

  // Sorteer: nieuwste datum eerst
  const sorted = useMemo(() =>
    [...competitions].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    }),
  [competitions]);

  const byTab = useMemo(() => ({
    gepland:    sorted.filter(c => c.status === 'open'),
    startklaar: sorted.filter(c => c.status === 'bezig'),
    voltooid:   sorted.filter(c => c.status === 'beëindigd'),
  }), [sorted]);

  const currentList = byTab[activeTab] ?? [];

  return (
    <aside style={s.sidebar}>
      {/* Nieuwe wedstrijd */}
      <div style={s.topBar}>
        <button style={s.newBtn} onClick={onNewCompetition}>
          <Plus size={16} />
          Nieuwe wedstrijd
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={s.tab(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {byTab[tab.key].length > 0 && (
              <span style={{
                marginLeft: '4px',
                background: activeTab === tab.key ? '#2563eb' : '#94a3b8',
                color: '#fff',
                borderRadius: '8px',
                padding: '0 5px',
                fontSize: '0.6rem',
              }}>
                {byTab[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lijst */}
      <div style={s.list}>
        {currentList.length === 0 ? (
          <div style={s.empty}>
            {activeTab === 'gepland'    && 'Geen geplande wedstrijden'}
            {activeTab === 'startklaar' && 'Geen actieve wedstrijden'}
            {activeTab === 'voltooid'   && 'Geen voltooide wedstrijden'}
          </div>
        ) : (
          currentList.map(comp => {
            const isSelected = selectedId === comp.id;
            const isLive     = comp.status === 'bezig';
            const isDone     = comp.status === 'beëindigd';
            const { isConfigured, eventCount } = getCompletionInfo(comp);

            return (
              <div
                key={comp.id}
                style={s.card(isSelected, isLive, isDone)}
                onClick={() => onSelect(comp.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={s.cardName(isDone)}>{comp.name}</div>
                  {isLive && <span style={s.badgeLive}>LIVE</span>}
                </div>

                <div style={s.cardMeta}>
                  <Calendar size={11} />
                  {comp.date || 'Geen datum'}
                </div>

                {comp.location && (
                  <div style={s.cardType}>{comp.location}</div>
                )}

                <div style={{ ...s.cardType, marginTop: '2px' }}>
                  {competitionTypes.find(t => t.id === comp.typeId)?.name ?? '—'}
                  {' · '}
                  {eventCount} onderdelen
                </div>

                {!isConfigured && (
                  <div style={s.warning}>
                    ⚠ Wedstrijdtype niet gevonden
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
