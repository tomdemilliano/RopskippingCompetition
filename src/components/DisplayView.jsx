import React, { useState } from 'react';
import { 
  Maximize2, Minimize2, Clock, X 
} from 'lucide-react';
import { isFreestyleType } from '../constants';

const DisplayView = ({ 
  selectedComp, 
  activeEvent, 
  activeReeks, 
  liveParticipants, 
  timeDiff,
  onClose 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Hulpvariabelen voor data-extractie
  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  const detailKey = `detail_${activeEvent?.replace(/\s/g, '')}`;
  const isFreestyle = isFreestyleType(activeEvent);

  // 1. Deelnemers die NU bezig zijn (huidige reeks)
  const currentSkippers = liveParticipants.filter(p => parseInt(p[eventKey]) === activeReeks);

  // 2. Logica voor "Volgende" (Klaarhouden)
  let nextUp = [];
  if (isFreestyle) {
    // Bij freestyle: de eerstvolgende 8 skippers (ongeacht reeks, maar meestal de volgende nummers)
    nextUp = liveParticipants
      .filter(p => parseInt(p[eventKey]) > activeReeks)
      .slice(0, 8);
  } else {
    // Bij speed: alle deelnemers van enkel de eerstvolgende reeks
    nextUp = liveParticipants
      .filter(p => parseInt(p[eventKey]) === (activeReeks + 1));
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getExpectedTime = (plannedStr) => {
    if (!plannedStr || !timeDiff) return plannedStr;
    const [hours, minutes] = plannedStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + timeDiff, 0);
    return date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
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
        padding: '1.5rem 2.5rem', background: 'rgba(30, 41, 59, 0.5)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)' 
      }}>
        <div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>{selectedComp.name}</div>
        </div>
        
        <div style={{ textAlign: 'right', display: 'flex', gap: '1rem' }}>
          <button onClick={toggleFullscreen} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}>
            {isFullscreen ? <Minimize2 size={24}/> : <Maximize2 size={24}/>}
          </button>
          <button onClick={onClose} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}>
            <X size={24}/>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Current Status */}
        <div style={{ width: '35%', padding: '2.5rem', borderRight: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.3)' }}>
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.8rem', textTransform: 'uppercase' }}>
              Nu bezig: {activeEvent}
            </div>
            <div style={{ 
              background: 'rgba(30, 41, 59, 0.4)', 
              padding: '1.5rem', 
              borderRadius: '15px', 
              border: '1px solid rgba(255,255,255,0.1)' 
            }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', marginBottom: '1rem' }}>
                Reeks {activeReeks}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentSkippers.map((p, i) => (
                  <div key={i} style={{ fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.naam}</span>
                    <span style={{ color: '#64748b', fontSize: '1rem' }}>Veld {p[detailKey]?.veld || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>TIJDSSCHEMA</div>
            <div style={{ fontSize: '3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Clock size={40} color="#38bdf8" />
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {timeDiff !== 0 && (
              <div style={{ 
                marginTop: '1rem', padding: '1rem', borderRadius: '12px', 
                background: timeDiff > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: timeDiff > 0 ? '#f87171' : '#34d399',
                fontSize: '1.1rem', fontWeight: 'bold'
              }}>
                {timeDiff > 0 ? `Vertraging: +${timeDiff} min` : `Voor op schema: ${Math.abs(timeDiff)} min`}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Next Up List */}
        <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, color: '#f8fafc' }}>
              Volgende
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: '1.1rem', textAlign: 'left' }}>
                <th style={{ padding: '0 1rem' }}>Verwacht</th>
                <th style={{ padding: '0 1rem' }}>Reeks</th>
                <th style={{ padding: '0 1rem' }}>Veld</th>
                <th style={{ padding: '0 1rem' }}>Skipper / Team</th>
                <th style={{ padding: '0 1rem' }}>Club</th>
              </tr>
            </thead>
            <tbody>
              {nextUp.map((p, idx) => {
                const time = getExpectedTime(p[detailKey]?.uur);

                return (
                  <tr key={idx} style={{ 
                    background: 'rgba(30, 41, 59, 0.4)',
                    fontSize: '1.6rem',
                    transition: 'all 0.3s ease'
                  }}>
                    <td style={{ padding: '1.2rem 1rem', borderRadius: '15px 0 0 15px', fontWeight: 900, color: '#94a3b8' }}>
                      {time || '--:--'}
                    </td>
                    <td style={{ padding: '1.2rem 1rem', fontWeight: 700 }}>{p[eventKey]}</td>
                    <td style={{ padding: '1.2rem 1rem' }}>
                      <span style={{ 
                        background: '#334155', 
                        color: '#fff',
                        padding: '0.2rem 0.8rem', borderRadius: '8px'
                      }}>
                        {p[detailKey]?.veld || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem 1rem', fontWeight: 900 }}>{p.naam}</td>
                    <td style={{ padding: '1.2rem 1rem', borderRadius: '0 15px 15px 0', color: '#94a3b8' }}>{p.club}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {nextUp.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#475569', fontSize: '1.5rem' }}>
              Geen verdere deelnemers gepland.
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div style={{ background: '#38bdf8', color: '#0f172a', padding: '0.8rem', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }}>
        MELD JE TIJDIG AAN BIJ DE STEWARD • KIJK GOED NAAR JE VELDNUMMER • VEEL SUCCES!
      </div>
    </div>
  );
};

export default DisplayView;
