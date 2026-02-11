import React, { useState, useEffect } from 'react';
import { 
  Maximize2, Minimize2, Clock, Users, MapPin, FastForward, PlayCircle, X 
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

  // Filter deelnemers die nog moeten komen (huidige reeks en verder)
  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  const detailKey = `detail_${activeEvent?.replace(/\s/g, '')}`;

  const upcoming = liveParticipants.filter(p => {
    const pReeks = parseInt(p[eventKey]);
    return pReeks >= activeReeks;
  });

  // De huidige actieve skipper(s)
  const currentSkippers = upcoming.filter(p => parseInt(p[eventKey]) === activeReeks);
  // De skippers die hierna komen (volgende reeksen)
  const nextUp = upcoming.filter(p => parseInt(p[eventKey]) > activeReeks).slice(0, 15);

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
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em' }}>OPWARMRUIMTE DISPLAY</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{selectedComp.name}</div>
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
            <div style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>NU BEZIG</div>
            <div style={{ background: '#2563eb', padding: '2rem', borderRadius: '20px', boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1.1 }}>{activeEvent}</div>
              <div style={{ fontSize: '4rem', fontWeight: 900 }}>Reeks {activeReeks}</div>
            </div>
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>TIJDSSCHEMA</div>
            <div style={{ fontSize: '3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Clock size={40} color="#38bdf8" />
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {timeDiff !== 0 && (
              <div style={{ 
                marginTop: '1rem', padding: '1rem', borderRadius: '12px', 
                background: timeDiff > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: timeDiff > 0 ? '#f87171' : '#34d399',
                fontSize: '1.2rem', fontWeight: 'bold'
              }}>
                {timeDiff > 0 ? `Vertraging: +${timeDiff} min` : `Voor op schema: ${Math.abs(timeDiff)} min`}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Upcoming List (The Main Focus) */}
        <div style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, color: '#f8fafc' }}>
              Klaarhouden <span style={{ color: '#38bdf8' }}>programma</span>
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '1.1rem' }}>{nextUp.length + currentSkippers.length} skippers in overzicht</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px' }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: '1.2rem', textAlign: 'left' }}>
                <th style={{ padding: '0 1rem' }}>Verwacht</th>
                <th style={{ padding: '0 1rem' }}>Reeks</th>
                <th style={{ padding: '0 1rem' }}>Veld</th>
                <th style={{ padding: '0 1rem' }}>Skipper / Team</th>
                <th style={{ padding: '0 1rem' }}>Club</th>
              </tr>
            </thead>
            <tbody>
              {/* Combineer huidige reeks (als die nog loopt) en de volgende reeksen */}
              {[...currentSkippers, ...nextUp].map((p, idx) => {
                const isCurrent = parseInt(p[eventKey]) === activeReeks;
                const time = getExpectedTime(p[detailKey]?.uur);

                return (
                  <tr key={idx} style={{ 
                    background: isCurrent ? 'rgba(255,255,255,0.05)' : 'rgba(30, 41, 59, 0.4)',
                    fontSize: isCurrent ? '1.8rem' : '1.5rem',
                    transition: 'all 0.3s ease'
                  }}>
                    <td style={{ padding: '1.5rem 1rem', borderRadius: '15px 0 0 15px', fontWeight: 900, color: isCurrent ? '#38bdf8' : '#94a3b8' }}>
                      {time || '--:--'}
                    </td>
                    <td style={{ padding: '1.5rem 1rem', fontWeight: 700 }}>{p[eventKey]}</td>
                    <td style={{ padding: '1.5rem 1rem' }}>
                      <span style={{ 
                        background: isCurrent ? '#38bdf8' : '#334155', 
                        color: isCurrent ? '#0f172a' : '#fff',
                        padding: '0.2rem 0.8rem', borderRadius: '8px'
                      }}>
                        {p[detailKey]?.veld || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '1.5rem 1rem', fontWeight: 900 }}>{p.naam}</td>
                    <td style={{ padding: '1.5rem 1rem', borderRadius: '0 15px 15px 0', color: '#94a3b8' }}>{p.club}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {upcoming.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#475569', fontSize: '2rem' }}>
              Geen deelnemers meer gepland voor dit onderdeel.
            </div>
          )}
        </div>
      </div>

      {/* Footer scrolling news or info */}
      <div style={{ background: '#38bdf8', color: '#0f172a', padding: '0.8rem', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }}>
        MELD JE TIJDIG AAN BIJ DE STEWARD • KIJK GOED NAAR JE VELDNUMMER • VEEL SUCCES!
      </div>
    </div>
  );
};

export default DisplayView;
