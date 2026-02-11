import React, { useState } from 'react';
import { 
  Maximize2, Minimize2, Clock, X, Coffee
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

  const eventKey = `reeks_${activeEvent?.replace(/\s/g, '')}`;
  const detailKey = `detail_${activeEvent?.replace(/\s/g, '')}`;
  const isFreestyle = isFreestyleType(activeEvent);

  // Bereken totaal aantal reeksen voor dit onderdeel
  const totalReeksen = Math.max(...liveParticipants.map(p => parseInt(p[eventKey]) || 0), 0);

  // Sortering op veld (numeriek) voor speed
  const currentSkippers = liveParticipants
    .filter(p => parseInt(p[eventKey]) === activeReeks)
    .sort((a, b) => {
      const veldA = parseInt(a[detailKey]?.veld) || 0;
      const veldB = parseInt(b[detailKey]?.veld) || 0;
      return veldA - veldB;
    });

  const isPause = currentSkippers.length === 0;

  let nextUp = [];
  if (isFreestyle) {
    nextUp = liveParticipants
      .filter(p => parseInt(p[eventKey]) > activeReeks)
      .slice(0, 8);
  } else {
    nextUp = liveParticipants
      .filter(p => parseInt(p[eventKey]) === (activeReeks + 1))
      .sort((a, b) => {
        const veldA = parseInt(a[detailKey]?.veld) || 0;
        const veldB = parseInt(b[detailKey]?.veld) || 0;
        return veldA - veldB;
      });
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
            <div style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
              Status: Reeks {activeReeks} van {totalReeksen}
            </div>

            {isPause ? (
              <div style={{ 
                background: 'rgba(56, 189, 248, 0.1)', 
                padding: '2rem 1rem', 
                borderRadius: '15px', 
                border: '2px dashed #38bdf8',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
              }}>
                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '2px' }}>PAUZE</div>
                <img 
                  src="https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&q=80&w=300&h=300" 
                  alt="Pause" 
                  style={{ width: '80%', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}
                />
                <Coffee size={48} color="#38bdf8" />
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
                    <div key={i} style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ 
                        background: '#334155', 
                        color: '#fff',
                        minWidth: '1.8rem', textAlign: 'center',
                        padding: '0.1rem 0.3rem', borderRadius: '4px', 
                        fontSize: '0.85rem', fontWeight: 700 
                      }}>
                        {p[detailKey]?.veld || '-'}
                      </span>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 400 }}>{p.naam}</span>
                        <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: '0.5rem' }}>({p.club})</span>
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
          <div style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: '#f8fafc' }}>
              Volgende
            </h2>
          </div>

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
                const time = getExpectedTime(p[detailKey]?.uur);
                return (
                  <tr key={idx} style={{ 
                    background: 'rgba(30, 41, 59, 0.4)',
                    fontSize: '1.4rem',
                  }}>
                    <td style={{ padding: '0.6rem 1rem', borderRadius: '10px 0 0 10px', fontWeight: 800, color: '#94a3b8' }}>
                      {time || '--:--'}
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <span style={{ 
                        background: '#334155', 
                        color: '#fff',
                        minWidth: '2.2rem', display: 'inline-block', textAlign: 'center',
                        padding: '0.1rem 0.6rem', borderRadius: '6px'
                      }}>
                        {p[detailKey]?.veld || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 1rem', fontWeight: 800 }}>{p.naam}</td>
                    <td style={{ padding: '0.6rem 1rem', borderRadius: '0 10px 10px 0', color: '#94a3b8', fontSize: '1.2rem' }}>{p.club}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {nextUp.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: '1.1rem' }}>
              Geen verdere deelnemers gepland.
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
