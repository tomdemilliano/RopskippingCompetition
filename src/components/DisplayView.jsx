import React, { useState, useMemo } from 'react';
import { 
  Maximize2, Minimize2, Clock, X, Coffee, ChevronRight
} from 'lucide-react';
import { isFreestyleType } from '../constants';

const DisplayView = ({ 
  selectedComp, 
  activeEvent, 
  activeReeks, 
  liveParticipants: allParticipants,
  timeDiff,
  onClose 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Verkrijg de gesorteerde lijst van events uit de competitie
  const sortedEvents = useMemo(() => {
    if (!selectedComp || !selectedComp.events) return [];
    const order = selectedComp.eventOrder || {};
    return [...selectedComp.events].sort((a, b) => (order[a] || 0) - (order[b] || 0));
  }, [selectedComp]);

  // 1. Filter de deelnemers specifiek voor het event dat de Display moet tonen
  const currentEventParticipants = useMemo(() => {
    if (!activeEvent || !allParticipants) return [];
    return Object.values(allParticipants)
      .filter(p => p.events?.includes(activeEvent) && p.status !== 'geschrapt' && p.eventStatus?.[activeEvent] !== 'geschrapt')
      .sort((a, b) => {
        const eventKey = `reeks_${activeEvent.replace(/\s/g, '')}`;
        const ra = parseInt(a[eventKey]) || 0;
        const rb = parseInt(b[eventKey]) || 0;
        if (ra !== rb) return ra - rb;
        return (a[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || '').toString().localeCompare((b[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || '').toString());
      });
  }, [allParticipants, activeEvent]);

  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  const detailKey = `detail_${activeEvent?.replace(/\s/g, '')}`;
  const isFreestyle = isFreestyleType(activeEvent);

  // Helper om een reeks deelnemers aan te vullen met lege velden (voor Speed)
  const getFullFields = (participantsInReeks, specificDetailKey) => {
    if (participantsInReeks.length === 0) return [];
    
    const maxVeld = Math.max(...participantsInReeks.map(p => parseInt(p[specificDetailKey]?.veld) || 0), 0);
    const fullList = [];

    for (let v = 1; v <= maxVeld; v++) {
      const skipper = participantsInReeks.find(p => (parseInt(p[specificDetailKey]?.veld) || 0) === v);
      if (skipper) {
        fullList.push(skipper);
      } else {
        fullList.push({
          naam: "---",
          club: "",
          [specificDetailKey]: { veld: v.toString() },
          isEmpty: true
        });
      }
    }
    return fullList;
  };

  const totalReeksen = Math.max(...currentEventParticipants.map(p => parseInt(p[eventKey]) || 0), 0);
  const rawCurrentSkippers = currentEventParticipants.filter(p => parseInt(p[eventKey]) === activeReeks);
  const isPause = rawCurrentSkippers.some(p => p.naam && p.naam.startsWith('PAUZE_'));

  const currentSkippers = isFreestyle 
    ? rawCurrentSkippers 
    : getFullFields(rawCurrentSkippers, detailKey);

  // --- AANGEPASTE LOGICA VOOR VOLGENDE (VOLGEND ONDERDEEL DETECTIE) ---
  const { nextUp, nextEventName, isNextEvent } = useMemo(() => {
    // Check of er nog een reeks is in het huidige event
    const hasMoreInCurrent = activeReeks < totalReeksen;
    
    if (hasMoreInCurrent) {
      const nextR = activeReeks + 1;
      let list = [];
      if (isFreestyle) {
        // Voor freestyle tonen we de komende 8 skippers
        list = currentEventParticipants.filter(p => parseInt(p[eventKey]) > activeReeks).slice(0, 8);
      } else {
        // Voor speed tonen we de volledige volgende reeks met velden
        const rawNext = currentEventParticipants.filter(p => parseInt(p[eventKey]) === nextR);
        list = getFullFields(rawNext, detailKey);
      }
      return { nextUp: list, nextEventName: activeEvent, isNextEvent: false };
    } 

    // ALS HET HUIDIGE ONDERDEEL AFGELOPEN IS: Zoek het volgende event
    const currentIndex = sortedEvents.indexOf(activeEvent);
    const nextEvent = sortedEvents[currentIndex + 1];

    if (nextEvent) {
      const nextEventKey = `reeks_${nextEvent.replace(/\s/g, '')}`;
      const nextDetailKey = `detail_${nextEvent.replace(/\s/g, '')}`;
      const nextIsFreestyle = isFreestyleType(nextEvent);

      const nextParts = Object.values(allParticipants)
        .filter(p => p.events?.includes(nextEvent) && p.status !== 'geschrapt' && p.eventStatus?.[nextEvent] !== 'geschrapt')
        .sort((a, b) => (parseInt(a[nextEventKey]) || 0) - (parseInt(b[nextEventKey]) || 0));

      let list = [];
      if (nextParts.length > 0) {
        if (nextIsFreestyle) {
          list = nextParts.filter(p => parseInt(p[nextEventKey]) === 1).slice(0, 8);
        } else {
          const rawNext = nextParts.filter(p => parseInt(p[nextEventKey]) === 1);
          list = getFullFields(rawNext, nextDetailKey);
        }
        return { nextUp: list, nextEventName: nextEvent, isNextEvent: true };
      }
    }

    // Geen volgende reeksen of events meer
    return { nextUp: [], nextEventName: null, isNextEvent: false };
  }, [activeReeks, totalReeksen, activeEvent, currentEventParticipants, sortedEvents, allParticipants, eventKey, detailKey, isFreestyle]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getExpectedTime = (p, currentNextEvent) => {
    if (!currentNextEvent) return null;
    const dKey = `detail_${currentNextEvent.replace(/\s/g, '')}`;
    const plannedStr = p[dKey]?.uur;
    if (!plannedStr || !timeDiff) return plannedStr;
    const [hours, minutes] = plannedStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + timeDiff, 0);
    return date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (!selectedComp || selectedComp.status !== 'bezig') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem' }}>Geen actieve wedstrijd</h1>
          <button onClick={onClose} style={{ marginTop: '2rem', padding: '1rem 2rem', borderRadius: '8px', border: 'none', background: '#334155', color: 'white', cursor: 'pointer' }}>Terug naar beheer</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: '#0f172a', color: '#f8fafc', zIndex: 9999,
      fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Top Bar */}
      <div style={{ 
        padding: '1rem 2.5rem', background: 'rgba(30, 41, 59, 0.8)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)' 
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 900 }}>
          {selectedComp.name} <span style={{ color: '#38bdf8', marginLeft: '1rem', fontWeight: 400 }}>| {activeEvent}</span>
        </div>
        
        <div style={{ textAlign: 'right', display: 'flex', gap: '1rem' }}>
          <button onClick={toggleFullscreen} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>
            {isFullscreen ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
          </button>
          <button onClick={onClose} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>
            <X size={20}/>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Current Status or Pause */}
        <div style={{ width: '30%', padding: '1.5rem 2rem', borderRight: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.3)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {!isPause && (
              <div style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                Nu bezig: Reeks {activeReeks} van {totalReeksen}
              </div>
            )}

            {isPause ? (
              <div style={{ 
                background: 'rgba(56, 189, 248, 0.1)', 
                padding: '4rem 1rem', 
                borderRadius: '15px', 
                border: '2px dashed #38bdf8',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2rem',
                marginTop: '2rem'
              }}>
                <Coffee size={120} color="#38bdf8" strokeWidth={1.5} />
                <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '4px' }}>PAUZE</div>
              </div>
            ) : (
              <div style={{ 
                background: 'rgba(30, 41, 59, 0.4)', 
                padding: '1rem', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.1)' 
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentSkippers.map((p, i) => (
                    <div key={i} style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', opacity: p.isEmpty ? 0.5 : 1 }}>
                      <span style={{ 
                        background: '#334155', 
                        color: '#fff',
                        minWidth: '1.8rem', textAlign: 'center',
                        padding: '0.1rem 0.3rem', borderRadius: '4px', 
                        fontSize: '0.85rem', fontWeight: 700 
                      }}>
                        {p[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld || '-'}
                      </span>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 400, fontStyle: p.isEmpty ? 'italic' : 'normal' }}>{p.naam}</span>
                        {!p.isEmpty && p.club && (
                          <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: '0.5rem' }}>({p.club})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>TIJDSSCHEMA</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Clock size={28} color="#38bdf8" />
              {new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            {timeDiff !== 0 && (
              <div style={{ 
                marginTop: '0.8rem', padding: '0.6rem', borderRadius: '8px', 
                background: timeDiff > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: timeDiff > 0 ? '#f87171' : '#34d399',
                fontSize: '0.9rem', fontWeight: 'bold'
              }}>
                {timeDiff > 0 ? `+${timeDiff} min` : `${timeDiff} min`}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Next Up List */}
        <div style={{ flex: 1, padding: '1rem 2.5rem', overflowY: 'auto' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: '#f8fafc' }}>
              Volgende
            </h2>
            {isNextEvent && nextEventName && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '0.5rem', 
                background: '#38bdf8', color: '#0f172a', 
                padding: '0.4rem 1rem', borderRadius: '12px', fontWeight: 800, fontSize: '1rem' 
              }}>
                <ChevronRight size={20} />
                VOLGEND ONDERDEEL: {nextEventName.toUpperCase()}
              </div>
            )}
          </div>

          {nextUp.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'left' }}>
                  <th style={{ padding: '0 1rem' }}>Verwacht</th>
                  <th style={{ padding: '0 1rem' }}>Veld</th>
                  <th style={{ padding: '0 1rem' }}>Skipper / Team</th>
                  <th style={{ padding: '0 1rem' }}>Club</th>
                </tr>
              </thead>
              <tbody>
                {nextUp.map((p, idx) => {
                  const time = getExpectedTime(p, nextEventName);
                  const isNextPause = p.naam && p.naam.startsWith('PAUZE_');
                  const currentNextDetailKey = `detail_${nextEventName?.replace(/\s/g, '')}`;

                  return (
                    <tr key={idx} style={{ 
                      background: isNextPause ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                      fontSize: '1.4rem',
                      opacity: p.isEmpty ? 0.6 : 1
                    }}>
                      <td style={{ padding: '0.6rem 1rem', borderRadius: '10px 0 0 10px', fontWeight: 800, color: '#94a3b8' }}>
                        {time || '--:--'}
                      </td>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        {!isNextPause && (
                          <span style={{ 
                            background: '#334155', 
                            color: '#fff',
                            minWidth: '2.2rem', display: 'inline-block', textAlign: 'center',
                            padding: '0.1rem 0.6rem', borderRadius: '6px'
                          }}>
                            {p[currentNextDetailKey]?.veld || '-'}
                          </span>
                        )}
                      </td>
                      <td 
                        colSpan={isNextPause ? 2 : 1} 
                        style={{ padding: '0.6rem 1rem', fontWeight: 800, fontStyle: (p.isEmpty || isNextPause) ? 'italic' : 'normal' }}
                      >
                        {isNextPause ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#38bdf8' }}>
                            <Coffee size={24} />
                            <span>PAUZE</span>
                          </div>
                        ) : (
                          p.naam
                        )}
                      </td>
                      {!isNextPause && (
                        <td style={{ padding: '0.6rem 1rem', borderRadius: '0 10px 10px 0', color: '#94a3b8', fontSize: '1.2rem' }}>
                          {p.club}
                        </td>
                      )}
                      {isNextPause && <td style={{ borderRadius: '0 10px 10px 0' }}></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ 
              marginTop: '4rem', textAlign: 'center', padding: '3rem', 
              background: 'rgba(30, 41, 59, 0.4)', borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)' 
            }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#94a3b8' }}>
                De wedstrijd is afgelopen
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#38bdf8', color: '#0f172a', padding: '0.5rem', fontWeight: 800, fontSize: '1rem', textAlign: 'center' }}>
        MELD JE TIJDIG AAN BIJ DE STEWARD • KIJK GOED NAAR JE VELDNUMMER • VEEL SUCCES!
      </div>
    </div>
  );
};

export default DisplayView;
