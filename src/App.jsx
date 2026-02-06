import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, deleteDoc, arrayRemove, arrayUnion, addDoc, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Trash2, Upload, Plus, X, Calendar, MapPin, Users, Coffee, Search, CheckCircle2, AlertCircle, Archive, Star, GripVertical
} from 'lucide-react';

// ... (Firebase config logica blijft hetzelfde)

const App = () => {
  // ... (States blijven hetzelfde)
  const [draggedItem, setDraggedItem] = useState(null);

  // Helper om de gesorteerde actieve onderdelen te krijgen
  const sortedActiveEvents = useMemo(() => {
    if (!selectedComp || !selectedComp.events) return [];
    return [...selectedComp.events].sort((a, b) => {
      const orderA = selectedComp.eventOrder?.[a] ?? 99;
      const orderB = selectedComp.eventOrder?.[b] ?? 99;
      return orderA - orderB;
    });
  }, [selectedComp]);

  // Drag & Drop handlers
  const onDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
    // Maak het element semi-transparant tijdens slepen
    e.target.style.opacity = "0.5";
  };

  const onDragOver = (index) => {
    if (draggedItem === index) return;
    
    const newEvents = [...sortedActiveEvents];
    const item = newEvents.splice(draggedItem, 1)[0];
    newEvents.splice(index, 0, item);
    
    setDraggedItem(index);
    
    // Update de volgorde in de database
    const newOrderMap = {};
    newEvents.forEach((name, idx) => {
      newOrderMap[name] = idx;
    });
    
    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { 
      eventOrder: newOrderMap 
    });
  };

  const onDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDraggedItem(null);
  };

  return (
    <div style={styles.mainWrapper}>
      {/* ... Header ... */}
      <div style={styles.layoutGrid}>
        {/* ... Sidebar ... */}

        <main style={styles.contentArea}>
          {selectedComp ? (
            <>
              {/* ... Wedstrijd Header Card ... */}

              {/* ONDERDELEN BALK MET DRAG & DROP */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginLeft: '0.2rem' }}>
                  ACTIEVE ONDERDELEN (SLEEP OM VOLGORDE TE WIJZIGEN)
                </span>
                <div style={styles.eventStrip}>
                  {sortedActiveEvents.map((ond, index) => {
                    const pCount = Object.values(participants).filter(p => p.events?.includes(ond) && !p.isPause).length;
                    const rCount = new Set(Object.values(participants).filter(p => p.events?.includes(ond)).map(p => p[`reeks_${ond.replace(/\s/g, '')}`])).size;

                    return (
                      <div 
                        key={ond}
                        draggable
                        onDragStart={(e) => onDragStart(e, index)}
                        onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
                        onDragEnd={onDragEnd}
                        style={{ 
                          ...styles.card, 
                          padding: '0.5rem 0.75rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          minWidth: '220px', 
                          cursor: 'grab',
                          borderColor: '#2563eb',
                          borderWidth: '2px',
                          position: 'relative'
                        }}
                      >
                        <GripVertical size={16} color="#cbd5e1" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 900 }}>{ond}</div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{pCount} skippers • {rCount} reeksen</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                           <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px' }} onClick={() => setShowUploadModal(ond)}>
                             <Upload size={12}/>
                           </button>
                           <button 
                            onClick={() => {
                              const newEvents = selectedComp.events.filter(e => e !== ond);
                              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                            }}
                            style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px' }}>
                             <X size={12}/>
                           </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Knop om nieuwe onderdelen toe te voegen (die nog niet actief zijn) */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                    {POSSIBLE_ONDERDELEN.filter(o => !selectedComp.events?.includes(o)).map(ond => (
                      <button 
                        key={ond}
                        onClick={() => {
                          const newEvents = [...(selectedComp.events || []), ond];
                          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', selectedComp.id), { events: newEvents });
                        }}
                        style={{ ...styles.btnSecondary, padding: '0.4rem 0.6rem', fontSize: '0.7rem', borderStyle: 'dashed' }}
                      >
                        + {ond}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ... Deelnemers Tabel ... */}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10rem' }}>Selecteer een wedstrijd.</div>
          )}
        </main>
      </div>
      {/* ... Modals ... */}
    </div>
  );
};
