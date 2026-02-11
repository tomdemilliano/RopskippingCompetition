import React from 'react';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Check, Flag, Mic2, FastForward, Ghost, Clock, MapPin
} from 'lucide-react';
import { isFreestyleType } from '../constants';
import { styles } from '../styles';

const LiveView = ({ 
  selectedComp, 
  activeEvent, 
  setActiveEvent, 
  activeReeks, 
  setActiveReeks, 
  reeksenInEvent, 
  liveParticipants, 
  currentReeksData, 
  plannedTime, 
  timeDiff, 
  finishedReeksen, 
  finishedEvents, 
  handleFinishReeks,
  sortedEvents
}) => {
  
  if (!selectedComp || selectedComp.status !== 'bezig') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '70vh', 
        color: '#94a3b8',
        textAlign: 'center'
      }}>
        <div style={{ 
          background: '#f1f5f9', 
          padding: '2rem', 
          borderRadius: '50%', 
          marginBottom: '1.5rem',
          border: '4px solid #e2e8f0'
        }}>
          <Ghost size={80} color="#cbd5e1" strokeWidth={1.5} />
        </div>
        <h2 style={{ color: '#475569', marginBottom: '0.5rem', fontWeight: 800 }}>
          Momenteel geen actieve wedstrijd
        </h2>
        <p style={{ maxWidth: '300px', lineHeight: '1.5' }}>
          Zodra er een wedstrijd gestart wordt in het beheerpaneel, verschijnt deze hier live.
        </p>
      </div>
    );
  }

  const isFreestyle = isFreestyleType(activeEvent);
  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  const detailKey = `detail_${activeEvent?.replace(/\s/g, '')}`;
  
  const currentReeksIndex = reeksenInEvent.indexOf(activeReeks);
  const upcomingParticipants = liveParticipants.filter(p => {
    const pReeks = parseInt(p[eventKey]);
    return pReeks > activeReeks;
  });

  const nextSkipper = upcomingParticipants[0];
  const furtherParticipants = upcomingParticipants.slice(1);
  
  const totaalReeksen = reeksenInEvent.length;
  const isEersteReeks = activeReeks === reeksenInEvent[0];
  const isLaatsteReeks = activeReeks === reeksenInEvent[reeksenInEvent.length - 1];
  const isReeksKlaar = finishedReeksen[activeEvent]?.includes(activeReeks);

  const maxVeldInReeks = currentReeksData.reduce((max, p) => {
    const veld = parseInt(p[detailKey]?.veld) || 0;
    return veld > max ? veld : max;
  }, 0);

  // Helper om verwachte tijd te berekenen
  const getExpectedTime = (plannedStr) => {
    if (!plannedStr || Math.abs(timeDiff || 0) <= 2) return plannedStr;
    
    try {
      const [hours, minutes] = plannedStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes + timeDiff, 0);
      return date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return plannedStr;
    }
  };

  const RenderHeader = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <span style={{ 
          fontSize: '0.75rem', 
          fontWeight: 900, 
          color: '#94a3b8', 
          letterSpacing: '0.1em', 
          textTransform: 'uppercase' 
        }}>
          {selectedComp.name}
        </span>
      </div>

      <div style={{ 
        ...styles.reeksNav, 
        minHeight: 'auto',
        display: 'flex', 
        flexDirection: 'column', 
        padding: '0.75rem 1.5rem', 
        gap: '0.75rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <button 
            disabled={isEersteReeks}
            style={{ ...styles.btnSecondary, opacity: isEersteReeks ? 0.3 : 1, cursor: isEersteReeks ? 'not-allowed' : 'pointer', width: '60px' }} 
            onClick={() => setActiveReeks(reeksenInEvent[currentReeksIndex - 1])}
          >
            <ChevronLeft/>
          </button>
          
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: isReeksKlaar ? '#10b981' : '#1e293b' }}>
              {isFreestyle ? activeEvent : 'Reeks'} {activeReeks} 
              <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '1.2rem', marginLeft: '4px' }}>/ {totaalReeksen}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>
              Gepland: {plannedTime || '--:--'}
              {timeDiff !== null && !isReeksKlaar && Math.abs(timeDiff) > 2 && (
                <span style={{ color: timeDiff > 0 ? '#ef4444' : '#10b981', marginLeft: '4px' }}>
                  (Verwacht: {getExpectedTime(plannedTime)})
                </span>
              )}
            </div>
          </div>

          <button 
            disabled={isLaatsteReeks}
            style={{ ...styles.btnSecondary, opacity: isLaatsteReeks ? 0.3 : 1, cursor: isLaatsteReeks ? 'not-allowed' : 'pointer', width: '60px' }} 
            onClick={() => setActiveReeks(reeksenInEvent[currentReeksIndex + 1])}
          >
            <ChevronRight/>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '0.25rem' }}>
          {isReeksKlaar ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 900, background: '#f0fdf4', padding: '0.5rem 1.5rem', borderRadius: '8px', border: '2px solid #bbf7d0', fontSize: '0.9rem' }}>
              <CheckCircle size={18} /> VOLTOOID
            </div>
          ) : (
            <button style={{ ...styles.btnPrimary, background: '#10b981', padding: '0.6rem 2.5rem', fontSize: '1rem' }} onClick={handleFinishReeks}>
              {isLaatsteReeks ? `${activeEvent} klaar` : 'Volgende'} <ChevronRight size={20} style={{ marginLeft: '4px' }}/>
            </button>
          )}
        </div>
      </div>
    </>
  );

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

      <div style={{...styles.liveContent, position: 'relative', overflowY: 'auto'}}>
        <RenderHeader />

        {!isFreestyle ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', width: 'fit-content', margin: '0 auto' }}>
            {[...Array(maxVeldInReeks || 0)].map((_, i) => {
              const veldNum = i + 1;
              const p = currentReeksData.find(cp => cp[detailKey]?.veld === veldNum);
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
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.2rem', 
            maxWidth: '900px', 
            minWidth: '800px', // Vaste breedte voor stabiliteit
            margin: '0 auto', 
            width: '100%', 
            paddingBottom: '2rem' 
          }}>
            {/* NU AAN DE BEURT - Zachter contrast en kleiner font */}
            <div style={{ background: '#334155', color: '#fff', padding: '1.2rem 2rem', borderRadius: '16px', position: 'relative' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic2 size={14}/> NU AAN DE BEURT
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1.1 }}>{currentReeksData[0]?.naam || '---'}</div>
                  <div style={{ fontSize: '1.1rem', opacity: 0.8 }}>{currentReeksData[0]?.club}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.6rem 1.2rem', borderRadius: '12px', textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', opacity: 0.8 }}>VELD</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{currentReeksData[0]?.[detailKey]?.veld || '-'}</div>
                </div>
              </div>
            </div>

            {/* VOLGENDE AAN DE BEURT */}
            {nextSkipper ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div>
                  <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <FastForward size={14}/> VOLGENDE
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{nextSkipper.naam}</div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>{nextSkipper.club}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#64748b' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#334155' }}>VELD {nextSkipper[detailKey]?.veld}</div>
                  <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                    <Clock size={13}/> {getExpectedTime(nextSkipper[detailKey]?.uur)}
                  </div>
                </div>
              </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontStyle: 'italic' }}>Einde van dit onderdeel</div>
            )}

            {/* PROGRAMMA GRID */}
            {furtherParticipants.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>VERDER PROGRAMMA</div>
                <div style={{ maxHeight: '350px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '2px solid #f1f5f9', zIndex: 1 }}>
                      <tr style={{ textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>Tijd</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>Veld</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>Skipper</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 'bold' }}>Club</th>
                      </tr>
                    </thead>
                    <tbody>
                      {furtherParticipants.map((p, idx) => {
                        const originalTime = p[detailKey]?.uur;
                        const expectedTime = getExpectedTime(originalTime);
                        const isDelayed = originalTime !== expectedTime;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', color: isDelayed ? '#ef4444' : '#64748b' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12}/>
                                {expectedTime}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#334155' }}>{p[detailKey]?.veld}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '800', color: '#1e293b' }}>{p.naam}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.club}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;
