import React from 'react';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Check, Flag, Mic2, FastForward, Coffee, Trophy, Utensils
} from 'lucide-react';
import { isFreestyleType } from '../constants';
import { styles } from '../styles';

const LiveView = ({ 
  selectedComp, activeEvent, setActiveEvent, activeReeks, setActiveReeks, 
  reeksenInEvent, liveParticipants, currentReeksData, plannedTime, 
  timeDiff, finishedReeksen, finishedEvents, handleFinishReeks, sortedEvents
}) => {
  // 1. Duidelijke boodschap indien geen actieve wedstrijd
  if (!selectedComp) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>
      <Coffee size={64} strokeWidth={1} style={{ marginBottom: '1rem' }} />
      <h3 style={{ margin: 0 }}>Geen actieve wedstrijd</h3>
      <p>Selecteer een wedstrijd in het beheer om de Live View te starten.</p>
    </div>
  );

  const isFreestyle = isFreestyleType(activeEvent);
  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  
  // Zoek de volgende skipper (sla pauzes over voor de 'Volgende aan de beurt' melding)
  const nextSkipper = isFreestyle ? liveParticipants.find(p => parseInt(p[eventKey]) === activeReeks + 1 && p.status !== 'pauze') : null;
  
  const totaalReeksen = reeksenInEvent.length;
  const isEersteReeks = activeReeks === reeksenInEvent[0];
  const isLaatsteReeks = activeReeks === reeksenInEvent[reeksenInEvent.length - 1];
  const isReeksKlaar = finishedReeksen[activeEvent]?.includes(activeReeks);

  // Check of de huidige reeks een pauze is
  const isPauzeReeks = currentReeksData.length > 0 && currentReeksData[0].status === 'pauze';

  const maxVeldInReeks = currentReeksData.reduce((max, p) => {
    const veld = parseInt(p[`detail_${activeEvent?.replace(/\s/g, '')}`]?.veld) || 0;
    return veld > max ? veld : max;
  }, 0);

  return (
    <div style={styles.liveGrid}>
      <div style={styles.liveLeft}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 'bold', color: '#64748b' }}>ONDERDELEN</span>
        </div>
        {sortedEvents.map(ev => {
          const isEventDone = finishedEvents.includes(ev);
          return (
            <div key={ev} 
              onClick={() => { setActiveEvent(ev); setActiveReeks(1); }}
              style={{ 
                padding: '1rem 1.5rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: activeEvent === ev ? '#f0f7ff' : (isEventDone ? '#f1f5f9' : '#fff'),
                color: activeEvent === ev ? '#2563eb' : (isEventDone ? '#94a3b8' : '#475569'),
                fontWeight: activeEvent === ev ? 'bold' : 'normal',
                borderLeft: activeEvent === ev ? '4px solid #2563eb' : '4px solid transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
              <span>{ev}</span>
              {isEventDone && <Check size={14} color="#10b981" />}
            </div>
          );
        })}
      </div>

      <div style={{...styles.liveContent, position: 'relative'}}>
        {/* 2. Naam van de wedstrijd boven het frame */}
        <div style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: 800 }}>{selectedComp.name}</h1>
        </div>

        {!isFreestyle ? (
          <>
            {/* 3. Minder witruimte rond 'reeks klaar' (padding van 1.5rem naar 1rem) */}
            <div style={{ ...styles.reeksNav, minHeight: '120px', display: 'flex', flexDirection: 'column', padding: '1rem', gap: '0.75rem' }}>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <button 
                  disabled={isEersteReeks}
                  style={{ ...styles.btnSecondary, opacity: isEersteReeks ? 0.3 : 1, cursor: isEersteReeks ? 'not-allowed' : 'pointer', width: '60px' }} 
                  onClick={() => setActiveReeks(reeksenInEvent[reeksenInEvent.indexOf(activeReeks) - 1])}
                >
                  <ChevronLeft/>
                </button>
                
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: isReeksKlaar ? '#10b981' : '#1e293b' }}>
                    Reeks {activeReeks} 
                    <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '1.2rem', marginLeft: '4px' }}>/ {totaalReeksen}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>
                    Gepland: {plannedTime || '--:--'}
                    {timeDiff !== null && !isReeksKlaar && (
                      <span style={{ color: timeDiff > 5 ? '#ef4444' : '#10b981', marginLeft: '4px' }}>
                        ({timeDiff > 0 ? `+${timeDiff}` : timeDiff} min)
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  disabled={isLaatsteReeks}
                  style={{ ...styles.btnSecondary, opacity: isLaatsteReeks ? 0.3 : 1, cursor: isLaatsteReeks ? 'not-allowed' : 'pointer', width: '60px' }} 
                  onClick={() => setActiveReeks(reeksenInEvent[reeksenInEvent.indexOf(activeReeks) + 1])}
                >
                  <ChevronRight/>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 'auto' }}>
                {isReeksKlaar ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 900, background: '#f0fdf4', padding: '0.5rem 1.5rem', borderRadius: '8px', border: '2px solid #bbf7d0' }}>
                    <CheckCircle size={20} /> REEKS VOLTOOID
                  </div>
                ) : (
                  <button style={{ ...styles.btnPrimary, background: '#10b981', padding: '0.6rem 2.5rem', fontSize: '1rem' }} onClick={handleFinishReeks}>
                    {isLaatsteReeks ? `${activeEvent} klaar` : 'Reeks klaar'} <ChevronRight size={20} style={{ marginLeft: '4px' }}/>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', width: 'fit-content', margin: '0 auto' }}>
              {[...Array(maxVeldInReeks || 0)].map((_, i) => {
                const veldNum = i + 1;
                const p = currentReeksData.find(cp => cp[`detail_${activeEvent.replace(/\s/g, '')}`]?.veld === veldNum);
                return (
                  <div key={veldNum} style={{ 
                    background: isReeksKlaar ? '#f1f5f9' : (p ? '#fff' : 'transparent'), 
                    padding: '0.6rem 1rem', borderRadius: '10px', 
                    border: p ? '1px solid #cbd5e1' : '1px dashed #cbd5e1',
                    display: 'flex', alignItems: 'center', gap: '1rem', height: '60px', minWidth: '350px',
                    opacity: isReeksKlaar ? 0.6 : 1
                  }}>
                    <div style={{ background: p ? (isReeksKlaar ? '#94a3b8' : '#2563eb') : '#cbd5e1', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{veldNum}</div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: p ? '#1e293b' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p ? p.naam : '---'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{p?.club || ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Freestyle View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={styles.reeksNav}>
              <button style={styles.btnSecondary} onClick={() => setActiveReeks(Math.max(1, activeReeks - 1))}><ChevronLeft/></button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{activeEvent} - Reeks {activeReeks}</div>
              </div>
              <button style={{ ...styles.btnPrimary, background: '#10b981' }} onClick={handleFinishReeks}>
                <FastForward size={18}/> Volgende
              </button>
            </div>

            {/* Speciale weergave voor pauze in Freestyle */}
            {isPauzeReeks ? (
              <div style={{ background: '#f8fafc', color: '#64748b', padding: '4rem', borderRadius: '20px', textAlign: 'center', border: '4px solid #e2e8f0' }}>
                {currentReeksData[0].club.toLowerCase().includes('prijs') ? <Trophy size={64} style={{marginBottom: '1rem'}}/> : <Utensils size={64} style={{marginBottom: '1rem'}}/>}
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#1e293b' }}>{currentReeksData[0].club}</div>
              </div>
            ) : (
              <div style={{ background: '#2563eb', color: '#fff', padding: '3rem', borderRadius: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', opacity: 0.8, marginBottom: '1rem' }}><Mic2 size={24}/> NU AAN DE BEURT</div>
                <div style={{ fontSize: '4.5rem', fontWeight: 900 }}>{currentReeksData[0]?.naam || '---'}</div>
                <div style={{ fontSize: '2rem' }}>{currentReeksData[0]?.club}</div>
              </div>
            )}

            {nextSkipper && (
              <div style={{ background: '#fff', border: '2px dashed #cbd5e1', padding: '2rem', borderRadius: '20px', opacity: 0.7 }}>
                <div style={{ color: '#64748b', fontWeight: 'bold' }}>VOLGENDE AAN DE BEURT</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{nextSkipper.naam}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;
